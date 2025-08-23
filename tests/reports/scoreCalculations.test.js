const generateModule = require('../../pages/api/reports/generate');
const { getCategoryScores } = generateModule.handler;

// Mock survey data structure
const createMockSurvey = () => ({
  categories: [
    {
      id: 'cat1',
      title: 'Category 1',
      questions: [
        { id: 'q1', prompt: 'Question 1', max_score: 1 },
        { id: 'q2', prompt: 'Question 2', max_score: 2 }
      ]
    },
    {
      id: 'cat2',
      title: 'Category 2',
      questions: [
        { id: 'q3', prompt: 'Question 3', max_score: 3 }
      ]
    }
  ]
});

// Mock answers data
const createMockAnswers = (scores) => scores.map(([questionId, score]) => ({
  question_id: questionId,
  score: score
}));

describe('Score Calculation Tests', () => {
  test('Perfect scores return 100%', () => {
    const survey = createMockSurvey();
    const answers = createMockAnswers([
      ['q1', 1], ['q2', 2], ['q3', 3]
    ]);
    
    const { categoryScores, totalPercentage } = getCategoryScores(survey, answers);
    
    expect(categoryScores['Category 1']).toBe(100);
    expect(categoryScores['Category 2']).toBe(100);
    expect(totalPercentage).toBe(100);
  });

  test('Partial scores calculate correctly', () => {
    const survey = createMockSurvey();
    const answers = createMockAnswers([
      ['q1', 1], ['q2', 1], ['q3', 0] // 1/1 + 1/2 = 75%, 0/3 = 0%
    ]);
    
    const { categoryScores, totalPercentage } = getCategoryScores(survey, answers);
    
    expect(categoryScores['Category 1']).toBe(75);
    expect(categoryScores['Category 2']).toBe(0);
    expect(totalPercentage).toBe(37.5); // (75 + 0) / 2
  });

  test('Empty category returns 0%', () => {
    const survey = createMockSurvey();
    survey.categories[0].questions = [];
    const answers = createMockAnswers([['q3', 3]]);
    
    const { categoryScores, totalPercentage } = getCategoryScores(survey, answers);
    
    expect(categoryScores['Category 1']).toBe(0);
    expect(categoryScores['Category 2']).toBe(100);
    expect(totalPercentage).toBe(50); // (0 + 100) / 2
  });

  test('Zero scores return 0%', () => {
    const survey = createMockSurvey();
    const answers = createMockAnswers([
      ['q1', 0], ['q2', 0], ['q3', 0]
    ]);
    
    const { categoryScores, totalPercentage } = getCategoryScores(survey, answers);
    
    expect(categoryScores['Category 1']).toBe(0);
    expect(categoryScores['Category 2']).toBe(0);
    expect(totalPercentage).toBe(0);
  });

  test('Mixed max scores calculate correctly', () => {
    const survey = createMockSurvey();
    survey.categories[0].questions[0].max_score = 5;
    const answers = createMockAnswers([
      ['q1', 3], ['q2', 2], ['q3', 3] // 3/5 + 2/2 = 80%, 3/3 = 100%
    ]);
    
    const { categoryScores, totalPercentage } = getCategoryScores(survey, answers);
    
    expect(categoryScores['Category 1']).toBeCloseTo(80);
    expect(categoryScores['Category 2']).toBe(100);
    expect(totalPercentage).toBeCloseTo(90); // (80 + 100) / 2
  });
});
