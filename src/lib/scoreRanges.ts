// src/lib/scoreRanges.ts
import { createClient } from '@supabase/supabase-js';

export type ScoreRange = {
  id: string;
  survey_id: string;
  category_id: string | null;
  min_score: number;
  max_score: number;
  color: string | null;
  description: string | null;
};

const supabase =
  process.env['NEXT_PUBLIC_SUPABASE_URL'] && process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    ? createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
    : null;

export async function listScoreRanges(surveyId: string, categoryId: string | null) {
  if (!supabase) throw new Error('Supabase not initialised');
  let q = supabase.from('score_ranges').select('*').eq('survey_id', surveyId);
  q = categoryId ? q.eq('category_id', categoryId) : q.is('category_id', null);
  const { data, error } = await q.order('min_score', { ascending: true });
  if (error) throw error;
  return (data || []) as ScoreRange[];
}

export async function createScoreRange(payload: Omit<ScoreRange, 'id'>) {
  if (!supabase) throw new Error('Supabase not initialised');
  const { data, error } = await supabase.from('score_ranges').insert(payload).select().single();
  if (error) throw error;
  return data as ScoreRange;
}

export async function updateScoreRange(id: string, patch: Partial<ScoreRange>) {
  if (!supabase) throw new Error('Supabase not initialised');
  const { data, error } = await supabase.from('score_ranges').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as ScoreRange;
}

export async function deleteScoreRange(id: string) {
  if (!supabase) throw new Error('Supabase not initialised');
  const { error } = await supabase.from('score_ranges').delete().eq('id', id);
  if (error) throw error;
}
