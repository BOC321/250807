// Survey-related types

export type SurveyStatus = 'draft' | 'published' | 'archived';

export interface Survey {
  id: string;
  version: number;
  title: string;
  description?: string;
  rangesOverallVersionId?: string;
  status: SurveyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  surveyId: string;
  title: string;
  description?: string;
  weight: number;
  rangesVersionId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Choice {
  id: string;
  label: string;
  value: number;
}

export type QuestionType = 'single' | 'multi' | 'scale' | 'text';

export interface Question {
  id: string;
  categoryId: string;
  type: QuestionType;
  prompt: string;
  choices: Choice[];
  maxScore: number;
  weight: number;
  required: boolean;
  imageUrl?: string;
  helpText?: string;
  scorable: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Band {
  min: number;
  max: number;
  label: string;
  htmlContent: string;
}

export type RangeSetScope = 'category' | 'overall';

export interface RangeSetVersion {
  id: string;
  scope: RangeSetScope;
  bands: Band[];
  createdAt: string;
}
