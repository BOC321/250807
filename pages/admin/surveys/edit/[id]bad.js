// pages/admin/surveys/edit/[id].js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

export default function SurveyEditor() {
  const router = useRouter();
  const surveyId = router.query.id ? String(router.query.id) : '';

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [choicesText, setChoicesText] = useState('Definitely, Kind of, Not really');
  const [imageUrl, setImageUrl] = useState('');

  // NEW: survey footer
  const [surveyFooter, setSurveyFooter] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Load survey + categories
  useEffect(() => {
    (async () => {
      if (!supabase || !surveyId) return;
      try {
        setLoading(true);

        const [{ data: s }, { data: cats }] = await Promise.all([
          supabase
            .from('surveys')
            .select('id, title, logo_url, footer_text')
            .eq('id', surveyId)
            .single(),
          supabase
            .from('categories')
            .select('id, title, description, order_index')
            .eq('survey_id', surveyId)
            .order('order_index', { ascending: true }),
        ]);

        setSurvey(s || null);
        setSurveyFooter(s?.footer_text || '© Copyright ' + new Date().getFullYear() + ' – All rights reserved');

        setCategories(cats || []);
        const firstCat = (cats && cats[0]) ? cats[0].id : '';
        setSelectedCategoryId(firstCat);
      } catch (e) {
        console.error(e);
        setMsg(e.message || 'Failed to load survey.');
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  // When category changes, load its questions + hydrate form
  useEffect(() => {
    (async () => {
      if (!supabase || !selectedCategoryId) return;
      try {
        const { data: qs } = await supabase
          .from('questions')
          .select('id, title, category_id, image_url, options')
          .eq('category_id', selectedCategoryId)
          .order('id', { ascending: true });

        setQuestions(qs || []);
        const cat = categories.find(c => c.id === selectedCategoryId);
        setCategoryTitle(cat?.title || '');
        setCategoryDesc(cat?.description || '');

        const firstQ = (qs && qs[0]) ? qs[0] : null;
        if (firstQ) {
          setSelectedQuestionId(firstQ.id);
          setQuestionPrompt(firstQ.title || '');
          setImageUrl(firstQ.image_url || '');
          const opts = Array.isArray(firstQ.options) ? firstQ.options : [];
          setChoicesText(opts.length ? opts.join(', ') : 'Definitely, Kind of, Not really');
        } else {
          setSelectedQuestionId('');
          setQuestionPrompt('');
          setImageUrl('');
          setChoicesText('Definitely, Kind of, Not really');
        }
      } catch (e) {
        console.error(e);
        setMsg(e.message || 'Failed to load questions.');
      }
    })();
  }, [selectedCategoryId, categories]);

  // When question changes via dropdown, hydrate fields
  useEffect(() => {
    const q = questions.find(q => q.id === selectedQuestionId);
    if (!q) return;
    setQuestionPrompt(q.title || '');
    setImageUrl(q.image_url || '');
    const opts = Array.isArray(q.options) ? q.options : [];
    setChoicesText(opts.length ? opts.join(', ') : 'Definitely, Kind of, Not really');
  }, [selectedQuestionId, questions]);

  const choices = useMemo(() => {
    return choicesText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [choicesText]);

  async function saveSurvey() {
    if (!supabase || !surveyId) return;
    setSaving(true); setMsg('');
    try {
      const { data: updated, error } = await supabase
        .from('surveys')
        .update({ footer_text: surveyFooter })
        .eq('id', surveyId)
        .select('id, title, logo_url, footer_text')
        .single();
      if (error) throw error;
      setSurvey(updated || null);
      setMsg('Survey saved.');
    } catch (e) {
      setMsg(e.message || 'Survey save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!supabase || !selectedCategoryId) return;
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase
        .from('categories')
        .update({ title: categoryTitle, description: categoryDesc })
        .eq('id', selectedCategoryId);
      if (error) throw error;
      setMsg('Category saved.');

      // refresh list
      const { data: cats } = await supabase
        .from('categories')
        .select('id, title, description, order_index')
        .eq('survey_id', surveyId)
        .order('order_index', { ascending: true });
      setCategories(cats || []);
    } catch (e) {
      setMsg(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion() {
    if (!supabase || !selectedQuestionId) return;
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          title: questionPrompt,
          image_url: imageUrl || null,
          options: choices, // jsonb[]
        })
        .eq('id', selectedQuestionId);
      if (error) throw error;
      setMsg('Question saved.');
    } catch (e) {
      setMsg(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = `surveys/${surveyId}/questions/${selectedQuestionId}/${encodeURIComponent(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = await supabase.storage.from('assets').getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      setMsg('Image uploaded.');
    } catch (e) {
      console.error(e);
      setMsg(e.message || 'Upload failed.');
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ background: '#f5ecdc', minHeight: '100vh' }}>
      <Head>
        <title>Edit Survey</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '24px 20px',
          fontFamily:
            'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <h1 style={{ margin: 0 }}>{survey?.title || 'Survey'}</h1>
          <span style={{ color: '#6b6b6b' }}>Editor</span>
        </div>

        {/* Top selectors */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <label>
            Category:&nbsp;
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.id}
                </option>
              ))}
            </select>
          </label>

          <label>
            Question:&nbsp;
            <select
              value={selectedQuestionId}
              onChange={(e) => setSelectedQuestionId(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
            >
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title || q.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Two-column editor + live preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 24 }}>
          {/* LEFT */}
          <div
            style={{
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid #eadfcb',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: '#6b6b6b', marginBottom: 6 }}>
              CATEGORY
            </div>

            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>
              Title (aligns with “CONTEXT”)
            </label>
            <input
              value={categoryTitle}
              onChange={(e) => setCategoryTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d2c5',
                borderRadius: 6,
                marginBottom: 14,
              }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>
              Description (aligns with instruction sentence)
            </label>
            <textarea
              value={categoryDesc}
              onChange={(e) => setCategoryDesc(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d2c5',
                borderRadius: 6,
                marginBottom: 14,
              }}
            />

            {/* NEW: Survey footer (between Description and the rest) */}
            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>
              Survey footer (aligns with bottom-right copyright)
            </label>
            <input
              type="text"
              value={surveyFooter}
              onChange={(e) => setSurveyFooter(e.target.value)}
              placeholder="© Copyright 2025 – Kate Christiansen – All rights reserved"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d2c5',
                borderRadius: 6,
                marginBottom: 20,
              }}
            />

            <div style={{ height: 12 }} />

            <div style={{ fontSize: 12, letterSpacing: 1.5, color: '#6b6b6b', marginBottom: 6 }}>
              QUESTION
            </div>
            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>
              Prompt (aligns with big statement)
            </label>
            <textarea
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d2c5',
                borderRadius: 6,
                marginBottom: 14,
              }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>
              Choices (comma-separated)
            </label>
            <input
              value={choicesText}
              onChange={(e) => setChoicesText(e.target.value)}
              placeholder="Definitely, Kind of, Not really"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d2c5',
                borderRadius: 6,
                marginBottom: 14,
              }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#555' }}>Hero image</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://.../assets/..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d9d2c5',
                  borderRadius: 6,
                }}
              />
              <label
                style={{
                  padding: '10px 12px',
                  background: '#111827',
                  color: '#fff',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Upload
                <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={saveSurvey}
                disabled={saving || !surveyId}
                style={{
                  padding: '10px 14px',
                  background: '#111827',
                  color: '#fff',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Save survey
              </button>

              <button
                onClick={saveCategory}
                disabled={saving || !selectedCategoryId}
                style={{
                  padding: '10px 14px',
                  background: '#374151',
                  color: '#fff',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Save category
              </button>

              <button
                onClick={saveQuestion}
                disabled={saving || !selectedQuestionId}
                style={{
                  padding: '10px 14px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Save question
              </button>

              <div
                style={{
                  marginLeft: 'auto',
                  color: msg.includes('fail') ? '#b00020' : '#0a7',
                  alignSelf: 'center',
                }}
              >
                {msg}
              </div>
            </div>
          </div>

          {/* RIGHT: live preview */}
          <LivePreview
            survey={survey}
            categoryTitle={categoryTitle || 'CONTEXT'}
            categoryDesc={
              categoryDesc ||
              'Click the response below that best reflects your experience based on the statement.'
            }
            prompt={
              questionPrompt || 'We’ve been through a lot of change and there’s more coming.'
            }
            choices={choices.length ? choices : ['Definitely', 'Kind of', 'Not really']}
            imageUrl={imageUrl}
            footerText={surveyFooter}
          />
        </div>
      </div>
    </div>
  );
}

// --- Preview component ---
function LivePreview({ survey, categoryTitle, categoryDesc, prompt, choices, imageUrl, footerText }) {
  const colors = {
    bg: '#f5ecdc',
    text: '#2b2b2b',
    muted: '#6b6b6b',
    button: '#f6f1e7',
    hover: '#e6dccb',
  };

  return (
    <div
      style={{
        background: colors.bg,
        border: '1px solid #eadfcb',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',           // for bottom-right footer positioning
        minHeight: 520,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: 24,
          alignItems: 'center',
          padding: 18,
        }}
      >
        <div>
          <div
            style={{ letterSpacing: 2, fontSize: 12, color: colors.muted, marginTop: 6, marginBottom: 12 }}
          >
            {categoryTitle || 'CONTEXT'}
          </div>
          <div style={{ color: colors.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
            {categoryDesc}
          </div>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontWeight: 600,
              fontSize: 34,
              lineHeight: 1.3,
              margin: '18px 0 24px',
              maxWidth: 640,
            }}
          >
            {prompt}
          </h1>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '10px 0 16px' }}>
            {choices.map((opt) => (
              <button
                key={opt}
                style={{
                  border: '1px solid #d9d2c5',
                  background: colors.button,
                  padding: '10px 16px',
                  borderRadius: 999,
                  cursor: 'default',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = colors.button)}
              >
                {opt}
              </button>
            ))}
          </div>

          <div style={{ color: colors.muted, fontSize: 13 }}>0% Complete</div>
        </div>

        <div style={{ width: '100%', height: '56vh', minHeight: 360 }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#d9d9d9',
                borderRadius: 4,
                display: 'grid',
                placeItems: 'center',
                color: '#555',
              }}
            >
              (Preview) Add an image URL or upload
            </div>
          )}
        </div>
      </div>

      {/* Bottom-right footer (aligned) */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 12,
          color: '#0b5ea8',
          fontSize: 14,
          textAlign: 'right',
          maxWidth: '60%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={footerText}
      >
        {footerText}
      </div>
    </div>
  );
}
