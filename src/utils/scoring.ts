// Utility functions for survey scoring and calculations

import { Question, Answer, CategoryResult, OverallResult, RangeSetVersion } from './types';

/**
 * Calculate the score for a single question
 * @param question The question object
 * @param answer The answer object
 * @returns The calculated score
 */
export function calculateQuestionScore(question: Question, answer: Answer): number {
  // Handle different question types
  switch (question.type) {
    case 'single':
      // For single choice, find the value of the selected choice
      if (typeof answer.value === 'string') {
        const selectedChoice = question.choices.find(choice => choice.id === answer.value);
        return selectedChoice ? selectedChoice.value * question.weight : 0;
      }
      return 0;
      
    case 'multi':
      // For multi-select, sum the values of all selected choices, capped at maxScore
      if (Array.isArray(answer.value)) {
        const total = answer.value.reduce((sum, choiceId) => {
          const choice = question.choices.find(c => c.id === choiceId);
          return sum + (choice ? choice.value : 0);
        }, 0);
        return Math.min(total, question.maxScore) * question.weight;
      }
      return 0;
      
    case 'scale':
      // For scale questions, the value is typically a number
      if (typeof answer.value === 'number') {
        // Normalize to maxScore if needed
        const normalized = Math.min(answer.value, question.maxScore);
        return normalized * question.weight;
      }
      return 0;
      
    case 'text':
      // Text questions don't have scores unless they're evaluated
      return 0;
      
    default:
      return 0;
  }
}

/**
 * Calculate category score based on answered questions
 * @param questions All questions in the category
 * @param answers All answers provided
 * @returns Category score details
 */
export function calculateCategoryScore(
  categoryId: string,
  questions: Question[],
  answers: Answer[]
): CategoryResult {
  const categoryQuestions = questions.filter(q => q.categoryId === categoryId);
  const categoryAnswers = answers.filter(a => 
    categoryQuestions.some(q => q.id === a.questionId)
  );
  
  // Calculate max possible score for answered questions only
  const maxScore = categoryQuestions
    .filter(q => categoryAnswers.some(a => a.questionId === q.id))
    .reduce((sum, q) => sum + q.maxScore * q.weight, 0);
  
  // Calculate actual score
  let score = 0;
  for (const answer of categoryAnswers) {
    const question = categoryQuestions.find(q => q.id === answer.questionId);
    if (question) {
      score += calculateQuestionScore(question, answer);
    }
  }
  
  // Calculate percentage (handle division by zero)
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100 * 100) / 100 : 0;
  
  return {
    categoryId,
    score,
    max: maxScore,
    percent,
    bandId: '' // Will be determined by range set
  };
}

/**
 * Calculate overall survey score
 * @param categoryResults Results for each category
 * @param categoryWeights Weights for each category
 * @returns Overall score details
 */
export function calculateOverallScore(
  categoryResults: CategoryResult[],
  categoryWeights: Record<string, number>
): OverallResult {
  // Calculate weighted average of category percentages
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const result of categoryResults) {
    const weight = categoryWeights[result.categoryId] || 1;
    weightedSum += result.percent * weight;
    totalWeight += weight;
  }
  
  const percent = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  
  // Calculate overall score and max (sum of category max scores)
  const score = categoryResults.reduce((sum, r) => sum + r.score, 0);
  const max = categoryResults.reduce((sum, r) => sum + r.max, 0);
  
  return {
    score,
    max,
    percent,
    bandId: '' // Will be determined by range set
  };
}

/**
 * Determine which band a percentage falls into
 * @param percentage The percentage score
 * @param rangeSet The range set with bands
 * @returns The band ID or null if not found
 */
export function determineBand(percentage: number, rangeSet: RangeSetVersion): string | null {
  if (percentage === null || percentage === undefined) return null;
  
  for (const band of rangeSet.bands) {
    // Check if percentage falls within this band (inclusive boundaries)
    if (percentage >= band.min && percentage <= band.max) {
      return band.label; // Using label as ID for simplicity
    }
  }
  
  return null;
}

/**
 * Calculate completion rate
 * @param answeredQuestions Number of questions answered
 * @param totalQuestions Total number of scorable questions
 * @returns Completion percentage
 */
export function calculateCompletionRate(answeredQuestions: number, totalQuestions: number): number {
  if (totalQuestions === 0) return 0;
  return Math.round((answeredQuestions / totalQuestions) * 100 * 100) / 100;
}
