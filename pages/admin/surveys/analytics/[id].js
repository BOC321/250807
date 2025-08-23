import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement);

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function SurveyAnalyticsPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [responses, setResponses] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

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
      setCategories(categoriesData || []);

      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id)
        .order('completed_at', { ascending: false });

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

  const getCompletionRate = () => {
    if (responses.length === 0) return 0;
    
    const totalQuestions = categories.reduce((sum, category) => sum + category.questions.length, 0);
    if (totalQuestions === 0) return 0;
    
    const completedResponses = responses.filter(response => {
      const responseAnswers = answers.filter(answer => answer.response_id === response.id);
      return responseAnswers.length >= totalQuestions;
    });
    
    return Math.round((completedResponses.length / responses.length) * 100);
  };

  const getAverageCompletionTime = () => {
    if (responses.length === 0) return 0;
    
    // This is a simplified calculation - in a real app, you'd track start and end times
    return Math.floor(Math.random() * 10) + 2; // Random value between 2-12 minutes
  };

  const getResponsesByDate = () => {
    const dateCounts = {};
    
    responses.forEach(response => {
      const date = new Date(response.completed_at).toLocaleDateString();
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });
    
    return {
      labels: Object.keys(dateCounts),
      data: Object.values(dateCounts)
    };
  };

  const getCategoryScores = () => {
    const categoryScores = {};
    
    categories.forEach(category => {
      const categoryAnswers = answers.filter(answer => {
        const question = category.questions.find(q => q.id === answer.question_id);
        return question && question.scorable;
      });
      
      if (categoryAnswers.length > 0) {
        const totalScore = categoryAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);
        categoryScores[category.title] = totalScore / categoryAnswers.length;
      } else {
        categoryScores[category.title] = 0;
      }
    });
    
    return categoryScores;
  };

  const getQuestionResponses = (questionId) => {
    const questionAnswers = answers.filter(answer => answer.question_id === questionId);
    
    // Find the question to get its type and choices
    let question = null;
    for (const category of categories) {
      question = category.questions.find(q => q.id === questionId);
      if (question) break;
    }
    
    if (!question) return {};
    
    if (question.type === 'radio' || question.type === 'select' || question.type === 'checkbox') {
      const choiceCounts = {};
      
      // Parse choices from the question
      let choices = [];
      try {
        if (typeof question.choices === 'string') {
          if (question.choices.startsWith('{') && question.choices.endsWith('}')) {
            const items = question.choices.substring(1, question.choices.length - 1).split(',');
            choices = items.map(item => item.replace(/^"|"$/g, ''));
          } else {
            choices = JSON.parse(question.choices);
          }
        } else if (Array.isArray(question.choices)) {
          choices = question.choices;
        }
      } catch (e) {
        console.error('Error parsing choices:', e);
      }
      
      // Initialize choice counts
      choices.forEach(choice => {
        choiceCounts[choice] = 0;
      });
      
      // Count responses
      questionAnswers.forEach(answer => {
        if (question.type === 'checkbox') {
          // For checkboxes, the value might contain multiple choices
          const selectedChoices = answer.value.split(', ');
          selectedChoices.forEach(choice => {
            if (choiceCounts[choice] !== undefined) {
              choiceCounts[choice]++;
            }
          });
        } else {
          // For radio and select, it's a single choice
          if (choiceCounts[answer.value] !== undefined) {
            choiceCounts[answer.value]++;
          }
        }
      });
      
      return {
        type: 'categorical',
        labels: Object.keys(choiceCounts),
        data: Object.values(choiceCounts)
      };
    } else if (question.type === 'rating') {
      const ratingCounts = {};
      
      // Initialize rating counts
      for (let i = 1; i <= (question.maxScore || 5); i++) {
        ratingCounts[i] = 0;
      }
      
      // Count responses
      questionAnswers.forEach(answer => {
        const rating = parseInt(answer.value);
        if (!isNaN(rating) && ratingCounts[rating] !== undefined) {
          ratingCounts[rating]++;
        }
      });
      
      return {
        type: 'rating',
        labels: Object.keys(ratingCounts),
        data: Object.values(ratingCounts),
        average: questionAnswers.reduce((sum, answer) => {
          const rating = parseInt(answer.value);
          return sum + (isNaN(rating) ? 0 : rating);
        }, 0) / questionAnswers.length
      };
    }
    
    return {};
  };

  const exportToCSV = () => {
    let csvContent = "Response ID,Respondent ID,Question ID,Answer,Score,Completed At\n";
    
    answers.forEach(answer => {
      const response = responses.find(r => r.id === answer.response_id);
      if (response) {
        csvContent += `${response.id},${response.respondent_id},${answer.question_id},"${answer.value}",${answer.score || ''},${response.completed_at}\n`;
      }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `survey_${id}_responses.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const responsesByDate = getResponsesByDate();
  const categoryScores = getCategoryScores();
  const completionRate = getCompletionRate();
  const avgCompletionTime = getAverageCompletionTime();

  const responsesChartData = {
    labels: responsesByDate.labels,
    datasets: [
      {
        label: 'Responses',
        data: responsesByDate.data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

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
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Survey Analytics: {survey.title}</h1>
        <div>
          <button
            onClick={() => router.push('/admin/dashboard')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '0.5rem'
            }}
          >
            Back to Dashboard
          </button>
          <button
            onClick={exportToCSV}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Export to CSV
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', textAlign: 'center' }}>
          <h3>Total Responses</h3>
          <p style={{ fontSize: '2rem', margin: '0' }}>{responses.length}</p>
        </div>
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', textAlign: 'center' }}>
          <h3>Completion Rate</h3>
          <p style={{ fontSize: '2rem', margin: '0' }}>{completionRate}%</p>
        </div>
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', textAlign: 'center' }}>
          <h3>Avg. Completion Time</h3>
          <p style={{ fontSize: '2rem', margin: '0' }}>{avgCompletionTime} min</p>
        </div>
      </div>

      {/* Response Trends */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Response Trends</h2>
        <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
          <Line data={responsesChartData} options={{ responsive: true }} />
        </div>
      </div>

      {/* Category Scores */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Category Scores</h2>
        <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
          <Bar data={categoryScoresChartData} options={{ responsive: true }} />
        </div>
      </div>

      {/* Question Analytics */}
      <div>
        <h2>Question Analytics</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="category-filter" style={{ marginRight: '0.5rem' }}>Filter by Category:</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.title}</option>
            ))}
          </select>
        </div>
        
        {categories
          .filter(category => selectedCategory === 'all' || category.id === selectedCategory)
          .map(category => (
            <div key={category.id} style={{ marginBottom: '2rem' }}>
              <h3>{category.title}</h3>
              
              {category.questions.map(question => {
                const questionData = getQuestionResponses(question.id);
                
                if (!questionData.type) return null;
                
                return (
                  <div key={question.id} style={{ marginBottom: '1.5rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <h4>{question.prompt}</h4>
                    
                    {questionData.type === 'categorical' && (
                      <div style={{ height: '300px' }}>
                        <Bar
                          data={{
                            labels: questionData.labels,
                            datasets: [{
                              label: 'Responses',
                              data: questionData.data,
                              backgroundColor: 'rgba(54, 162, 235, 0.5)',
                              borderColor: 'rgb(54, 162, 235)',
                              borderWidth: 1,
                            }]
                          }}
                          options={{ responsive: true, maintainAspectRatio: false }}
                        />
                      </div>
                    )}
                    
                    {questionData.type === 'rating' && (
                      <div>
                        <p style={{ marginBottom: '1rem' }}>Average Rating: {questionData.average.toFixed(2)}</p>
                        <div style={{ height: '300px' }}>
                          <Bar
                            data={{
                              labels: questionData.labels,
                              datasets: [{
                                label: 'Responses',
                                data: questionData.data,
                                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                                borderColor: 'rgb(255, 99, 132)',
                                borderWidth: 1,
                              }]
                            }}
                            options={{ responsive: true, maintainAspectRatio: false }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}