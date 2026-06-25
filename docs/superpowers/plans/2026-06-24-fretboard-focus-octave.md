# Fretboard Focus Filter + Octave-Precise Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused-practice zone selector to Hunt mode, upgrade both Guess and Hunt modes to octave-precise note matching, and enrich Hunt mode stats with first-tap accuracy and total-tap count.

**Architecture:** Focus state lives in `EarTraining.tsx` (passed into `generateFretboardRound` to constrain note selection and down to `FretboardTrainer` → `Fretboard` for dimming). `FretboardRound.targetNote` changes from pitch class to full note+octave string; all matching logic updates to compare exact notes. Five tasks follow the dependency chain: data layer → focus selector UI → fretboard dimming → trainer logic → page wiring.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (no config file; use brand tokens), Vite, `src/lib/audio.ts` (`getFretNote`), `src/lib/earTraining.ts`, `src/components/Fretboard.tsx`, `src/components/FretboardTrainer.tsx`, `src/pages/EarTraining.tsx`.

## Global Constraints

- No test framework exists. Verification = `npm run lint` (TypeScript `tsc --noEmit`) + manual browser check via `npm run dev`.
- Tailwind v4 — no config file. Use existing brand tokens: `brand-primary`, `brand-line`, `brand-secondary`, `brand-surface`, `brand-bg`, `brand-ink`, `brand-active`. No arbitrary colours unless using standard opacity suffixes (`/10`, `/60`, `/90`).
- `@` resolves to the **project root**, not `src/`. Imports inside `src/` use relative paths (`../lib/earTraining`).
- No new npm packages.
- `FretboardRound.targetNote` changes from pitch class (`"E"`) to full note+octave (`"E3"`). Every place that reads `targetNote` must be updated to treat it as a full note string.
- Octave-precise matching: `getCorrectPositions` matches the exact note string; `noteStr === round.targetNote` replaces all `pitchClass === round.targetNote` comparisons.
- Star thresholds (absolute semitones from first tap to target): 0 → 3 stars, 1–2 → 2 stars, 3–5 → 1 star, 6+ → 0 stars.
- Focus does not restrict correct positions — all positions at the correct note+octave are valid regardless of which zone is active.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/earTraining.ts` | `FretboardFocus` type, helper functions, updated `generateFretboardRound`, `getCorrectPositions`, `playFretboardRound`, `HuntResult` |
| Create | `src/components/FretboardFocusSelector.tsx` | Focus selector UI (string pills + fret zone pills + specific fret input) |
| Modify | `src/components/Fretboard.tsx` | `focusZone` prop + SVG dimming overlay |
| Modify | `src/components/FretboardTrainer.tsx` | Octave-precise grading, first-tap stats, focus props, renders `FretboardFocusSelector` |
| Modify | `src/pages/EarTraining.tsx` | `fretboardFocus` state, `handleFocusChange`, updated `makeRound` / `advanceRound` |

---

### Task 1: Data layer — `earTraining.ts`

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Produces:
  - `FretboardFocus` — `{ stringIdx?: number; fretMin?: number; fretMax?: number }`
  - `FretboardRound.targetNote` — now a full note+octave string (e.g. `"E3"`)
  - `getAbsoluteSemitoneDistance(a: string, b: string): number`
  - `getAbsoluteDirection(played: string, target: string): 'sharp' | 'flat' | 'correct'`
  - `generateFretboardRound(difficulty: DifficultyLevel, focus?: FretboardFocus): FretboardRound`
  - `getCorrectPositions(targetNote: string, fretsNum: number): Set<string>` — unchanged signature, new octave-precise logic
  - `HuntResult` — extended with `selectionCount: number` and `firstSelectionSemitones: number`
  - Old `getSemitoneDistance` and `getSemitoneDirection` remain exported for now (removed in Task 4)

- [ ] **Step 1: Add `FretboardFocus` type and new helper functions**

Open `src/lib/earTraining.ts`. After the `HuntResult` interface (currently at the end of the file), add:

```typescript
export interface FretboardFocus {
  stringIdx?: number;   // 0 = low E … 5 = high E; undefined = all strings
  fretMin?: number;     // inclusive; undefined = 0
  fretMax?: number;     // inclusive; undefined = fretsNum
}

function noteToMidi(noteStr: string): number {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return 0;
  const pitchClass = ALL_NOTES.indexOf(match[1] as Note);
  const octave = parseInt(match[2], 10);
  return octave * 12 + pitchClass;
}

export function getAbsoluteSemitoneDistance(a: string, b: string): number {
  return Math.abs(noteToMidi(a) - noteToMidi(b));
}

export function getAbsoluteDirection(
  played: string,
  target: string,
): 'sharp' | 'flat' | 'correct' {
  const diff = noteToMidi(played) - noteToMidi(target);
  if (diff === 0) return 'correct';
  return diff > 0 ? 'sharp' : 'flat';
}
```

- [ ] **Step 2: Update `HuntResult` to add the two new fields**

Find the existing `HuntResult` interface:

```typescript
export interface HuntResult {
  stars: number;
  attempts: number;
  direction: 'sharp' | 'flat' | 'correct';
}
```

Replace it with:

```typescript
export interface HuntResult {
  stars: number;
  attempts: number;           // confirm presses before success
  selectionCount: number;     // total fret taps before confirm
  direction: 'sharp' | 'flat' | 'correct';
  firstSelectionSemitones: number;  // absolute semitones, first tap to target
}
```

- [ ] **Step 3: Update `generateFretboardRound` to accept focus and return full note+octave**

Find the existing `generateFretboardRound`:

```typescript
export function generateFretboardRound(difficulty: DifficultyLevel): FretboardRound {
  const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
  return { kind: 'fretboard', targetNote: pickRandom([...ALL_NOTES]), fretsNum: fretsMap[difficulty] };
}
```

Replace it with:

```typescript
export function generateFretboardRound(
  difficulty: DifficultyLevel,
  focus: FretboardFocus = {},
): FretboardRound {
  const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
  const fretsNum = fretsMap[difficulty];

  const pool = new Set<string>();
  for (let s = 0; s < 6; s++) {
    if (focus.stringIdx !== undefined && focus.stringIdx !== s) continue;
    for (let f = 0; f <= fretsNum; f++) {
      const fMin = focus.fretMin ?? 0;
      const fMax = focus.fretMax ?? fretsNum;
      if (f < fMin || f > fMax) continue;
      const note = getFretNote(s, f);
      if (note) pool.add(note);
    }
  }

  // Safety fallback: if focus produced an empty pool, use all reachable notes.
  if (pool.size === 0) {
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= fretsNum; f++) {
        const note = getFretNote(s, f);
        if (note) pool.add(note);
      }
    }
  }

  const targetNote = pickRandom([...pool]);
  return { kind: 'fretboard', targetNote, fretsNum };
}
```

- [ ] **Step 4: Update `playFretboardRound` to play the stored note directly**

Find:

```typescript
export async function playFretboardRound(round: FretboardRound): Promise<void> {
  await initAudio();
  const octave = pickRandom([2, 3, 4]);
  playNote(round.targetNote + octave, '2n');
}
```

Replace with:

```typescript
export async function playFretboardRound(round: FretboardRound): Promise<void> {
  await initAudio();
  playNote(round.targetNote, '2n');
}
```

- [ ] **Step 5: Update `getCorrectPositions` to match exact note+octave**

Find:

```typescript
export function getCorrectPositions(targetNote: string, fretsNum: number): Set<string> {
  const positions = new Set<string>();
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= fretsNum; f++) {
      const note = getFretNote(s, f);
      if (note && note.replace(/\d$/, '') === targetNote) positions.add(`${s}-${f}`);
    }
  }
  return positions;
}
```

Replace with:

```typescript
export function getCorrectPositions(targetNote: string, fretsNum: number): Set<string> {
  const positions = new Set<string>();
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= fretsNum; f++) {
      if (getFretNote(s, f) === targetNote) positions.add(`${s}-${f}`);
    }
  }
  return positions;
}
```

- [ ] **Step 6: Verify lint passes**

```bash
npm run lint
```

Expected: no errors. If TypeScript complains about existing callers of `generateFretboardRound` (the single call in `EarTraining.tsx` at the module-level `makeRound` function), that is expected — it will be fixed in Task 5. For now, confirm the earTraining.ts file itself has no internal errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: octave-precise matching, FretboardFocus type, richer HuntResult"
```

---

### Task 2: Focus selector component — `FretboardFocusSelector.tsx`

**Files:**
- Create: `src/components/FretboardFocusSelector.tsx`

**Interfaces:**
- Consumes: `FretboardFocus` from `'../lib/earTraining'`, `cn` from `'../lib/utils'`
- Produces: `FretboardFocusSelector` component with props `{ focus: FretboardFocus; fretsNum: number; onChange: (focus: FretboardFocus) => void }`

- [ ] **Step 1: Create the file with all constants and types**

Create `src/components/FretboardFocusSelector.tsx`:

```typescript
import React from 'react';
import { FretboardFocus } from '../lib/earTraining';
import { cn } from '../lib/utils';

interface FretboardFocusSelectorProps {
  focus: FretboardFocus;
  fretsNum: number;
  onChange: (focus: FretboardFocus) => void;
}

// stringIdx 0 = low E (E2) … 5 = high E (E4)
const STRING_LABELS: [number, string][] = [
  [0, 'E₂'], [1, 'A'], [2, 'D'], [3, 'G'], [4, 'B'], [5, 'E₄'],
];

const FRET_ZONES = [
  { label: 'Open', fretMin: 0, fretMax: 0 },
  { label: '1–4', fretMin: 1, fretMax: 4 },
  { label: '5–8', fretMin: 5, fretMax: 8 },
  { label: '9–12', fretMin: 9, fretMax: 12 },
];

function pillCls(active: boolean) {
  return cn(
    'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
    active
      ? 'bg-brand-primary text-white border-brand-primary'
      : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary',
  );
}
```

- [ ] **Step 2: Implement the component body**

Append to the same file:

```typescript
export function FretboardFocusSelector({ focus, fretsNum, onChange }: FretboardFocusSelectorProps) {
  const activeZone =
    FRET_ZONES.find(z => z.fretMin === focus.fretMin && z.fretMax === focus.fretMax) ?? null;
  const isSpecificFret =
    focus.fretMin !== undefined &&
    focus.fretMin === focus.fretMax &&
    activeZone === null;
  const specificFretVal = isSpecificFret ? (focus.fretMin ?? '') : '';

  return (
    <div className="space-y-1.5 text-xs pb-2">
      {/* String row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">String:</span>
        <button
          className={pillCls(focus.stringIdx === undefined)}
          onClick={() => onChange({ ...focus, stringIdx: undefined })}
        >
          All
        </button>
        {STRING_LABELS.map(([idx, label]) => (
          <button
            key={idx}
            className={pillCls(focus.stringIdx === idx)}
            onClick={() => onChange({ ...focus, stringIdx: idx })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fret row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">Frets:</span>
        <button
          className={pillCls(focus.fretMin === undefined && focus.fretMax === undefined)}
          onClick={() => onChange({ ...focus, fretMin: undefined, fretMax: undefined })}
        >
          All
        </button>
        {FRET_ZONES.map(zone => (
          <button
            key={zone.label}
            className={pillCls(activeZone?.label === zone.label)}
            onClick={() =>
              onChange({
                ...focus,
                fretMin: zone.fretMin,
                fretMax: Math.min(zone.fretMax, fretsNum),
              })
            }
          >
            {zone.label}
          </button>
        ))}
        <span className="text-brand-secondary ml-1 shrink-0">Fret:</span>
        <input
          type="number"
          min={1}
          max={fretsNum}
          value={specificFretVal}
          placeholder="—"
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= fretsNum) {
              onChange({ ...focus, fretMin: v, fretMax: v });
            } else if (e.target.value === '') {
              onChange({ ...focus, fretMin: undefined, fretMax: undefined });
            }
          }}
          className="w-12 text-center rounded border border-brand-line text-xs py-0.5 bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/FretboardFocusSelector.tsx
git commit -m "feat: add FretboardFocusSelector component"
```

---

### Task 3: Fretboard dimming — `Fretboard.tsx`

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: `FretboardFocus` from `'../lib/earTraining'`
- Produces: Updated `Fretboard` component accepting new optional prop `focusZone?: FretboardFocus`

- [ ] **Step 1: Add the `FretboardFocus` import**

At the top of `src/components/Fretboard.tsx`, find:

```typescript
import { ChordShape, ScalePattern, STANDARD_TUNING } from '../types';
```

Add the earTraining import after it:

```typescript
import { FretboardFocus } from '../lib/earTraining';
```

- [ ] **Step 2: Add `focusZone` to `FretboardProps` and the `isInFocus` helper**

Find the `FretboardProps` interface. Add `focusZone?: FretboardFocus;` as the last property before the closing brace:

```typescript
interface FretboardProps {
  fretsNum?: number;
  chord?: ChordShape;
  scale?: ScalePattern;
  onNoteClick?: (note: string) => void;
  onFretClick?: (stringIdx: number, fretIdx: number) => void;
  onFretMouseDown?: (stringIdx: number, fretIdx: number) => void;
  showNoteNames?: boolean;
  className?: string;
  fretRange?: [number, number];
  playingNotes?: Set<string>;
  compact?: boolean;
  correctPositions?: Set<string>;
  wrongPosition?: string | null;
  previewPosition?: string | null;
  focusZone?: FretboardFocus;
}
```

After the interface, add the module-level helper (before the `Fretboard` function):

```typescript
function isInFocus(
  stringIdx: number,
  fretIdx: number,
  focus: FretboardFocus,
  fretsNum: number,
): boolean {
  if (focus.stringIdx !== undefined && focus.stringIdx !== stringIdx) return false;
  const fMin = focus.fretMin ?? 0;
  const fMax = focus.fretMax ?? fretsNum;
  return fretIdx >= fMin && fretIdx <= fMax;
}
```

- [ ] **Step 3: Destructure `focusZone` in the component signature**

Find the `export function Fretboard(...)` signature. It currently ends with `previewPosition = null }`. Add `focusZone` to the destructuring:

```typescript
export function Fretboard({
  fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown,
  showNoteNames = true, className, fretRange, playingNotes = new Set(),
  compact = false, correctPositions = new Set(), wrongPosition = null,
  previewPosition = null, focusZone,
}: FretboardProps) {
```

- [ ] **Step 4: Add the dimming overlay to the SVG**

In the SVG, find the comment `{/* Preview dot (Hunt mode) */}`. Insert the dimming overlay **immediately before** that comment:

```typescript
        {/* Dimming overlay — dims frets outside the active focus zone */}
        {focusZone && Array.from({ length: stringsNum }).map((_, stringIdx) =>
          Array.from({ length: fretsNum + 1 }).map((_, fretIdx) => {
            if (isInFocus(stringIdx, fretIdx, focusZone, fretsNum)) return null;
            const visualStringIdx = 5 - stringIdx;
            const x = fretIdx === 0 ? 0 : paddingX + (fretIdx - 1) * fretSpacing;
            const y = paddingY + visualStringIdx * stringSpacing - 15;
            const width = fretIdx === 0 ? paddingX : fretSpacing;
            return (
              <rect
                key={`dim-${stringIdx}-${fretIdx}`}
                x={x}
                y={y}
                width={width}
                height={30}
                fill="rgba(0,0,0,0.35)"
                style={{ pointerEvents: 'none' }}
              />
            );
          })
        )}
```

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Verify visually (optional but recommended)**

```bash
npm run dev
```

Navigate to any route that uses `<Fretboard>`. The prop is optional with default `undefined` so no existing usage changes. Confirm nothing is visually broken.

- [ ] **Step 7: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add focusZone dimming overlay to Fretboard"
```

---

### Task 4: FretboardTrainer — octave-precise grading, first-tap stats, focus UI

**Files:**
- Modify: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Consumes (from Task 1): `FretboardFocus`, `getAbsoluteSemitoneDistance`, `getAbsoluteDirection` from `'../lib/earTraining'`
- Consumes (from Task 2): `FretboardFocusSelector` from `'./FretboardFocusSelector'`
- Consumes (from Task 3): `focusZone` prop on `Fretboard`
- Produces: Updated `FretboardTrainer` with new optional props `focus?: FretboardFocus` and `onFocusChange?: (focus: FretboardFocus) => void`

**Context:** The current file (`src/components/FretboardTrainer.tsx`) has these Hunt-mode state fields that will be removed: `firstConfirmSemitones`, `firstConfirmDirection`. These are replaced by `firstSelectionSemitones`, `firstSelectionDirection`, and the new `selectionCount`. The field `selectedNote` currently stores a pitch class; it will now store the full note+octave string (e.g. `"C4"`).

- [ ] **Step 1: Update imports**

Replace the current import block at the top of `src/components/FretboardTrainer.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import { FretboardFocusSelector } from './FretboardFocusSelector';
import {
  FretboardRound, DifficultyLevel, SessionScore, HuntResult, FretboardFocus,
  getCorrectPositions, playFretboardRound, getAbsoluteSemitoneDistance, getAbsoluteDirection,
} from '../lib/earTraining';
import { getFretNote, initAudio, playNote, startNote, stopNote } from '../lib/audio';
```

(This removes `getSemitoneDistance` and `getSemitoneDirection` from the import and adds the new helpers and `FretboardFocus`.)

- [ ] **Step 2: Update `FretboardTrainerProps`**

Replace the existing interface:

```typescript
interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;
  focus?: FretboardFocus;
  onFocusChange?: (focus: FretboardFocus) => void;
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}
```

- [ ] **Step 3: Update the component signature to destructure the new props**

Replace the existing function signature line:

```typescript
export function FretboardTrainer({ round, score, isHuntMode, onComplete }: FretboardTrainerProps) {
```

With:

```typescript
export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  onComplete,
}: FretboardTrainerProps) {
```

- [ ] **Step 4: Replace the state declarations**

Find the existing state block (the lines from `const [correctPositions...` through `const [roundFeedback...]`). Replace the entire Hunt-only state section with the new fields. The full new state block for the component is:

```typescript
  // Shared state (Guess + Hunt)
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);

  // Hunt-only state
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null); // full note+octave e.g. "C4"
  const [attemptCount, setAttemptCount] = useState(0);
  const [selectionCount, setSelectionCount] = useState(0);
  const [firstSelectionSemitones, setFirstSelectionSemitones] = useState<number | null>(null);
  const [firstSelectionDirection, setFirstSelectionDirection] = useState<'sharp' | 'flat' | 'correct' | null>(null);
  const [wrongConfirmFlash, setWrongConfirmFlash] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState<string | null>(null);
```

- [ ] **Step 5: Update the `useEffect` that resets state on round change**

Replace the existing `useEffect` (the one that calls `playFretboardRound`):

```typescript
  useEffect(() => {
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    setSelectedPosition(null);
    setSelectedNote(null);
    setAttemptCount(0);
    setSelectionCount(0);
    setFirstSelectionSemitones(null);
    setFirstSelectionDirection(null);
    setWrongConfirmFlash(false);
    setRoundFeedback(null);
    playFretboardRound(round).catch(() => {});
  }, [round]);
```

- [ ] **Step 6: Replace `handleFretMouseDown`**

Replace the existing `handleFretMouseDown`:

```typescript
  const handleFretMouseDown = useCallback((stringIdx: number, fretIdx: number) => {
    if (!isHuntMode || isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const key = `${stringIdx}-${fretIdx}`;
    setSelectedPosition(key);
    setSelectedNote(noteStr);
    setSelectionCount(c => c + 1);
    setFirstSelectionSemitones(prev =>
      prev !== null ? prev : getAbsoluteSemitoneDistance(noteStr, round.targetNote),
    );
    setFirstSelectionDirection(prev =>
      prev !== null ? prev : getAbsoluteDirection(noteStr, round.targetNote),
    );
    initAudio().then(() => startNote(noteStr)).catch(() => {});
  }, [isHuntMode, isRevealing, round.targetNote]);
```

- [ ] **Step 7: Replace `handleFretClick`**

Replace the existing `handleFretClick`:

```typescript
  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const key = `${stringIdx}-${fretIdx}`;

    if (isHuntMode) {
      // Mouse: handled by mousedown/mouseup. Touch fallback: play short note.
      setSelectedPosition(key);
      setSelectedNote(noteStr);
      setSelectionCount(c => c + 1);
      setFirstSelectionSemitones(prev =>
        prev !== null ? prev : getAbsoluteSemitoneDistance(noteStr, round.targetNote),
      );
      setFirstSelectionDirection(prev =>
        prev !== null ? prev : getAbsoluteDirection(noteStr, round.targetNote),
      );
      initAudio().then(() => playNote(noteStr, '2n')).catch(() => {});
      return;
    }

    // Guess mode — octave-precise grading
    if (noteStr === round.targetNote) {
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
```

- [ ] **Step 8: Replace `handleConfirm`**

Replace the existing `handleConfirm`:

```typescript
  const handleConfirm = useCallback(() => {
    if (!selectedPosition || !selectedNote || isRevealing) return;
    const isCorrect = selectedNote === round.targetNote;

    const semitones =
      firstSelectionSemitones ??
      getAbsoluteSemitoneDistance(selectedNote, round.targetNote);
    const direction =
      firstSelectionDirection ??
      getAbsoluteDirection(selectedNote, round.targetNote);

    if (isCorrect) {
      const stars = semitones === 0 ? 3 : semitones <= 2 ? 2 : semitones <= 5 ? 1 : 0;
      const attempts = attemptCount + 1;
      const totalTaps = selectionCount;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const feedback =
        semitones === 0 && totalTaps === 1
          ? '★★★  Direct hit — confirmed first try'
          : `${starStr}  ${totalTaps} tap${totalTaps !== 1 ? 's' : ''} · confirmed ${
              attempts === 1
                ? 'first try'
                : attempts === 2
                ? '2nd try'
                : attempts === 3
                ? '3rd try'
                : `${attempts}th try`
            } · first tap ${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction}`;
      setRoundFeedback(feedback);
      setCorrectPositions(new Set([selectedPosition]));
      setIsRevealing(true);
      setNoteRevealed(true);
      setTimeout(() =>
        onComplete(true, {
          stars,
          attempts,
          selectionCount: totalTaps,
          direction,
          firstSelectionSemitones: semitones,
        }),
        600,
      );
    } else {
      setIsRevealing(true);
      setWrongConfirmFlash(true);
      setAttemptCount(a => a + 1);
      setTimeout(() => {
        setWrongConfirmFlash(false);
        setIsRevealing(false);
      }, 600);
    }
  }, [
    selectedPosition, selectedNote, isRevealing, round,
    firstSelectionSemitones, firstSelectionDirection,
    attemptCount, selectionCount, onComplete,
  ]);
```

- [ ] **Step 9: Update the JSX — add `FretboardFocusSelector` and `focusZone` prop**

Find the `return (` JSX block. Make two changes:

**a)** In the `<Fretboard ... />` element, add `focusZone={isHuntMode ? focus : undefined}`:

```tsx
      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        onFretMouseDown={isHuntMode ? handleFretMouseDown : undefined}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
        previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
        focusZone={isHuntMode ? focus : undefined}
        compact
      />
```

**b)** Inside `{isHuntMode && (`, add the `FretboardFocusSelector` just above the `<Fretboard>` element. The full Hunt mode section of the return becomes:

```tsx
      {isHuntMode && onFocusChange && (
        <FretboardFocusSelector
          focus={focus}
          fretsNum={round.fretsNum}
          onChange={onFocusChange}
        />
      )}

      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        onFretMouseDown={isHuntMode ? handleFretMouseDown : undefined}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
        previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
        focusZone={isHuntMode ? focus : undefined}
        compact
      />
```

Also update the note revealed display — currently it shows `round.targetNote` which is now a full note+octave. The pitch class displayed should strip the octave. Find:

```tsx
          <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote}</span>
```

Replace with:

```tsx
          <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote.replace(/\d$/, '')}</span>
```

- [ ] **Step 10: Verify lint passes**

```bash
npm run lint
```

Expected: no errors. (EarTraining.tsx will have a TypeScript error at the `<FretboardTrainer>` call site because it is not yet passing `focus` and `onFocusChange`. That error will be fixed in Task 5. If lint fails for any other reason, fix it before committing.)

Actually — to keep lint clean after this task, temporarily the optional `focus` prop (defaulting to `{}`) means EarTraining.tsx can continue to compile without passing it. Confirm this is the case.

- [ ] **Step 11: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: octave-precise Hunt grading, first-tap stats, focus selector in trainer"
```

---

### Task 5: EarTraining.tsx — wire focus state

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes (from Task 1): `FretboardFocus` from `'../lib/earTraining'`
- Consumes (from Task 4): `focus` and `onFocusChange` props on `FretboardTrainer`

**Context:** `EarTraining.tsx` has a module-level `makeRound` function (lines 14–18) that calls `generateFretboardRound(difficulty)`. This needs a third `focus` parameter. The component has `advanceRound` (lines 63–68) and `handleStartOver` (lines 190–195) that both need updating. The `<FretboardTrainer>` JSX is at lines 417–423.

- [ ] **Step 1: Add `FretboardFocus` to the import from `earTraining`**

Find the import block at lines 4–10. Add `FretboardFocus` to the named imports:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
```

- [ ] **Step 2: Update the module-level `makeRound` function**

Find (lines 14–18):

```typescript
function makeRound(s: EarTrainingSettings, difficulty: DifficultyLevel = 'Beginner'): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty);
  return generateIntervalRound(s.activeIntervals);
}
```

Replace with:

```typescript
function makeRound(
  s: EarTrainingSettings,
  difficulty: DifficultyLevel = 'Beginner',
  focus: FretboardFocus = {},
): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty, focus);
  return generateIntervalRound(s.activeIntervals);
}
```

- [ ] **Step 3: Add `fretboardFocus` state inside the `EarTraining` component**

Find the state declarations at the top of `EarTraining()`. After the `biasTally` state line, add:

```typescript
  const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});
```

- [ ] **Step 4: Update `advanceRound` to pass focus**

Find `advanceRound` (lines 63–68):

```typescript
  function advanceRound(s: EarTrainingSettings = settings) {
    const r = makeRound(s, difficulty);
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```

Replace with:

```typescript
  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus) {
    const activeFocus = focusOverride ?? fretboardFocus;
    const r = makeRound(s, difficulty, activeFocus);
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```

- [ ] **Step 5: Add `handleFocusChange`**

After `handleFretboardMode` (around line 94), add:

```typescript
  function handleFocusChange(focus: FretboardFocus) {
    setFretboardFocus(focus);
    advanceRound(settings, focus);
  }
```

- [ ] **Step 6: Update `handleStartOver` to reset focus**

Find `handleStartOver` (lines 190–195):

```typescript
  function handleStartOver() {
    setScore(initialScore());
    setBiasTally({ sharp: 0, flat: 0, correct: 0 });
    setShowSummary(false);
    advanceRound();
  }
```

Replace with:

```typescript
  function handleStartOver() {
    setScore(initialScore());
    setBiasTally({ sharp: 0, flat: 0, correct: 0 });
    setFretboardFocus({});
    setShowSummary(false);
    advanceRound(settings, {});
  }
```

- [ ] **Step 7: Pass `focus` and `onFocusChange` to `<FretboardTrainer>`**

Find the `<FretboardTrainer>` element (lines 417–423):

```tsx
        <FretboardTrainer
          round={round as FretboardRound}
          difficulty={difficulty}
          score={score}
          isHuntMode={fretboardSubMode === 'hunt'}
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
          focus={fretboardFocus}
          onFocusChange={handleFocusChange}
          onComplete={handleFretboardComplete}
        />
```

- [ ] **Step 8: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 9: Manual browser verification**

```bash
npm run dev
```

Open `http://localhost:3000/Guitar_Chords/` and navigate to Ear Training → Fretboard tab.

Check Guess mode:
- Select Beginner difficulty. Click a note on the fretboard. Confirm that only positions showing the exact note+octave light green. Confirm that clicking the same pitch class at a different octave shows red (wrong).

Check Hunt mode:
- Click Hunt. The focus selector strip should appear above the fretboard with string pills and fret pills.
- Select "E₂" string. Replay — confirm the played tone is always on the low E string range. The other strings should appear dimmed.
- Select "1–4" frets. Replay — the note should be within frets 1–4.
- Enter `5` in the specific fret input. All frets except fret 5 should dim.
- Select a fret, hit Confirm. The feedback line should show tap count, try count, and semitone distance.
- Hit "Start Over" (End Session → Start Over). Focus should reset to All / All.

- [ ] **Step 10: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: wire fretboard focus state and handleFocusChange in EarTraining"
```
