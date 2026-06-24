# Fretboard Hunt Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hunt sub-mode to the Fretboard ear training tab — tap frets to audition notes, press Confirm to submit, with proximity-weighted scoring and session bias tracking.

**Architecture:** Hunt mode is a behaviour switch inside the existing `FretboardTrainer` component, controlled by an `isHuntMode` boolean prop. Tapping a fret in Hunt mode plays the note and shows a blue preview dot with the pitch-class label rather than grading immediately. A Confirm button grades the selection; wrong confirms flash red and keep the round alive. `EarTraining.tsx` exposes Hunt as a fourth entry in the fretboard difficulty selector.

**Tech Stack:** React 19, TypeScript, Tone.js (via `src/lib/audio.ts`), Tailwind CSS v4, SVG (Fretboard rendering).

## Global Constraints

- No test framework — `npm run lint` (`tsc --noEmit`) is the only static check; it must pass with zero errors after every task.
- No new dependencies.
- `DifficultyLevel` type (`'Beginner' | 'Intermediate' | 'Advanced'`) stays unchanged — Hunt is wired as a UI-level concept in `EarTraining.tsx`, not a new type value.
- Existing Guess mode behaviour is unchanged — all new code is additive.
- Tailwind CSS v4: no `tailwind.config.js`; use only existing brand tokens (`brand-primary`, `brand-secondary`, `brand-ink`, `brand-surface`, `brand-line`, `brand-sidebar`) and standard Tailwind colour utilities.
- `@` resolves to project root; use `@/src/...` for aliased imports if needed, but prefer relative imports matching the existing style.
- Preview dot colour: `#3b82f6` (blue-500). Wrong-confirm flash: reuse existing `wrongPosition` red (`#ef4444`). Correct flash: existing green (`#22c55e`).

---

### Task 1: Data layer — earTraining.ts

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Produces:
  - `export interface HuntResult { stars: number; attempts: number; direction: 'sharp' | 'flat' | 'correct'; }`
  - `export function getSemitoneDistance(played: string, target: string): number`
  - `export function getSemitoneDirection(played: string, target: string): 'sharp' | 'flat' | 'correct'`
  - `SessionScore` extended with `totalStars?: number` and `huntAttempts?: number[]`

- [ ] **Step 1: Extend `SessionScore` interface**

Open `src/lib/earTraining.ts`. Find the `SessionScore` interface (currently around line 70):

```typescript
export interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
}
```

Replace with:

```typescript
export interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
  totalStars?: number;
  huntAttempts?: number[];
}
```

- [ ] **Step 2: Add `HuntResult` type and helper functions**

At the end of `src/lib/earTraining.ts`, after the existing `playFretboardRound` function, append:

```typescript
export interface HuntResult {
  stars: number;
  attempts: number;
  direction: 'sharp' | 'flat' | 'correct';
}

export function getSemitoneDistance(played: string, target: string): number {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const diff = Math.abs(idx(played) - idx(target));
  return Math.min(diff, 12 - diff);
}

export function getSemitoneDirection(
  played: string,
  target: string,
): 'sharp' | 'flat' | 'correct' {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const raw = idx(played) - idx(target);
  const wrapped = ((raw % 12) + 12) % 12;
  if (wrapped === 0) return 'correct';
  return wrapped <= 6 ? 'sharp' : 'flat';
}
```

- [ ] **Step 3: Verify lint passes**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```

Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add HuntResult type and semitone helpers to earTraining"
```

---

### Task 2: Fretboard — previewPosition prop

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: `getFretNote(stringIdx, fretIdx)` from `src/lib/audio.ts` (already imported)
- Produces: `previewPosition?: string | null` prop — renders a blue `#3b82f6` circle with pitch-class text label

- [ ] **Step 1: Add `previewPosition` to `FretboardProps`**

In `src/components/Fretboard.tsx`, find the `FretboardProps` interface. Add one line after `wrongPosition`:

```typescript
interface FretboardProps {
  fretsNum?: number;
  chord?: ChordShape;
  scale?: ScalePattern;
  onNoteClick?: (note: string) => void;
  onFretClick?: (stringIdx: number, fretIdx: number) => void;
  showNoteNames?: boolean;
  className?: string;
  fretRange?: [number, number];
  playingNotes?: Set<string>;
  compact?: boolean;
  correctPositions?: Set<string>;
  wrongPosition?: string | null;
  previewPosition?: string | null;
}
```

- [ ] **Step 2: Destructure the new prop**

Find the function signature line (starts `export function Fretboard({`). Add `previewPosition = null` to the destructuring alongside the other props:

```typescript
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null }: FretboardProps) {
```

- [ ] **Step 3: Render the preview dot**

In the SVG body, find the comment `{/* Trainer feedback dots */}`. Insert the preview dot block immediately **before** it (so trainer feedback green/red renders on top of the blue preview dot in SVG paint order):

```tsx
        {/* Preview dot (Hunt mode) — blue circle with pitch-class label */}
        {previewPosition && (() => {
          const [sStr, fStr] = previewPosition.split('-');
          const sIdx = Number(sStr);
          const fIdx = Number(fStr);
          const visualStringIdx = 5 - sIdx;
          const x = fIdx === 0 ? paddingX / 2 : paddingX + (fIdx - 0.5) * fretSpacing;
          const y = paddingY + visualStringIdx * stringSpacing;
          const r = fIdx === 0 ? 10 : 14;
          const noteStr = getFretNote(sIdx, fIdx);
          const pitchClass = noteStr ? noteStr.replace(/\d$/, '') : '';
          return (
            <g key="preview" style={{ pointerEvents: 'none' }}>
              <circle cx={x} cy={y} r={r} fill="#3b82f6" opacity={0.9} />
              {pitchClass && (
                <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">
                  {pitchClass}
                </text>
              )}
            </g>
          );
        })()}
```

- [ ] **Step 4: Verify lint passes**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add previewPosition prop to Fretboard for Hunt mode"
```

---

### Task 3: FretboardTrainer — Hunt mode logic

**Files:**
- Modify: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Consumes from Task 1: `HuntResult`, `getSemitoneDistance`, `getSemitoneDirection` from `../lib/earTraining`
- Consumes from Task 2: `previewPosition` prop on `<Fretboard>`
- Consumes from `../lib/audio`: `initAudio`, `playNote` (add to existing import of `getFretNote`)
- Produces: `isHuntMode: boolean` prop; `onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void`

- [ ] **Step 1: Replace the entire file**

Write `src/components/FretboardTrainer.tsx` with the following complete content:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import {
  FretboardRound, DifficultyLevel, SessionScore, HuntResult,
  getCorrectPositions, playFretboardRound, getSemitoneDistance, getSemitoneDirection,
} from '../lib/earTraining';
import { getFretNote, initAudio, playNote } from '../lib/audio';

interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}

export function FretboardTrainer({ round, score, isHuntMode, onComplete }: FretboardTrainerProps) {
  // Shared state (Guess + Hunt)
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);

  // Hunt-only state
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [firstConfirmSemitones, setFirstConfirmSemitones] = useState<number | null>(null);
  const [firstConfirmDirection, setFirstConfirmDirection] = useState<'sharp' | 'flat' | 'correct' | null>(null);
  const [wrongConfirmFlash, setWrongConfirmFlash] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    setSelectedPosition(null);
    setSelectedNote(null);
    setAttemptCount(0);
    setFirstConfirmSemitones(null);
    setFirstConfirmDirection(null);
    setWrongConfirmFlash(false);
    setRoundFeedback(null);
    playFretboardRound(round).catch(() => {});
  }, [round]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const pitchClass = noteStr.replace(/\d$/, '');
    const key = `${stringIdx}-${fretIdx}`;

    if (isHuntMode) {
      setSelectedPosition(key);
      setSelectedNote(pitchClass);
      initAudio().then(() => playNote(noteStr, '8n')).catch(() => {});
      return;
    }

    // Guess mode — grade immediately
    if (pitchClass === round.targetNote) {
      setCorrectPositions(new Set([key]));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => onComplete(true), 600);
    } else {
      setWrongPosition(key);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => setWrongPosition(null), 600);
      setTimeout(() => onComplete(false), 1500);
    }
  }, [isRevealing, isHuntMode, round, onComplete]);

  const handleConfirm = useCallback(() => {
    if (!selectedPosition || !selectedNote || isRevealing) return;
    const isCorrect = selectedNote === round.targetNote;

    // Capture first-confirm stats (never overwritten on subsequent wrong confirms)
    const semitones = firstConfirmSemitones ?? getSemitoneDistance(selectedNote, round.targetNote);
    const direction = firstConfirmDirection ?? getSemitoneDirection(selectedNote, round.targetNote);
    if (firstConfirmSemitones === null) {
      setFirstConfirmSemitones(semitones);
      setFirstConfirmDirection(direction);
    }

    if (isCorrect) {
      const stars = semitones === 0 ? 3 : semitones <= 2 ? 2 : semitones <= 5 ? 1 : 0;
      const attempts = attemptCount + 1;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const feedback = semitones === 0
        ? '★★★  Found in 1 attempt  ·  Perfect — correct first try!'
        : `${starStr}  Found in ${attempts} attempt${attempts !== 1 ? 's' : ''}  ·  ${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction} on first try`;
      setRoundFeedback(feedback);
      setCorrectPositions(new Set([selectedPosition])); // green dot renders on top of blue preview
      setIsRevealing(true);
      setNoteRevealed(true);
      setTimeout(() => onComplete(true, { stars, attempts, direction }), 600);
    } else {
      setIsRevealing(true);
      setWrongConfirmFlash(true);
      setAttemptCount(a => a + 1);
      setTimeout(() => {
        setWrongConfirmFlash(false);
        setIsRevealing(false);
      }, 600);
    }
  }, [selectedPosition, selectedNote, isRevealing, round, firstConfirmSemitones, firstConfirmDirection, attemptCount, onComplete]);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          {isHuntMode ? 'Hunt the note' : 'Find the note'}
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
        previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
        compact
      />

      {isHuntMode && (
        <div className="flex items-center justify-between min-h-[36px]">
          {roundFeedback ? (
            <p className="text-sm text-brand-ink font-medium">{roundFeedback}</p>
          ) : (
            <span />
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedPosition || isRevealing}
            className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      )}

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: zero errors. If TypeScript complains about `playNote` signature, check that `initAudio` and `playNote` are exported from `src/lib/audio.ts` (they are — confirmed in existing codebase).

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: add Hunt mode logic to FretboardTrainer"
```

---

### Task 4: EarTraining.tsx — wire Hunt mode

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1: `HuntResult` from `../lib/earTraining`
- Consumes from Task 3: `isHuntMode` prop + extended `onComplete` signature on `<FretboardTrainer>`

- [ ] **Step 1: Add `HuntResult` to the earTraining import**

Find the existing import block at the top of `src/pages/EarTraining.tsx`:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
```

Replace with (added `HuntResult`):

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
```

- [ ] **Step 2: Add `fretboardSubMode` and `biasTally` state**

Inside the `EarTraining` component, find the existing state declarations (the block starting with `const [settings, setSettings]`). Add two new lines after the `difficulty` state:

```typescript
const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt'>('guess');
const [biasTally, setBiasTally] = useState({ sharp: 0, flat: 0, correct: 0 });
```

- [ ] **Step 3: Add `handleFretboardDifficulty` function**

After the existing `handleStudyMode` function, add:

```typescript
function handleFretboardDifficulty(level: DifficultyLevel | 'Hunt') {
  if (level === 'Hunt') {
    setFretboardSubMode('hunt');
    setDifficulty('Advanced');
  } else {
    setFretboardSubMode('guess');
    setDifficulty(level);
  }
}
```

- [ ] **Step 4: Update `handleFretboardComplete`**

Find the existing `handleFretboardComplete` function:

```typescript
function handleFretboardComplete(wasCorrect: boolean) {
  const typeKey = (round as FretboardRound).targetNote;
  setScore(prev => ({
    correct: prev.correct + (wasCorrect ? 1 : 0),
    total: prev.total + 1,
    streak: wasCorrect ? prev.streak + 1 : 0,
    byType: {
      ...prev.byType,
      [typeKey]: {
        correct: (prev.byType[typeKey]?.correct ?? 0) + (wasCorrect ? 1 : 0),
        total: (prev.byType[typeKey]?.total ?? 0) + 1,
      },
    },
  }));
  advanceRound();
}
```

Replace with:

```typescript
function handleFretboardComplete(wasCorrect: boolean, huntResult?: HuntResult) {
  const typeKey = (round as FretboardRound).targetNote;
  setScore(prev => ({
    correct: prev.correct + (wasCorrect ? 1 : 0),
    total: prev.total + 1,
    streak: wasCorrect ? prev.streak + 1 : 0,
    byType: {
      ...prev.byType,
      [typeKey]: {
        correct: (prev.byType[typeKey]?.correct ?? 0) + (wasCorrect ? 1 : 0),
        total: (prev.byType[typeKey]?.total ?? 0) + 1,
      },
    },
    totalStars: huntResult ? (prev.totalStars ?? 0) + huntResult.stars : prev.totalStars,
    huntAttempts: huntResult ? [...(prev.huntAttempts ?? []), huntResult.attempts] : prev.huntAttempts,
  }));
  if (huntResult) {
    setBiasTally(prev => ({
      ...prev,
      [huntResult.direction]: prev[huntResult.direction] + 1,
    }));
  }
  advanceRound();
}
```

- [ ] **Step 5: Update the difficulty buttons to include Hunt**

Find the difficulty presets section in the settings panel:

```tsx
{/* Difficulty presets */}
<div className="pt-3">
  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
  <div className="flex gap-2">
    {(['Beginner', 'Intermediate', 'Advanced'] as DifficultyLevel[]).map(level => (
      <button
        key={level}
        onClick={() => handleDifficulty(level)}
        className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
      >
        {level}
      </button>
    ))}
  </div>
</div>
```

Replace with:

```tsx
{/* Difficulty presets */}
<div className="pt-3">
  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
  <div className="flex gap-2 flex-wrap">
    {(['Beginner', 'Intermediate', 'Advanced'] as DifficultyLevel[]).map(level => (
      <button
        key={level}
        onClick={() => settings.mode === 'fretboard' ? handleFretboardDifficulty(level) : handleDifficulty(level)}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
          settings.mode === 'fretboard' && fretboardSubMode === 'guess' && difficulty === level
            ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
            : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
        )}
      >
        {level}
      </button>
    ))}
    {settings.mode === 'fretboard' && (
      <button
        onClick={() => handleFretboardDifficulty('Hunt')}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
          fretboardSubMode === 'hunt'
            ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
            : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
        )}
      >
        Hunt
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 6: Pass `isHuntMode` to `FretboardTrainer`**

Find the `<FretboardTrainer>` render call:

```tsx
<FretboardTrainer
  round={round as FretboardRound}
  difficulty={difficulty}
  score={score}
  onComplete={handleFretboardComplete}
/>
```

Replace with:

```tsx
<FretboardTrainer
  round={round as FretboardRound}
  difficulty={difficulty}
  score={score}
  isHuntMode={fretboardSubMode === 'hunt'}
  onComplete={handleFretboardComplete}
/>
```

- [ ] **Step 7: Add Hunt stats to session summary**

Find the session summary modal. After the closing `</table>` tag of the `byType` table (and before the `<div className="flex gap-3 pt-1">` button row), add:

```tsx
{score.huntAttempts && score.huntAttempts.length > 0 && (
  <div className="pt-2 border-t border-brand-line space-y-1">
    <p className="text-sm font-medium text-brand-ink">Hunt Mode</p>
    <p className="text-xs text-brand-secondary">
      Avg stars: {((score.totalStars ?? 0) / score.huntAttempts.length).toFixed(1)} / 3
      &nbsp;·&nbsp;
      Avg attempts: {(score.huntAttempts.reduce((a, b) => a + b, 0) / score.huntAttempts.length).toFixed(1)}
    </p>
    {biasTally.sharp > biasTally.flat + 2 && (
      <p className="text-xs text-brand-secondary">Tendency: guessing sharp ↑</p>
    )}
    {biasTally.flat > biasTally.sharp + 2 && (
      <p className="text-xs text-brand-secondary">Tendency: guessing flat ↓</p>
    )}
  </div>
)}
```

- [ ] **Step 8: Reset `biasTally` in `handleStartOver`**

Find the existing `handleStartOver` function:

```typescript
function handleStartOver() {
  setScore(initialScore());
  setShowSummary(false);
  advanceRound();
}
```

Replace with:

```typescript
function handleStartOver() {
  setScore(initialScore());
  setBiasTally({ sharp: 0, flat: 0, correct: 0 });
  setShowSummary(false);
  advanceRound();
}
```

- [ ] **Step 9: Verify lint passes**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: wire Hunt mode into EarTraining — difficulty selector, scoring, session summary"
```
