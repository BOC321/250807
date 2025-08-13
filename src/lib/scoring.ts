// src/lib/scoring.ts
export type Choice = { score?: number; value?: number; label?: string };
export type Question = {
  id: string;
  prompt?: string;
  weight?: number | null;
  scorable?: boolean | null;
  meta?: { choices?: Choice[] } | null;
  question_options?: { score?: number | null; label?: string | null }[]; // table form
};
export type Category = { id: string; title: string; weight?: number | null; questions?: Question[] };
export type Answer = { question_id: string; score?: number | null }; // assume numeric scoring in answers

function getOptionScores(q: Question): number[] {
  const table = (q.question_options ?? [])
    .map(o => Number(o.score))
    .filter(Number.isFinite);
  if (table.length) return table;

  const json = (q.meta?.choices ?? [])
    .map(c => Number((c.score ?? c.value)))
    .filter(Number.isFinite);
  return json;
}

function normaliseAnswer(q: Question, raw: number | null | undefined): number {
  const scores = getOptionScores(q);
  if (scores.length === 0) return 0;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (!(max > min)) return 0;                  // avoid divide-by-zero
  const r = Number(raw) || 0;
  const frac = (r - min) / (max - min);
  return Math.max(0, Math.min(frac, 1));       // clamp 0..1
}

export function computeScores(
  categories: Category[] | undefined,
  answers: Answer[] | undefined,
  opts?: {
    treatMissingAsZero?: boolean;   // default true
    useQuestionWeights?: boolean;   // default true
    useCategoryWeights?: boolean;   // default false
  }
): { categoryPercents: Record<string, number>; totalPercent: number } {
  const {
    treatMissingAsZero = true,
    useQuestionWeights = true,
    useCategoryWeights = false,
  } = opts ?? {};

  const ansByQ = new Map((answers ?? []).map(a => [a.question_id, a]));
  const categoryPercents: Record<string, number> = {};
  let globalNum = 0, globalDen = 0;

  for (const cat of categories ?? []) {
    let catNum = 0, catDen = 0;
    const catW = useCategoryWeights ? (Number(cat.weight) || 1) : 1;

    for (const q of cat.questions ?? []) {
      if (q.scorable === false) continue;

      const ans = ansByQ.get(q.id);
      const has = ans && ans.score != null;
      if (!has && !treatMissingAsZero) continue;

      const frac = normaliseAnswer(q, ans?.score);          // 0..1
      const qW = useQuestionWeights ? (Number(q.weight) || 1) : 1;

      catNum += frac * qW;
      catDen += 1 * qW;

      globalNum += frac * qW * catW;
      globalDen += 1   * qW * catW;
    }

    categoryPercents[cat.title] = catDen > 0 ? +((catNum / catDen) * 100).toFixed(2) : 0;
  }

  const totalPercent = globalDen > 0 ? +((globalNum / globalDen) * 100).toFixed(2) : 0;
  return { categoryPercents, totalPercent };
}

// Helper to pick a range from 0..100 thresholds
export function pickRange(percentage: number, ranges: { min_score: number; max_score: number; description?: string; color?: string }[]) {
  return ranges.find(r => percentage >= r.min_score && percentage <= r.max_score) || null;
}
