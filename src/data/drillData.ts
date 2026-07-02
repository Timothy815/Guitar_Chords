export interface DrillStep {
  stringIdx: number;
  fret: number;
  finger?: 1 | 2 | 3 | 4;
  pick?: 'down' | 'up' | 'p' | 'i' | 'm' | 'a';
}

export interface Drill {
  id: string;
  hand: 'fretting' | 'picking';
  category: 'chromatic' | 'spider' | 'legato' | 'stretch'
           | 'alternate' | 'economy' | 'pima' | 'travis';
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

// Diagonal spider crawl: 3 windows of 4 adjacent strings (ascending or descending).
// Each window plays fingers 1–4 one at a time on consecutive strings, same relative
// frets. Ascending shifts from low-E toward high-E; descending reverses.
function spiderCrawl(startFret: number, descending = false): DrillStep[] {
  const windows = descending ? [2, 1, 0] : [0, 1, 2];
  return windows.flatMap(s => {
    const notes: DrillStep[] = [
      { stringIdx: s,     fret: startFret,     finger: 1 as const },
      { stringIdx: s + 1, fret: startFret + 1, finger: 2 as const },
      { stringIdx: s + 2, fret: startFret + 2, finger: 3 as const },
      { stringIdx: s + 3, fret: startFret + 3, finger: 4 as const },
    ];
    return descending ? [...notes].reverse() : notes;
  });
}

// Skip-string spider: each window weaves through strings with a 1-string gap,
// giving the picking hand a skip-string challenge while frets still advance smoothly.
function spiderSkip(startFret: number): DrillStep[] {
  return [0, 1, 2].flatMap(s => [
    { stringIdx: s,     fret: startFret,     finger: 1 as const },
    { stringIdx: s + 2, fret: startFret + 1, finger: 2 as const },
    { stringIdx: s + 1, fret: startFret + 2, finger: 3 as const },
    { stringIdx: s + 3, fret: startFret + 3, finger: 4 as const },
  ]);
}

// ─── Drill definitions ────────────────────────────────────────────────────────

export const DRILLS: Drill[] = [
  // ── Chromatic ──────────────────────────────────────────────────────────────
  {
    id: 'chromatic-1234',
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
    category: 'spider',
    name: 'Ascending Spider',
    description: 'Four fingers crawl diagonally up the strings, low E to high E. Each group of 4 shifts one string at a time.',
    steps: spiderCrawl(5),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'spider-descending',
    hand: 'fretting',
    category: 'spider',
    name: 'Descending Spider',
    description: 'Same diagonal crawl reversed, high E to low E. Descending often exposes weakness.',
    steps: spiderCrawl(5, true),
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'spider-skip',
    hand: 'fretting',
    category: 'spider',
    name: 'Skip-String Spider',
    description: 'Crawls across the neck but skips a string on each finger 1→2 and finger 3→4 move. Harder picking-hand accuracy.',
    steps: spiderSkip(5),
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 90,
    bpmStep: 5,
  },

  // ── Legato ─────────────────────────────────────────────────────────────────
  {
    id: 'legato-ho-chain',
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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
    hand: 'fretting',
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

  // ── Alternate ──────────────────────────────────────────────────────────────
  {
    id: 'alt-single-string',
    hand: 'picking',
    category: 'alternate',
    name: 'Single-String Alternate',
    description: 'Down-up on one string. The foundational alternate picking drill.',
    steps: [
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 6, finger: 2, pick: 'up' },
      { stringIdx: 2, fret: 7, finger: 3, pick: 'down' },
      { stringIdx: 2, fret: 8, finger: 4, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-crossing-asc',
    hand: 'picking',
    category: 'alternate',
    name: 'String Crossing Ascending',
    description: 'One note per string from low E to high E. Pick direction never resets at string changes.',
    steps: [
      { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-crossing-desc',
    hand: 'picking',
    category: 'alternate',
    name: 'String Crossing Descending',
    description: 'One note per string from high e to low E. Descending direction exposes reverse-pick weakness.',
    steps: [
      { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-3nps',
    hand: 'picking',
    category: 'alternate',
    name: 'Three Notes Per String',
    description: 'Three fretted notes per string before crossing. Pick alternates continuously; starting direction shifts each string.',
    steps: [
      { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 0, fret: 6, finger: 2, pick: 'up' },
      { stringIdx: 0, fret: 7, finger: 3, pick: 'down' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 1, fret: 6, finger: 2, pick: 'down' },
      { stringIdx: 1, fret: 7, finger: 3, pick: 'up' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 6, finger: 2, pick: 'up' },
      { stringIdx: 2, fret: 7, finger: 3, pick: 'down' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 3, fret: 6, finger: 2, pick: 'down' },
      { stringIdx: 3, fret: 7, finger: 3, pick: 'up' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 4, fret: 6, finger: 2, pick: 'up' },
      { stringIdx: 4, fret: 7, finger: 3, pick: 'down' },
      { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 5, fret: 6, finger: 2, pick: 'down' },
      { stringIdx: 5, fret: 7, finger: 3, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },

  // ── Economy ────────────────────────────────────────────────────────────────
  {
    id: 'eco-ascending',
    hand: 'picking',
    category: 'economy',
    name: 'Ascending Economy',
    description: 'One note per string ascending. No direction reversal on string change — all downstrokes.',
    steps: [
      { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'eco-descending',
    hand: 'picking',
    category: 'economy',
    name: 'Descending Economy',
    description: 'One note per string descending. All upstrokes — no reversal when crossing down.',
    steps: [
      { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'eco-sweep-3',
    hand: 'picking',
    category: 'economy',
    name: '3-String Sweep',
    description: 'Continuous sweep across 3 adjacent strings in one direction. The foundation of sweep picking.',
    steps: [
      { stringIdx: 0, fret: 7, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 7, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 7, finger: 1, pick: 'down' },
    ],
    startFret: 7,
    bpmStart: 30,
    bpmTarget: 80,
    bpmStep: 5,
  },

  // ── PIMA ───────────────────────────────────────────────────────────────────
  {
    id: 'pima-open-pima',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-a Open Strings',
    description: 'Classical ascending arpeggio — thumb on bass, then three treble fingers in sequence. Entry point for classical fingerpicking.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 0, pick: 'a' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-open-pami',
    hand: 'picking',
    category: 'pima',
    name: 'p-a-m-i Open Strings',
    description: 'Descending arpeggio from high e back down. Builds reverse finger independence.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-open-pimi',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-i Open Strings',
    description: 'Middle finger returns between each note — a common classical pattern that builds middle-finger agility.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  // ── Travis ─────────────────────────────────────────────────────────────────
  {
    id: 'travis-open-basic',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Basic Open Strings',
    description: 'Alternating thumb bass (low E / A) plus index on the off-beat. The core Travis mechanic on open strings.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'travis-open-full',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Full Pattern Open Strings',
    description: 'Full p-i-p-m pattern — thumb alternates bass while index and middle alternate melody. Open strings only.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
];
