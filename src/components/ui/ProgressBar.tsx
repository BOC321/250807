// Progress bar component
import { ProgressBarProps } from '../../types/ui';

export const ProgressBar = ({ value, className = '' }: ProgressBarProps) => {
  return (
    <div className={`progress-container ${className}`}>
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
