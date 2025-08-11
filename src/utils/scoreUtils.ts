// Utility functions for score calculations and ranges

export interface ScoreRange {
  min_score: number;
  max_score: number;
  description: string;
  color: string;
}

/**
 * Get the score range for a given score
 * @param score - The score to find the range for (0-1 scale)
 * @param ranges - Array of score ranges
 * @returns The matching score range or undefined
 */
export const getScoreRange = (score: number, ranges: ScoreRange[]): ScoreRange | undefined => {
  const percentage = Math.round(score * 100);
  return ranges.find(range => percentage >= range.min_score && percentage <= range.max_score);
};

/**
 * Calculate percentage from score
 * @param score - The raw score
 * @param maxScore - The maximum possible score
 * @returns Percentage (0-100)
 */
export const calculatePercentage = (score: number, maxScore: number): number => {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
};

/**
 * Normalize score to 0-1 scale
 * @param score - The raw score
 * @param maxScore - The maximum possible score
 * @returns Normalized score (0-1)
 */
export const normalizeScore = (score: number, maxScore: number): number => {
  if (maxScore === 0) return 0;
  return score / maxScore;
};

/**
 * Get color for score based on percentage
 * @param percentage - Score percentage (0-100)
 * @returns Color hex code
 */
export const getScoreColor = (percentage: number): string => {
  if (percentage >= 80) return '#22c55e'; // green
  if (percentage >= 60) return '#eab308'; // yellow
  if (percentage >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
};
