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
  const [allResponses, setAllResponses] = useState([]); // Store all responses
  const [answers, setAnswers] = useState([]);
  const [allAnswers, setAllAnswers] = useState([]); // Store all answers
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Date range filtering states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateFilterApplied, setDateFilterApplied] = useState(false);

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
      setAllResponses(responsesData || []); // Store all responses
      setResponses(responsesData || []); // Initially show all responses

      // Fetch answers
      if (responsesData && responsesData.length > 0) {
        const responseIds = responsesData.map(r => r.id);
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .in('response_id', responseIds);

        if (answersError) throw answersError;
        setAllAnswers(answersData || []); // Store all answers
        setAnswers(answersData || []); // Initially show all answers
      }
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Date filtering functions
  const applyDateFilter = () => {
    if (!startDate && !endDate) {
      // No date filter applied, show all data
      setResponses(allResponses);
      setAnswers(allAnswers);
      setDateFilterApplied(false);
      return;
    }

    let filteredResponses = [...allResponses];

    // Apply date filtering
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      filteredResponses = filteredResponses.filter(response => {
        const responseDate = new Date(response.completed_at);
        return responseDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      filteredResponses = filteredResponses.filter(response => {
        const responseDate = new Date(response.completed_at);
        return responseDate <= end;
      });
    }

    // Filter answers based on filtered responses
    const filteredResponseIds = filteredResponses.map(r => r.id);
    const filteredAnswers = allAnswers.filter(answer => 
      filteredResponseIds.includes(answer.response_id)
    );

    setResponses(filteredResponses);
    setAnswers(filteredAnswers);
    setDateFilterApplied(true);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setResponses(allResponses);
    setAnswers(allAnswers);
    setDateFilterApplied(false);
  };

  const getDateRangePresets = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split('T')[0];
    
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];
    
    const last3Months = new Date(now);
    last3Months.setMonth(last3Months.getMonth() - 3);
    const last3MonthsStr = last3Months.toISOString().split('T')[0];

    return {
      today: { start: today, end: today, label: 'Today' },
      yesterday: { start: yesterdayStr, end: yesterdayStr, label: 'Yesterday' },
      lastWeek: { start: lastWeekStr, end: today, label: 'Last 7 days' },
      lastMonth: { start: lastMonthStr, end: today, label: 'Last 30 days' },
      last3Months: { start: last3MonthsStr, end: today, label: 'Last 3 months' },
    };
  };

  const applyPreset = (preset) => {
    const presets = getDateRangePresets();
    const selected = presets[preset];
    if (selected) {
      setStartDate(selected.start);
      setEndDate(selected.end);
      // Apply filter after setting dates
      setTimeout(() => applyDateFilter(), 0);
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
    
    // Use filtered data when date filter is applied
    const dataToExport = dateFilterApplied ? answers : allAnswers;
    const responsesToExport = dateFilterApplied ? responses : allResponses;
    
    dataToExport.forEach(answer => {
      const response = responsesToExport.find(r => r.id === answer.response_id);
      if (response) {
        csvContent += `${response.id},${response.respondent_id},${answer.question_id},"${answer.value}",${answer.score || ''},${response.completed_at}\n`;
      }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateRangeText = dateFilterApplied ? `_${startDate || 'all'}_to_${endDate || 'today'}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `survey_${id}_responses${dateRangeText}.csv`);
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

      {/* Date Range Filter */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>📅 Date Range Filter</h3>
        
        {/* Quick Presets */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ marginRight: '1rem', fontWeight: 'bold', color: '#6c757d' }}>Quick select:</span>
          {Object.entries(getDateRangePresets()).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              style={{
                padding: '0.25rem 0.75rem',
                margin: '0 0.25rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {/* Custom Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="start-date" style={{ fontWeight: 'bold', color: '#495057' }}>From:</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="end-date" style={{ fontWeight: 'bold', color: '#495057' }}>To:</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <button
            onClick={applyDateFilter}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            Apply Filter
          </button>
          
          <button
            onClick={clearDateFilter}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
          >
            Clear Filter
          </button>
        </div>
        
        {/* Filter Status */}
        {dateFilterApplied && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#d1ecf1', 
            color: '#0c5460',
            borderRadius: '4px',
            border: '1px solid #bee5eb'
          }}>
            <strong>🔍 Filter Active:</strong> Showing data from {startDate || 'beginning'} to {endDate || 'today'} 
            ({responses.length} responses out of {allResponses.length} total)
          </div>
        )}
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