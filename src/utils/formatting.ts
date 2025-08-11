// Formatting utilities for the survey application

/**
 * Format date to localized string
 * @param date - Date to format
 * @param format - Format style ('short', 'medium', 'long', 'full')
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' | 'full' = 'medium',
  locale: string = 'en-US'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    short: { dateStyle: 'short' as const },
    medium: { dateStyle: 'medium' as const, timeStyle: 'short' as const },
    long: { dateStyle: 'long' as const, timeStyle: 'short' as const },
    full: { dateStyle: 'full' as const, timeStyle: 'long' as const },
  }[format];

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
};

/**
 * Format number with locale-specific formatting
 * @param number - Number to format
 * @param options - Formatting options
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted number string
 */
export const formatNumber = (
  number: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, options).format(number);
};

/**
 * Format currency
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Format percentage
 * @param value - Value to format (0-1)
 * @param decimals - Number of decimal places (default: 1)
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format duration in human readable format
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format phone number
 * @param phone - Phone number to format
 * @param format - Format style ('us', 'international', 'e164')
 * @returns Formatted phone number string
 */
export const formatPhoneNumber = (
  phone: string,
  format: 'us' | 'international' | 'e164' = 'us'
): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  if (format === 'e164') {
    return `+${cleaned}`;
  }

  if (cleaned.length === 10) {
    if (format === 'us') {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `+1 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
  }

  return phone; // Return original if format fails
};

/**
 * Format text with proper capitalization
 * @param text - Text to format
 * @param style - Capitalization style ('title', 'sentence', 'upper', 'lower')
 * @returns Formatted text string
 */
export const formatText = (
  text: string,
  style: 'title' | 'sentence' | 'upper' | 'lower' = 'sentence'
): string => {
  if (!text) return '';

  switch (style) {
    case 'title':
      return text.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    case 'sentence':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    default:
      return text;
  }
};

/**
 * Format score with color coding
 * @param score - Score to format (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Object with formatted score and color class
 */
export const formatScore = (
  score: number,
  decimals: number = 1
): { formatted: string; colorClass: string } => {
  const formatted = score.toFixed(decimals);
  let colorClass = '';

  if (score >= 90) {
    colorClass = 'text-green-600';
  } else if (score >= 80) {
    colorClass = 'text-blue-600';
  } else if (score >= 70) {
    colorClass = 'text-yellow-600';
  } else if (score >= 60) {
    colorClass = 'text-orange-600';
  } else {
    colorClass = 'text-red-600';
  }

  return { formatted, colorClass };
};

/**
 * Format relative time (e.g., "2 hours ago")
 * @param date - Date to format
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (
  date: Date | string,
  locale: string = 'en-US'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return rtf.format(-years, 'year');
  if (months > 0) return rtf.format(-months, 'month');
  if (weeks > 0) return rtf.format(-weeks, 'week');
  if (days > 0) return rtf.format(-days, 'day');
  if (hours > 0) return rtf.format(-hours, 'hour');
  if (minutes > 0) return rtf.format(-minutes, 'minute');
  return rtf.format(-seconds, 'second');
};

/**
 * Format list with conjunction (e.g., "A, B, and C")
 * @param items - Array of items to format
 * @param conjunction - Conjunction word (default: 'and')
 * @returns Formatted list string
 */
export const formatList = (items: string[], conjunction: string = 'and'): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  
  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  
  return `${rest.join(', ')}, ${conjunction} ${last}`;
};

/**
 * Format number with ordinal suffix (e.g., "1st", "2nd", "3rd")
 * @param number - Number to format
 * @returns Formatted ordinal string
 */
export const formatOrdinal = (number: number): string => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = number % 100;
  
  return number + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
};

/**
 * Format bytes to human readable format
 * @param bytes - Bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted bytes string
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
