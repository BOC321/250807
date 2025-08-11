// Base API service with common functionality

import axios from 'axios';
import { ApiResponse, PaginatedResponse, ServiceError } from '../types';

/**
 * Base API service class with common functionality
 */
export class BaseService {
  protected client: any;
  protected baseUrl: string;
  protected timeout: number;
  protected retries: number;

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_API_URL || '/api',
    timeout: number = 30000,
    retries: number = 3
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.retries = retries;

    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up request interceptor
    this.client.interceptors.request.use(
      (config: any) => {
        // Add authentication token if available
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Set up response interceptor
    this.client.interceptors.response.use(
      (response: any) => {
        return response;
      },
      async (error: any) => {
        const originalRequest = error.config as any & { _retry?: number };

        // Handle token refresh logic if needed
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          // Implement token refresh logic here
          // For now, just reject with the original error
          return Promise.reject(this.handleError(error));
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Generic GET request
   */
  protected async get<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.client.get(url, config);
      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Generic POST request
   */
  protected async post<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.client.post(url, data, config);
      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.client.put(url, data, config);
      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.client.delete(url, config);
      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Generic PATCH request
   */
  protected async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.client.patch(url, data, config);
      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Paginated GET request
   */
  protected async getPaginated<T>(
    url: string,
    page: number = 1,
    limit: number = 10,
    config?: any
  ): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.get(url, {
        ...config,
        params: {
          ...config?.params,
          page,
          limit,
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Upload file
   */
  protected async uploadFile<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    config?: any
  ): Promise<T> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.client.post(url, formData, {
        ...config,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });

      return response.data.data as T;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Download file
   */
  protected async downloadFile(url: string, config?: any): Promise<Blob> {
    try {
      const response = await this.client.get(url, {
        ...config,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error as any);
    }
  }

  /**
   * Retry request with exponential backoff
   */
  protected async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = this.retries
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Handle API errors and convert to ServiceError
   */
  protected handleError(error: any): ServiceError {
    if (error.response) {
      const status = error.response.status;
      const message = (error.response.data as any)?.message || error.message;

      switch (status) {
        case 400:
          return new ServiceError('Bad Request', message, 'VALIDATION_ERROR', status);
        case 401:
          return new ServiceError('Unauthorized', message, 'AUTHENTICATION_ERROR', status);
        case 403:
          return new ServiceError('Forbidden', message, 'AUTHORIZATION_ERROR', status);
        case 404:
          return new ServiceError('Not Found', message, 'NOT_FOUND_ERROR', status);
        case 409:
          return new ServiceError('Conflict', message, 'CONFLICT_ERROR', status);
        case 422:
          return new ServiceError('Unprocessable Entity', message, 'VALIDATION_ERROR', status);
        case 429:
          return new ServiceError('Too Many Requests', message, 'RATE_LIMIT_ERROR', status);
        case 500:
          return new ServiceError('Internal Server Error', message, 'INTERNAL_ERROR', status);
        case 502:
        case 503:
        case 504:
          return new ServiceError('Service Unavailable', message, 'SERVICE_UNAVAILABLE_ERROR', status);
        default:
          return new ServiceError('API Error', message, 'API_ERROR', status);
      }
    } else if (error.request) {
      return new ServiceError('Network Error', 'No response received from server', 'NETWORK_ERROR', 0);
    } else {
      return new ServiceError('Request Error', error.message || 'Unknown error occurred', 'REQUEST_ERROR', 0);
    }
  }

  /**
   * Set authentication token
   */
  public setAuthToken(token: string): void {
    this.client.defaults.headers = this.client.defaults.headers || {};
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Clear authentication token
   */
  public clearAuthToken(): void {
    if (this.client.defaults.headers) {
      delete this.client.defaults.headers.Authorization;
    }
  }

  /**
   * Set default headers
   */
  public setDefaultHeaders(headers: Record<string, string>): void {
    this.client.defaults.headers = {
      ...this.client.defaults.headers,
      ...headers,
    };
  }

  /**
   * Get client instance for custom requests
   */
  public getClient(): any {
    return this.client;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}
