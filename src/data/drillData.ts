export interface DrillStep {
  stringIdx: number;
  fret: number;
  finger: 1 | 2 | 3 | 4;
}

export interface Drill {
  id: string;
  category: 'chromatic' | 'spider' | 'legato' | 'stretch';
  name: string;
  description: string;
  safetyNote?: string;
  steps: DrillStep[];
  startFret: number;
  bpmStart: number;
  bpmTarget: number;
  bpmStep: number;
}

const STORAGE_KEY = 'guitarmaster_drill_bests';

export function getDrillBest(drillId: string): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, number>;
    return parsed[drillId] ?? null;
  } catch {
    return null;
  }
}

export function saveDrillBest(drillId: string, bpm: number): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: Record<string, number> = stored ? JSON.parse(stored) : {};
    if ((parsed[drillId] ?? 0) < bpm) {
      parsed[drillId] = bpm;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // localStorage unavailable in this environment
  }
}

// ─── Internal step-builder helpers ───────────────────────────────────────────

type FingerStep = [number, 1 | 2 | 3 | 4]; // [fretOffset, finger]

// Builds steps for a pattern repeated across all 6 strings (low E → high E)
function allStrings(sequence: FingerStep[], startFret: number): DrillStep[] {
  const steps: DrillStep[] = [];
  for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
    for (const [off, finger] of sequence) {
      steps.push({ stringIdx, fret: startFret + off, finger });
    }
  }
  return steps;
}

// Builds spider steps across given string pairs
function spider(startFret: number, pairs: [number, number][]): DrillStep[] {
  return pairs.flatMap(([strA, strB]) => [
    { stringIdx: strA, fret: startFret,     finger: 1 as const },
    { stringIdx: strB, fret: startFret + 1, finger: 2 as const },
    { stringIdx: strA, fret: startFret + 2, finger: 3 as const },
    { stringIdx: strB, fret: startFret + 3, finger: 4 as const },
  ]);
}

const ADJ_PAIRS: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[4,5]];
const SKIP_PAIRS: [number, number][] = [[0,2],[1,3],[2,4],[3,5]];

// ─── Drill definitions ────────────────────────────────────────────────────────

export const DRILLS: Drill[] = [
  // ── Chromatic ──────────────────────────────────────────────────────────────
  {
    id: 'chromatic-1234',
    category: 'chromatic',
    name: '1-2-3-4 Crawl',
    description: 'All four fingers in sequence across every string. The foundation of finger independence.',
    steps: allStrings([[0,1],[1,2],[2,3],[3,4]], 5),
    startFret: 5,
    bpmStart: 60,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'chromatic-1324',
    category: 'chromatic',
    name: '1-3-2-4 Permutation',
    description: 'Crossing pattern. Builds independence between the middle and ring fingers.',
    steps: allStrings([[0,1],[2,3],[1,2],[3,4]], 5),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'chromatic-1423',
    category: 'chromatic',
    name: '1-4-2-3 Permutation',
    description: 'Index to pinky first, then the middle pair. Challenges the pinky-to-index leap.',
    steps: allStrings([[0,1],[3,4],[1,2],[2,3]], 5),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'chromatic-4321',
    category: 'chromatic',
    name: '4-3-2-1 Reverse Crawl',
    description: 'Pinky leads descending. Many players are weaker in this direction — this fixes it.',
    steps: allStrings([[3,4],[2,3],[1,2],[0,1]], 5),
    startFret: 5,
    bpmStart: 60,
    bpmTarget: 120,
    bpmStep: 5,
  },

  // ── Spider ─────────────────────────────────────────────────────────────────
  {
    id: 'spider-ascending',
    category: 'spider',
    name: 'Ascending Spider',
    description: 'Diagonal pattern across adjacent string pairs, low E to high E. Builds string-crossing control.',
    steps: spider(5, ADJ_PAIRS),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'spider-descending',
    category: 'spider',
    name: 'Descending Spider',
    description: 'Same diagonal pattern reversed, high E to low E. Descending often exposes weakness.',
    steps: spider(5, [...ADJ_PAIRS].reverse()),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'spider-skip',
    category: 'spider',
    name: 'Skip-String Spider',
    description: 'Jumps one string per step. Harder string-crossing control; exposes picking-hand accuracy.',
    steps: spider(5, SKIP_PAIRS),
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 90,
    bpmStep: 5,
  },

  // ── Legato ─────────────────────────────────────────────────────────────────
  {
    id: 'legato-ho-chain',
    category: 'legato',
    name: 'Hammer-On Chain',
    description: 'Pick only the first note — hammer all others. Builds fretting-hand attack and tone.',
    steps: [
      { stringIdx: 3, fret: 5, finger: 1 },
      { stringIdx: 3, fret: 6, finger: 2 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 3, fret: 8, finger: 4 },
    ],
    startFret: 5,
    bpmStart: 60,
    bpmTarget: 130,
    bpmStep: 5,
  },
  {
    id: 'legato-po-chain',
    category: 'legato',
    name: 'Pull-Off Chain',
    description: 'Pick the top note, pull off down to each lower fret. Builds pull-off strength and evenness.',
    steps: [
      { stringIdx: 3, fret: 8, finger: 4 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 3, fret: 6, finger: 2 },
      { stringIdx: 3, fret: 5, finger: 1 },
    ],
    startFret: 5,
    bpmStart: 60,
    bpmTarget: 130,
    bpmStep: 5,
  },
  {
    id: 'legato-alt',
    category: 'legato',
    name: 'Alternating Hammer/Pull',
    description: 'Ascend with hammers, descend with pull-offs — no re-picking. Full legato loop.',
    steps: [
      { stringIdx: 3, fret: 5, finger: 1 },
      { stringIdx: 3, fret: 6, finger: 2 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 3, fret: 8, finger: 4 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 3, fret: 6, finger: 2 },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 110,
    bpmStep: 5,
  },
  {
    id: 'legato-2string',
    category: 'legato',
    name: 'Two-String Legato Roll',
    description: 'Hammer and pull across G and B strings. Builds cross-string legato coordination.',
    steps: [
      { stringIdx: 3, fret: 5, finger: 1 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 4, fret: 5, finger: 1 },
      { stringIdx: 4, fret: 7, finger: 3 },
      { stringIdx: 4, fret: 7, finger: 3 },
      { stringIdx: 4, fret: 5, finger: 1 },
      { stringIdx: 3, fret: 7, finger: 3 },
      { stringIdx: 3, fret: 5, finger: 1 },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },

  // ── Stretch ────────────────────────────────────────────────────────────────
  {
    id: 'stretch-124',
    category: 'stretch',
    name: '1-2-4 Stretch',
    description: 'Skips the ring finger. Widens the index-to-pinky span while bypassing finger 3.',
    safetyNote: 'Keep your thumb behind the neck. Stop if you feel any tightness in your palm.',
    steps: allStrings([[0,1],[1,2],[3,4]], 7),
    startFret: 7,
    bpmStart: 50,
    bpmTarget: 90,
    bpmStep: 5,
  },
  {
    id: 'stretch-134',
    category: 'stretch',
    name: '1-3-4 Stretch',
    description: 'Skips the middle finger. Builds ring and pinky independence on a wider span.',
    safetyNote: 'Keep your thumb behind the neck. Stop if you feel any tightness in your palm.',
    steps: allStrings([[0,1],[2,3],[3,4]], 7),
    startFret: 7,
    bpmStart: 50,
    bpmTarget: 90,
    bpmStep: 5,
  },
  {
    id: 'stretch-1235',
    category: 'stretch',
    name: 'Four-Fret Span',
    description: 'Fingers 1-2-3 on consecutive frets, pinky stretches an extra fret. Serious reach builder.',
    safetyNote: 'Warm up thoroughly first. Stop immediately at any discomfort — this is a demanding stretch.',
    steps: allStrings([[0,1],[1,2],[2,3],[4,4]], 7),
    startFret: 7,
    bpmStart: 40,
    bpmTarget: 80,
    bpmStep: 5,
  },
  {
    id: 'stretch-shift',
    category: 'stretch',
    name: 'Shift Stretch',
    description: 'Standard 1-2-3-4 pattern shifting up one fret per repetition. Practices position shifts under stretch conditions.',
    safetyNote: 'Move slowly between positions. Never force the stretch — the shift should feel controlled.',
    steps: allStrings([[0,1],[1,2],[2,3],[3,4]], 7),
    startFret: 7,
    bpmStart: 40,
    bpmTarget: 80,
    bpmStep: 5,
  },
];
