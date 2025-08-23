// pages/surveys/results/[id].js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

export default function SurveyResultsPage() {
  const router = useRouter();
  const routeSurveyId = router.query.id ? String(router.query.id) : '';
  const respondentId = router.query.respondentId ? String(router.query.respondentId) : '';

  const [surveyId, setSurveyId] = useState(routeSurveyId);
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [serveUrl, setServeUrl] = useState('');
  const [error, setError] = useState('');

  // Keep surveyId in sync with the route param
  useEffect(() => {
    setSurveyId(routeSurveyId || '');
  }, [routeSurveyId]);

  // Load everything; if the route surveyId is missing/wrong, resolve it via respondents.survey_id
  useEffect(() => {
    (async () => {
      if (!supabase || !respondentId) {
        setLoading(false);
        return;
      }
      try {
        // 0) Resolve surveyId if needed
        let effSurveyId = surveyId;
        if (!effSurveyId) {
          const { data: respRow, error: respErr } = await supabase
            .from('respondents')
            .select('survey_id')
            .eq('id', respondentId)
            .single();
          if (respErr) throw respErr;
          effSurveyId = respRow?.survey_id || '';
          setSurveyId(effSurveyId);
        }

        // 1) Survey
        const { data: s, error: sErr } = await supabase
          .from('surveys')
          .select('id, title')
          .eq('id', effSurveyId)
          .single();

        // If the route surveyId was wrong, try deriving from respondents then re-run
        if (sErr) {
          const { data: respRow2 } = await supabase
            .from('respondents')
            .select('survey_id')
            .eq('id', respondentId)
            .single();
          if (respRow2?.survey_id && respRow2.survey_id !== effSurveyId) {
            setSurveyId(respRow2.survey_id);
            return; // dependency change will re-run
          }
          throw sErr;
        }
        setSurvey(s);

        // 2) Categories
        const { data: cats, error: cErr } = await supabase
          .from('categories')
          .select('id, title')
          .eq('survey_id', s.id);
        if (cErr) throw cErr;

        const catIds = (cats || []).map(c => c.id);

        // 3) Questions
        const { data: qs, error: qErr } = await supabase
          .from('questions')
          .select('id, category_id')
          .in('category_id', catIds.length ? catIds : ['00000000-0000-0000-0000-000000000000']);
        if (qErr) throw qErr;

        // 4) Answers for this respondent
        const { data: ans, error: aErr } = await supabase
          .from('answers')
          .select('question_id, value, created_at')
          .eq('respondent_id', respondentId);
        if (aErr) throw aErr;

        setCategories(cats || []);
        setQuestions(qs || []);
        setAnswers(ans || []);
        setError('');
      } catch (e) {
        console.error(e);
        setError(e?.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId, respondentId]);

  // --- scoring helpers ---
  function parseScore(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const s = String(val).trim().toLowerCase();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
    const map = {
      'definitely': 3, 'kind of': 2, 'kinda': 2, 'not at all': 1,
      'extremely likely': 3, 'somewhat likely': 2, 'unlikely': 1,
      'strongly agree': 5, 'agree': 4, 'neutral': 3, 'disagree': 2, 'strongly disagree': 1,
      'yes': 1, 'no': 0, 'true': 1, 'false': 0,
    };
    return map[s] ?? null;
  }

  // latest answer per question
  const latestAnswerByQ = useMemo(() => {
    const m = new Map();
    for (const a of answers || []) {
      const prev = m.get(a.question_id);
      if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
        m.set(a.question_id, a);
      }
    }
    return m;
  }, [answers]);

  // per-category % (0–100) using observed min/max for that category's questions
  const categoryPercents = useMemo(() => {
    if (!categories?.length) return {};
    const titleByCatId = new Map(categories.map(c => [c.id, c.title]));
    const scoresByTitle = {};
    for (const q of questions || []) {
      const a = latestAnswerByQ.get(q.id);
      if (!a) continue;
      const score = parseScore(a.value);
      if (score === null) continue;
      const title = titleByCatId.get(q.category_id);
      if (!title) continue;
      (scoresByTitle[title] ||= []).push(score);
    }
    const result = {};
    for (const [title, arr] of Object.entries(scoresByTitle)) {
      if (!arr.length) { result[title] = 0; continue; }
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
      const pct = max === min ? (avg > min ? 100 : 0) : ((avg - min) / (max - min)) * 100;
      result[title] = Number(pct.toFixed(2));
    }
    for (const c of categories) {
      if (result[c.title] === undefined) result[c.title] = 0;
    }
    return result;
  }, [categories, questions, latestAnswerByQ]);

  // userResponses map
  const userResponses = useMemo(() => {
    const map = {};
    for (const a of answers || []) map[a.question_id] = a.value;
    return map;
  }, [answers]);

  // --- send email/pdf ---
  async function onSendEmail(e) {
    e.preventDefault();
    setSendMessage('');
    if (!/\S+@\S+\.\S+/.test(email)) {
      setSendMessage('Please enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      // per-survey → global → none
      let template = null;
      try {
        if (typeof window !== 'undefined') {
          const keys = [`report-template:${surveyId}`, `report-template:global`];
          for (const k of keys) {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') { template = parsed; break; }
            }
          }
        }
      } catch {}

      const resp = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          respondentId,
          email,
          categoryScores: categoryPercents,
          userResponses,
          template,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Failed to generate report');
      if (data?.serveUrl) setServeUrl(data.serveUrl);
      setSendMessage(
  data?.emailSent
    ? 'Report generated and emailed to you.'
     : `Report generated. ${data?.emailMessage || 'Email not confirmed as sent.'}`
    );
    } catch (err) {
      console.error(err);
      setSendMessage(`Failed to generate: ${err?.message || String(err)}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{survey?.title || 'Survey'}</h1>
          <div style={{ color: '#666' }}>
            Respondent: <code>{respondentId}</code>
          </div>
          {error ? <div style={{ marginTop: 8, color: 'crimson' }}>Error: {error}</div> : null}
          {surveyId ? <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>Using surveyId: <code>{surveyId}</code></div> : null}
        </div>
      </header>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Results</h2>
        <div style={{ marginTop: 8 }}>
          <pre style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
{JSON.stringify({ categoryPercents, userResponses }, null, 2)}
          </pre>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Email PDF</h2>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6 }}
          />
          <button
            onClick={onSendEmail}
            disabled={sending}
            style={{
              padding: '10px 16px',
              background: sending ? '#9aa3af' : '#111827',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: sending ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Email me the PDF'}
          </button>
        </div>
        <div style={{ marginTop: 8, color: sendMessage.includes('Failed') ? '#b00020' : '#0a7' }}>
          {sendMessage}
        </div>

        {serveUrl ? (
          <div style={{ marginTop: 10 }}>
            <a href={serveUrl} target="_blank" rel="noreferrer">
              View report
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
