import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SurveyResultsPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [responses, setResponses] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (id) {
      fetchSurveyData();
    }
  }, [id]);

  const fetchSurveyData = async () => {
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
      setCategories(categoriesData || []);

      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id);

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);

      // Fetch answers
      if (responsesData && responsesData.length > 0) {
        const responseIds = responsesData.map(r => r.id);
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .in('response_id', responseIds);

        if (answersError) throw answersError;
        setAnswers(answersData || []);
      }
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryScores = () => {
    const categoryScores = {};
    
    categories.forEach(category => {
      const categoryQuestions = category.questions.map(q => q.id);
      const categoryAnswers = answers.filter(answer => 
        categoryQuestions.includes(answer.question_id) && answer.score !== null
      );
      
      if (categoryAnswers.length > 0) {
        const totalScore = categoryAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);
        categoryScores[category.title] = totalScore / categoryAnswers.length;
      } else {
        categoryScores[category.title] = 0;
      }
    });
    
    return categoryScores;
  };

  const getTopResponses = () => {
    // Get the most common responses for each question type
    const topResponses = {};
    
    categories.forEach(category => {
      category.questions.forEach(question => {
        const questionAnswers = answers.filter(a => a.question_id === question.id);
        
        if (questionAnswers.length > 0) {
          // Count frequency of each response
          const responseCounts = {};
          questionAnswers.forEach(answer => {
            const value = answer.value || 'No response';
            responseCounts[value] = (responseCounts[value] || 0) + 1;
          });
          
          // Sort by frequency and get top 3
          const sortedResponses = Object.entries(responseCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([value, count]) => ({ value, count }));
          
          topResponses[question.id] = {
            question: question.prompt,
            type: question.type,
            responses: sortedResponses
          };
        }
      });
    });
    
    return topResponses;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    // Simple email validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setSubmittingEmail(true);
    setEmailError('');
    
    try {
      // Get the respondent ID from the most recent response
      // This assumes the user just completed the survey
      const recentResponse = responses.sort((a, b) => 
        new Date(b.completed_at) - new Date(a.completed_at)
      )[0];
      
      if (!recentResponse) {
        throw new Error('No response found');
      }
      
      // Update the respondent record with the email
      const { error: updateError } = await supabase
        .from('respondents')
        .update({ email })
        .eq('id', recentResponse.respondent_id);
      
      if (updateError) throw updateError;
      
      // Call API to generate and send PDF report
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surveyId: id,
          respondentId: recentResponse.respondent_id,
          email
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      setEmailSubmitted(true);
    } catch (err) {
      console.error('Error in handleEmailSubmit:', err);
      setEmailError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const categoryScores = getCategoryScores();
  const topResponses = getTopResponses();

  const categoryScoresChartData = {
    labels: Object.keys(categoryScores),
    datasets: [
      {
        label: 'Average Score',
        data: Object.values(categoryScores),
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgb(153, 102, 255)',
        borderWidth: 1,
      },
    ],
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!survey) return <div>Survey not found</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Survey Results: {survey.title}</h1>
      
      {survey.description && (
        <p style={{ marginBottom: '2rem', color: '#666' }}>{survey.description}</p>
      )}
      
      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', textAlign: 'center' }}>
          <h3>Total Responses</h3>
          <p style={{ fontSize: '2rem', margin: '0' }}>{responses.length}</p>
        </div>
      </div>

      {/* Category Scores */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Category Scores</h2>
        <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
          <Bar data={categoryScoresChartData} options={{ responsive: true }} />
        </div>
      </div>

      {/* Top Responses */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Top Responses</h2>
        {Object.entries(topResponses).slice(0, 5).map(([questionId, data]) => (
          <div key={questionId} style={{ marginBottom: '1.5rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
            <h4>{data.question}</h4>
            <ul>
              {data.responses.map((response, index) => (
                <li key={index}>
                  {response.value}: {response.count} responses
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Email Request Form */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '4px', marginBottom: '2rem' }}>
        <h2>Request Detailed Report</h2>
        <p>Enter your email address to receive a detailed PDF report of the survey results.</p>
        
        {emailSubmitted ? (
          <div style={{ padding: '1rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', marginTop: '1rem' }}>
            Thank you! Your detailed report will be sent to {email} shortly.
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>Email Address:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="your.email@example.com"
                required
              />
              {emailError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{emailError}</p>}
            </div>
            <button
              type="submit"
              disabled={submittingEmail}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {submittingEmail ? 'Submitting...' : 'Request Report'}
            </button>
          </form>
        )}
      </div>

      {/* Back to Surveys Button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => router.push('/surveys')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Surveys
        </button>
      </div>
    </div>
  );
}