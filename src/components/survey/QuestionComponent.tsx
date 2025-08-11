// Question component for rendering different question types
import { useState, useEffect } from 'react';
import { QuestionComponentProps, Question } from '../../types';

export const QuestionComponent = ({ question, onAnswer, answer }: QuestionComponentProps) => {
  const [value, setValue] = useState(answer?.value || (question.type === 'multi' ? [] : ''));
  
  useEffect(() => {
    setValue(answer?.value || (question.type === 'multi' ? [] : ''));
  }, [answer, question.type]);
  
  const handleChange = (newValue: any) => {
    setValue(newValue);
    
    // For single choice and scale, auto-submit
    if (question.type === 'single' || question.type === 'scale') {
      onAnswer(question.id, newValue);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnswer(question.id, value);
  };
  
  const renderChoices = () => {
    if (!question.choices || question.choices.length === 0) return null;
    
    switch (question.type) {
      case 'single':
        return (
          <div className="choices">
            {question.choices.map((choice: any) => (
              <label key={choice.id} className="choice-option">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={choice.id}
                  checked={value === choice.id}
                  onChange={(e) => handleChange(e.target.value)}
                />
                <span className="choice-label">{choice.label}</span>
                {choice.value !== undefined && (
                  <span className="choice-value">({choice.value})</span>
                )}
              </label>
            ))}
          </div>
        );
        
      case 'multi':
        return (
          <div className="choices">
            {question.choices.map((choice: any) => (
              <label key={choice.id} className="choice-option">
                <input
                  type="checkbox"
                  name={`question-${question.id}`}
                  value={choice.id}
                  checked={value.includes(choice.id)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...value, choice.id]
                      : value.filter((v: any) => v !== choice.id);
                    handleChange(newValues);
                  }}
                />
                <span className="choice-label">{choice.label}</span>
                {choice.value !== undefined && (
                  <span className="choice-value">({choice.value})</span>
                )}
              </label>
            ))}
          </div>
        );
        
      case 'scale':
        return (
          <div className="scale-input">
            <input
              type="range"
              min="0"
              max={question.maxScore}
              value={value}
              onChange={(e) => handleChange(parseFloat(e.target.value))}
              className="scale-slider"
            />
            <div className="scale-value">{value}</div>
            <div className="scale-labels">
              <span>0</span>
              <span>{question.maxScore}</span>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  const renderTextInput = () => {
    if (question.type !== 'text') return null;
    
    return (
      <div className="text-input">
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Please enter your response..."
          rows={4}
        />
      </div>
    );
  };
  
  return (
    <div className="question">
      <h3 className="question-prompt">{question.prompt}</h3>
      
      {question.helpText && (
        <p className="question-help">{question.helpText}</p>
      )}
      
      {question.imageUrl && (
        <img 
          src={question.imageUrl} 
          alt="Question illustration" 
          className="question-image"
        />
      )}
      
      <form onSubmit={handleSubmit} className="question-form">
        {renderChoices()}
        {renderTextInput()}
        
        {(question.type === 'text' || question.type === 'scale') && (
          <button type="submit" className="submit-button">
            Submit
          </button>
        )}
      </form>
    </div>
  );
};
