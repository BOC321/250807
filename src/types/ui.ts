// UI component types

export interface ProgressBarProps {
  value: number;
  className?: string;
}

export interface QuestionComponentProps {
  question: any; // Will be typed as Question from survey.ts
  onAnswer: (questionId: string, value: any) => void;
  answer?: any;
}

export interface ConsentFormProps {
  onConsent: (consented: boolean) => void;
}

export interface SurveyResultsProps {
  survey: any; // Will be typed as Survey from survey.ts
  categoryScores: Record<string, number>;
  userResponses: Record<string, any>;
  scoreRanges: any;
}

// Common UI types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface FormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
