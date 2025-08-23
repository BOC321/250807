// pages/surveys/take/[id].js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

/** ---------- helpers: parse JSONB or PG array strings ---------- */
function parsePgArrayString(str) {
  const inner = str.slice(1, -1); // remove { }
  if (!inner) return [];
  return inner.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
}
function parseChoices(value) {
  try {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) return arr.map(String);
      } catch {}
      if (value.startsWith('{') && value.endsWith('}')) {
        return parsePgArrayString(value).map(String);
      }
    }
  } catch {}
  return [];
}
function parseChoiceScores(value) {
  try {
    if (Array.isArray(value)) return value.map((n) => Number(n ?? 0));
    if (typeof value === 'string') {
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) return arr.map((n) => Number(n ?? 0));
      } catch {}
      if (value.startsWith('{') && value.endsWith('}')) {
        return parsePgArrayString(value).map((n) => Number(n ?? 0));
      }
    }
  } catch {}
  return [];
}

/** -------------------------------------------------------------- */

export default function TakeSurveyPage() {
  const router = useRouter();
  const { id: surveyId } = router.query;

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [flatQs, setFlatQs] = useState([]);
  const [respMap, setRespMap] = useState({});
  const [i, setI] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!surveyId) return;
    if (!supabase) {
      setError('Database connection not available.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError('');

        // 1) survey (must be published)
        const { data: s, error: sErr } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .eq('status', 'published')
          .single();
        if (sErr) throw sErr;
        setSurvey(s);

        // 2) categories (no join to question_options)
        const { data: cats, error: cErr } = await supabase
          .from('categories')
          .select('id, title, description, weight, order')
          .eq('survey_id', surveyId)
          .order('order', { ascending: true });
        if (cErr) throw cErr;

        const categoryIds = (cats || []).map((c) => c.id);

        // 3) questions (only choices + choice_scores)
        const { data: qs, error: qErr } = await supabase
          .from('questions')
          .select(
            'id, category_id, prompt, type, required, scorable, weight, order, max_score, choices, choice_scores'
          )
          .in('category_id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
          .order('order', { ascending: true });
        if (qErr) throw qErr;

        // normalize structure (options + optionScores)
        const normalized = (cats || []).map((c) => {
          const qsForCat = (qs || []).filter((q) => q.category_id === c.id);

          const normQs = qsForCat.map((q) => {
            const options = parseChoices(q.choices);
            const scoresArr = parseChoiceScores(q.choice_scores);
            const optionScores = {};
            options.forEach((label, idx) => {
              optionScores[label] = Number(scoresArr[idx] ?? 0);
            });
            return {
              id: String(q.id),
              categoryId: String(c.id),
              categoryTitle: c.title,
              prompt: q.prompt,
              required: !!q.required,
              type: 'radio', // your surveys: radio-only
              scorable: !!q.scorable,
              options,
              optionScores,
            };
          });

          return {
            id: String(c.id),
            title: c.title,
            description: c.description,
            weight: Number(c.weight ?? 1),
            questions: normQs,
          };
        });

        setCategories(normalized);
        const allQs = normalized.flatMap((c) => c.questions);
        setFlatQs(allQs);

        const init = {};
        allQs.forEach((q) => (init[q.id] = null));
        setRespMap(init);

        if (!allQs.length) {
          setError('This survey has no questions.');
        } else if (!allQs.some((q) => (q.options || []).length)) {
          setError('No questions with options found in this survey.');
        }
      } catch (e) {
        console.error('Load error:', e);
        setError(e.message || 'Failed to load survey.');
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  const currentQ = useMemo(() => flatQs[i] || null, [flatQs, i]);

  const isAnswered = (q, map = respMap) => {
    const v = map[q.id];
    return v !== null && v !== '';
  };

  // Auto-advance on pick; on last question submit with the updated map (prevents validation race)
  const onPick = (q, label) => {
    const nextMap = { ...respMap, [q.id]: label };
    setRespMap(nextMap);

    const last = i === flatQs.length - 1;
    if (last) {
      // slight delay allows radio UI to paint
      setTimeout(() => handleSubmit(nextMap), 50);
    } else {
      setTimeout(() => setI((prev) => prev + 1), 0);
    }
  };

  async function handleSubmit(mapOverride) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const map = mapOverride ?? respMap;

      // Validate required
      const missing = flatQs.filter((q) => q.required && !isAnswered(q, map));
      if (missing.length) {
        const firstIdx = flatQs.findIndex((q) => q.id === missing[0].id);
        if (firstIdx >= 0) setI(firstIdx);
        throw new Error('Please answer all required questions.');
      }

      const respondentId = uuidv4();

      // respondent (unique id per submission)
      const { error: rErr } = await supabase.from('respondents').insert({
        id: respondentId,
        survey_id: surveyId,
        survey_version: 1,
        consent: false,
        created_at: new Date().toISOString(),
      });
      if (rErr) throw rErr;

      // response row
      const { data: respRow, error: respErr } = await supabase
        .from('responses')
        .insert({
          survey_id: surveyId,
          respondent_id: respondentId,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (respErr) throw respErr;

      const responseId = respRow.id;

      // answers (score via optionScores[label])
      const answerRows = flatQs.map((q) => {
        const label = map[q.id];
        const score = q.scorable ? Number(q.optionScores[label] ?? 0) : null;
        return {
          response_id: responseId,
          respondent_id: respondentId,
          question_id: q.id,
          value: label,
          score,
        };
      });
      const { error: aErr } = await supabase.from('answers').insert(answerRows);
      if (aErr) throw aErr;

      // navigate to results
      router.push({
        pathname: `/surveys/results/${surveyId}`,
        query: { respondentId },
      });
    } catch (e) {
      console.error('Submit error:', e);
      setError(e.message || 'Failed to submit survey.');
      setSubmitting(false);
      submittingRef.current = false; // allow retry
    }
  }

  /** ------------------------------- UI ------------------------------- */
  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;
  if (!survey) return <div style={{ padding: '2rem' }}>Survey not found or not published.</div>;
  if (!currentQ) return <div style={{ padding: '2rem' }}>No questions available.</div>;

  const progress = Math.round(((i + 1) / flatQs.length) * 100);

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 4 }}>{survey.title}</h1>
      {survey.description && <p style={{ color: '#555', marginTop: 0 }}>{survey.description}</p>}

      {/* Progress */}
      <div style={{ margin: '1rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <small>
            Question {i + 1} of {flatQs.length}
          </small>
          <small>{progress}% complete</small>
        </div>
        <div style={{ height: 8, background: '#eee', borderRadius: 4, marginTop: 6 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#0d6efd', borderRadius: 4 }} />
        </div>
      </div>

      {/* Category */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <strong>{currentQ.categoryTitle}</strong>
      </div>

      {/* Question card */}
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600 }}>
            {currentQ.prompt}
            {currentQ.required && <span style={{ color: 'crimson' }}> *</span>}
          </label>
        </div>

        {/* Radio list — choosing an option auto-advances (and auto-submits on last) */}
        <div style={{ display: 'grid', gap: 8 }}>
          {(currentQ.options || []).map((opt, idx) => {
            const checked = respMap[currentQ.id] === opt;
            return (
              <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`q-${currentQ.id}`}
                  value={opt}
                  checked={checked}
                  onChange={() => onPick(currentQ, opt)}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* No Submit button: the last pick triggers submission automatically */}

      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}
      {submitting && <div style={{ marginTop: 12 }}>Submitting…</div>}
    </div>
  );
}
