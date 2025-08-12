import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import SurveyResults from '../../../components/survey/SurveyResults';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function TakeSurveyPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // New state for question-by-question flow
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [flattenedQuestions, setFlattenedQuestions] = useState([]);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [categoryScores, setCategoryScores] = useState({});
  const [userResponses, setUserResponses] = useState({});
  const [scoreRanges, setScoreRanges] = useState([]);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleResponseChange = (questionId, value) => {
    console.log('handleResponseChange called:', questionId, 'value:', value, 'type:', typeof value);
    setResponses(prev => {
      const newResponses = {
        ...prev,
        [questionId]: value
      };
      console.log('Updated responses:', newResponses);
      return newResponses;
    });
  };

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
        .eq('status', 'published') // Only allow taking published surveys
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
            scorable: question.scorable,
            categoryTitle: category.title // Add category title for display
          };
        })
      }));
      
      setCategories(formattedCategories);
      
      // Flatten questions for sequential display
      const allQuestions = [];
      formattedCategories.forEach(category => {
        category.questions.forEach(question => {
          allQuestions.push(question);
        });
      });
      setFlattenedQuestions(allQuestions);
      
      // Initialize responses object
      const initialResponses = {};
      allQuestions.forEach(question => {
        // Initialize radio buttons as null, others as empty string
        if (question.type === 'radio') {
          initialResponses[question.id] = null;
        } else {
          initialResponses[question.id] = '';
        }
      });
      console.log('Initial responses:', initialResponses);
      console.log('Total questions loaded:', allQuestions.length);
      console.log('Last question details:', allQuestions[allQuestions.length - 1]);
      setResponses(initialResponses);
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // New functions for question-by-question flow
  const handleNext = () => {
    console.log('handleNext called. Current index:', currentQuestionIndex, 'Total questions:', flattenedQuestions.length);
    
    // Validate current question if required
    const currentQuestion = flattenedQuestions[currentQuestionIndex];
    const currentResponse = responses[currentQuestion.id];
    
    console.log('Validating question:', currentQuestion.id, 'Type:', currentQuestion.type, 'Response:', currentResponse, 'Required:', currentQuestion.required);
    
    // Check if the question is required and empty
    if (currentQuestion.required) {
      let isEmpty = false;
      
      if (currentQuestion.type === 'radio') {
        // For radio buttons, check if no selection is made
        isEmpty = !currentResponse || currentResponse === '' || currentResponse === null;
      } else if (currentQuestion.type === 'checkbox') {
        // For checkboxes, check if array is empty
        isEmpty = !currentResponse || !Array.isArray(currentResponse) || currentResponse.length === 0;
      } else {
        // For text, textarea, etc.
        isEmpty = !currentResponse || currentResponse === '';
      }
      
      if (isEmpty) {
        console.log('Validation failed for question:', currentQuestion.id);
        setError('You must select an answer before clicking on Next');
        
        // Clear the error after 5 seconds
        setTimeout(() => {
          setError(null);
        }, 5000);
        
        return;
      }
    }
    
    setError(null);
    
    console.log('About to navigate. Current index:', currentQuestionIndex, 'Total questions:', flattenedQuestions.length - 1);
    console.log('Should advance to next question:', currentQuestionIndex < flattenedQuestions.length - 1);
    
    if (currentQuestionIndex < flattenedQuestions.length - 1) {
      console.log('Advancing to next question');
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      console.log('This should be the last question - showing submit button instead of next');
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!supabase) {
      setError('Database connection not available');
      setSubmitting(false);
      return;
    }
    
    try {
      // Validate all required questions
      let isValid = true;
      const validationErrors = {};
      
      console.log('Starting handleSubmit validation...');
      console.log('All responses:', responses);
      console.log('All flattened questions:', flattenedQuestions);
      
      flattenedQuestions.forEach(question => {
        if (question.required) {
          const response = responses[question.id];
          let isEmpty = false;
          
          if (question.type === 'radio') {
            // For radio buttons, check if no selection is made
            isEmpty = !response || response === '' || response === null;
          } else if (question.type === 'checkbox') {
            // For checkboxes, check if array is empty
            isEmpty = !response || !Array.isArray(response) || response.length === 0;
          } else {
            // For text, textarea, etc.
            isEmpty = !response || response === '';
          }
          
          console.log('Question:', question.id, 'Type:', question.type, 'Required:', question.required, 'Response:', response, 'IsEmpty:', isEmpty);
          
          if (isEmpty) {
            isValid = false;
            validationErrors[question.id] = 'This question is required';
            console.log('❌ Validation failed for question:', question.id, 'Type:', question.type, 'Response:', response);
            console.log('❌ Question prompt:', question.prompt);
            console.log('❌ Question choices:', question.choices);
          } else {
            console.log('✅ Validation passed for question:', question.id, 'Type:', question.type, 'Response:', response);
          }
        }
      });
      
      console.log('Final validation result:', isValid);
      console.log('Validation errors:', validationErrors);
      
      if (!isValid) {
        console.log('🚨 SUMMARY OF FAILED QUESTIONS:');
        Object.keys(validationErrors).forEach(questionId => {
          const question = flattenedQuestions.find(q => q.id === questionId);
          if (question) {
            console.log(`🚨 Question: "${question.prompt}" (ID: ${questionId})`);
            console.log(`🚨 Type: ${question.type}, Required: ${question.required}`);
            console.log(`🚨 Your response: ${responses[questionId]}`);
          }
        });
        
        setError('Please answer all required questions. Check console for details.');
        setSubmitting(false);
        return;
      }
      
      // Generate a unique respondent ID for this submission
      const respondentId = uuidv4();
      
      // Create a new respondent record first
      const { error: respondentError } = await supabase
        .from('respondents')
        .insert({
          id: respondentId,
          survey_id: id,  // Changed from 'survey-id' to survey_id
          survey_version: 1, // Default to version 1
          consent: false,    // Default to no consent
          created_at: new Date().toISOString()
        });
      
      if (respondentError) throw respondentError;
      
      // Create a new response
      const { data: newResponse, error: responseError } = await supabase
        .from('responses')
        .insert({
          survey_id: id,
          respondent_id: respondentId,
          completed_at: new Date().toISOString()
        })
        .select();
      
      if (responseError) throw responseError;
      
      const responseId = newResponse[0].id;
      
      // Create answers for each question
      const answers = [];
      
      // First, fetch all choice scores for all questions in one query
      const questionIds = [];
      flattenedQuestions.forEach(question => {
        questionIds.push(question.id);
      });
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('id, choice_scores')
        .in('id', questionIds);
      
      if (questionsError) throw questionsError;
      
      // Create a map of question IDs to choice scores
      const choiceScoresMap = {};
      questionsData.forEach(questionData => {
        let choiceScores = [];
        
        try {
          if (typeof questionData.choice_scores === 'string') {
            if (questionData.choice_scores.startsWith('{') && questionData.choice_scores.endsWith('}')) {
              const items = questionData.choice_scores.substring(1, questionData.choice_scores.length - 1).split(',');
              choiceScores = items.map(item => parseInt(item) || 0);
            } else {
              choiceScores = JSON.parse(questionData.choice_scores);
            }
          } else if (Array.isArray(questionData.choice_scores)) {
            choiceScores = questionData.choice_scores;
          }
        } catch (e) {
          console.error('Error parsing choice_scores:', e);
        }
        
        choiceScoresMap[questionData.id] = choiceScores;
      });
      
      // Now process each question
      flattenedQuestions.forEach(question => {
        let score = null;
        
        // Calculate score for scorable questions
        if (question.scorable) {
          if (question.type === 'radio' || question.type === 'select') {
            // For single choice, get the score of the selected option
            const choiceIndex = question.choices.indexOf(responses[question.id]);
            if (choiceIndex !== -1) {
              const choiceScores = choiceScoresMap[question.id] || [];
              if (choiceScores[choiceIndex] !== undefined) {
                score = choiceScores[choiceIndex];
              }
            }
          } else if (question.type === 'checkbox') {
            // For multiple choice, sum the scores of selected options
            const selectedOptions = Array.isArray(responses[question.id]) 
              ? responses[question.id] 
              : [responses[question.id]];
            
            const choiceScores = choiceScoresMap[question.id] || [];
            
            score = selectedOptions.reduce((sum, option) => {
              const choiceIndex = question.choices.indexOf(option);
              if (choiceIndex !== -1 && choiceScores[choiceIndex] !== undefined) {
                return sum + choiceScores[choiceIndex];
              }
              return sum;
            }, 0);
          } else if (question.type === 'rating') {
            // For rating, use the selected value as the score
            score = parseInt(responses[question.id]) || 0;
          }
        }
        
        answers.push({
          response_id: responseId,
          question_id: question.id,
          respondent_id: respondentId,
          value: Array.isArray(responses[question.id]) 
            ? responses[question.id].join(', ') 
            : responses[question.id],
          score: score
        });
      });
      
      // Insert all answers
      const { error: answersError } = await supabase
        .from('answers')
        .insert(answers);
      
      if (answersError) throw answersError;
      
      // Calculate category scores
      const calculatedCategoryScores = {};
      
      // Initialize scores for each category
      categories.forEach(category => {
        calculatedCategoryScores[category.id] = 0;
      });
      
      // Sum scores based on responses
      for (const questionId in responses) {
        const question = flattenedQuestions.find(q => q.id === questionId);
        
        if (question && question.scorable) {
          const categoryId = question.categoryTitle;
          const score = parseInt(responses[questionId]) || 0;
          
          if (calculatedCategoryScores[categoryId] !== undefined) {
            calculatedCategoryScores[categoryId] += score;
          }
        }
      }
      
      setCategoryScores(calculatedCategoryScores);
      setUserResponses(responses);
      
      // Redirect directly to thank you page without intermediate state
      router.push({
        pathname: '/surveys/thank-you',
        query: { surveyId: id }
      });
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailSent(false);
    setEmailError('');
    
    if (!supabase) {
      setEmailError('Database connection not available');
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Validate email format
      if (!/\S+@\S+\.\S+/.test(email)) {
        setEmailError('Invalid email address');
        setIsSubmitting(false);
        return;
      }
      
      // Send email with report
      const { data, error } = await supabase
        .functions
        .invoke('send-survey-report', {
          body: {
            surveyId: id,
            email: email
          }
        });
      
      if (error) throw error;
      
      setEmailSent(true);
    } catch (err) {
      console.error('Error sending email:', err);
      setEmailError('Failed to send report. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            required={question.required}
          />
        );
      case 'textarea':
        return (
          <textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            required={question.required}
          />
        );
      case 'radio':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {question.choices.map((choice, index) => (
              <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={choice}
                  checked={responses[question.id] === choice}
                  onChange={() => {
                    handleResponseChange(question.id, choice);
                    // Clear any error when user makes a selection
                    if (error) setError(null);
                  }}
                  style={{ cursor: 'pointer' }}
                />
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
                <input
                  type="checkbox"
                  value={choice}
                  checked={Array.isArray(responses[question.id]) 
                    ? responses[question.id].includes(choice) 
                    : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(responses[question.id]) 
                      ? responses[question.id] 
                      : [];
                    
                    if (e.target.checked) {
                      handleResponseChange(question.id, [...currentValues, choice]);
                    } else {
                      handleResponseChange(question.id, currentValues.filter(v => v !== choice));
                    }
                  }}
                />
                {choice}
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            required={question.required}
          >
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
              <button
                key={i}
                type="button"
                onClick={() => handleResponseChange(question.id, (i + 1).toString())}
                style={{
                  fontSize: '1.5rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: responses[question.id] === (i + 1).toString() ? '#ffc107' : '#ddd'
                }}
              >
                ★
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!survey) return <div>Survey not found or not published</div>;
  if (flattenedQuestions.length === 0) return <div>No questions found in this survey</div>;

  const currentQuestion = flattenedQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / flattenedQuestions.length) * 100;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>{survey.title}</h1>
      
      {survey.description && (
        <p style={{ marginBottom: '2rem', color: '#666' }}>{survey.description}</p>
      )}
      
      {/* Progress bar */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span>Question {currentQuestionIndex + 1} of {flattenedQuestions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div style={{ height: '10px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${progress}%`, 
              backgroundColor: '#007bff', 
              borderRadius: '5px' 
            }}
          ></div>
        </div>
      </div>
      
      {/* Category title */}
      <div style={{ marginBottom: '1rem' }}>
        <h2>{currentQuestion.categoryTitle}</h2>
      </div>
      
      {/* Debug info */}
      <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
        <strong>Debug:</strong> Question {currentQuestionIndex + 1} of {flattenedQuestions.length} | 
        Current Question ID: {currentQuestion?.id} | 
        Prompt: "{currentQuestion?.prompt}"
        <br />
        <strong>Current Index:</strong> {currentQuestionIndex} | 
        <strong>Array Length:</strong> {flattenedQuestions.length} | 
        <strong>Last Index:</strong> {flattenedQuestions.length - 1} |
        <strong>Is Last Question:</strong> {currentQuestionIndex === flattenedQuestions.length - 1 ? 'YES' : 'NO'}
      </div>
      
      {surveyCompleted ? (
        <div className="survey-completed">
          <SurveyResults 
            survey={survey}
            categoryScores={categoryScores}
            userResponses={userResponses}
            scoreRanges={scoreRanges}
          />
          
          <div className="email-form">
            <h2>Get Your Report via Email</h2>
            <p>Enter your email address to receive a copy of your report:</p>
            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Report'}
              </button>
            </form>
            {emailSent && <p className="success-message">Report sent successfully!</p>}
            {emailError && <p className="error-message">{emailError}</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 'bold' }}>
                {currentQuestion.prompt}
                {currentQuestion.required && <span style={{ color: 'red' }}> *</span>}
              </label>
            </div>
            {renderQuestion(currentQuestion)}
          </div>
          
          {error && (
            <div style={{ color: 'red', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            {/* Next/Submit button */}
            <div>
              {currentQuestionIndex === flattenedQuestions.length - 1 ? (
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Survey'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}