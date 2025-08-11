// Main export file for all services

// API Services
export * from './api/baseService';
export * from './api/surveyService';

// External Services
export * from './external/emailService';
export * from './external/pdfService';

// Service Types
export * from './types';

// Service Utilities
export { 
  ServiceError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from './types';

// Default service configurations
export const defaultServiceConfig = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
    timeout: 30000,
    retries: 3,
    headers: {
      'Content-Type': 'application/json',
    },
  },
  email: {
    apiKey: process.env.EMAIL_API_KEY || '',
    baseUrl: process.env.EMAIL_BASE_URL || '',
    from: process.env.EMAIL_FROM || 'noreply@surveyapp.com',
  },
  database: {
    host: process.env.DB_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || '',
    username: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
  },
};

// Service factory functions
export const createSurveyService = () => {
  return {
    // Survey operations
    getSurvey: (id: string) => import('./api/surveyService').then(m => m.SurveyService.getSurveyById(id)),
    listSurveys: (status?: any) => import('./api/surveyService').then(m => m.SurveyService.listSurveys(status)),
    createSurvey: (data: any) => import('./api/surveyService').then(m => m.SurveyService.createSurvey(data)),
    updateSurvey: (id: string, data: any) => import('./api/surveyService').then(m => m.SurveyService.updateSurvey(id, data)),
    deleteSurvey: (id: string) => import('./api/surveyService').then(m => m.SurveyService.deleteSurvey(id)),
    getCompleteSurvey: (id: string) => import('./api/surveyService').then(m => m.SurveyService.getCompleteSurvey(id)),
    
    // Respondent operations
    createRespondent: (data: any) => import('./api/surveyService').then(m => m.SurveyService.createRespondent(data)),
    submitAnswers: (answers: any[]) => import('./api/surveyService').then(m => m.SurveyService.submitAnswers(answers)),
    getSurveyResult: (respondentId: string) => import('./api/surveyService').then(m => m.SurveyService.getSurveyResult(respondentId)),
    createResult: (data: any) => import('./api/surveyService').then(m => m.SurveyService.createResult(data)),
    getRespondentAnswers: (respondentId: string) => import('./api/surveyService').then(m => m.SurveyService.getRespondentAnswers(respondentId)),
  };
};

export const createEmailService = async (config?: any) => {
  const { EmailService } = await import('./external/emailService');
  const emailConfig = config || defaultServiceConfig.email;
  return new EmailService(emailConfig);
};

export const createMailerooService = async (apiKey?: string) => {
  const { MailerooService } = await import('./external/emailService');
  const key = apiKey || process.env.MAILEROO_API_KEY || '';
  return new MailerooService(key);
};

export const createPDFService = () => {
  return {
    generateSurveyReport: (data: any) => import('./external/pdfService').then(m => m.PDFService.generateSurveyReport(data)),
    generateSummaryReport: (title: string, total: number, avg: number, rate: number) => 
      import('./external/pdfService').then(m => m.PDFService.generateSummaryReport(title, total, avg, rate)),
    savePDF: (data: Uint8Array, filename: string) => import('./external/pdfService').then(m => m.PDFService.savePDF(data, filename)),
    openPDF: (data: Uint8Array) => import('./external/pdfService').then(m => m.PDFService.openPDF(data)),
  };
};
