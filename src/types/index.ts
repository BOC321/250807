// Types for our survey application

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
  max: max: number;
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

export interface Respondent {
  id: string;
  surveyId: string;
  surveyVersion: number;
  email?: string;
  meta: Record<string, any>;
  consent: boolean;
  consentTimestamp?: string;
  createdAt: string;
}

export interface Answer {
  id: string;
  respondentId: string;
  questionId: string;
  value: any; // Could be string, number, or array depending on question type
  presentedOrder: number;
  createdAt: string;
}

export interface CategoryResult {
  categoryId: string;
  score: number;
  max: number;
  percent: number;
  bandId: string;
}

export interface OverallResult {
  score: number;
  max: number;
  percent: number;
  bandId: string;
}

export interface Result {
  id: string;
  respondentId: string;
  perCategory: CategoryResult[];
  overall: OverallResult;
  completedCount: number;
  scorableCount: number;
  createdAt: string;
}

export interface ReportAsset {
  id: string;
  surveyId: string;
  categoryId?: string;
  bandId?: string;
  assetType: string;
  assetUrl: string;
  createdAt: string;
}

export interface SurveySnapshot {
  id: string;
  surveyId: string;
  snapshot: any;
  createdAt: string;
}
