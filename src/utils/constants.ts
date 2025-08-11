// Application constants for the survey system

// Survey Configuration
export const SURVEY_CONFIG = {
  MAX_QUESTIONS_PER_CATEGORY: 20,
  MIN_QUESTIONS_PER_CATEGORY: 3,
  DEFAULT_TIME_LIMIT: 30, // minutes
  AUTO_SAVE_INTERVAL: 30000, // milliseconds
  MAX_RESPONSE_LENGTH: 1000, // characters
} as const;

// Scoring Configuration
export const SCORING_CONFIG = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  SCORE_PRECISION: 2,
  DEFAULT_WEIGHT: 1,
  PASSING_SCORE: 70,
  EXCELLENT_SCORE: 90,
} as const;

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // milliseconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 60000, // milliseconds
} as const;

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300, // milliseconds
  DEBOUNCE_DELAY: 500, // milliseconds
  THROTTLE_DELAY: 200, // milliseconds
  MAX_TOAST_MESSAGES: 5,
  TOAST_DURATION: 5000, // milliseconds
  MODAL_Z_INDEX: 1000,
  SIDEBAR_WIDTH: 300, // pixels
} as const;

// Validation Configuration
export const VALIDATION_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MAX_EMAIL_LENGTH: 254,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_REGEX: /^https?:\/\/.+/,
} as const;

// Database Configuration
export const DB_CONFIG = {
  MAX_CONNECTIONS: 10,
  CONNECTION_TIMEOUT: 30000, // milliseconds
  QUERY_TIMEOUT: 10000, // milliseconds
  POOL_MIN: 2,
  POOL_MAX: 10,
} as const;

// File Upload Configuration
export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
  ],
  MAX_FILES_PER_UPLOAD: 5,
  CHUNK_SIZE: 1024 * 1024, // 1MB
} as const;

// Email Configuration
export const EMAIL_CONFIG = {
  MAX_RECIPIENTS: 100,
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_SUBJECT_LENGTH: 200,
  MAX_BODY_LENGTH: 10000,
  DEFAULT_FROM: 'noreply@surveyapp.com',
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 3600, // seconds
  MAX_CACHE_SIZE: 1000, // entries
  CLEANUP_INTERVAL: 300, // seconds
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  JWT_EXPIRY: '24h',
  JWT_REFRESH_EXPIRY: '7d',
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  PASSWORD_SALT_ROUNDS: 12,
} as const;

// Survey Categories
export const SURVEY_CATEGORIES = [
  'Leadership',
  'Communication',
  'Problem Solving',
  'Teamwork',
  'Adaptability',
  'Technical Skills',
  'Customer Service',
  'Time Management',
  'Decision Making',
  'Creativity',
] as const;

// Question Types
export const QUESTION_TYPES = [
  'multiple_choice',
  'single_choice',
  'text_input',
  'rating_scale',
  'yes_no',
  'matrix',
  'ranking',
] as const;

// Response Types
export const RESPONSE_TYPES = [
  'single',
  'multiple',
  'text',
  'numeric',
  'date',
] as const;

// Report Formats
export const REPORT_FORMATS = [
  'pdf',
  'excel',
  'csv',
  'json',
  'html',
] as const;

// User Roles
export const USER_ROLES = [
  'admin',
  'manager',
  'user',
  'viewer',
] as const;

// Survey Status
export const SURVEY_STATUS = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  AUTH_ERROR: 'Authentication failed. Please log in again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  PERMISSION_ERROR: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'A conflict occurred with your request.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SURVEY_CREATED: 'Survey created successfully.',
  SURVEY_UPDATED: 'Survey updated successfully.',
  SURVEY_DELETED: 'Survey deleted successfully.',
  SURVEY_COMPLETED: 'Survey completed successfully.',
  RESPONSE_SAVED: 'Response saved successfully.',
  EMAIL_SENT: 'Email sent successfully.',
  FILE_UPLOADED: 'File uploaded successfully.',
  SETTINGS_UPDATED: 'Settings updated successfully.',
} as const;
