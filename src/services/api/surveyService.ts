// Survey API service with organized methods

import { createClient } from '@supabase/supabase-js';
import { 
  Survey, 
  Category, 
  Question, 
  Respondent, 
  Answer, 
  Result,
  SurveyStatus
} from '../../types';
import { 
  ServiceError,
  NotFoundError,
  ValidationError 
} from '../types';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SurveyService {
  /**
   * Get a survey by ID
   */
  static async getSurveyById(id: string): Promise<Survey | null> {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Survey not found');
        }
        throw new ServiceError('Error fetching survey', 'DB_ERROR', error);
      }

      return data as Survey;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get survey', 'GET_SURVEY_ERROR', error);
    }
  }

  /**
   * Get categories for a survey
   */
  static async getCategoriesBySurveyId(surveyId: string): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('surveyId', surveyId)
        .order('order');

      if (error) {
        throw new ServiceError('Error fetching categories', 'DB_ERROR', error);
      }

      return data as Category[];
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get categories', 'GET_CATEGORIES_ERROR', error);
    }
  }

  /**
   * Get questions for a category
   */
  static async getQuestionsByCategoryId(categoryId: string): Promise<Question[]> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('categoryId', categoryId)
        .order('order');

      if (error) {
        throw new ServiceError('Error fetching questions', 'DB_ERROR', error);
      }

      return data as Question[];
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get questions', 'GET_QUESTIONS_ERROR', error);
    }
  }

  /**
   * Get complete survey data
   */
  static async getCompleteSurvey(surveyId: string): Promise<{
    survey: Survey;
    categories: Category[];
    questions: Question[];
  } | null> {
    try {
      const survey = await this.getSurveyById(surveyId);
      if (!survey) {
        return null;
      }

      const categories = await this.getCategoriesBySurveyId(surveyId);
      const questions: Question[] = [];

      for (const category of categories) {
        const categoryQuestions = await this.getQuestionsByCategoryId(category.id);
        questions.push(...categoryQuestions);
      }

      return { survey, categories, questions };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get complete survey', 'GET_COMPLETE_SURVEY_ERROR', error);
    }
  }

  /**
   * List surveys
   */
  static async listSurveys(status?: SurveyStatus): Promise<Survey[]> {
    try {
      let query = supabase
        .from('surveys')
        .select('*')
        .order('createdAt', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw new ServiceError('Error fetching surveys', 'DB_ERROR', error);
      }

      return data as Survey[];
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to list surveys', 'LIST_SURVEYS_ERROR', error);
    }
  }

  /**
   * Create a new survey
   */
  static async createSurvey(surveyData: Omit<Survey, 'id' | 'createdAt' | 'updatedAt'>): Promise<Survey> {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .insert({
          ...surveyData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new ServiceError('Error creating survey', 'DB_ERROR', error);
      }

      return data as Survey;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to create survey', 'CREATE_SURVEY_ERROR', error);
    }
  }

  /**
   * Update a survey
   */
  static async updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey> {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .update({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new ServiceError('Error updating survey', 'DB_ERROR', error);
      }

      return data as Survey;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to update survey', 'UPDATE_SURVEY_ERROR', error);
    }
  }

  /**
   * Delete a survey
   */
  static async deleteSurvey(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) {
        throw new ServiceError('Error deleting survey', 'DB_ERROR', error);
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to delete survey', 'DELETE_SURVEY_ERROR', error);
    }
  }

  /**
   * Create a respondent
   */
  static async createRespondent(respondentData: Omit<Respondent, 'id' | 'createdAt'>): Promise<Respondent> {
    try {
      const { data, error } = await supabase
        .from('respondents')
        .insert({
          ...respondentData,
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new ServiceError('Error creating respondent', 'DB_ERROR', error);
      }

      return data as Respondent;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to create respondent', 'CREATE_RESPONDENT_ERROR', error);
    }
  }

  /**
   * Submit survey answers
   */
  static async submitAnswers(answers: Omit<Answer, 'id' | 'createdAt'>[]): Promise<Answer[]> {
    try {
      const answersWithTimestamp = answers.map(answer => ({
        ...answer,
        createdAt: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('answers')
        .insert(answersWithTimestamp)
        .select();

      if (error) {
        throw new ServiceError('Error submitting answers', 'DB_ERROR', error);
      }

      return data as Answer[];
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to submit answers', 'SUBMIT_ANSWERS_ERROR', error);
    }
  }

  /**
   * Get survey results for a respondent
   */
  static async getSurveyResult(respondentId: string): Promise<Result | null> {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('respondentId', respondentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new ServiceError('Error fetching result', 'DB_ERROR', error);
      }

      return data as Result;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get survey result', 'GET_RESULT_ERROR', error);
    }
  }

  /**
   * Create survey result
   */
  static async createResult(resultData: Omit<Result, 'id' | 'createdAt'>): Promise<Result> {
    try {
      const { data, error } = await supabase
        .from('results')
        .insert({
          ...resultData,
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new ServiceError('Error creating result', 'DB_ERROR', error);
      }

      return data as Result;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to create result', 'CREATE_RESULT_ERROR', error);
    }
  }

  /**
   * Get answers for a respondent
   */
  static async getRespondentAnswers(respondentId: string): Promise<Answer[]> {
    try {
      const { data, error } = await supabase
        .from('answers')
        .select('*')
        .eq('respondentId', respondentId)
        .order('presentedOrder');

      if (error) {
        throw new ServiceError('Error fetching answers', 'DB_ERROR', error);
      }

      return data as Answer[];
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to get respondent answers', 'GET_ANSWERS_ERROR', error);
    }
  }
}
