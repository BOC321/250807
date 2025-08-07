// Service layer for interacting with Supabase

import { createClient } from '@supabase/supabase-js';
import { 
  Survey, 
  Category, 
  Question, 
  Respondent, 
  Answer, 
  Result,
  RangeSetVersion
} from '../types';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Survey Service
 */
export class SurveyService {
  /**
   * Get a survey by ID
   */
  static async getSurveyById(id: string): Promise<Survey | null> {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching survey:', error);
      return null;
    }

    return data as Survey;
  }

  /**
   * Get categories for a survey
   */
  static async getCategoriesBySurveyId(surveyId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order');

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    return data as Category[];
  }

  /**
   * Get questions for a category
   */
  static async getQuestionsByCategoryId(categoryId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('category_id', categoryId)
      .order('order');

    if (error) {
      console.error('Error fetching questions:', error);
      return [];
    }

    return data as Question[];
  }

  /**
   * Get all questions for a survey
   */
  static async getQuestionsBySurveyId(surveyId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('questions.*')
      .join('categories', 'questions.category_id', 'categories.id')
      .eq('categories.survey_id', surveyId)
      .order('categories.order')
      .order('questions.order');

    if (error) {
      console.error('Error fetching questions:', error);
      return [];
    }

    return data as Question[];
  }

  /**
   * Get range set by ID
   */
  static async getRangeSetById(id: string): Promise<RangeSetVersion | null> {
    const { data, error } = await supabase
      .from('range_set_versions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching range set:', error);
      return null;
    }

    return data as RangeSetVersion;
  }
}

/**
 * Respondent Service
 */
export class RespondentService {
  /**
   * Create a new respondent
   */
  static async createRespondent(surveyId: string, surveyVersion: number, email?: string, meta?: any): Promise<Respondent> {
    const { data, error } = await supabase
      .from('respondents')
      .insert({
        survey_id: surveyId,
        survey_version: surveyVersion,
        email: email,
        meta: meta || {},
        consent: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating respondent: ${error.message}`);
    }

    return data as Respondent;
  }

  /**
   * Update respondent consent
   */
  static async updateConsent(respondentId: string, consent: boolean): Promise<Respondent> {
    const { data, error } = await supabase
      .from('respondents')
      .update({
        consent: consent,
        consent_timestamp: consent ? new Date().toISOString() : null
      })
      .eq('id', respondentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating consent: ${error.message}`);
    }

    return data as Respondent;
  }
}

/**
 * Answer Service
 */
export class AnswerService {
  /**
   * Save an answer
   */
  static async saveAnswer(respondentId: string, questionId: string, value: any, presentedOrder: number): Promise<Answer> {
    const { data, error } = await supabase
      .from('answers')
      .insert({
        respondent_id: respondentId,
        question_id: questionId,
        value: value,
        presented_order: presentedOrder
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error saving answer: ${error.message}`);
    }

    return data as Answer;
  }

  /**
   * Get answers by respondent ID
   */
  static async getAnswersByRespondentId(respondentId: string): Promise<Answer[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('respondent_id', respondentId);

    if (error) {
      console.error('Error fetching answers:', error);
      return [];
    }

    return data as Answer[];
  }
}

/**
 * Result Service
 */
export class ResultService {
  /**
   * Save results
   */
  static async saveResult(respondentId: string, perCategory: any[], overall: any, completedCount: number, scorableCount: number): Promise<Result> {
    const { data, error } = await supabase
      .from('results')
      .insert({
        respondent_id: respondentId,
        per_category: perCategory,
        overall: overall,
        completed_count: completedCount,
        scorable_count: scorableCount
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error saving result: ${error.message}`);
    }

    return data as Result;
  }

  /**
   * Get result by respondent ID
   */
  static async getResultByRespondentId(respondentId: string): Promise<Result | null> {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('respondent_id', respondentId)
      .single();

    if (error) {
      console.error('Error fetching result:', error);
      return null;
    }

    return data as Result;
  }
}
