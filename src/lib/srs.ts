const STORAGE_KEY = 'guitar_study_srs_v1';

export interface SRSState {
  interval: number;       // days until next review
  repetitions: number;    // successful review streak
  easeFactor: number;     // multiplier, range 1.3–2.5, starts at 2.5
  dueDate: string;        // ISO date string
}

export function defaultSRSState(): SRSState {
  return { interval: 0, repetitions: 0, easeFactor: 2.5, dueDate: new Date().toISOString() };
}

export function isDue(state: SRSState): boolean {
  return new Date(state.dueDate) <= new Date();
}

/**
 * SM-2 update. quality: 0–5 where ≥3 = correct, <3 = incorrect.
 * Map study responses: first-attempt correct → 5, second-attempt → 3, wrong → 1.
 */
export function updateSRS(state: SRSState, quality: 0 | 1 | 2 | 3 | 4 | 5): SRSState {
  const { interval, repetitions, easeFactor } = state;
  let newInterval: number;
  let newReps: number;
  let newEF: number;

  if (quality >= 3) {
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * easeFactor);
    newReps = repetitions + 1;
    newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    newInterval = 1;
    newReps = 0;
    newEF = Math.max(1.3, easeFactor - 0.2);
  }

  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  return { interval: newInterval, repetitions: newReps, easeFactor: newEF, dueDate: due.toISOString() };
}

export function getSRSCardId(card: { kind: string; displayLabel?: string; label?: string }): string {
  return card.kind === 'chord' ? `chord-${card.displayLabel ?? ''}` : `interval-${card.label ?? ''}`;
}

export function loadSRSData(): Record<string, SRSState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SRSState>) : {};
  } catch { return {}; }
}

export function saveSRSData(data: Record<string, SRSState>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Orders cards for a study session: due cards first (sorted by overdue-ness),
 * then new cards, shuffled within each group.
 */
export function buildSRSDeck<T extends { kind: string; displayLabel?: string; label?: string }>(
  cards: T[],
  srsData: Record<string, SRSState>,
): T[] {
  const due: T[] = [];
  const newCards: T[] = [];

  for (const card of cards) {
    const id = getSRSCardId(card);
    const state = srsData[id];
    if (!state || isDue(state)) {
      if (state) due.push(card);
      else newCards.push(card);
    }
  }

  // Shuffle each group independently, then concatenate
  const shuffle = <U>(arr: U[]): U[] => [...arr].sort(() => Math.random() - 0.5);
  return [...shuffle(due), ...shuffle(newCards)];
}
