// API response and request types

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

// API Request/Response types
export interface CompleteSurveyRequest {
  respondentId: string;
}

export interface CompleteSurveyResponse {
  success: boolean;
  resultId: string;
  message: string;
}

export interface GenerateReportRequest {
  surveyId: string;
  respondentId: string;
  email: string;
}

export interface GenerateReportResponse {
  success: boolean;
  reportUrl: string;
  emailSent: boolean;
  message: string;
}
