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
  const [respondentId, setRespondentId] = useState(null);
  
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [responses, setResponses] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [scoreRanges, setScoreRanges] = useState({ categories: {}, total: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (id) {
      // Check if respondentId is in the URL query
      const urlRespondentId = router.query.respondentId;
      if (urlRespondentId) {
        setRespondentId(urlRespondentId);
      } else {
        // If not, try to get the most recent response for this survey
        fetchMostRecentResponse();
      }
    }
  }, [id, router.query]);

  useEffect(() => {
    if (id && respondentId) {
      fetchSurveyData();
    }
  }, [id, respondentId]);

  const fetchMostRecentResponse = async () => {
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

      // Fetch the most recent response for this survey
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id)
        .order('completed_at', { ascending: false })
        .limit(1);

      if (responsesError) throw responsesError;
      
      if (responsesData && responsesData.length > 0) {
        const mostRecentResponse = responsesData[0];
        setResponses([mostRecentResponse]);
        setRespondentId(mostRecentResponse.id);
        
        // Fetch answers for this respondent
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('response_id', mostRecentResponse.id);

        if (answersError) throw answersError;
        setAnswers(answersData || []);
        
        // Update the URL with the respondent ID
        router.replace(`/surveys/results/${id}?respondentId=${mostRecentResponse.id}`, undefined, { shallow: true });
      } else {
        setResponses([]);
        setAnswers([]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error in fetchMostRecentResponse:', err);
      setError(err.message);
      setLoading(false);
    }
  };

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

      // Fetch responses for this respondent only
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id)
        .eq('id', respondentId); // Filter by the current respondent

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);

      // Fetch answers for this respondent only
      if (responsesData && responsesData.length > 0) {
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('response_id', respondentId); // Only get answers for this respondent

        if (answersError) throw answersError;
        setAnswers(answersData || []);
      }

      // Fetch score ranges
      const scoreRanges = await fetchScoreRanges(id);
      setScoreRanges(scoreRanges);
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoreRanges = async (surveyId) => {
    try {
      // Fetch category score ranges
      const { data: categoryRanges, error: categoryError } = await supabase
        .from('score_ranges')
        .select('*')
        .eq('survey_id', surveyId)
        .not('category_id', 'is', null);
      
      if (categoryError) throw categoryError;
      
      // Fetch total score ranges
      const { data: totalRanges, error: totalError } = await supabase
        .from('score_ranges')
        .select('*')
        .eq('survey_id', surveyId)
        .is('category_id', null);
      
      if (totalError) throw totalError;
      
      // Organize ranges by category ID
      const rangesByCategory = {};
      categoryRanges.forEach(range => {
        if (!rangesByCategory[range.category_id]) {
          rangesByCategory[range.category_id] = [];
        }
        rangesByCategory[range.category_id].push(range);
      });
      
      return {
        categories: rangesByCategory,
        total: totalRanges || []
      };
    } catch (err) {
      console.error('Error fetching score ranges:', err);
      return {
        categories: {},
        total: []
      };
    }
  };

  const getCategoryScores = () => {
    const categoryScores = {};
    const categoryMaxScores = {};
    
    categories.forEach(category => {
      const categoryQuestions = category.questions.map(q => q.id);
      const categoryAnswers = answers.filter(answer => 
        categoryQuestions.includes(answer.question_id) && answer.score !== null
      );
      
      // Calculate actual score for the category
      let categoryScore = 0;
      let categoryMaxScore = 0;
      
      if (categoryAnswers.length > 0) {
        // Sum the actual scores
        categoryScore = categoryAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);
        
        // Calculate maximum possible score for this category
        category.questions.forEach(question => {
          categoryMaxScore += question.max_score || 1; // Use max_score from question, default to 1 if not set
        });
      }
      
      // Calculate percentage using the correct formula
      const categoryPercentage = categoryMaxScore > 0 ? (categoryScore / categoryMaxScore) * 100 : 0;
      
      categoryScores[category.title] = {
        score: categoryScore,
        maxScore: categoryMaxScore,
        percentage: categoryPercentage
      };
      
      categoryMaxScores[category.title] = categoryMaxScore;
    });
    
    return { categoryScores, categoryMaxScores };
  };

  const getTopResponses = () => {
    // For the top responses, instead of showing the most frequent responses, show this respondent's responses
    const userResponses = {};
    categories.forEach(category => {
      category.questions.forEach(question => {
        const questionAnswer = answers.find(a => a.question_id === question.id);
        
        if (questionAnswer) {
          userResponses[question.id] = {
            question: question.prompt,
            type: question.type,
            response: questionAnswer.value || 'No response'
          };
        }
      });
    });
    
    return userResponses;
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

  const getScoreRange = (percentage, ranges) => {
    return ranges.find(range => percentage >= range.min_score && percentage <= range.max_score);
  };

  const { categoryScores, categoryMaxScores } = getCategoryScores();
  const topResponses = getTopResponses();

  // Calculate total score using the correct formula
  let totalScore = 0;
  let totalMaxScore = 0;
  
  Object.values(categoryScores).forEach(categoryData => {
    totalScore += categoryData.score;
    totalMaxScore += categoryData.maxScore;
  });
  
  const totalPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

  const categoryScoresChartData = {
    labels: Object.keys(categoryScores),
    datasets: [
      {
        label: 'Score Percentage',
        data: Object.values(categoryScores).map(categoryData => categoryData.percentage),
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
      
      {/* Category Scores */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Category Scores</h2>
        <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
          <Bar data={categoryScoresChartData} options={{ responsive: true }} />
          
          {/* Display score range descriptions for each category */}
          {Object.entries(categoryScores).map(([category, categoryData]) => {
            const categoryId = categories.find(c => c.title === category)?.id;
            const ranges = scoreRanges.categories[categoryId] || [];
            const range = getScoreRange(categoryData.percentage, ranges);
            
            return (
              <div key={category} style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{category}:</strong>
                  <span>{Math.round(categoryData.percentage)}%</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  ({categoryData.score} out of {categoryData.maxScore} points)
                </div>
                {range && (
                  <div 
                    style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.75rem', 
                      borderRadius: '4px', 
                      backgroundColor: `${range.color}20`, // Add transparency
                      borderLeft: `4px solid ${range.color}`
                    }}
                  >
                    {range.description}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Display total score range */}
          {Object.keys(categoryScores).length > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
              <h3>Total Score</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Overall Score:</strong>
                <span>{Math.round(totalPercentage)}%</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                ({totalScore} out of {totalMaxScore} points)
              </div>
              {(() => {
                const totalRange = getScoreRange(totalPercentage, scoreRanges.total);
                
                return totalRange ? (
                  <div 
                    style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.75rem', 
                      borderRadius: '4px', 
                      backgroundColor: `${totalRange.color}20`, // Add transparency
                      borderLeft: `4px solid ${totalRange.color}`
                    }}
                  >
                    {totalRange.description}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Top Responses */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Your Responses</h2>
        {Object.entries(topResponses).map(([questionId, data]) => (
          <div key={questionId} style={{ marginBottom: '1.5rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
            <h4>{data.question}</h4>
            <div>- {data.response}</div>
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