import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import ScoreRangesManager from './ScoreRangesManager'; // Make sure this path is correct

// Only create Supabase client if environment variables are available
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function Dashboard() {
  const router = useRouter();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSurveys(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSurvey = async (id) => {
    if (!confirm('Are you sure you want to delete this survey?')) return;
    
    try {
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        return;
      }
      
      // First, delete all questions in all categories of this survey
      const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .eq('survey_id', id);
      
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(cat => cat.id);
        
        await supabase
          .from('questions')
          .delete()
          .in('category_id', categoryIds);
      }
      
      // Then, delete all categories of this survey
      await supabase
        .from('categories')
        .delete()
        .eq('survey_id', id);
      
      // Finally, delete the survey
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh the surveys list
      fetchSurveys();
    } catch (err) {
      setError(err.message);
    }
  };

  const viewResponses = (id) => {
    router.push(`/admin/surveys/responses/${id}`);
  };

  const editSurvey = (id) => {
    router.push(`/admin/surveys/edit/${id}`);
  };

  const createSurvey = () => {
    router.push('/admin/surveys/create');
  };

  const previewSurvey = (id) => {
    router.push(`/admin/surveys/preview/${id}`);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Survey Dashboard</h1>
        <button
          onClick={createSurvey}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Create New Survey
        </button>
      </div>
      
      {surveys.length === 0 ? (
        <div>
          <p>No surveys found. Create your first survey!</p>
        </div>
      ) : (
        <div>
          {surveys.map((survey) => (
            <div key={survey.id} style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>{survey.title}</h2>
                <div>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px',
                    backgroundColor: survey.status === 'published' ? '#28a745' : 
                                   survey.status === 'draft' ? '#ffc107' : '#6c757d',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}>
                    {survey.status}
                  </span>
                </div>
              </div>
              
              <p style={{ marginBottom: '1rem', color: '#666' }}>{survey.description}</p>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => editSurvey(survey.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
                
                <button
                  onClick={() => viewResponses(survey.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  View Responses
                </button>
                
                <button
                  onClick={() => previewSurvey(survey.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6f42c1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Preview
                </button>
                
                <button
                  onClick={() => deleteSurvey(survey.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>

                <button
                  onClick={() => router.push(`/admin/surveys/analytics/${survey.id}`)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#fd7e14',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Analytics
                </button>
                
                {/* Add this new button for managing score ranges */}
                <button
                  onClick={() => {
                    // Fetch categories for this survey
                    const fetchCategories = async () => {
                      try {
                        if (!supabase) {
                          setError('Supabase client not initialized. Please check environment variables.');
                          return;
                        }
                        
                        const { data, error } = await supabase
                          .from('categories')
                          .select('*')
                          .eq('survey_id', survey.id)
                          .order('order');
                        
                        if (error) throw error;
                        setCategories(data || []);
                        setEditingSurvey(survey);
                      } catch (err) {
                        setError(err.message);
                      }
                    };
                    
                    fetchCategories();
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#20c997',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Score Ranges
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Survey editing section */}
      {editingSurvey && (
        <div>
          {/* Existing survey editing form */}
          
          {/* Add the ScoreRangesManager component */}
          <ScoreRangesManager 
            surveyId={editingSurvey.id} 
            categories={categories} 
          />
        </div>
      )}
    </div>
  );
}
