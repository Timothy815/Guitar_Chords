# Melodic Sequence Training — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a melody ear training mode where the user hears a sequence of notes, reconstructs it pitch-by-pitch on a piano keyboard or guitar fretboard, and submits for scoring with retry support.

**Architecture:** Six tasks in dependency order: data layer first, then the two input components (independent), then the trainer that composes them, then wiring into EarTraining, then the RhythmTrainer retry mechanic. Each task type-checks cleanly on its own.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Tone.js (`playNote` from `src/lib/audio.ts`), `@tonaljs/tonal` (not needed — pitch math handled manually with `ALL_NOTES`).

## Global Constraints

- `npm run lint` (`tsc --noEmit`) is the only static check — run it after every task; zero new errors required
- No tests exist in this project — lint + manual dev-server verification is the acceptance bar
- Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config.js`; use `cn()` from `src/lib/utils.ts` for conditional classes
- Dark mode via `document.documentElement.classList.contains('dark')` — use `isDark` state with `MutationObserver` when needed (see `RhythmStaff.tsx` for pattern)
- `initAudio()` must be called before any `playNote()` — always gate with `initAudio().then(...)` on user gesture
- `playNote(noteStr, duration?)` — `noteStr` is like `'C4'`, `'F#3'`; duration defaults to `'2n'`
- `getFretNote(stringIndex, fret)` from `src/lib/audio.ts` — returns full note string like `'E2'` using default standard tuning
- `ALL_NOTES: Note[]` from `src/data/guitarData.ts` = `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`
- `STANDARD_TUNING.notes[s]` and `STANDARD_TUNING.octaves[s]` — string 0 = low E2, string 5 = high E4
- Path alias `@` resolves to project root — correct import is `@/src/...`; prefer relative imports within `src/`
- App deployed to GitHub Pages under `/Guitar_Chords/` — `vite.config.ts` base must stay unchanged
- Pitch class only for comparison — strip octave digit: `note.replace(/\d$/, '')` or `note.slice(0, -1)`

---

### Task 1: Data layer — `src/lib/melodyTraining.ts`

**Files:**
- Create: `src/lib/melodyTraining.ts`

**Interfaces:**
- Consumes: `ALL_NOTES` from `src/data/guitarData.ts`; `DifficultyLevel` from `src/lib/earTraining.ts`; `Note` from `src/types.ts`
- Produces:
  - `MelodyRound` — `{ kind: 'melody'; notes: string[]; rootKey: string; bpm: number }`
  - `MelodySettings` — `{ rootKey: string; bpm: number }`
  - `buildAllowedPitches(rootKey: string, difficulty: DifficultyLevel): string[]`
  - `generateMelodyRound(difficulty: DifficultyLevel, settings: MelodySettings): MelodyRound`

- [ ] **Step 1: Create the file with types and helpers**

```typescript
// src/lib/melodyTraining.ts
import type { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import type { DifficultyLevel } from './earTraining';

export interface MelodyRound {
  kind: 'melody';
  notes: string[];   // pitch classes, e.g. ['C', 'E', 'G']
  rootKey: string;   // root used to build the pool
  bpm: number;
}

export interface MelodySettings {
  rootKey: string;   // 'random' or specific root like 'C'
  bpm: number;
}

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const CHROMATIC_INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function buildAllowedPitches(rootKey: string, difficulty: DifficultyLevel): string[] {
  const rootIdx = ALL_NOTES.indexOf(rootKey as Note);
  if (rootIdx === -1) return ALL_NOTES.slice();
  let intervals: number[];
  if (difficulty === 'Beginner') {
    intervals = MAJOR_INTERVALS;
  } else if (difficulty === 'Intermediate') {
    intervals = [...new Set([...MAJOR_INTERVALS, ...MINOR_INTERVALS])].sort((a, b) => a - b);
  } else {
    intervals = CHROMATIC_INTERVALS;
  }
  return intervals.map(i => ALL_NOTES[(rootIdx + i) % 12]);
}

export function generateMelodyRound(
  difficulty: DifficultyLevel,
  settings: MelodySettings,
): MelodyRound {
  const rootKey = settings.rootKey === 'random'
    ? ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)]
    : settings.rootKey;

  const pool = buildAllowedPitches(rootKey, difficulty);

  const [minLen, maxLen] =
    difficulty === 'Beginner' ? [3, 3] :
    difficulty === 'Intermediate' ? [4, 5] :
    [5, 7];

  const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;

  const notes: string[] = [];
  for (let i = 0; i < length; i++) {
    const last = notes[notes.length - 1];
    const candidates = pool.filter(p => p !== last);
    const source = candidates.length > 0 ? candidates : pool;
    notes.push(source[Math.floor(Math.random() * source.length)]);
  }

  return { kind: 'melody', notes, rootKey, bpm: settings.bpm };
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/melodyTraining.ts
git commit -m "feat: add melody training data layer (MelodyRound, generator)"
```

---

### Task 2: `src/components/PianoInput.tsx`

**Files:**
- Create: `src/components/PianoInput.tsx`

**Interfaces:**
- Consumes: `initAudio`, `playNote` from `src/lib/audio.ts`; `cn` from `src/lib/utils.ts`
- Produces:
  - `PianoInput` — `(props: { onNoteSelect: (pitch: string) => void; allowedPitches?: string[]; disabled?: boolean }) => JSX.Element`

- [ ] **Step 1: Create the component**

```tsx
// src/components/PianoInput.tsx
import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { initAudio, playNote } from '../lib/audio';

interface PianoInputProps {
  onNoteSelect: (pitch: string) => void;
  allowedPitches?: string[];
  disabled?: boolean;
}

const OCTAVES = [3, 4] as const;
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
// Which white note has a black key to its right?
const BLACK_AFTER: Record<string, string> = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

const WKW = 36; // white key width (px)
const WKH = 112; // white key height (px)
const BKW = 22; // black key width (px)
const BKH = 70; // black key height (px)

export function PianoInput({ onNoteSelect, allowedPitches, disabled }: PianoInputProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function handleKey(pitch: string, oct: number) {
    if (disabled) return;
    initAudio().then(() => playNote(`${pitch}${oct}`)).catch(() => {});
    onNoteSelect(pitch);
    setFlash(pitch);
    setTimeout(() => setFlash(f => (f === pitch ? null : f)), 150);
  }

  const totalWhiteKeys = OCTAVES.length * WHITE_NOTES.length;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative select-none"
        style={{ width: totalWhiteKeys * WKW, height: WKH }}
      >
        {OCTAVES.flatMap((oct, octIdx) =>
          WHITE_NOTES.map((note, ni) => {
            const absIdx = octIdx * WHITE_NOTES.length + ni;
            const blackNote = BLACK_AFTER[note];
            const isWhiteAllowed = !allowedPitches || allowedPitches.includes(note);
            const isBlackAllowed = !blackNote || !allowedPitches || allowedPitches.includes(blackNote);
            // Black key left: center at 2/3 of white key, then offset by half black key width
            const blackLeft = absIdx * WKW + Math.round(WKW * 0.67) - Math.round(BKW / 2);

            return (
              <React.Fragment key={`${note}${oct}`}>
                {/* White key */}
                <div
                  onClick={() => handleKey(note, oct)}
                  className={cn(
                    'absolute border border-gray-300 dark:border-gray-600 rounded-b-sm cursor-pointer',
                    'flex items-end justify-center pb-1',
                    flash === note
                      ? 'bg-brand-primary/30'
                      : isDark
                        ? 'bg-[#e5e7eb] hover:bg-[#d1d5db]'
                        : 'bg-white hover:bg-gray-100',
                    !isWhiteAllowed && 'opacity-40',
                  )}
                  style={{ left: absIdx * WKW, top: 0, width: WKW - 1, height: WKH, zIndex: 1 }}
                >
                  <span className={cn('text-[8px] pointer-events-none', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {note}{oct}
                  </span>
                </div>

                {/* Black key (if this white note has one to its right) */}
                {blackNote && (
                  <div
                    onClick={e => { e.stopPropagation(); handleKey(blackNote, oct); }}
                    className={cn(
                      'absolute rounded-b-sm cursor-pointer',
                      flash === blackNote
                        ? 'bg-brand-primary/70'
                        : isDark
                          ? 'bg-[#374151] hover:bg-[#4b5563]'
                          : 'bg-gray-900 hover:bg-gray-700',
                      !isBlackAllowed && 'opacity-40',
                    )}
                    style={{ left: blackLeft, top: 0, width: BKW, height: BKH, zIndex: 2 }}
                  />
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 3: Visual smoke-test in dev server**

```bash
npm run dev
```

Temporarily import and render `<PianoInput onNoteSelect={console.log} />` anywhere (e.g., inline in EarTraining.tsx) to confirm white/black key layout, click events, and dark mode appearance. Remove the temporary render after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/components/PianoInput.tsx
git commit -m "feat: add PianoInput component (2-octave keyboard with click/dark mode)"
```

---

### Task 3: `src/components/FretboardInput.tsx`

**Files:**
- Create: `src/components/FretboardInput.tsx`

**Interfaces:**
- Consumes: `getFretNote` from `src/lib/audio.ts`; `cn` from `src/lib/utils.ts`
- Produces:
  - `FretboardInput` — `(props: { onNoteSelect: (pitch: string) => void; allowedPitches?: string[]; disabled?: boolean }) => JSX.Element`

- [ ] **Step 1: Create the component**

```tsx
// src/components/FretboardInput.tsx
import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { initAudio, playNote, getFretNote } from '../lib/audio';

interface FretboardInputProps {
  onNoteSelect: (pitch: string) => void;
  allowedPitches?: string[];
  disabled?: boolean;
}

const STRING_COUNT = 6;
const FRET_COUNT = 12; // frets 0 (open) through 12

// String labels (index 0 = low E, index 5 = high E) — displayed top-to-bottom as high E first
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

export function FretboardInput({ onNoteSelect, allowedPitches, disabled }: FretboardInputProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function handleFret(stringIdx: number, fret: number) {
    if (disabled) return;
    const fullNote = getFretNote(stringIdx, fret); // e.g. 'E2'
    if (!fullNote) return;
    const pitchClass = fullNote.replace(/\d$/, ''); // strip octave → 'E'
    initAudio().then(() => playNote(fullNote)).catch(() => {});
    onNoteSelect(pitchClass);
    setFlash(`${stringIdx}-${fret}`);
    setTimeout(() => setFlash(f => (f === `${stringIdx}-${fret}` ? null : f)), 150);
  }

  // Render strings top-to-bottom as high E first (visualStringIdx = 5 - stringIdx)
  const visualRows = Array.from({ length: STRING_COUNT }, (_, vi) => STRING_COUNT - 1 - vi); // [5,4,3,2,1,0]

  return (
    <div className="overflow-x-auto pb-1">
      <table className="border-collapse text-[10px] select-none">
        <thead>
          <tr>
            <th className="px-1 text-brand-secondary font-normal w-5" />
            {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
              <th key={f} className="px-0.5 text-center text-brand-secondary font-normal w-8">
                {f === 0 ? 'O' : f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visualRows.map(stringIdx => (
            <tr key={stringIdx}>
              {/* String label */}
              <td className="pr-1 text-right text-brand-secondary font-mono">
                {STRING_LABELS[stringIdx]}
              </td>
              {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                const fullNote = getFretNote(stringIdx, fret);
                const pitchClass = fullNote ? fullNote.replace(/\d$/, '') : '';
                const isAllowed = !allowedPitches || allowedPitches.includes(pitchClass);
                const isFlashing = flash === `${stringIdx}-${fret}`;

                return (
                  <td key={fret} className="p-0.5">
                    <button
                      onClick={() => handleFret(stringIdx, fret)}
                      disabled={disabled}
                      className={cn(
                        'w-8 h-7 rounded text-[9px] font-medium border transition-colors',
                        isFlashing
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : isAllowed
                            ? 'border-brand-line text-brand-ink hover:border-brand-primary hover:bg-brand-sidebar'
                            : 'border-brand-line/50 text-brand-secondary/40 hover:border-brand-primary/30',
                        disabled && 'cursor-not-allowed',
                      )}
                    >
                      {pitchClass}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 3: Visual smoke-test in dev server**

Temporarily render `<FretboardInput onNoteSelect={console.log} />` somewhere, confirm 6 rows × 13 columns, note names in cells, click events fire and play audio, dimming for out-of-pool notes. Remove temp render.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardInput.tsx
git commit -m "feat: add FretboardInput component (6-string grid with click/dark mode)"
```

---

### Task 4: `src/components/MelodyTrainer.tsx`

**Files:**
- Create: `src/components/MelodyTrainer.tsx`

**Interfaces:**
- Consumes:
  - `MelodyRound`, `MelodySettings`, `buildAllowedPitches` from `src/lib/melodyTraining.ts`
  - `SessionScore`, `DifficultyLevel` from `src/lib/earTraining.ts`
  - `PianoInput` from `./PianoInput`
  - `FretboardInput` from `./FretboardInput`
  - `initAudio`, `playNote` from `src/lib/audio.ts`
  - `cn` from `src/lib/utils.ts`
- Produces:
  - `MelodyTrainer` — `(props: MelodyTrainerProps) => JSX.Element`
  - Props: `{ round: MelodyRound; score: SessionScore; settings: MelodySettings; difficulty: DifficultyLevel; onComplete: (wasCorrect: boolean) => void }`

- [ ] **Step 1: Create the component**

```tsx
// src/components/MelodyTrainer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { MelodyRound, MelodySettings, buildAllowedPitches } from '../lib/melodyTraining';
import { SessionScore, DifficultyLevel } from '../lib/earTraining';
import { initAudio, playNote } from '../lib/audio';
import { PianoInput } from './PianoInput';
import { FretboardInput } from './FretboardInput';

interface MelodyTrainerProps {
  round: MelodyRound;
  score: SessionScore;
  settings: MelodySettings;
  difficulty: DifficultyLevel;
  onComplete: (wasCorrect: boolean) => void;
}

export function MelodyTrainer({ round, score, settings, difficulty, onComplete }: MelodyTrainerProps) {
  const [placedNotes, setPlacedNotes] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<('correct' | 'wrong')[] | null>(null);
  const [inputMode, setInputMode] = useState<'piano' | 'fretboard'>('piano');
  const [attempts, setAttempts] = useState(0);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const allowedPitches = buildAllowedPitches(round.rootKey, difficulty);

  function stopMelody() {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  }

  function playSequence(notes: string[]) {
    stopMelody();
    const noteDuration = (60 / round.bpm) * 1000;
    notes.forEach((pitch, i) => {
      const id = setTimeout(() => {
        initAudio().then(() => playNote(`${pitch}4`)).catch(() => {});
      }, i * noteDuration);
      timeoutIds.current.push(id);
    });
  }

  // Auto-play on new round; clear state
  useEffect(() => {
    setPlacedNotes([]);
    setFeedback(null);
    setAttempts(0);
    initAudio().then(() => playSequence(round.notes)).catch(() => {});
    return () => stopMelody();
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = useCallback(() => {
    playSequence(round.notes);
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayAnswer = useCallback(() => {
    if (placedNotes.length === 0) return;
    playSequence(placedNotes);
  }, [placedNotes, round.bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNoteSelect(pitch: string) {
    if (feedback || placedNotes.length >= round.notes.length) return;
    setPlacedNotes(prev => [...prev, pitch]);
  }

  function handleDelete() {
    if (feedback) return;
    setPlacedNotes(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (placedNotes.length !== round.notes.length || feedback) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const fb = round.notes.map((correct, i) =>
      placedNotes[i] === correct ? 'correct' as const : 'wrong' as const,
    );
    setFeedback(fb);
  }

  function handleTryAgain() {
    setPlacedNotes([]);
    setFeedback(null);
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    const wasCorrect = attempts === 1 && allCorrect;
    stopMelody();
    onComplete(wasCorrect);
  }

  const canSubmit = placedNotes.length === round.notes.length && !feedback;
  const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
  const isWrong = feedback !== null && !allCorrect;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Placed notes row */}
      <div>
        <p className="text-xs text-brand-secondary mb-1.5">
          {feedback ? 'Result' : `${placedNotes.length} / ${round.notes.length} placed`}
        </p>
        <div className="flex gap-1.5 flex-wrap min-h-[40px]">
          {round.notes.map((_, i) => {
            const placed = placedNotes[i];
            const fb = feedback?.[i];
            return (
              <div
                key={i}
                className={cn(
                  'w-10 h-10 rounded-lg border text-sm font-bold flex items-center justify-center',
                  !placed && 'border-brand-line text-brand-secondary',
                  placed && !feedback && 'border-brand-primary bg-brand-sidebar text-brand-ink',
                  fb === 'correct' && 'border-green-500 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  fb === 'wrong' && 'border-red-500 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                )}
              >
                {placed ?? '—'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback message */}
      {feedback && (
        <p className={cn(
          'text-sm font-semibold text-center',
          allCorrect ? 'text-green-600' : 'text-red-500',
        )}>
          {allCorrect ? 'Correct! 🎯' : 'Not quite — review above'}
        </p>
      )}

      {/* Input toggle */}
      {!feedback && (
        <div className="flex rounded-lg border border-brand-line overflow-hidden w-fit text-sm font-medium">
          <button
            onClick={() => setInputMode('piano')}
            className={cn(
              'px-4 py-1.5 transition-colors',
              inputMode === 'piano'
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar',
            )}
          >
            Piano
          </button>
          <button
            onClick={() => setInputMode('fretboard')}
            className={cn(
              'px-4 py-1.5 transition-colors border-l border-brand-line',
              inputMode === 'fretboard'
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar',
            )}
          >
            Fretboard
          </button>
        </div>
      )}

      {/* Active input */}
      {!feedback && (
        inputMode === 'piano'
          ? <PianoInput
              onNoteSelect={handleNoteSelect}
              allowedPitches={allowedPitches}
              disabled={placedNotes.length >= round.notes.length}
            />
          : <FretboardInput
              onNoteSelect={handleNoteSelect}
              allowedPitches={allowedPitches}
              disabled={placedNotes.length >= round.notes.length}
            />
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePlay}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          ▶ Play
        </button>
        <button
          onClick={handlePlayAnswer}
          disabled={placedNotes.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ▶ My Answer
        </button>
        {!feedback && (
          <button
            onClick={handleDelete}
            disabled={placedNotes.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Delete
          </button>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Submit
          </button>
        )}
        {isWrong && (
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            Try Again
          </button>
        )}
        {feedback && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MelodyTrainer.tsx
git commit -m "feat: add MelodyTrainer component (placed-note tiles, piano/fretboard toggle, retry)"
```

---

### Task 5: Wire melody into `earTraining.ts` + `EarTraining.tsx`

**Files:**
- Modify: `src/lib/earTraining.ts`
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes all of Task 1 and Task 4 outputs
- Produces: fully working Melody tab in the Ear Training page

- [ ] **Step 1: Update `earTraining.ts`**

In `src/lib/earTraining.ts`, make four changes:

**1a. Add import at top (after existing imports):**
```typescript
import type { MelodyRound, MelodySettings } from './melodyTraining';
```

**1b. Replace the `mode` union in `EarTrainingSettings` (line ~17):**
```typescript
// Before:
mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm';

// After:
mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody';
```

**1c. Add `melodySettings` field to `EarTrainingSettings`:**
```typescript
export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
  melodySettings: MelodySettings;
}
```

**1d. Replace the `Round` type (line ~69):**
```typescript
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound;
```

**1e. Update `DEFAULT_SETTINGS` to include `melodySettings`:**
```typescript
export const DEFAULT_SETTINGS: EarTrainingSettings = {
  mode: 'chord',
  activeChordTypes: ['major', 'minor'],
  activeIntervals: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
  settingsPanelOpen: true,
  melodySettings: { rootKey: 'random', bpm: 80 },
};
```

- [ ] **Step 2: Run lint after earTraining.ts change**

```bash
npm run lint
```

Expected: zero new errors (EarTraining.tsx will still compile because `melodySettings` has a default in `DEFAULT_SETTINGS` and `loadSettings` merges with `DEFAULT_SETTINGS`).

- [ ] **Step 3: Update `EarTraining.tsx` — imports**

Add these imports at the top of `src/pages/EarTraining.tsx`:

```typescript
import { MelodyRound, MelodySettings, generateMelodyRound } from '../lib/melodyTraining';
import { MelodyTrainer } from '../components/MelodyTrainer';
```

- [ ] **Step 4: Add `handleMelodyMode` and `handleMelodyComplete` functions**

Add these two functions after `handleRhythmComplete` (around line 244):

```typescript
function handleMelodyMode() {
  const next = { ...settings, mode: 'melody' as const };
  setSettings(next);
  advanceRound(next);
}

function handleMelodyComplete(wasCorrect: boolean) {
  setScore(s => ({
    ...s,
    correct: wasCorrect ? s.correct + 1 : s.correct,
    total: s.total + 1,
    streak: wasCorrect ? s.streak + 1 : 0,
  }));
  setTimeout(() => advanceRound(), 400);
}
```

- [ ] **Step 5: Wire `advanceRound` for melody mode**

In `advanceRound()`, add the melody branch after the existing `else if (effectiveMode === 'rhythm')` block. The current code is:

```typescript
} else if (effectiveMode === 'rhythm') {
  const rr = generateRhythmRound(difficulty, rhythmSettings);
  setSelected(null);
  setTentative(null);
  setRound(rr);
  roundStartTimeRef.current = Date.now();
  return;
} else {
  r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
}
```

Change it to:

```typescript
} else if (effectiveMode === 'rhythm') {
  const rr = generateRhythmRound(difficulty, rhythmSettings);
  setSelected(null);
  setTentative(null);
  setRound(rr);
  roundStartTimeRef.current = Date.now();
  return;
} else if (effectiveMode === 'melody') {
  const mr = generateMelodyRound(difficulty, settings.melodySettings);
  setSelected(null);
  setTentative(null);
  setRound(mr);
  roundStartTimeRef.current = Date.now();
  return;
} else {
  r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
}
```

- [ ] **Step 6: Add the Melody tab button**

Find the Rhythm tab button block in the JSX (the one ending with `</button>` and `</div>` for the tab row, around line 583–594):

```tsx
        <button
          onClick={handleRhythmMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'rhythm'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Rhythm
        </button>
      </div>
```

Add the Melody button immediately before `</div>`:

```tsx
        <button
          onClick={handleRhythmMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'rhythm'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Rhythm
        </button>
        <button
          onClick={handleMelodyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'melody'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Melody
        </button>
      </div>
```

- [ ] **Step 7: Add melody settings in the settings panel**

Find the block that ends the rhythm settings section (around line 928–930):

```tsx
              </div>
            )}

            {/* Weakest types hint + Export/Import — chord/interval only */}
```

Insert the melody settings block between the rhythm settings end and the weakest types hint:

```tsx
            {/* Melody settings — melody mode only */}
            {settings.mode === 'melody' && (
              <div className="pt-3 space-y-3 border-t border-brand-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary">Melody Settings</p>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">Root Key</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['random', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).map(key => (
                      <button
                        key={key}
                        onClick={() => setSettings(s => ({ ...s, melodySettings: { ...s.melodySettings, rootKey: key } }))}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                          settings.melodySettings.rootKey === key
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                        )}
                      >
                        {key === 'random' ? 'Random' : key}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">BPM: {settings.melodySettings.bpm}</p>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    step={5}
                    value={settings.melodySettings.bpm}
                    onChange={e => setSettings(s => ({ ...s, melodySettings: { ...s.melodySettings, bpm: Number(e.target.value) } }))}
                    className="w-full accent-brand-primary"
                  />
                </div>
              </div>
            )}
```

- [ ] **Step 8: Add melody round rendering**

Find the rhythm rendering block (around line 1256–1266):

```tsx
          ) : settings.mode === 'rhythm' ? (
            round.kind === 'rhythm' ? (
              <RhythmTrainer
                round={round as RhythmRound}
                score={score}
                settings={rhythmSettings}
                onComplete={handleRhythmComplete}
              />
            ) : (
              <RhythmRoundLoader onLoad={() => advanceRound()} />
            )
          ) : (
```

Change it to add the melody branch:

```tsx
          ) : settings.mode === 'rhythm' ? (
            round.kind === 'rhythm' ? (
              <RhythmTrainer
                round={round as RhythmRound}
                score={score}
                settings={rhythmSettings}
                onComplete={handleRhythmComplete}
              />
            ) : (
              <RhythmRoundLoader onLoad={() => advanceRound()} />
            )
          ) : settings.mode === 'melody' ? (
            round.kind === 'melody' ? (
              <MelodyTrainer
                round={round as MelodyRound}
                score={score}
                settings={settings.melodySettings}
                difficulty={difficulty}
                onComplete={handleMelodyComplete}
              />
            ) : (
              <RhythmRoundLoader onLoad={() => advanceRound()} />
            )
          ) : (
```

- [ ] **Step 9: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 10: Test in dev server**

```bash
npm run dev
```

- Click Melody tab → first round plays automatically
- Piano toggle: clicking keys places notes in the tiles row
- Fretboard toggle: clicking fret cells places notes
- ▶ Play replays original; ▶ My Answer plays your notes
- ← Delete removes last tile
- Submit appears when all notes placed; turns green/red per note
- Try Again resets tiles (wrong answer); Next → advances round (correct answer)
- Settings panel → BPM slider and Root Key selector work
- Dark mode: piano and fretboard render correctly

- [ ] **Step 11: Commit**

```bash
git add src/lib/earTraining.ts src/pages/EarTraining.tsx
git commit -m "feat: wire melody mode into EarTraining (tab, advanceRound, settings panel)"
```

---

### Task 6: RhythmTrainer retry mechanic

**Files:**
- Modify: `src/components/RhythmTrainer.tsx`

**Interfaces:**
- Consumes: existing `RhythmTrainer` props (no changes)
- Produces: same `RhythmTrainer` component, with retry support

- [ ] **Step 1: Add `attempts` state**

In `src/components/RhythmTrainer.tsx`, add `attempts` to the existing state declarations (after `feedback`):

```typescript
const [attempts, setAttempts] = useState(0);
```

Also reset `attempts` in the `useEffect` that resets on new round (the one with `[round]` dep):

```typescript
useEffect(() => {
  setPlacedUnits([]);
  setSelectedDuration('q');
  setIsRest(false);
  setFeedback(null);
  setAttempts(0);  // add this line
  initAudio().then(() => playRhythmRound(round, settings.enableLeadIn)).catch(() => {});
  return () => stopRhythm();
}, [round]);
```

- [ ] **Step 2: Update `handleSubmit` to increment attempts**

Find the existing `handleSubmit` function:

```typescript
function handleSubmit() {
  if (remainingBeats > 0.001 || feedback) return;
  const fb = round.units.map((correct, i) => {
    const placed = placedUnits[i];
    if (!placed) return 'wrong' as const;
    return placed.duration === correct.duration && placed.isRest === correct.isRest
      ? 'correct' as const
      : 'wrong' as const;
  });
  setFeedback(fb);
}
```

Replace with:

```typescript
function handleSubmit() {
  if (remainingBeats > 0.001 || feedback) return;
  setAttempts(a => a + 1);
  const fb = round.units.map((correct, i) => {
    const placed = placedUnits[i];
    if (!placed) return 'wrong' as const;
    return placed.duration === correct.duration && placed.isRest === correct.isRest
      ? 'correct' as const
      : 'wrong' as const;
  });
  setFeedback(fb);
}
```

- [ ] **Step 3: Update `handleNext` to use first-attempt scoring**

Find the existing `handleNext`:

```typescript
function handleNext() {
  const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
  stopRhythm();
  onComplete(allCorrect);
}
```

Replace with:

```typescript
function handleNext() {
  const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
  const wasCorrect = attempts === 1 && allCorrect;
  stopRhythm();
  onComplete(wasCorrect);
}
```

- [ ] **Step 4: Add `handleTryAgain` function**

Add this function after `handleNext`:

```typescript
function handleTryAgain() {
  setPlacedUnits([]);
  setFeedback(null);
}
```

- [ ] **Step 5: Update the controls JSX to show Try Again on wrong answers**

Find the existing controls block that shows `feedback && <button onClick={handleNext}>`:

```tsx
        {feedback && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        )}
```

Replace with:

```tsx
        {feedback && !feedback.every(f => f === 'correct') && (
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            Try Again
          </button>
        )}
        {feedback && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        )}
```

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: zero new errors.

- [ ] **Step 7: Test in dev server**

```bash
npm run dev
```

- Submit a wrong rhythm answer → both "Try Again" and "Next →" appear
- Click Try Again → tiles clear, can input again; the original round still plays
- Submit correct on retry → only "Next →" appears (no Try Again)
- Click Next → after retry → score does NOT count as correct (first-attempt only)
- Submit correct on first try → only "Next →"; score counts as correct

- [ ] **Step 8: Commit**

```bash
git add src/components/RhythmTrainer.tsx
git commit -m "feat: add retry mechanic to RhythmTrainer (Try Again button, first-attempt scoring)"
```
