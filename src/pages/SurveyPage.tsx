// Main survey page component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { SurveyService, RespondentService, AnswerService } from '../services/supabaseService';
import { calculateQuestionScore, calculateCategoryScore, calculateOverallScore, calculateCompletionRate, determineBand } from '../utils/scoring';
import { QuestionComponent } from '../components/survey/QuestionComponent';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ConsentForm } from '../components/survey/ConsentForm';
import { Survey, Category, Question, Respondent, Answer } from '../types';

export default function SurveyPage() {
  const router = useRouter();
  const { surveyId } = router.query as { surveyId?: string };
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [respondent, setRespondent] = useState<Respondent | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load survey data
  useEffect(() => {
    if (!surveyId) return;
    
    const loadData = async () => {
      try {
        const surveyData = await SurveyService.getSurveyById(surveyId);
        if (!surveyData) {
          setError('Survey not found');
          return;
        }
        
        setSurvey(surveyData);
        
        const categoriesData = await SurveyService.getCategoriesBySurveyId(surveyId);
        setCategories(categoriesData);
        
        const questionsData = await SurveyService.getQuestionsBySurveyId(surveyId);
        setQuestions(questionsData);
        
        // Create respondent record
        const respondentData = await RespondentService.createRespondent(
          surveyId,
          surveyData.version
        );
        setRespondent(respondentData);
      } catch (err) {
        setError('Failed to load survey data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [surveyId]);
  
  // Handle consent
  const handleConsent = async () => {
    if (!respondent) return;
    
    try {
      const updatedRespondent = await RespondentService.updateConsent(
        respondent.id,
        true
      );
      setRespondent(updatedRespondent);
      setConsentGiven(true);
    } catch (err) {
      setError('Failed to update consent');
      console.error(err);
    }
  };
  
  // Handle answer submission
  const handleAnswer = async (questionId: string, value: any) => {
    if (!respondent) return;
    
    try {
      // Save answer to database
      const answer = await AnswerService.saveAnswer(
        respondent.id,
        questionId,
        value,
        currentQuestionIndex
      );
      
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: answer
      }));
      
      // Move to next question
      goToNextQuestion();
    } catch (err) {
      setError('Failed to save answer');
      console.error(err);
    }
  };
  
  // Navigation functions
  const goToNextQuestion = () => {
    const currentCategory = categories[currentCategoryIndex];
    const categoryQuestions = questions.filter(q => q.categoryId === currentCategory.id);
    
    if (currentQuestionIndex < categoryQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentCategoryIndex < categories.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Survey completed, calculate results
      calculateAndSaveResults();
    }
  };
  
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else if (currentCategoryIndex > 0) {
      const prevCategory = categories[currentCategoryIndex - 1];
      const prevCategoryQuestions = questions.filter(q => q.categoryId === prevCategory.id);
      setCurrentCategoryIndex(prev => prev - 1);
      setCurrentQuestionIndex(prevCategoryQuestions.length - 1);
    }
  };
  
  // Calculate and save results
  const calculateAndSaveResults = async () => {
    if (!respondent || !survey) return;
    
    try {
      // Get all answers
      const allAnswers = await AnswerService.getAnswersByRespondentId(respondent.id);
      
      // Calculate category results
      const categoryResults = categories.map(category => {
        return calculateCategoryScore(category.id, questions, allAnswers);
      });
      
      // Calculate overall result
      const categoryWeights: Record<string, number> = {};
      categories.forEach(cat => {
        categoryWeights[cat.id] = cat.weight;
      });
      
      const overallResult = calculateOverallScore(categoryResults, categoryWeights);
      
      // Determine bands
      if (survey.rangesOverallVersionId) {
        const rangeSet = await SurveyService.getRangeSetById(survey.rangesOverallVersionId);
        if (rangeSet) {
          overallResult.bandId = determineBand(overallResult.percent, rangeSet) || '';
        }
      }
      
      // Save results
      // In a real implementation, you would also determine category bands here
      
      // Redirect to results page
      router.push(`/survey/${surveyId}/results?respondentId=${respondent.id}`);
    } catch (err) {
      setError('Failed to calculate results');
      console.error(err);
    }
  };
  
  if (loading) {
    return <div className="survey-container">Loading survey...</div>;
  }
  
  if (error) {
    return <div className="survey-container error">{error}</div>;
  }
  
  if (!consentGiven) {
    return (
      <div className="survey-container">
        <ConsentForm onConsent={handleConsent} />
      </div>
    );
  }
  
  const currentCategory = categories[currentCategoryIndex];
  const categoryQuestions = questions.filter(q => q.categoryId === currentCategory?.id);
  const currentQuestion = categoryQuestions[currentQuestionIndex];
  
  const answeredCount = Object.keys(answers).length;
  const totalScorableQuestions = questions.filter(q => q.scorable).length;
  const completionRate = calculateCompletionRate(answeredCount, totalScorableQuestions);
  
  return (
    <div className="survey-container">
      <div className="survey-header">
        <h1>{survey?.title}</h1>
        <ProgressBar value={completionRate} />
        <p>Progress: {completionRate}% complete</p>
      </div>
      
      {currentQuestion && (
        <div className="question-container">
          <h2>{currentCategory?.title}</h2>
          <QuestionComponent 
            question={currentQuestion}
            onAnswer={handleAnswer}
            answer={answers[currentQuestion.id]}
          />
        </div>
      )}
      
      <div className="navigation-buttons">
        {currentCategoryIndex > 0 || currentQuestionIndex > 0 ? (
          <button onClick={goToPreviousQuestion}>Previous</button>
        ) : null}
        
        <button 
          onClick={goToNextQuestion}
          disabled={!currentQuestion}
        >
          {currentCategoryIndex === categories.length - 1 && 
           currentQuestionIndex === categoryQuestions.length - 1 ? 
           'Finish Survey' : 'Next'}
        </button>
      </div>
    </div>
  );
}
