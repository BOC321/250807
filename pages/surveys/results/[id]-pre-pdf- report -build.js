// pages/surveys/results/[id].js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase client (browser) ----------
const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

// ---------- Helpers ----------
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function parsePgArrayString(s) {
  // Handles: {"A","B","C"} or {1,2,3}
  if (typeof s !== 'string') return null;
  if (!(s.startsWith('{') && s.endsWith('}'))) return null;
  const inner = s.slice(1, -1);
  if (!inner.trim()) return [];
  // Split respecting simple quoted items:
  // remove leading/trailing quotes from each piece
  return inner
    .split(',')
    .map((raw) => raw.trim())
    .map((raw) => raw.replace(/^"(.*)"$/, '$1'));
}

function parseJsonOrPgArray(maybe) {
  if (maybe == null) return [];
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === 'string') {
    // Try JSON first
    try {
      const v = JSON.parse(maybe);
      if (Array.isArray(v)) return v;
    } catch {
      // not JSON — try PG array string
      const pg = parsePgArrayString(maybe);
      if (Array.isArray(pg)) return pg;
    }
    return [];
  }
  return [];
}

function asNumberArray(arr) {
  return arr
    .map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    })
    .filter((v) => v !== null);
}

function pickRange(percentage, ranges) {
  const p = Math.round(Number(percentage || 0));
  if (!Array.isArray(ranges)) return null;
  return ranges.find((r) => p >= Number(r.min_score) && p <= Number(r.max_score)) || null;
}

// ---------- UI bits ----------
function Chip({ color = '#999', children }) {
  return (
    <div
      style={{
        marginTop: 6,
        padding: '10px 12px',
        borderLeft: `4px solid ${color}`,
        background: '#f8f9fa',
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}

// ======================================================
// Results Page
// ======================================================
export default function SurveyResultsPage() {
  const router = useRouter();
  const { id: surveyId, respondentId } = router.query;

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);

  const [categories, setCategories] = useState([]); // [{id,title,questions:[...] }]
  const [answers, setAnswers] = useState([]); // [{question_id, score, value, ...}]
  const [scoreRangesByCat, setScoreRangesByCat] = useState({}); // {catId: [ranges]}
  const [totalRanges, setTotalRanges] = useState([]); // [{min_score,max_score,description,color}]

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [serveUrl, setServeUrl] = useState('');

  const [error, setError] = useState(null);

  // -------- Fetch all data --------
  useEffect(() => {
    if (!supabase) {
      setError('Database connection not available');
      setLoading(false);
      return;
    }
    if (!surveyId || !respondentId) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        // 1) Survey
        const { data: surveyData, error: sErr } = await supabase
          .from('surveys')
          .select('id, title, description')
          .eq('id', surveyId)
          .single();
        if (sErr) throw sErr;
        if (cancelled) return;
        setSurvey(surveyData);

        // 2) Categories (try order by 'order', else retry without)
        let { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id, title, survey_id')
          .eq('survey_id', surveyId)
          .order('order', { ascending: true });

        if (catErr && String(catErr.code) === '42703') {
          ({ data: catData, error: catErr } = await supabase
            .from('categories')
            .select('id, title, survey_id')
            .eq('survey_id', surveyId));
        }
        if (catErr) throw catErr;
        if (cancelled) return;

        const catIds = (catData || []).map((c) => c.id);
        // 3) Questions (no join to question_options)
        //    Try order by 'order', else retry without
        let { data: qData, error: qErr } = await supabase
          .from('questions')
          .select('id, category_id, prompt, type, required, weight, max_score, choices, choice_scores')
          .in('category_id', catIds)
          .order('order', { ascending: true });

        if (qErr && String(qErr.code) === '42703') {
          ({ data: qData, error: qErr } = await supabase
            .from('questions')
            .select('id, category_id, prompt, type, required, weight, max_score, choices, choice_scores')
            .in('category_id', catIds));
        }
        if (qErr) throw qErr;
        if (cancelled) return;

        // 4) Answers for this respondent
        const { data: aData, error: aErr } = await supabase
          .from('answers')
          .select('question_id, score, value')
          .eq('respondent_id', respondentId);
        if (aErr) throw aErr;
        if (cancelled) return;

        // 5) Score ranges (category + total)
        const { data: catRanges, error: rCatErr } = await supabase
          .from('score_ranges')
          .select('*')
          .eq('survey_id', surveyId)
          .not('category_id', 'is', null);
        if (rCatErr) throw rCatErr;

        const { data: totRanges, error: rTotErr } = await supabase
          .from('score_ranges')
          .select('*')
          .eq('survey_id', surveyId)
          .is('category_id', null);
        if (rTotErr) throw rTotErr;

        if (cancelled) return;

        // Attach questions to categories
        const catsWithQs = (catData || []).map((c) => ({
          ...c,
          questions: (qData || []).filter((q) => q.category_id === c.id),
        }));

        const rangesByCat = {};
        (catRanges || []).forEach((r) => {
          if (!rangesByCat[r.category_id]) rangesByCat[r.category_id] = [];
          rangesByCat[r.category_id].push(r);
        });

        setCategories(catsWithQs);
        setAnswers(aData || []);
        setScoreRangesByCat(rangesByCat);
        setTotalRanges(totRanges || []);
      } catch (e) {
        console.error('Error loading results page data:', e);
        setError(e.message || 'Failed to load results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [surveyId, respondentId]);

  // -------- Compute normalized category percentages + total --------
  const { categoryPercents, totalPercent, userResponses } = useMemo(() => {
    if (!categories.length) return { categoryPercents: {}, totalPercent: 0, userResponses: {} };

    // Index answers
    const ansByQ = new Map();
    (answers || []).forEach((a) => ansByQ.set(a.question_id, a));

    const perCat = {};
    const responses = {};

    categories.forEach((cat) => {
      let normSum = 0;
      let qCount = 0;

      cat.questions.forEach((q) => {
        // record response (for the PDF table)
        const a = ansByQ.get(q.id);
        if (a) {
          responses[q.id] = a.value != null ? a.value : '';
        }

        // scoring
        // Determine min/max for this question
        const scoresArr = asNumberArray(parseJsonOrPgArray(q.choice_scores));
        const hasChoiceScores = scoresArr.length > 0;

        const qMin = hasChoiceScores ? Math.min(...scoresArr) : 0;
        const qMax = hasChoiceScores
          ? Math.max(...scoresArr)
          : Number.isFinite(Number(q.max_score))
          ? Number(q.max_score)
          : 1;

        const raw = Number(a?.score ?? 0);

        let normalized;
        if (qMax === qMin) {
          // Degenerate range => if any positive raw treat as 1, else 0
          normalized = raw > qMin ? 1 : 0;
        } else {
          normalized = clamp((raw - qMin) / (qMax - qMin), 0, 1);
        }

        normSum += normalized;
        qCount += 1;
      });

      const pct = qCount > 0 ? (normSum / qCount) * 100 : 0;
      perCat[cat.title] = pct;
    });

    const values = Object.values(perCat);
    const total =
      values.length > 0 ? values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) / values.length : 0;

    return { categoryPercents: perCat, totalPercent: total, userResponses: responses };
  }, [categories, answers]);

  // -------- Build annotated rows with range descriptions --------
  const annotated = useMemo(() => {
    const rows = categories.map((cat) => {
      const pct = Number(categoryPercents[cat.title] || 0);
      const ranges = scoreRangesByCat[cat.id] || [];
      const r = pickRange(pct, ranges);
      return {
        id: cat.id,
        title: cat.title,
        pct,
        rangeDesc: r?.description || null,
        rangeColor: r?.color || '#999',
      };
    });
    const totalR = pickRange(totalPercent, totalRanges);
    return {
      rows,
      totalRangeDesc: totalR?.description || null,
      totalRangeColor: totalR?.color || '#999',
    };
  }, [categories, categoryPercents, totalPercent, scoreRangesByCat, totalRanges]);

  // -------- Email/PDF handler --------
  async function onSendEmail(e) {
    e.preventDefault();
    setSendMessage('');
    if (!/\S+@\S+\.\S+/.test(email)) {
      setSendMessage('Please enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      const resp = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          respondentId,
          email,
          categoryScores: categoryPercents, // { "Category Title": percent }
          userResponses, // { questionId: value }
        }),
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {
        throw new Error(`The server returned an unexpected response (status ${resp.status}).`);
      }

      if (!resp.ok) throw new Error(data?.error || 'Failed to generate report');

      if (data?.serveUrl) setServeUrl(data.serveUrl);
      setSendMessage(
        data?.emailSent
          ? 'Report generated and emailed to you.'
          : 'Report generated. Email could not be sent — use the link below to download.'
      );
    } catch (err) {
      console.error('Error sending email / generating report:', err);
      setSendMessage(err?.message || 'Failed to generate/send report.');
    } finally {
      setSending(false);
    }
  }

  // ---------- Render ----------
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: 'crimson' }}>Error: {error}</div>;
  if (!survey) return <div style={{ padding: 24 }}>Survey not found</div>;
  if (!respondentId) return <div style={{ padding: 24 }}>Missing respondentId in the URL.</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 4 }}>{survey.title}</h1>
      {/* ✅ Intentionally NO respondent ID displayed */}

      {/* Total */}
      <section style={{ marginTop: 16, paddingTop: 8 }}>
        <h2 style={{ margin: '12px 0' }}>Total Score</h2>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{totalPercent.toFixed(2)}%</div>
        {annotated.totalRangeDesc ? <Chip color={annotated.totalRangeColor}>{annotated.totalRangeDesc}</Chip> : null}
      </section>

      {/* Categories */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: '12px 0' }}>Category Scores</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {annotated.rows.map((row) => (
            <div key={row.id} style={{ padding: 12, border: '1px solid #e6e6e6', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 600 }}>{row.title}</div>
                <div style={{ fontFamily: 'tabular-nums, ui-monospace, monospace' }}>
                  {row.pct.toFixed(2)}%
                </div>
              </div>
              {row.rangeDesc ? <Chip color={row.rangeColor}>{row.rangeDesc}</Chip> : null}
            </div>
          ))}
        </div>
      </section>

      {/* Email form */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ margin: '12px 0' }}>Get the PDF report by email</h2>
        <form onSubmit={onSendEmail} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              flex: '1 1 260px',
              padding: '10px 12px',
              border: '1px solid #ccc',
              borderRadius: 6,
              minWidth: 220,
            }}
          />
          <button
            type="submit"
            disabled={sending}
            style={{
              padding: '10px 14px',
              background: '#0070f3',
              color: 'white',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Email me the PDF'}
          </button>
        </form>

        {sendMessage ? (
          <div style={{ marginTop: 10, color: sendMessage.toLowerCase().includes('fail') ? 'crimson' : '#0a7' }}>
            {sendMessage}
          </div>
        ) : null}

        {serveUrl ? (
          <div style={{ marginTop: 10 }}>
            <a href={serveUrl} target="_blank" rel="noreferrer">
              Download your report
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
