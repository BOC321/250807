// Main export file for all utilities

// Score utilities
export * from './scoreUtils';
export * from './scoring';

// General helpers
export * from './helpers';

// Constants
export * from './constants';

// Validation utilities
export * from './validation';

// Formatting utilities - exclude formatFileSize to avoid conflict
export {
  formatDate,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDuration,
  formatPhoneNumber,
  formatText,
  formatScore,
  formatRelativeTime,
  formatList,
  formatOrdinal,
  formatBytes,
} from './formatting';

// Re-export commonly used types for convenience
export type {
  Survey,
  Category,
  Question,
  Respondent,
} from '../types';

// Utility type helpers
export type { 
  SurveyResultsProps,
  QuestionComponentProps,
  ProgressBarProps,
} from '../types/ui';
