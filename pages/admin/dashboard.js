// pages/admin/dashboard.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import ScoreRangesManager from './ScoreRangesManager'; // keep your existing relative path

// Only create Supabase client if environment variables are available
const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

export default function Dashboard() {
  const router = useRouter();

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // local “edit” state used to render ScoreRangesManager like your current page
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [categories, setCategories] = useState([]);

  // ---------------------------
  // Load surveys
  // ---------------------------
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setError('Supabase client not initialized. Please check environment variables.');
          setLoading(false);
          return;
        }
        const { data, error: qErr } = await supabase
          .from('surveys')
          .select('id, title, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (qErr) throw qErr;
        setSurveys(data || []);
      } catch (e) {
        setError(e.message || 'Failed to load surveys.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------------------------
  // Helpers
  // ---------------------------
  function fmtDate(d) {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d || '');
    }
  }

  // Load categories for ScoreRangesManager panel when a survey is selected
  async function loadCategoriesForSurvey(surveyId) {
    if (!supabase || !surveyId) return;
    
    try {
      // First, let's try to get ANY category to see what columns exist
      const { data: testData, error: testError } = await supabase
        .from('categories')
        .select('*')
        .eq('survey_id', surveyId)
        .limit(1);
      
      if (testError) {
        console.error('Error testing categories table:', testError);
        setError(`Database error: ${testError.message}`);
        return;
      }
      
      if (testData && testData.length > 0) {
        console.log('Available columns in categories table:', Object.keys(testData[0]));
        console.log('Sample category data:', testData[0]);
        
        // Now try the actual query with available columns
        const { data, error: catErr } = await supabase
          .from('categories')
          .select('id, title') // Start with just basic columns
          .eq('survey_id', surveyId);
          // Remove ordering for now to test basic functionality
        
        if (!catErr && data) {
          console.log('Successfully loaded categories:', data);
          setCategories(data);
        } else {
          console.error('Error loading categories:', catErr);
          setError(`Failed to load categories: ${catErr?.message}`);
        }
      } else {
        console.log('No categories found for this survey');
        setCategories([]);
      }
    } catch (err) {
      console.error('Exception in loadCategoriesForSurvey:', err);
      setError(`Unexpected error: ${err.message}`);
    }
  }

  // ---------------------------
  // Create survey (basic default)
  // ---------------------------
  async function createSurvey() {
    try {
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        return;
      }
      setCreating(true);
      const title = `Untitled survey ${new Date().toLocaleString()}`;
      const { data, error: insErr } = await supabase
        .from('surveys')
        .insert([{ title }])
        .select('id, title, created_at, updated_at')
        .single();

      if (insErr) throw insErr;

      setSurveys(prev => [data, ...prev]);
    } catch (e) {
      setError(e.message || 'Failed to create survey.');
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------
  // Delete survey (safe cascade: questions → categories → survey)
  // ---------------------------
  async function deleteSurvey(id) {
    if (!id) return;
    const ok = confirm('Delete this survey and all its categories/questions? This cannot be undone.');
    if (!ok) return;

    try {
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        return;
      }
      setDeletingId(id);

      // 1) collect categories for this survey
      const { data: cats, error: catErr } = await supabase
        .from('categories')
        .select('id')
        .eq('survey_id', id);

      if (catErr) throw catErr;

      const categoryIds = (cats || []).map(c => c.id);

      // 2) delete questions under these categories
      if (categoryIds.length > 0) {
        const { error: qDelErr } = await supabase.from('questions').delete().in('category_id', categoryIds);
        if (qDelErr) throw qDelErr;
      }

      // 3) delete categories
      const { error: cDelErr } = await supabase.from('categories').delete().eq('survey_id', id);
      if (cDelErr) throw cDelErr;

      // 4) delete survey
      const { error: sDelErr } = await supabase.from('surveys').delete().eq('id', id);
      if (sDelErr) throw sDelErr;

      setSurveys(prev => prev.filter(s => s.id !== id));

      // clean up edit panel if it was open for this survey
      if (editingSurvey?.id === id) {
        setEditingSurvey(null);
        setCategories([]);
      }
    } catch (e) {
      setError(e.message || 'Failed to delete survey.');
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------
  // UI
  // ---------------------------
  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;
  if (error) return <div style={{ padding: '2rem', color: '#b00020' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Survey dashboard</h1>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* NEW: Global (no survey) report designer button */}
          <button
            onClick={() => router.push('/admin/reports/designer')}
            title="      Report Designer (global template)"
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Open PDF Report Designer
          </button>

          <button
            onClick={createSurvey}
            disabled={creating}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: creating ? '#9aa3af' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creating…' : 'Create survey'}
          </button>
        </div>
      </div>

      {/* Surveys grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {surveys.map(survey => (
          <div key={survey.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600 }}>{survey.title || 'Untitled survey'}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(survey.created_at)}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Existing actions you likely had: adjust these routes if you use different ones */}
              <button
                onClick={() => {
                  setEditingSurvey(survey);
                  loadCategoriesForSurvey(survey.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Edit score ranges
              </button>

              <button
                onClick={() => router.push(`/admin/surveys/analytics/${survey.id}`)}
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: '#1f2937',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Analytics
              </button>

              {/* NEW: Per-survey deep link to the Report Designer */}
              <button
                onClick={() => router.push(`/admin/reports/designer?surveyId=${survey.id}`)}
                title="Open PDF Report Designer for this survey"
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Report designer
              </button>

              <button
                onClick={() => router.push(`/admin/surveys/edit/${survey.id}`)}
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Manage
              </button>

              <button
                onClick={() => deleteSurvey(survey.id)}
                disabled={deletingId === survey.id}
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: deletingId === survey.id ? '#fca5a5' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingId === survey.id ? 'not-allowed' : 'pointer',
                  marginLeft: 'auto',
                }}
              >
                {deletingId === survey.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inline edit panel area (preserves your ScoreRangesManager usage) */}
      {editingSurvey && (
        <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Editing: {editingSurvey.title || editingSurvey.id}</h2>
            <button
              onClick={() => {
                setEditingSurvey(null);
                setCategories([]);
              }}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#e5e7eb',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {/* Existing survey editing form would sit here if you had it */}

          {/* Keep your ScoreRangesManager exactly as before */}
          <ScoreRangesManager surveyId={editingSurvey.id} categories={categories} />
        </div>
      )}
    </div>
  );
}
