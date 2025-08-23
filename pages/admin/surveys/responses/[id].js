import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function ViewResponsesPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      fetchSurveyData();
    }
  }, [id]);

  const fetchSurveyData = async () => {
    if (!supabase) {
      setError('Database connection not available');
      setLoading(false);
      return;
    }

    try {
      // Fetch survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (surveyError) throw surveyError;
      
      setSurvey(surveyData);

      // Fetch responses with answers
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*, answers(*)')
        .eq('survey_id', id)
        .order('created_at', { ascending: false });

      if (responsesError) throw responsesError;
      
      setResponses(responsesData || []);
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!survey) return <div>Survey not found</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Responses for: {survey.title}</h1>
        <button
          onClick={() => router.back()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Dashboard
        </button>
      </div>
      
      {responses.length === 0 ? (
        <div>
          <p>No responses found for this survey.</p>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: '1rem' }}>Found {responses.length} response{responses.length !== 1 ? 's' : ''}.</p>
          
          {responses.map((response) => (
            <div key={response.id} style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Response #{response.id.substring(0, 8)}</h3>
                <div>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>
                    {formatDate(response.created_at)}
                  </span>
                  {response.completed_at && (
                    <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#28a745' }}>
                      Completed
                    </span>
                  )}
                </div>
              </div>
              
              {response.answers && response.answers.length > 0 ? (
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>Answers:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {response.answers.map((answer, index) => (
                      <div key={index} style={{ padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                          Question {index + 1}:
                        </div>
                        <div>{answer.value || 'No answer provided'}</div>
                        {answer.score !== undefined && answer.score !== null && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: '#666' }}>
                            Score: {answer.score}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No answers found for this response.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}