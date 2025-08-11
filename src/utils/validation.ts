// Validation utilities for the survey application

import { VALIDATION_CONFIG, FILE_UPLOAD_CONFIG } from './constants';

/**
 * Email validation
 * @param email - Email to validate
 * @returns True if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  return VALIDATION_CONFIG.EMAIL_REGEX.test(email);
};

/**
 * Phone number validation
 * @param phone - Phone number to validate
 * @returns True if phone number is valid
 */
export const isValidPhone = (phone: string): boolean => {
  return VALIDATION_CONFIG.PHONE_REGEX.test(phone);
};

/**
 * URL validation
 * @param url - URL to validate
 * @returns True if URL is valid
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return VALIDATION_CONFIG.URL_REGEX.test(url);
  } catch {
    return false;
  }
};

/**
 * Password strength validation
 * @param password - Password to validate
 * @returns Object with validation result and error message
 */
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (password.length < VALIDATION_CONFIG.MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be at least ${VALIDATION_CONFIG.MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  if (password.length > VALIDATION_CONFIG.MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be less than ${VALIDATION_CONFIG.MAX_PASSWORD_LENGTH} characters long`,
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number',
    };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one special character',
    };
  }

  return { isValid: true };
};

/**
 * Username validation
 * @param username - Username to validate
 * @returns Object with validation result and error message
 */
export const validateUsername = (username: string): { isValid: boolean; error?: string } => {
  if (username.length < VALIDATION_CONFIG.MIN_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${VALIDATION_CONFIG.MIN_USERNAME_LENGTH} characters long`,
    };
  }

  if (username.length > VALIDATION_CONFIG.MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be less than ${VALIDATION_CONFIG.MAX_USERNAME_LENGTH} characters long`,
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  if (/^[0-9_]/.test(username)) {
    return {
      isValid: false,
      error: 'Username cannot start with a number or underscore',
    };
  }

  return { isValid: true };
};

/**
 * Survey question validation
 * @param question - Question object to validate
 * @returns Object with validation result and error message
 */
export const validateQuestion = (question: any): { isValid: boolean; error?: string } => {
  if (!question.text || question.text.trim() === '') {
    return {
      isValid: false,
      error: 'Question text is required',
    };
  }

  if (question.text.length > 500) {
    return {
      isValid: false,
      error: 'Question text must be less than 500 characters',
    };
  }

  if (!question.type || !['multiple_choice', 'single_choice', 'text_input', 'rating_scale', 'yes_no'].includes(question.type)) {
    return {
      isValid: false,
      error: 'Invalid question type',
    };
  }

  if (['multiple_choice', 'single_choice'].includes(question.type)) {
    if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
      return {
        isValid: false,
        error: 'Multiple choice and single choice questions must have at least 2 options',
      };
    }

    if (question.options.some((option: any) => !option.text || option.text.trim() === '')) {
      return {
        isValid: false,
        error: 'All options must have text',
      };
    }
  }

  if (question.type === 'rating_scale') {
    if (!question.minScale || !question.maxScale || question.minScale >= question.maxScale) {
      return {
        isValid: false,
        error: 'Rating scale must have valid min and max values',
      };
    }
  }

  return { isValid: true };
};

/**
 * Survey validation
 * @param survey - Survey object to validate
 * @returns Object with validation result and error message
 */
export const validateSurvey = (survey: any): { isValid: boolean; error?: string } => {
  if (!survey.title || survey.title.trim() === '') {
    return {
      isValid: false,
      error: 'Survey title is required',
    };
  }

  if (survey.title.length > 200) {
    return {
      isValid: false,
      error: 'Survey title must be less than 200 characters',
    };
  }

  if (!survey.categories || !Array.isArray(survey.categories) || survey.categories.length === 0) {
    return {
      isValid: false,
      error: 'Survey must have at least one category',
    };
  }

  for (const category of survey.categories) {
    if (!category.name || category.name.trim() === '') {
      return {
        isValid: false,
        error: 'Category name is required',
      };
    }

    if (!category.questions || !Array.isArray(category.questions) || category.questions.length === 0) {
      return {
        isValid: false,
        error: `Category "${category.name}" must have at least one question`,
      };
    }

    for (const question of category.questions) {
      const questionValidation = validateQuestion(question);
      if (!questionValidation.isValid) {
        return questionValidation;
      }
    }
  }

  return { isValid: true };
};

/**
 * File validation
 * @param file - File object to validate
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSize - Maximum file size in bytes
 * @returns Object with validation result and error message
 */
export const validateFile = (
  file: File,
  allowedTypes: string[] = [...FILE_UPLOAD_CONFIG.ALLOWED_FILE_TYPES],
  maxSize: number = FILE_UPLOAD_CONFIG.MAX_FILE_SIZE
): { isValid: boolean; error?: string } => {
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided',
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size must be less than ${maxSize / (1024 * 1024)}MB`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not allowed`,
    };
  }

  return { isValid: true };
};

/**
 * Numeric range validation
 * @param value - Value to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if value is within range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Required field validation
 * @param value - Value to validate
 * @returns True if value is not empty
 */
export const isRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

/**
 * Length validation
 * @param value - Value to validate
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @returns Object with validation result and error message
 */
export const validateLength = (
  value: string,
  minLength: number,
  maxLength: number
): { isValid: boolean; error?: string } => {
  if (value.length < minLength) {
    return {
      isValid: false,
      error: `Value must be at least ${minLength} characters long`,
    };
  }

  if (value.length > maxLength) {
    return {
      isValid: false,
      error: `Value must be less than ${maxLength} characters long`,
    };
  }

  return { isValid: true };
};

/**
 * Pattern validation
 * @param value - Value to validate
 * @param pattern - Regular expression pattern
 * @param errorMessage - Custom error message
 * @returns Object with validation result and error message
 */
export const validatePattern = (
  value: string,
  pattern: RegExp,
  errorMessage: string = 'Invalid format'
): { isValid: boolean; error?: string } => {
  if (!pattern.test(value)) {
    return {
      isValid: false,
      error: errorMessage,
    };
  }

  return { isValid: true };
};
