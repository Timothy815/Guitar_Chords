# Technique Drills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/technique` page with four categories of fretting-hand dexterity drills (Chromatic, Spider, Legato, Stretch), each featuring a fretboard pattern display, BPM ladder with self-report progression, and localStorage-persisted personal bests.

**Architecture:** Four files change. `Fretboard.tsx` gains a `drillDots` prop that force-renders labeled finger-number dots independently of any scale/chord prop. `drillData.ts` defines all 15 drills with typed step arrays and localStorage persistence helpers. `Technique.tsx` is the full page (tab row → drill selector grid → trainer panel with click track). `App.tsx` adds the route and nav link.

**Tech Stack:** React 19, TypeScript, Tailwind v4, existing `Fretboard` component, `playClick` / `initAudio` from `src/lib/audio.ts`, `Dumbbell` icon from `lucide-react`.

## Global Constraints

- New files: `src/pages/Technique.tsx`, `src/data/drillData.ts`
- Modified files: `src/components/Fretboard.tsx` (drillDots prop), `src/App.tsx` (route + nav)
- No new dependencies
- localStorage key: `guitarmaster_drill_bests` — `Record<string, number>` (drill id → highest clean BPM ever)
- All audio via `playClick` and `initAudio` from `src/lib/audio.ts`
- Fretboard coordinate system: `stringIdx 0` = low E, `stringIdx 5` = high E
- `npm run lint` (tsc --noEmit) must pass with zero errors after every task

---

## Task 1: Add `drillDots` prop to Fretboard.tsx

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Context:**
The existing `Fretboard` component only renders dots for positions that appear in a `chord` or `scale` prop. Technique drills need to show arbitrary labeled dots (finger numbers 1–4) without a scale or chord. The `drillDots` prop solves this: it force-renders a dot at each specified position with a custom label, regardless of whether scale/chord is active.

**Interfaces:**
- Produces: `drillDots?: { stringIdx: number; fret: number; label: string }[]` prop on `Fretboard` — used by Task 3.

- [ ] **Step 1: Add `drillDots` to `FretboardProps` and destructure it**

Open `src/components/Fretboard.tsx`. Find the `FretboardProps` interface (around line 31). Add `drillDots` as the last property before the closing `}`:

```ts
// In FretboardProps interface, add after flashHighlight:
drillDots?: { stringIdx: number; fret: number; label: string }[];
```

Find the function signature line that starts `export function Fretboard({`. Add `, drillDots` inside the destructure, before `}: FretboardProps)`:

```ts
// Before: ... flashHighlight, tuning = STANDARD_TUNING }: FretboardProps) {
// After:
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, scalePositions, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote, labeledDots, flashHighlight, tuning = STANDARD_TUNING, drillDots }: FretboardProps) {
```

- [ ] **Step 2: Insert the drillDot override inside `renderNoteMarker`**

Inside `renderNoteMarker`, find the two closing braces that end the scale block, immediately followed by `const x = ...`:

```ts
      }
    }

    const x = isMuted || fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
```

Insert the drillDot check between the `}` block and `const x`:

```ts
      }
    }

    // drillDots: force-show a dot with a custom label (e.g. finger number) at this position
    const drillDot = drillDots?.find(d => d.stringIdx === stringIdx && d.fret === fretIdx);
    if (drillDot) {
      show = true;
      text = drillDot.label;
      bgColor = 'fill-brand-primary';
      textColor = 'fill-white';
    }

    const x = isMuted || fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: zero errors. If TypeScript complains about the `drillDots?.find` call, ensure `drillDots` is properly destructured (Step 1).

- [ ] **Step 4: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add drillDots prop to Fretboard for technique drill display"
```

---

## Task 2: Create `src/data/drillData.ts`

**Files:**
- Create: `src/data/drillData.ts`

**Context:**
All drill content and persistence logic lives here. The file exports `DrillStep`, `Drill` interfaces, `getDrillBest`, `saveDrillBest` helpers, and the `DRILLS` array containing all 15 drills across four categories. No React imports — pure TypeScript data.

Helper functions inside the file generate step arrays so the drill definitions stay readable. These helpers are NOT exported (internal only).

**Interfaces:**
- Produces (used by Task 3):
  - `export interface DrillStep { stringIdx: number; fret: number; finger: 1|2|3|4 }`
  - `export interface Drill { id, category, name, description, safetyNote?, steps, startFret, bpmStart, bpmTarget, bpmStep }`
  - `export function getDrillBest(drillId: string): number | null`
  - `export function saveDrillBest(drillId: string, bpm: number): void`
  - `export const DRILLS: Drill[]`

- [ ] **Step 1: Write the complete file**

Create `src/data/drillData.ts` with the following content:

```ts
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
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/drillData.ts
git commit -m "feat: add drillData with 15 technique drills and localStorage persistence"
```

---

## Task 3: Create `src/pages/Technique.tsx`

**Files:**
- Create: `src/pages/Technique.tsx`

**Context:**
The page has four sections: a page header, a dismissible warm-up banner (session-only state), a tab row, and a two-column drill selector grid. Selecting a drill opens the trainer panel below the grid. The trainer panel shows the fretboard pattern via `drillDots`, a BPM display with −/+ buttons, a play/stop click track toggle, a "Got it clean" button, and a personal best display.

The click track uses `setInterval` stored in a `useRef`. The interval is cleared and restarted whenever `isPlaying` or `bpm` changes, and on unmount. `initAudio()` must be called before any `playClick()`.

**Interfaces:**
- Consumes from Task 1: `Fretboard` with `drillDots` prop
- Consumes from Task 2: `DRILLS`, `getDrillBest`, `saveDrillBest`, `Drill` type
- Produces: `export function Technique()` — used by Task 4

- [ ] **Step 1: Write the complete file**

Create `src/pages/Technique.tsx` with the following content:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Dumbbell } from 'lucide-react';
import { cn } from '../lib/utils';
import { DRILLS, getDrillBest, saveDrillBest } from '../data/drillData';
import type { Drill } from '../data/drillData';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playClick } from '../lib/audio';

type Category = 'chromatic' | 'spider' | 'legato' | 'stretch';

const CATEGORIES: Category[] = ['chromatic', 'spider', 'legato', 'stretch'];

const CATEGORY_LABELS: Record<Category, string> = {
  chromatic: 'Chromatic',
  spider: 'Spider',
  legato: 'Legato',
  stretch: 'Stretch',
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  chromatic: 'Finger independence across all strings',
  spider: 'Cross-string coordination and string crossing',
  legato: 'Hammer-on and pull-off strength',
  stretch: 'Reach and fret-span conditioning',
};

export function Technique() {
  const [activeTab, setActiveTab] = useState<Category>('chromatic');
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null);
  const [bpm, setBpm] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bestFlash, setBestFlash] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabDrills = DRILLS.filter(d => d.category === activeTab);
  const selectedDrill: Drill | null = selectedDrillId
    ? (DRILLS.find(d => d.id === selectedDrillId) ?? null)
    : null;

  // Load personal best and reset BPM when selected drill changes
  useEffect(() => {
    if (selectedDrill) {
      setPersonalBest(getDrillBest(selectedDrill.id));
      setBpm(selectedDrill.bpmStart);
    }
  }, [selectedDrill?.id]);

  // Click track — restarts whenever isPlaying or bpm changes; cleans up on unmount
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isPlaying) {
      const tick = () => { initAudio().then(() => playClick()); };
      tick();
      intervalRef.current = setInterval(tick, Math.floor(60000 / bpm));
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, bpm]);

  function handleTabChange(tab: Category) {
    setActiveTab(tab);
    setSelectedDrillId(null);
    setIsPlaying(false);
  }

  function handleSelectDrill(drillId: string) {
    if (isPlaying) setIsPlaying(false);
    setSelectedDrillId(prev => (prev === drillId ? null : drillId));
    setBestFlash(false);
  }

  function handleBpmChange(delta: number) {
    setBpm(prev => Math.min(200, Math.max(40, prev + delta)));
  }

  async function handleTogglePlay() {
    await initAudio();
    setIsPlaying(prev => !prev);
  }

  function handleGotItClean() {
    if (!selectedDrill) return;
    saveDrillBest(selectedDrill.id, bpm);
    const newBest = getDrillBest(selectedDrill.id);
    setPersonalBest(newBest);
    if (newBest !== null && (personalBest === null || bpm >= personalBest)) {
      setBestFlash(true);
      setTimeout(() => setBestFlash(false), 1000);
    }
    setBpm(prev => Math.min(200, prev + selectedDrill.bpmStep));
  }

  const drillDots = selectedDrill
    ? selectedDrill.steps.map(s => ({
        stringIdx: s.stringIdx,
        fret: s.fret,
        label: String(s.finger),
      }))
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
          <Dumbbell size={18} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Technique</h1>
          <p className="text-sm text-brand-secondary">Fretting hand dexterity drills. Slow and accurate builds speed.</p>
        </div>
      </div>

      {/* Warm-up banner */}
      {showBanner && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Warm up first.</span>{' '}
            Spend 2–3 minutes playing open strings or easy chord changes before drilling.
            Stop immediately if you feel pain or tension anywhere in your hand or forearm.
          </p>
          <button
            onClick={() => setShowBanner(false)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tab row */}
      <div className="border-b border-brand-line">
        <div className="flex gap-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleTabChange(cat)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === cat
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-brand-secondary hover:text-brand-ink hover:border-brand-line',
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Category description */}
      <p className="text-xs text-brand-secondary -mt-3">{CATEGORY_DESCRIPTIONS[activeTab]}</p>

      {/* Drill selector grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tabDrills.map(drill => {
          const best = getDrillBest(drill.id);
          const isSelected = selectedDrillId === drill.id;
          return (
            <button
              key={drill.id}
              onClick={() => handleSelectDrill(drill.id)}
              className={cn(
                'text-left rounded-lg border p-4 transition-colors',
                isSelected
                  ? 'border-brand-active bg-brand-active/10'
                  : 'border-brand-line bg-brand-surface hover:border-brand-primary/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-brand-ink">{drill.name}</span>
                <span className="text-xs text-brand-secondary whitespace-nowrap flex-shrink-0">
                  Best: {best !== null ? `${best} BPM` : '—'}
                </span>
              </div>
              <p className="text-xs text-brand-secondary mt-1 leading-snug">{drill.description}</p>
            </button>
          );
        })}
      </div>

      {/* Trainer panel */}
      {selectedDrill && (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-5 space-y-5">
          {/* Drill title + safety note */}
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{selectedDrill.name}</h2>
            {selectedDrill.safetyNote && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ {selectedDrill.safetyNote}
              </p>
            )}
          </div>

          {/* Fretboard */}
          <div className="overflow-x-auto">
            <Fretboard
              showNoteNames={false}
              drillDots={drillDots}
              fretRange={[selectedDrill.startFret, selectedDrill.startFret + 4]}
              fretsNum={15}
            />
          </div>

          {/* BPM controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => handleBpmChange(-selectedDrill.bpmStep)}
                className="w-10 h-10 rounded-full border border-brand-line text-brand-ink text-xl font-bold hover:border-brand-primary/60 transition-colors"
                aria-label="Decrease BPM"
              >
                −
              </button>
              <div className="text-center min-w-[90px]">
                <div className="text-5xl font-bold text-brand-primary tabular-nums">{bpm}</div>
                <div className="text-xs text-brand-secondary mt-0.5">BPM</div>
              </div>
              <button
                onClick={() => handleBpmChange(selectedDrill.bpmStep)}
                className="w-10 h-10 rounded-full border border-brand-line text-brand-ink text-xl font-bold hover:border-brand-primary/60 transition-colors"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>

            {/* Target milestone */}
            <p className="text-xs text-center text-brand-secondary">
              Target: {selectedDrill.bpmTarget} BPM
              {bpm >= selectedDrill.bpmTarget && (
                <span className="ml-2 font-semibold text-brand-primary">Target reached!</span>
              )}
            </p>

            {/* Play and Got it clean buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleTogglePlay}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isPlaying
                    ? 'bg-brand-secondary/80 text-white hover:bg-brand-secondary'
                    : 'border border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {isPlaying ? '■ Stop' : '▶ Start Click Track'}
              </button>
              <button
                onClick={handleGotItClean}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                Got it clean
              </button>
            </div>

            {/* Personal best */}
            <div className={cn(
              'text-center text-sm font-semibold transition-colors duration-300',
              bestFlash ? 'text-green-600 dark:text-green-400' : 'text-brand-secondary',
            )}>
              {bestFlash ? '✓ New personal best!' : (
                personalBest !== null
                  ? `Personal best: ${personalBest} BPM`
                  : 'No personal best yet — start drilling!'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero errors. Common issues to watch for:
- `selectedDrill?.id` in `useEffect` deps — TypeScript may warn; replace with `selectedDrill ? selectedDrill.id : null` as the dep if needed
- Import path uses relative `../lib/utils`, `../data/drillData`, `../components/Fretboard`, `../lib/audio` — all relative from `src/pages/`

- [ ] **Step 3: Commit**

```bash
git add src/pages/Technique.tsx
git commit -m "feat: add Technique page with drill trainer and BPM ladder"
```

---

## Task 4: Wire `Technique` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Context:**
`App.tsx` defines the router, nav, and imports for every page. Add the Technique import, a `<Route>`, and a `<NavLink>` using the `Dumbbell` icon from lucide-react (already in the project). The NavLink pattern is identical to all existing nav items.

**Interfaces:**
- Consumes from Task 3: `export function Technique()` from `'./pages/Technique'`

- [ ] **Step 1: Add the import**

Open `src/App.tsx`. Find the block of page imports near the top:

```ts
import { Caged } from './pages/Caged';
import { Circle } from './pages/Circle';
import { Metronome } from './pages/Metronome';
import { ScalePositions } from './pages/ScalePositions';
import { Tuner } from './pages/Tuner';
```

Add the Technique import after Tuner:

```ts
import { Caged } from './pages/Caged';
import { Circle } from './pages/Circle';
import { Metronome } from './pages/Metronome';
import { ScalePositions } from './pages/ScalePositions';
import { Tuner } from './pages/Tuner';
import { Technique } from './pages/Technique';
```

- [ ] **Step 2: Add the Route**

Find the `<Routes>` block:

```tsx
<Route path="/tuner" element={<Tuner />} />
```

Add the Technique route after it:

```tsx
<Route path="/tuner" element={<Tuner />} />
<Route path="/technique" element={<Technique />} />
```

- [ ] **Step 3: Add the NavLink and Dumbbell icon import**

Find the lucide-react import line at the top of the file:

```ts
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock, Layers, Gauge } from 'lucide-react';
```

Add `Dumbbell` to the import:

```ts
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock, Layers, Gauge, Dumbbell } from 'lucide-react';
```

Find the nav block and locate the Tuner NavLink:

```tsx
<NavLink title="Tuner" to="/tuner" className={({isActive}) => `p-2 rounded-md transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}>
  <Gauge size={18} />
</NavLink>
```

Add the Technique NavLink after it:

```tsx
<NavLink title="Tuner" to="/tuner" className={({isActive}) => `p-2 rounded-md transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}>
  <Gauge size={18} />
</NavLink>
<NavLink title="Technique" to="/technique" className={({isActive}) => `p-2 rounded-md transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}>
  <Dumbbell size={18} />
</NavLink>
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire Technique page into router and nav"
```

---

## Manual Verification Checklist

After all four tasks are committed:

```bash
npm run dev
```

1. Open `http://localhost:3000/Guitar_Chords/technique`
2. A dumbbell icon appears in the nav bar; clicking it navigates to `/technique`
3. The warm-up banner appears and can be dismissed with `×`
4. Four tabs are visible: Chromatic, Spider, Legato, Stretch
5. Chromatic tab shows 4 drill cards, each displaying name, description, and "Best: —"
6. Clicking a drill card highlights it with an active border and opens the trainer panel below
7. The fretboard shows colored dots labeled with finger numbers 1–4 in the drill's fret window
8. BPM starts at the drill's `bpmStart`. `−` and `+` buttons change it by `bpmStep`; min 40, max 200
9. "Start Click Track" plays an audible click at the selected BPM; "■ Stop" stops it
10. Changing BPM while the click track is playing restarts the track at the new tempo immediately
11. "Got it clean" increments BPM by `bpmStep` and updates the personal best if it's a new high
12. The personal best briefly flashes green when a new best is set
13. Refreshing the page and re-selecting the same drill shows the saved personal best
14. Clicking a drill with a `safetyNote` (any Stretch drill) shows the amber warning below the drill title
15. Switching tabs clears the selected drill and stops the click track
16. All other pages (Dictionary, Ear Training, etc.) still work normally
