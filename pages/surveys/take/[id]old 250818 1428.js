// pages/surveys/take/[id].js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

/** ---------- helpers to read choices stored as JSON or PG array strings ---------- */
function parsePgArrayString(str) {
  const inner = str.slice(1, -1); // strip { }
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

/** Build a public URL for an object in the `assets` bucket (bucket is public). */
function getPublicImageUrl(pathInBucket) {
  if (!supabase || !pathInBucket) return null;
  const { data } = supabase.storage.from('assets').getPublicUrl(pathInBucket);
  return data?.publicUrl || null; // e.g. https://<proj>.supabase.co/storage/v1/object/public/assets/...
}

export default function TakeSurveyPage() {
  const router = useRouter();
  const { id: surveyId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [survey, setSurvey] = useState(null);
  const [flatQs, setFlatQs] = useState([]);
  const [i, setI] = useState(0);             // active question index
  const [answers, setAnswers] = useState({}); // { [questionId]: label }

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

        // 1) Survey (published)
        const { data: s, error: sErr } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .eq('status', 'published')
          .single();
        if (sErr) throw sErr;
        setSurvey(s);

        // 2) Categories (need title + description for the left column)
        const { data: cats, error: cErr } = await supabase
          .from('categories')
          .select('id, title, description, weight, order')
          .eq('survey_id', surveyId)
          .order('order', { ascending: true });
        if (cErr) throw cErr;

        // 3) Questions (pull choices + image_path)
        const catIds = (cats || []).map((c) => c.id);
        const { data: qs, error: qErr } = await supabase
          .from('questions')
          .select('id, category_id, prompt, type, required, scorable, weight, order, max_score, choices, choice_scores, image_path')
          .in('category_id', catIds.length ? catIds : ['00000000-0000-0000-0000-000000000000'])
          .order('order', { ascending: true });
        if (qErr) throw qErr;

        // 4) Normalise to a flat array in the order: categories.order, then questions.order
        const flat = [];
        (cats || []).forEach((c) => {
          const qsForCat = (qs || []).filter((q) => q.category_id === c.id);
          qsForCat.forEach((q) => {
            const options = parseChoices(q.choices);
            const scores = parseChoiceScores(q.choice_scores);
            const optionScores = {};
            options.forEach((label, idx) => (optionScores[label] = Number(scores[idx] ?? 0)));
            flat.push({
              id: String(q.id),
              categoryId: String(c.id),
              categoryTitle: c.title,
              categoryDescription: c.description,
              prompt: q.prompt,
              options,
              optionScores,
              required: !!q.required,
              scorable: !!q.scorable,
              imagePath: q.image_path || null,
            });
          });
        });

        setFlatQs(flat);
        const init = {};
        flat.forEach((q) => (init[q.id] = null));
        setAnswers(init);

        if (!flat.length) setError('This survey has no questions.');
      } catch (e) {
        console.error(e);
        setError(e.message || 'Failed to load survey.');
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  const currentQ = useMemo(() => flatQs[i] || null, [flatQs, i]);
  const progress = useMemo(() => (flatQs.length ? Math.round(((i + 1) / flatQs.length) * 100) : 0), [flatQs, i]);
  const imgUrl = currentQ?.imagePath ? getPublicImageUrl(currentQ.imagePath) : null;

  const onPick = (label) => {
    if (!currentQ) return;
    const next = { ...answers, [currentQ.id]: label };
    setAnswers(next);

    // Auto-advance to next question
    if (i < flatQs.length - 1) {
      setTimeout(() => setI((v) => v + 1), 0);
    } else {
      // Last question reached — keep UX simple; you can submit here if you like.
      // e.g., call your existing submit handler.
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;
  if (error) return <div style={{ padding: '2rem', color: 'crimson' }}>{error}</div>;
  if (!survey || !currentQ) return <div style={{ padding: '2rem' }}>Nothing to display.</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#fbf4e9', minHeight: '100vh' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'start',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* LEFT: Title (category) → Description (category) → Prompt → Options → Progress */}
        <div style={{ paddingRight: 12 }}>
          {/* Category Title where “CONTEXT” was */}
          {currentQ.categoryTitle ? (
            <div style={{ letterSpacing: 1, fontSize: 12, textTransform: 'uppercase', color: '#555', marginBottom: 16 }}>
              {currentQ.categoryTitle}
            </div>
          ) : null}

          {/* Category Description where guidance text was */}
          {currentQ.categoryDescription ? (
            <div style={{ color: '#666', lineHeight: 1.6, marginBottom: 24 }}>
              {currentQ.categoryDescription}
            </div>
          ) : null}

          {/* Question prompt — large */}
          <h2 style={{ fontSize: 36, lineHeight: 1.25, fontWeight: 600, margin: '0 0 28px 0', color: '#333' }}>
            {currentQ.prompt}
          </h2>

          {/* Three options horizontally (use first 3 options from the question) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
              gap: 24,
              alignItems: 'center',
              marginBottom: 40,
            }}
          >
            {(currentQ.options || []).slice(0, 3).map((opt, idx) => {
              const checked = answers[currentQ.id] === opt;
              return (
                <label
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: '#333',
                  }}
                >
                  <input
                    type="radio"
                    name={`q-${currentQ.id}`}
                    value={opt}
                    checked={checked}
                    onChange={() => onPick(opt)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>

          {/* Progress where “0% Complete” sits */}
          <div style={{ textAlign: 'center', color: '#333' }}>
            <small>{progress}% Complete</small>
          </div>
        </div>

        {/* RIGHT: Per-question image from public assets bucket */}
        <div style={{ width: '100%' }}>
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', paddingTop: '56.25%', background: '#eaeaea', borderRadius: 4 }} />
          )}
        </div>
      </div>

      {/* Survey footer bottom-right */}
      {survey?.survey_footer ? (
        <div style={{ maxWidth: 1200, margin: '24px auto 0', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 12, color: '#2c6fb7' }}>{survey.survey_footer}</div>
        </div>
      ) : null}
    </div>
  );
}
