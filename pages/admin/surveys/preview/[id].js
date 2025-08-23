import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function PreviewSurveyPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
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

      // Fetch categories with questions
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*, questions(*)')
        .eq('survey_id', id)
        .order('order');

      if (categoriesError) throw categoriesError;
      
      // Format categories and questions for display
      const formattedCategories = categoriesData.map(category => ({
        id: category.id,
        title: category.title,
        description: category.description,
        weight: category.weight,
        questions: category.questions.map(question => {
          // Safely parse JSON fields with fallbacks
          let choices = [];
          
          try {
            // Handle choices - could be a string, array, or PostgreSQL array format
            if (question.choices) {
              if (typeof question.choices === 'string') {
                // Check if it's a PostgreSQL array format like '{"choice1","choice2"}'
                if (question.choices.startsWith('{') && question.choices.endsWith('}')) {
                  // Remove the braces and split by commas
                  const items = question.choices.substring(1, question.choices.length - 1).split(',');
                  choices = items.map(item => {
                    // Remove quotes if present
                    return item.replace(/^"|"$/g, '');
                  });
                } else {
                  // Try to parse as JSON
                  choices = JSON.parse(question.choices);
                }
              } else if (Array.isArray(question.choices)) {
                choices = question.choices;
              }
            }
          } catch (e) {
            console.error('Error parsing choices:', e, question.choices);
            choices = [];
          }
          
          return {
            id: question.id,
            prompt: question.prompt,
            type: question.type,
            choices,
            maxScore: question.max_score,
            weight: question.weight,
            required: question.required,
            scorable: question.scorable
          };
        })
      }));
      
      setCategories(formattedCategories);
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question) => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            disabled
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        );
      case 'textarea':
        return (
          <textarea
            disabled
            rows={4}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        );
      case 'radio':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {question.choices.map((choice, index) => (
              <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="radio" name={`question-${question.id}`} disabled />
                {choice}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {question.choices.map((choice, index) => (
              <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" disabled />
                {choice}
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select disabled style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="">Select an option</option>
            {question.choices.map((choice, index) => (
              <option key={index} value={choice}>{choice}</option>
            ))}
          </select>
        );
      case 'rating':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[...Array(question.maxScore)].map((_, i) => (
              <span key={i} style={{ fontSize: '1.5rem', cursor: 'pointer' }}>★</span>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!survey) return <div>Survey not found</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>{survey.title}</h1>
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
      
      {survey.description && (
        <p style={{ marginBottom: '2rem', color: '#666' }}>{survey.description}</p>
      )}
      
      <div style={{ marginBottom: '2rem' }}>
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
      
      <form>
        {categories.map((category, categoryIndex) => (
          <div key={categoryIndex} style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>{category.title}</h2>
            
            {category.description && (
              <p style={{ marginBottom: '1rem', color: '#666' }}>{category.description}</p>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {category.questions.map((question, questionIndex) => (
                <div key={questionIndex}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 'bold' }}>
                      {question.prompt}
                      {question.required && <span style={{ color: 'red' }}> *</span>}
                    </label>
                  </div>
                  {renderQuestion(question)}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            type="button"
            disabled
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'not-allowed',
              opacity: '0.7'
            }}
          >
            Submit Survey (Preview Mode)
          </button>
        </div>
      </form>
    </div>
  );
}