import React from 'react';

const SurveyResults = ({ survey, userResponses }) => {
  return (
    <div className="survey-results">
      <h1>Your Survey Report: {survey.title}</h1>
      <p>Generated on: {new Date().toLocaleDateString()}</p>
      
      <h2>Detailed Responses</h2>
      {survey.categories?.map((category) => (
        <div key={category.id} className="category-responses">
          <h3>{category.title}</h3>
          {category.questions?.map((question) => {
            const response = userResponses[question.id];
            return (
              <div key={question.id} className="question-response">
                <p><strong>Q: {question.text}</strong></p>
                <p>A: {response?.answer || 'Not answered'}</p>
                {response?.notes && <p><em>Notes: {response.notes}</em></p>}
              </div>
            );
          })}
        </div>
      ))}
      
      <div className="survey-actions">
        <button onClick={() => window.print()}>Print Report</button>
        <button onClick={() => window.history.back()}>Back to Survey</button>
      </div>
    </div>
  );
};

export default SurveyResults;
