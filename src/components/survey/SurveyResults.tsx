import React from 'react';
import { getScoreRange } from '../../utils/scoreUtils';
import { SurveyResultsProps } from '../../types/ui';

const SurveyResults = ({ survey, categoryScores, userResponses, scoreRanges }: SurveyResultsProps) => {
  return (
    <div className="survey-results">
      <h1>Your Survey Report: {survey.title}</h1>
      <p>Generated on: {new Date().toLocaleDateString()}</p>
      
      <h2>Category Scores</h2>
      {Object.entries(categoryScores).map(([category, score]) => {
        const categoryId = survey.categories?.find((c: any) => c.title === category)?.id;
        const ranges = scoreRanges.categories[categoryId] || [];
        const range = getScoreRange(score, ranges);
        const percentage = Math.round(score * 100);
        
        return (
          <div key={category}>
            <div className="category-score">
              <strong>{category}:</strong> {percentage}%
            </div>
            {range && (
              <div className="score-range" style={{ backgroundColor: range.color + '20', borderLeft: `4px solid ${range.color}` }}>
                <strong>{category}:</strong> {range.description}
              </div>
            )}
          </div>
        );
      })}
      
      {Object.keys(categoryScores).length > 0 && (
        <div className="total-score">
          <strong>Total Score: {Math.round((Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length) * 100)}%</strong>
          {(() => {
            const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length;
            const totalRange = getScoreRange(totalScore, scoreRanges.total);
            
            return totalRange && (
              <div className="score-range" style={{ backgroundColor: totalRange.color + '20', borderLeft: `4px solid ${totalRange.color}` }}>
                <strong>Total Score:</strong> {totalRange.description}
              </div>
            );
          })()}
        </div>
      )}
      
      <h2>Your Responses</h2>
      {Object.entries(userResponses).map(([questionId, data]) => (
        <div key={questionId}>
          <h3>{data.question}</h3>
          <div className="response-item">- {data.response}</div>
        </div>
      ))}
    </div>
  );
};

export default SurveyResults;
