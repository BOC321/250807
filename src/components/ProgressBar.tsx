// Progress bar component

export const ProgressBar = ({ value }) => {
  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${value}%` }}
        ></div>
      </div>
      <div className="progress-value">{Math.round(value)}%</div>
    </div>
  );
};
