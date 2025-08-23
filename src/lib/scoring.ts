// src/lib/scoring.ts
// Pure scoring helpers that don't depend on question_options.
// They use question.choice_scores (array) to derive per-question min/max
// and normalize each answer to 0..1, then average to 0..100 per category.

export type Question = {
  id: string;
  prompt?: string;
  type?: string;               // 'radio' | 'select' | 'checkbox' | 'rating' | ...
  scorable?: boolean | null;
  weight?: number | null;
  choices?: unknown;           // labels (array or JSON string or PG "{...}" string)
  choice_scores?: unknown;     // scores (array or JSON string or PG "{...}" string)
  max_score?: number | null;   // optional legacy
};

export type Category = {
  id: string;
  title: string;
  weight?: number | null;
  questions: Question[];
};

export type Answer = {
  question_id: string;
  score?: number | null;       // if stored by backend
  value?: unknown;             // labels (string or array)
};

export type ComputeOpts = {
  treatMissingAsZero?: boolean;
  useQuestionWeights?: boolean;
  useCategoryWeights?: boolean;
};

export function pickRange(
  percent: number,
  ranges: Array<{ min_score: number; max_score: number; description: string; color?: string }>
) {
  const p = Math.round(percent);
  return ranges?.find(r => p >= r.min_score && p <= r.max_score) || null;
}

// --- Utilities ---

function parseArrayish(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map(String);

  if (typeof input === 'string') {
    const s = input.trim();
    // Try JSON first
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        // fall through to PG array parser
      }
    }
    // Postgres array format: {"Yes","No","Maybe"}
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1);
      if (!inner) return [];
      // split by commas that are not inside quotes (basic)
      const parts = inner.match(/"([^"]*)"|[^,]+/g) || [];
      return parts.map(p => p.replace(/^"|"$/g, ''));
    }
    // Single scalar string
    return [s];
  }

  // Fallback: try to coerce to string
  return [String(input)];
}

function parseNumberArrayish(input: unknown): number[] {
  const raw = parseArrayish(input);
  return raw.map(v => Number(v)).filter(v => !Number.isNaN(v));
}

function asArrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    // answers for checkbox often stored as "A, B, C"
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return value == null ? [] : [String(value)];
}

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Resolve a raw numeric score for one question, given an answer.
// Uses position-based scoring so admin can use any text for choices.
function resolveRawScore(q: Question, a?: Answer): number {
  if (!a) return 0;

  // ALWAYS calculate score from answer.value, ignore stored a.score
  // This ensures scoring reflects actual user choices, not cached values
  
  // Get choice labels and scores arrays
  const labels = parseArrayish(q.choices);
  const scores = parseNumberArrayish(q.choice_scores);

  const type = (q.type || '').toLowerCase();

  if (type === 'checkbox') {
    const selected = asArrayOfStrings(a.value);
    if (!selected.length || !labels.length || !scores.length) return 0;
    // Sum scores for all selected options based on their position
    return selected.reduce((sum, label) => {
      const idx = labels.indexOf(label);
      const s = idx >= 0 ? scores[idx] ?? 0 : 0;
      return sum + (Number.isFinite(s) ? s : 0);
    }, 0);
  }

  if (type === 'rating') {
    // rating value is usually the number selected (e.g., "3")
    const n = Number(Array.isArray(a.value) ? a.value[0] : a.value);
    return Number.isFinite(n) ? n : 0;
  }

  // radio/select (single choice) - position-based scoring
  const picked = Array.isArray(a.value) ? a.value[0] : a.value;
  if (picked == null) return 0;
  
  // Find the position of the selected choice in the labels array
  // Handle whitespace variations by trimming both the picked value and labels
  const pickedTrimmed = String(picked).trim();
  let idx = labels.indexOf(pickedTrimmed);
  
  // If exact match fails, try trimmed comparison
  if (idx === -1) {
    idx = labels.findIndex(label => String(label).trim() === pickedTrimmed);
  }
  
  if (idx === -1) {
    console.log(`[DEBUG] Choice "${picked}" not found in labels for question ${q.id}:`, labels);
    console.log(`[DEBUG] Tried trimmed comparison with "${pickedTrimmed}" against:`, labels.map(l => `"${String(l).trim()}"`));
    return 0;
  }
  
  // Get score from the corresponding position in scores array
  const s = scores[idx] ?? 0;
  console.log(`[DEBUG] Question ${q.id}: choice "${picked}" at position ${idx} = score ${s}`);
  return Number.isFinite(s) ? s : 0;
}

// Compute (qMin, qMax) for normalization
function questionMinMax(q: Question): { min: number; max: number } {
  const scores = parseNumberArrayish(q.choice_scores);
  if (scores.length) {
    return { min: Math.min(...scores), max: Math.max(...scores) };
  }
  // fallback: legacy max_score with min=0
  const max = typeof q.max_score === 'number' ? q.max_score : 1;
  return { min: 0, max: Math.max(1, max) };
}

// --- Main API ---

export function computeScores(
  categories: Category[],
  answers: Answer[],
  opts: ComputeOpts = { treatMissingAsZero: true, useQuestionWeights: false, useCategoryWeights: false }
): { categoryPercents: Record<string, number>; totalPercent: number } {
  const ansMap = new Map<string, Answer>();
  answers.forEach(a => ansMap.set(a.question_id, a));

  const categoryPercents: Record<string, number> = {};
  let totalAccum = 0;
  let totalWeight = 0;

  for (const cat of categories) {
    let catAccum = 0;
    let catWeight = 0;

    const catW = opts.useCategoryWeights && typeof cat.weight === 'number' && cat.weight > 0 ? cat.weight : 1;

    for (const q of cat.questions || []) {
      if (!q || q.scorable === false) continue;

      const a = ansMap.get(q.id);
      const { min, max } = questionMinMax(q);

      // If no answer and we don't want to count missing as zero, skip it
      if (!a && !opts.treatMissingAsZero) continue;

      const raw = resolveRawScore(q, a);
      const normalized = max === min ? (raw > min ? 1 : 0) : (raw - min) / (max - min);
      const qNorm = clamp01(normalized);

      const qW = opts.useQuestionWeights && typeof q.weight === 'number' && q.weight > 0 ? q.weight : 1;
      catAccum += qNorm * qW;
      catWeight += qW;
    }

    const catPct = catWeight > 0 ? (catAccum / catWeight) * 100 : 0;
    categoryPercents[cat.title] = Number(catPct.toFixed(2));
    totalAccum += catPct * catW;
    totalWeight += catW;
  }

  const totalPercent = totalWeight > 0 ? Number((totalAccum / totalWeight).toFixed(2)) : 0;
  return { categoryPercents, totalPercent };
}
