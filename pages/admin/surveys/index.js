import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // Add this import

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

  // Rest of the code remains the same until handleSubmit

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!supabase) {
      setError('Database connection not available');
      setSubmitting(false);
      return;
    }
    
    try {
      // Validate required questions
      let isValid = true;
      const validationErrors = {};
      
      categories.forEach(category => {
        category.questions.forEach(question => {
          if (question.required && (!responses[question.id] || responses[question.id] === '')) {
            isValid = false;
            validationErrors[question.id] = 'This question is required';
          }
        });
      });
      
      if (!isValid) {
        setError('Please answer all required questions');
        setSubmitting(false);
        return;
      }
      
      // Generate a unique respondent ID for this submission
      const respondentId = uuidv4();
      
      // Create a new response
      const { data: newResponse, error: responseError } = await supabase
        .from('responses')
        .insert({
          survey_id: id,
          respondent_id: respondentId, // Add this line
          completed_at: new Date().toISOString()
        })
        .select();
      
      if (responseError) throw responseError;
      
      const responseId = newResponse[0].id;
      
      // Create answers for each question
      const answers = [];
      
      // First, fetch all choice scores for all questions in one query
      const questionIds = [];
      categories.forEach(category => {
        category.questions.forEach(question => {
          questionIds.push(question.id);
        });
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
      categories.forEach(category => {
        category.questions.forEach(question => {
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
            respondent_id: respondentId, // Add this line
            value: Array.isArray(responses[question.id]) 
              ? responses[question.id].join(', ') 
              : responses[question.id],
            score: score
          });
        });
      });
      
      // Insert all answers
      const { error: answersError } = await supabase
        .from('answers')
        .insert(answers);
      
      if (answersError) throw answersError;
      
      // Redirect to a thank you page
      router.push('/surveys/thank-you');
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  // Rest of the code remains the same
}
