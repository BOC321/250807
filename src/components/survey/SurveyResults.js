import React from 'react';
import { computeScores, pickRange } from '@/lib/scoring';
import { SurveyResultsProps } from '../../types/ui';

const SurveyResults = ({ survey, userResponses, scoreRanges }) => {
  // Format answers for scoring module
  const answerObjects = Object.values(userResponses).map(r => ({
    question_id: r.questionId,
    score: r.score
  }));

  // Calculate scores using normalized method
  const { categoryPercents, totalPercent } = computeScores(
    survey.categories,
    answerObjects,
    { treatMissingAsZero: true }
  );

  return (
    <div className="survey-results">
      <h1>Your Survey Report: {survey.title}</h1>
      <p>Generated on: {new Date().toLocaleDateString()}</p>
      
      <h2>Category Scores</h2>
      {Object.entries(categoryPercents).map(([category, percentage]) => {
        const categoryId = survey.categories?.find(c => c.title === category)?.id;
        const ranges = scoreRanges.categories[categoryId] || [];
        const range = pickRange(percentage, ranges);
        
        return (
          <div key={category}>
            <div className="category-score">
              <strong>{category}:</strong> {percentage.toFixed(2)}%
            </div>
            {range && (
              <div 
                className="score-range" 
                style={{ 
                  backgroundColor: `${range.color}20`, 
                  borderLeft: `4px solid ${range.color}`,
                  padding: '10px',
                  borderRadius: '4px',
                  marginTop: '10px'
                }}
              >
                <strong>{category}:</strong> {range.description}
              </div>
            )}
          </div>
        );
      })}
      
      {Object.keys(categoryPercents).length > 0 && (
        <div className="total-score" style={{ fontWeight: 'bold', marginTop: '15px', fontSize: '1.2em' }}>
          <strong>Total Score: {totalPercent.toFixed(2)}%</strong>
          {(() => {
            const totalRange = pickRange(totalPercent, scoreRanges.total || []);
            return totalRange ? (
              <div 
                className="score-range" 
                style={{ 
                  backgroundColor: `${totalRange.color}20`, 
                  borderLeft: `4px solid ${totalRange.color}`,
                  padding: '10px',
                  borderRadius: '4px',
                  marginTop: '10px'
                }}
              >
                <strong>Total Score:</strong> {totalRange.description}
              </div>
            ) : null;
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
      
      <style jsx>{`
        .survey-results {
          font-family: Arial, sans-serif;
          margin: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
        }
        h2 {
          color: #555;
          margin-top: 30px;
        }
        h3 {
          color: #777;
          margin-top: 20px;
        }
        .category-score {
          margin-bottom: 5px;
        }
        .response-item {
          margin-bottom: 5px;
        }
      `}</style>
    </div>
  );
};

export default SurveyResults;
