# Scale Interval Drill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Interval Drill mode to the Scale Drill section in Ear Training — three difficulty tiers that teach interval identification and navigation within a chosen scale and fret position.

**Architecture:** A new `ScaleIntervalRound` type and `generateScaleIntervalRound` generator land in `earTraining.ts`. A new `IntervalDrillTrainer` component (sibling to `ScaleDrillTrainer`, same prop shape) renders the drill. `EarTraining.tsx` gains a `Note Name | Interval` tab row when in `scaleDrill` mode, toggling between the two trainers.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, existing `Fretboard` component, existing `audio.ts`.

## Global Constraints

- No changes to `ScaleDrillTrainer.tsx` — must remain exactly as-is.
- `IntervalDrillTrainer` props: `{ score: SessionScore; onComplete: (wasCorrect: boolean) => void }`.
- Interval labels use full names from `INTERVAL_DEFS`: "Minor 3rd", "Perfect 5th" — never scale-degree numbers.
- Intervals always ascending, mod 12 (1–11 semitones). Unison (0) is excluded — anchor and target must be different pitch classes.
- Answer options (4 choices) drawn only from intervals that appear within the scale — never from the full chromatic set.
- Valid positions for Advanced mode: all `{stringIdx, fret}` within the active `fretRange` where the note matches `targetNote`.
- Streak key: `` `${root}|${scaleName}` ``. Show streak when ≥ 3.
- Picker or difficulty changes reset to study mode.
- `initAudio()` must be awaited before any playback.
- Tailwind v4 — use brand CSS variables and `cn()` for conditional classes.
- Path alias: `@` = project root; use `@/src/...` for imports.
- Lint command: `npm run lint` (TypeScript type-check only, no test suite).

---

## File Map

- **Modify:** `src/lib/earTraining.ts` — add `ScaleIntervalRound` interface, add to `Round` union, add `generateScaleIntervalRound`.
- **Create:** `src/components/IntervalDrillTrainer.tsx` — self-contained interval drill component.
- **Modify:** `src/pages/EarTraining.tsx` — import `IntervalDrillTrainer`, add `scaleDrillTab` state, render tab row + conditional trainer.

---

### Task 1: Data layer — `ScaleIntervalRound` type and generator

**Files:**
- Modify: `src/lib/earTraining.ts` (append after `generateScaleDrillRound` at line 629)

**Interfaces:**
- Consumes: `COMMON_SCALES`, `generateScalePattern`, `STANDARD_TUNING`, `getNoteFromFret`, `ALL_NOTES`, `INTERVAL_DEFS`, `shuffle`, `pickRandom` — all already in scope in `earTraining.ts`.
- Produces:
  - `ScaleIntervalRound` interface (exported)
  - `generateScaleIntervalRound(opts: { scaleName: string; root: Note; fretRange: [number, number]; difficulty: 'Beginner' | 'Intermediate' | 'Advanced' }): ScaleIntervalRound` (exported)
  - `Round` union updated to include `ScaleIntervalRound`

- [ ] **Step 1: Add `ScaleIntervalRound` interface and update `Round` union**

Open `src/lib/earTraining.ts`. After line 82 (`anchorFret: number;`) and before the closing `}` of `ScaleDrillRound`, find the `Round` type on line 98:

```ts
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound;
```

Replace it with:

```ts
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound | ScaleIntervalRound;
```

Then add the `ScaleIntervalRound` interface directly above the `Round` type (insert before line 98):

```ts
export interface ScaleIntervalRound {
  kind: 'scaleInterval';
  scaleName: string;
  root: Note;
  anchorStringIdx: number;
  anchorFret: number;
  anchorNote: Note;
  targetStringIdx: number;
  targetFret: number;
  targetNote: Note;
  intervalSemitones: number;   // 1–11, always ascending mod 12
  intervalLabel: string;       // e.g. "Perfect 5th"
  options: string[];           // 4 interval label strings, includes correct answer
  validPositions: { stringIdx: number; fret: number }[];
}
```

- [ ] **Step 2: Verify lint passes after type additions**

Run: `npm run lint`
Expected: no errors. If there are errors, they are from the `Round` union update — ensure the interface is placed before the `Round` type.

- [ ] **Step 3: Add `generateScaleIntervalRound` at the end of `earTraining.ts` (after line 629)**

Append the following function:

```ts
export function generateScaleIntervalRound(opts: {
  scaleName: string;
  root: Note;
  fretRange: [number, number];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}): ScaleIntervalRound {
  const scaleDef = COMMON_SCALES.find(s => s.name === opts.scaleName) ?? COMMON_SCALES[0];
  const pattern = generateScalePattern(opts.root, scaleDef);
  const [minFret, maxFret] = opts.fretRange;

  // Build position pool: all scale-note fret positions within the fret window.
  let positions: { stringIdx: number; fret: number; note: Note }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
    for (let fret = minFret; fret <= maxFret; fret++) {
      const note = getNoteFromFret(openNote, fret);
      if (pattern.notes.includes(note)) {
        positions.push({ stringIdx, fret, note });
      }
    }
  });

  // Fall back to full neck if position pool is too small.
  if (positions.length < 2) {
    positions = [];
    STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
      for (let fret = 0; fret <= 12; fret++) {
        const note = getNoteFromFret(openNote, fret);
        if (pattern.notes.includes(note)) {
          positions.push({ stringIdx, fret, note });
        }
      }
    });
  }

  // Pick anchor and target, retrying until they are different pitch classes.
  let anchor: { stringIdx: number; fret: number; note: Note };
  let target: { stringIdx: number; fret: number; note: Note };
  let intervalSemitones = 0;
  let attempts = 0;

  do {
    if (opts.difficulty === 'Beginner') {
      const rootPositions = positions.filter(p => p.note === opts.root);
      anchor = rootPositions.length > 0
        ? rootPositions[Math.floor(Math.random() * rootPositions.length)]
        : positions[Math.floor(Math.random() * positions.length)];
    } else {
      anchor = positions[Math.floor(Math.random() * positions.length)];
    }

    const others = positions.filter(
      p => !(p.stringIdx === anchor.stringIdx && p.fret === anchor.fret)
    );
    target = others.length > 0
      ? others[Math.floor(Math.random() * others.length)]
      : positions[Math.floor(Math.random() * positions.length)];

    intervalSemitones =
      (ALL_NOTES.indexOf(target.note) - ALL_NOTES.indexOf(anchor.note) + 12) % 12;
    attempts++;
  } while (intervalSemitones === 0 && attempts < 20);

  // Hard fallback: force a different pitch class if still unison after retries.
  if (intervalSemitones === 0) {
    const diffNote = positions.find(p => p.note !== anchor.note);
    if (diffNote) {
      target = diffNote;
      intervalSemitones =
        (ALL_NOTES.indexOf(target.note) - ALL_NOTES.indexOf(anchor.note) + 12) % 12;
    }
  }

  const intervalLabel =
    INTERVAL_DEFS.find(d => d.semitones === intervalSemitones)?.label ?? INTERVAL_DEFS[1].label;

  // Build options pool: all unique intervals (1–11 semitones) present between scale notes.
  const scaleNotes = pattern.notes;
  const scaleIntervalSet = new Set<number>();
  for (const noteA of scaleNotes) {
    for (const noteB of scaleNotes) {
      if (noteA === noteB) continue;
      const semi = (ALL_NOTES.indexOf(noteB) - ALL_NOTES.indexOf(noteA) + 12) % 12;
      if (semi > 0) scaleIntervalSet.add(semi);
    }
  }
  const distractorLabels = shuffle(
    [...scaleIntervalSet]
      .filter(s => s !== intervalSemitones)
      .map(s => INTERVAL_DEFS.find(d => d.semitones === s)?.label)
      .filter((l): l is string => l !== undefined)
  ).slice(0, 3);
  const options = shuffle([intervalLabel, ...distractorLabels]);

  // Valid positions: all positions of targetNote within the fret window.
  const validPositions: { stringIdx: number; fret: number }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
    for (let fret = minFret; fret <= maxFret; fret++) {
      if (getNoteFromFret(openNote, fret) === target.note) {
        validPositions.push({ stringIdx, fret });
      }
    }
  });

  return {
    kind: 'scaleInterval',
    scaleName: scaleDef.name,
    root: opts.root,
    anchorStringIdx: anchor.stringIdx,
    anchorFret: anchor.fret,
    anchorNote: anchor.note,
    targetStringIdx: target.stringIdx,
    targetFret: target.fret,
    targetNote: target.note,
    intervalSemitones,
    intervalLabel,
    options,
    validPositions,
  };
}
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add ScaleIntervalRound type and generateScaleIntervalRound"
```

---

### Task 2: Create `IntervalDrillTrainer.tsx`

**Files:**
- Create: `src/components/IntervalDrillTrainer.tsx`

**Interfaces:**
- Consumes from Task 1: `ScaleIntervalRound`, `generateScaleIntervalRound`, `SCALE_DRILL_POSITIONS` from `@/src/lib/earTraining`.
- Consumes from existing code: `SessionScore` from `@/src/lib/earTraining`; `Fretboard` from `@/src/components/Fretboard`; `generateScalePattern`, `COMMON_SCALES`, `ALL_NOTES` from `@/src/data/guitarData`; `initAudio`, `playArpeggio`, `getFretNote` from `@/src/lib/audio`; `STANDARD_TUNING` from `@/src/types`; `Note` from `@/src/types`; `cn` from `@/src/lib/utils`.
- Produces: `IntervalDrillTrainer` (named export, props `{ score: SessionScore; onComplete: (wasCorrect: boolean) => void }`).

- [ ] **Step 1: Create the file with full implementation**

Create `src/components/IntervalDrillTrainer.tsx` with the following content:

```tsx
import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';
import {
  ScaleIntervalRound,
  SessionScore,
  generateScaleIntervalRound,
  SCALE_DRILL_POSITIONS,
} from '@/src/lib/earTraining';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
import { initAudio, playArpeggio, getFretNote } from '@/src/lib/audio';
import { STANDARD_TUNING } from '@/src/types';
import type { Note } from '@/src/types';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type Position = 'full' | 'open' | 'mid' | 'upper';

const POSITION_LABELS: Record<Position, string> = {
  full:  'Full neck',
  open:  'Open (0–4)',
  mid:   'Mid (5–9)',
  upper: 'Upper (9–12)',
};

const SCALE_CATEGORIES = Array.from(new Set(COMMON_SCALES.map(s => s.category)));

interface IntervalDrillTrainerProps {
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function IntervalDrillTrainer({ score, onComplete }: IntervalDrillTrainerProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [scaleName, setScaleName] = useState<string>(COMMON_SCALES[0].name);
  const [root, setRoot] = useState<Note>('A');
  const [position, setPosition] = useState<Position>('full');
  const [studyMode, setStudyMode] = useState(true);
  const [round, setRound] = useState<ScaleIntervalRound>(() =>
    generateScaleIntervalRound({
      scaleName: COMMON_SCALES[0].name,
      root: 'A',
      fretRange: SCALE_DRILL_POSITIONS.full,
      difficulty: 'Beginner',
    })
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [advancedResult, setAdvancedResult] = useState<'correct' | 'wrong' | null>(null);

  const streakKey = `${root}|${scaleName}`;
  const currentStreak = streaks[streakKey] ?? 0;

  const scaleDef = COMMON_SCALES.find(s => s.name === scaleName) ?? COMMON_SCALES[0];
  const scalePattern = generateScalePattern(root, scaleDef);
  const fretRange: [number, number] = SCALE_DRILL_POSITIONS[position];

  function makeRound(sName: string, r: Note, pos: Position, diff: Difficulty): ScaleIntervalRound {
    return generateScaleIntervalRound({
      scaleName: sName,
      root: r,
      fretRange: SCALE_DRILL_POSITIONS[pos],
      difficulty: diff,
    });
  }

  function handlePickerChange(newScale: string, newRoot: Note, newPos: Position) {
    setScaleName(newScale);
    setRoot(newRoot);
    setPosition(newPos);
    setStudyMode(true);
    setSelected(null);
    setFlashCorrect(false);
    setAdvancedResult(null);
    setRound(makeRound(newScale, newRoot, newPos, difficulty));
  }

  function handleDifficultyChange(d: Difficulty) {
    setDifficulty(d);
    setStudyMode(true);
    setSelected(null);
    setFlashCorrect(false);
    setAdvancedResult(null);
    setRound(makeRound(scaleName, root, position, d));
  }

  async function handlePlayScale() {
    await initAudio();
    const notes: { note: string; midi: number }[] = [];
    STANDARD_TUNING.notes.forEach((_openNote, stringIdx) => {
      for (let fret = 0; fret <= 12; fret++) {
        const noteStr = getFretNote(stringIdx, fret);
        const noteName = noteStr.replace(/[0-9]/g, '');
        if (scalePattern.notes.includes(noteName as Note)) {
          const octave = parseInt(noteStr.replace(/[^0-9]/g, ''), 10);
          const chromaticIdx = ALL_NOTES.indexOf(noteName as Note);
          notes.push({ note: noteStr, midi: octave * 12 + chromaticIdx });
        }
      }
    });
    const seen = new Set<number>();
    const unique = notes
      .sort((a, b) => a.midi - b.midi)
      .filter(n => {
        if (seen.has(n.midi)) return false;
        seen.add(n.midi);
        return true;
      });
    playArpeggio(unique.map(n => n.note), 80, '4n');
  }

  function handleStartDrilling() {
    setStudyMode(false);
    setSelected(null);
    setFlashCorrect(false);
    setAdvancedResult(null);
    setRound(makeRound(scaleName, root, position, difficulty));
  }

  function handleSelect(intervalLabel: string) {
    if (selected !== null) return;
    setSelected(intervalLabel);
    const isCorrect = intervalLabel === round.intervalLabel;

    if (isCorrect) {
      setStreaks(prev => ({ ...prev, [streakKey]: (prev[streakKey] ?? 0) + 1 }));
      onComplete(true);
      setTimeout(() => {
        setSelected(null);
        setRound(makeRound(scaleName, root, position, difficulty));
      }, 600);
    } else {
      setStreaks(prev => ({ ...prev, [streakKey]: 0 }));
      setFlashCorrect(true);
      setTimeout(() => {
        setFlashCorrect(false);
        setSelected(null);
        onComplete(false);
        setRound(makeRound(scaleName, root, position, difficulty));
      }, 1500);
    }
  }

  function handleFretClick(stringIdx: number, fretIdx: number) {
    if (advancedResult !== null) return;
    const isCorrect = round.validPositions.some(
      p => p.stringIdx === stringIdx && p.fret === fretIdx
    );

    if (isCorrect) {
      setAdvancedResult('correct');
      setStreaks(prev => ({ ...prev, [streakKey]: (prev[streakKey] ?? 0) + 1 }));
      onComplete(true);
      setTimeout(() => {
        setAdvancedResult(null);
        setRound(makeRound(scaleName, root, position, difficulty));
      }, 600);
    } else {
      setAdvancedResult('wrong');
      setStreaks(prev => ({ ...prev, [streakKey]: 0 }));
      setFlashCorrect(true);
      setTimeout(() => {
        setFlashCorrect(false);
        setAdvancedResult(null);
        onComplete(false);
        setRound(makeRound(scaleName, root, position, difficulty));
      }, 1500);
    }
  }

  const labeledDots: { stringIdx: number; fret: number }[] = [
    { stringIdx: round.anchorStringIdx, fret: round.anchorFret },
  ];

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">

      {/* Pickers row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Root picker */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Root</label>
            <select
              value={root}
              onChange={e => handlePickerChange(scaleName, e.target.value as Note, position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {ALL_NOTES.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Scale picker */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Scale</label>
            <select
              value={scaleName}
              onChange={e => handlePickerChange(e.target.value, root, position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {SCALE_CATEGORIES.map(cat => (
                <optgroup key={cat} label={cat}>
                  {COMMON_SCALES.filter(s => s.category === cat).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Position picker */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Position</label>
            <select
              value={position}
              onChange={e => handlePickerChange(scaleName, root, e.target.value as Position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {(Object.keys(POSITION_LABELS) as Position[]).map(p => (
                <option key={p} value={p}>{POSITION_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Difficulty pills */}
        <div className="flex gap-2">
          {(['Beginner', 'Intermediate', 'Advanced'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => handleDifficultyChange(d)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                difficulty === d
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Score + streak */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <div className="flex items-center gap-3">
          {currentStreak >= 3 && (
            <span className="text-brand-primary font-semibold">Streak: {currentStreak}</span>
          )}
          <span>{score.correct}/{score.total} correct</span>
        </div>
      </div>

      {studyMode ? (
        /* ── Study mode ─────────────────────────────────────────────── */
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-ink">
            Study: <span className="text-brand-primary font-bold">{root} {scaleName}</span>
            <span className="text-brand-secondary font-normal"> — {POSITION_LABELS[position]}</span>
          </p>
          <p className="text-xs text-brand-secondary">
            All notes are labeled. Use Play to hear the scale, then start drilling when ready.
          </p>
          <div className="overflow-x-auto">
            <Fretboard scale={scalePattern} showNoteNames={true} fretsNum={12} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePlayScale}
              className="px-4 py-2 rounded-lg border border-brand-line text-sm font-medium text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
            >
              Play scale
            </button>
            <button
              onClick={handleStartDrilling}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              Start Drilling →
            </button>
          </div>
        </div>
      ) : (
        /* ── Drill mode ──────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="space-y-1">
            {difficulty === 'Advanced' ? (
              <p className="text-sm font-medium text-brand-ink">
                Find the{' '}
                <span className="text-brand-primary font-bold">{round.intervalLabel}</span>
                {' '}above{' '}
                <span className="text-brand-primary font-bold">{round.anchorNote}</span>
                {' '}in{' '}
                <span className="text-brand-primary font-bold">{round.root} {round.scaleName}</span>.
              </p>
            ) : difficulty === 'Beginner' ? (
              <p className="text-sm font-medium text-brand-ink">
                What interval is ★ above the root (
                <span className="text-brand-primary font-bold">{round.anchorNote}</span>)?
              </p>
            ) : (
              <p className="text-sm font-medium text-brand-ink">
                What is the interval from{' '}
                <span className="text-brand-primary font-bold">{round.anchorNote}</span>
                {' '}to ★?
              </p>
            )}
            <p className="text-xs text-brand-secondary">
              {difficulty === 'Advanced'
                ? 'Click the correct note on the fretboard.'
                : `String ${round.targetStringIdx + 1} (from low E), fret ${round.targetFret}`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <Fretboard
              scale={scalePattern}
              fretRange={fretRange}
              highlightNote={
                difficulty !== 'Advanced'
                  ? { stringIdx: round.targetStringIdx, fret: round.targetFret }
                  : undefined
              }
              showNoteNames={false}
              labeledDots={labeledDots}
              flashHighlight={flashCorrect}
              fretsNum={12}
              onFretClick={
                difficulty === 'Advanced' && advancedResult === null
                  ? handleFretClick
                  : undefined
              }
            />
          </div>

          {/* Answer buttons — Beginner and Intermediate only */}
          {difficulty !== 'Advanced' && (
            <div className="grid grid-cols-2 gap-2">
              {round.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  disabled={selected !== null}
                  className={cn(
                    'py-3 rounded-lg text-sm font-bold border transition-colors',
                    selected === null
                      ? 'border-brand-line text-brand-ink hover:border-brand-primary/60 hover:bg-brand-sidebar/50'
                      : opt === round.intervalLabel
                        ? 'bg-green-500 text-white border-green-500'
                        : opt === selected
                          ? 'bg-red-500 text-white border-red-500'
                          : 'border-brand-line text-brand-secondary opacity-50',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Feedback */}
          {selected !== null && difficulty !== 'Advanced' && (
            <p className={cn(
              'text-sm font-semibold text-center',
              selected === round.intervalLabel ? 'text-green-600' : 'text-red-500',
            )}>
              {selected === round.intervalLabel
                ? 'Correct!'
                : `Not quite — it's ${round.intervalLabel}`}
            </p>
          )}
          {advancedResult !== null && (
            <p className={cn(
              'text-sm font-semibold text-center',
              advancedResult === 'correct' ? 'text-green-600' : 'text-red-500',
            )}>
              {advancedResult === 'correct'
                ? 'Correct!'
                : `Not quite — the ${round.intervalLabel} is on fret ${round.targetFret}`}
            </p>
          )}

          <button
            onClick={() => {
              setStudyMode(true);
              setSelected(null);
              setFlashCorrect(false);
              setAdvancedResult(null);
            }}
            className="w-full py-1.5 rounded-lg border border-brand-line text-xs text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
          >
            Back to Study
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. The most likely errors are import paths — ensure all use `@/src/...` prefix.

- [ ] **Step 3: Commit**

```bash
git add src/components/IntervalDrillTrainer.tsx
git commit -m "feat: add IntervalDrillTrainer component"
```

---

### Task 3: Wire tab row in `EarTraining.tsx`

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 2: `IntervalDrillTrainer` from `'../components/IntervalDrillTrainer'`
- Consumes existing: `ScaleDrillTrainer`, `score`, `handleScaleDrillComplete` — all already wired.

- [ ] **Step 1: Add the import for `IntervalDrillTrainer`**

In `src/pages/EarTraining.tsx`, find the existing import on line 43:

```ts
import { ScaleDrillTrainer } from '../components/ScaleDrillTrainer';
```

Add the new import directly after it:

```ts
import { IntervalDrillTrainer } from '../components/IntervalDrillTrainer';
```

- [ ] **Step 2: Add `scaleDrillTab` state**

In `src/pages/EarTraining.tsx`, after the existing state declarations (around line 88, after `const audioUnlocked = useRef(false);`), add:

```ts
const [scaleDrillTab, setScaleDrillTab] = useState<'noteName' | 'interval'>('noteName');
```

- [ ] **Step 3: Reset `scaleDrillTab` when leaving Scale Drill mode**

In `src/pages/EarTraining.tsx`, add a `useEffect` after the state declarations to reset the tab when the user leaves Scale Drill mode. Place it near the other `useEffect` calls:

```ts
useEffect(() => {
  if (settings.mode !== 'scaleDrill') {
    setScaleDrillTab('noteName');
  }
}, [settings.mode]);
```

- [ ] **Step 4: Replace the scaleDrill render block with tabbed version**

In `src/pages/EarTraining.tsx`, find the existing scaleDrill render block (around line 1671):

```tsx
          ) : settings.mode === 'scaleDrill' ? (
            <ScaleDrillTrainer
              score={score}
              onComplete={handleScaleDrillComplete}
            />
          ) : settings.mode === 'intervalFretboard' ? (
```

Replace it with:

```tsx
          ) : settings.mode === 'scaleDrill' ? (
            <div>
              {/* Tab row */}
              <div className="flex gap-1 mb-3">
                {(['noteName', 'interval'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setScaleDrillTab(tab)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                      scaleDrillTab === tab
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
                    )}
                  >
                    {tab === 'noteName' ? 'Note Name' : 'Interval'}
                  </button>
                ))}
              </div>
              {scaleDrillTab === 'noteName' ? (
                <ScaleDrillTrainer
                  score={score}
                  onComplete={handleScaleDrillComplete}
                />
              ) : (
                <IntervalDrillTrainer
                  score={score}
                  onComplete={handleScaleDrillComplete}
                />
              )}
            </div>
          ) : settings.mode === 'intervalFretboard' ? (
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no errors. Common issue: `cn` may not be imported in `EarTraining.tsx` — check the existing imports and add it if missing (`import { cn } from '../lib/utils';`).

- [ ] **Step 6: Manual smoke test**

Start the dev server: `npm run dev`

Verify the following:
1. Navigate to Ear Training → click "Scale Drill" mode.
2. Two tabs appear: "Note Name" and "Interval". "Note Name" is active by default.
3. "Note Name" tab shows `ScaleDrillTrainer` unchanged.
4. "Interval" tab shows `IntervalDrillTrainer` with identical pickers (Root, Scale, Position) and Difficulty pills.
5. Study mode shows a fully labeled fretboard with Play Scale and Start Drilling buttons.
6. Play Scale plays the scale ascending.
7. **Beginner drill:** Start Drilling → fretboard shows scale dots with one ★ (target) and one labeled dot (root). Prompt: "What interval is ★ above the root (A)?". Four answer buttons appear. Correct answer turns green. Wrong answer flashes the ★ and shows red.
8. **Intermediate drill:** Anchor is any labeled scale note (not necessarily root). Prompt reads "What is the interval from [X] to ★?".
9. **Advanced drill:** No answer buttons. Prompt: "Find the [interval] above [anchorNote]." Fretboard dots are clickable. Correct click: green feedback. Wrong click: red feedback, correct position pulses.
10. Switching away from Scale Drill mode and back resets to "Note Name" tab.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: wire Interval Drill tab in Scale Drill section"
```
