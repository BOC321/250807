// Service-specific types and interfaces

import { 
  Category, 
  Result, 
  CategoryResult, 
  OverallResult 
} from '../types';

// API Service Types
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Survey Service Types
export interface SurveyFilters {
  status?: 'draft' | 'active' | 'completed' | 'archived';
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
}

export interface SurveyCreateOptions {
  title: string;
  description?: string;
  categories: Omit<Category, 'id' | 'survey_id' | 'created_at' | 'updated_at'>[];
  settings?: SurveySettings;
}

export interface SurveyUpdateOptions {
  title?: string;
  description?: string;
  status?: 'draft' | 'active' | 'completed' | 'archived';
  categories?: Category[];
  settings?: Partial<SurveySettings>;
}

export interface SurveySettings {
  allowAnonymous: boolean;
  requireEmail: boolean;
  timeLimit?: number;
  maxAttempts?: number;
  showResults: boolean;
  allowRetake: boolean;
}

// Email Service Types
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  variables: string[];
}

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailConfig {
  apiKey: string;
  baseUrl: string;
  from?: string;
  replyTo?: string;
}

// PDF Service Types
export interface PDFReportOptions {
  format: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  header?: boolean;
  footer?: boolean;
  watermark?: string;
}

export interface PDFReportData {
  title: string;
  subtitle?: string;
  respondentEmail?: string;
  completedAt: Date;
  result: Result;
  categories: Array<{
    id: string;
    title: string;
    description?: string;
    result: CategoryResult;
  }>;
  overall: OverallResult;
  completionRate: number;
  metadata?: Record<string, any>;
}

// Analytics Service Types
export interface AnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  surveyId?: string;
  category?: string;
  respondentType?: 'anonymous' | 'registered';
}

export interface SurveyAnalytics {
  totalResponses: number;
  completionRate: number;
  averageScore: number;
  averageTimeToComplete: number;
  responsesByDate: Array<{
    date: string;
    count: number;
  }>;
  categoryPerformance: Array<{
    categoryId: string;
    categoryName: string;
    averageScore: number;
    completionRate: number;
  }>;
  questionPerformance: Array<{
    questionId: string;
    questionText: string;
    averageScore: number;
    responseRate: number;
  }>;
}

export interface RespondentAnalytics {
  totalRespondents: number;
  newRespondents: number;
  returningRespondents: number;
  averageSurveysCompleted: number;
  demographics?: Record<string, any>;
}

// Storage Service Types
export interface StorageFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  path: string;
  file: File | Buffer;
  metadata?: Record<string, any>;
  contentType?: string;
  upsert?: boolean;
}

export interface DownloadOptions {
  path: string;
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  };
}

// Service Error Types
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details, 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ServiceError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', undefined, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ServiceError {
  constructor(message: string = 'Authorization failed') {
    super(message, 'AUTHORIZATION_ERROR', undefined, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND_ERROR', undefined, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string = 'Resource conflict') {
    super(message, 'CONFLICT_ERROR', undefined, 409);
    this.name = 'ConflictError';
  }
}

// Service Configuration Types
export interface ServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
    idle: number;
  };
}

export interface CacheConfig {
  provider: 'memory' | 'redis';
  ttl: number;
  maxSize?: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
}
