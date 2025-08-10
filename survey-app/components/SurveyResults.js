import React from 'react';
import { getScoreRange } from '../utils/scoreUtils';

const SurveyResults = ({ survey, categoryScores, userResponses, scoreRanges }) => {
  return (
    <div className="survey-results">
      <h1>Your Survey Report: {survey.title}</h1>
      <p>Generated on: {new Date().toLocaleDateString()}</p>
      
      <h2>Category Scores</h2>
      {Object.entries(categoryScores).map(([category, score]) => {
        const categoryId = survey.categories?.find(c => c.title === category)?.id;
        const ranges = scoreRanges.categories[categoryId] || [];
        const range = getScoreRange(score, ranges);
        const percentage = Math.round(score * 100);
        
        return (
          <div key={category}>
            <div className="category-score">
              <strong>{category}:</strong> {percentage}%
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
      
      {Object.keys(categoryScores).length > 0 && (
        <div className="total-score" style={{ fontWeight: 'bold', marginTop: '15px', fontSize: '1.2em' }}>
          <strong>
            Total Score: {Math.round((Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length) * 100)}%
          </strong>
          {(() => {
            const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length;
            const totalRange = getScoreRange(totalScore, scoreRanges.total);
            
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