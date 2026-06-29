# Tuning-Aware Fretboard Implementation Plan

> **For agentic workers:** Implement this plan task-by-task using the checkbox steps below. Commit after each task. Run `npm run lint` (tsc --noEmit) before every commit — fix all errors before proceeding.

**Goal:** Make the `Fretboard` component respect alternate tunings so that selecting Open G, Open D, Drop D, etc. in the Dictionary changes the visible note names, scale dots, and open-string labels to match the tuning.

**Architecture:** Add an optional `tuning?: Tuning` prop to `Fretboard.tsx` (default `STANDARD_TUNING`). Replace every call to `getFretNote(stringIdx, fretIdx)` inside Fretboard with one that passes the tuning explicitly. Wire `currentTuning` from Dictionary into the `<Fretboard>` render. No other pages or components need changes — they all stay standard-tuning.

**Tech Stack:** React 19, TypeScript, Tailwind v4. No new dependencies.

---

## Global Constraints

- `Fretboard.tsx` new prop: `tuning?: Tuning` — default value `STANDARD_TUNING` (imported from `@/src/types` — note: inside `src/`, imports use relative paths like `../types`).
- All existing call sites that do NOT pass `tuning` must continue to work exactly as before — the default handles this.
- Only `src/pages/Dictionary.tsx` passes a non-default tuning (its `currentTuning` state).
- `npm run lint` (tsc --noEmit) must pass with zero errors after every task.
- No changes to any file other than `src/components/Fretboard.tsx` and `src/pages/Dictionary.tsx`.
- Do NOT change `src/lib/audio.ts` — `getFretNote` already accepts an optional `tuning` argument and defaults to `currentAudioTuning`.

---

## Task 1: Add `tuning` prop to `Fretboard.tsx`

**Files:**
- Modify: `src/components/Fretboard.tsx`

**What to do:**

### Step 1 — Add `tuning` to `FretboardProps` interface

Current interface (lines 31–50):
```ts
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
  highlightNote?: { stringIdx: number; fret: number };
  labeledDots?: { stringIdx: number; fret: number }[];
  flashHighlight?: boolean;
}
```

Add `tuning?: Tuning;` as the last property before the closing `}`.

Also add `Tuning` to the import from `'../types'` at line 2. Current import:
```ts
import { ChordShape, ScalePattern, STANDARD_TUNING } from '../types';
```
Change to:
```ts
import { ChordShape, ScalePattern, STANDARD_TUNING, Tuning } from '../types';
```

### Step 2 — Destructure `tuning` in the function signature with default

Current function signature (line 52):
```ts
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote, labeledDots, flashHighlight }: FretboardProps) {
```

Add `, tuning = STANDARD_TUNING` at the end of the destructure, before `}: FretboardProps`:
```ts
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote, labeledDots, flashHighlight, tuning = STANDARD_TUNING }: FretboardProps) {
```

### Step 3 — Thread `tuning` through every `getFretNote` call inside `renderNoteMarker`

Inside `renderNoteMarker` (and anywhere else in the component that calls `getFretNote`), every call currently looks like:
```ts
const noteStr = getFretNote(stringIdx, fretIdx);
```
or
```ts
const noteName = getFretNote(stringIdx, 0).replace(/[^A-G#b]/g, '');
```

Change every `getFretNote(stringIdx, fretIdx)` call inside the Fretboard component to pass the tuning:
```ts
const noteStr = getFretNote(stringIdx, fretIdx, tuning);
```

`getFretNote` already has the signature `getFretNote(stringIndex: number, fret: number, tuning: Tuning = currentAudioTuning)` in `src/lib/audio.ts` — you are just passing the explicit tuning instead of relying on the audio module's global state.

Search the entire `Fretboard.tsx` file for every occurrence of `getFretNote(` and add `, tuning` as the third argument.

### Step 4 — Also thread tuning into `handleDotClick`

Current `handleDotClick` (line 84):
```ts
const handleDotClick = (stringIdx: number, fretIdx: number) => {
  const noteStr = getFretNote(stringIdx, fretIdx);
  if (onFretClick) onFretClick(stringIdx, fretIdx);
  else if (onNoteClick) onNoteClick(noteStr);
  else playNote(noteStr);
};
```

Change to:
```ts
const handleDotClick = (stringIdx: number, fretIdx: number) => {
  const noteStr = getFretNote(stringIdx, fretIdx, tuning);
  if (onFretClick) onFretClick(stringIdx, fretIdx);
  else if (onNoteClick) onNoteClick(noteStr);
  else playNote(noteStr);
};
```

### Step 5 — Lint check and commit

```bash
npm run lint
```

Expected: zero errors.

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add tuning prop to Fretboard component"
```

---

## Task 2: Wire `currentTuning` into Fretboard in Dictionary.tsx

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Context:** `Dictionary.tsx` already has:
- `import { ChordShape, Note, TUNINGS, Tuning, Finger } from '../types';` (line 10)
- `const [currentTuning, setCurrentTuning] = useState<Tuning>(TUNINGS['Standard']);` (line 78)
- A `<select>` at around line 696 that calls `setCurrentTuning(TUNINGS[e.target.value])`
- `import('../lib/audio').then(m => m.setAudioTuning(currentTuning))` in a useEffect (line 316) — this already handles audio

**What to do:**

### Step 1 — Find the `<Fretboard>` render in Dictionary

Search for `<Fretboard` in `Dictionary.tsx`. There is one main instance used for chords/scales/identify modes (around line 1194):

```tsx
<Fretboard
   fretsNum={15}
   chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: [-1,-1,-1,-1,-1,-1] } : undefined)}
   showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
   scale={mode === 'scales' ? activeScale : undefined}
   playingNotes={playingNotes}
   fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
   onNoteClick={(str) => {
     import('../lib/audio').then(m => m.playNote(str, sustain));
   }}
   onFretClick={handleFretClick}
/>
```

Add `tuning={currentTuning}` as a prop:

```tsx
<Fretboard
   fretsNum={15}
   chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: [-1,-1,-1,-1,-1,-1] } : undefined)}
   showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
   scale={mode === 'scales' ? activeScale : undefined}
   playingNotes={playingNotes}
   fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
   onNoteClick={(str) => {
     import('../lib/audio').then(m => m.playNote(str, sustain));
   }}
   onFretClick={handleFretClick}
   tuning={currentTuning}
/>
```

### Step 2 — Verify the tuning warning message still shows

Around line 704 there is already a warning for non-standard tuning in chords mode:
```tsx
{currentTuning.name !== 'Standard' && mode === 'chords' && (
  <p className="text-[10px] text-orange-500 font-bold">Standard chord shapes may not sound correct in this tuning!</p>
)}
```
Leave this exactly as-is — no change needed.

### Step 3 — Lint check and commit

```bash
npm run lint
```

Expected: zero errors.

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: pass currentTuning into Fretboard in Dictionary"
```

---

## How to verify it works

1. Run `npm run dev`
2. Navigate to `/Guitar_Chords/dictionary`
3. Go to the Scales tab, select a root and scale — note names on the fretboard should be standard
4. Change the tuning selector to "Open G" (open strings become D G D G B D)
5. The fretboard open-string dots should now show D, G, D, G, B, D
6. Scale dots should reposition to match the new open string notes
7. Clicking any dot should play the note that matches the visible label
8. Switch back to Standard — fretboard reverts

---

## Notes for the implementer

- `STANDARD_TUNING.notes` is `['E', 'A', 'D', 'G', 'B', 'E']` (low E to high E, index 0 = low E)
- `getFretNote` in `audio.ts` already handles any tuning correctly — you only need to pass it through, not reimplement the math
- The `generateScalePattern` function in `guitarData.ts` returns a `ScalePattern` with a `notes` array (note names, tuning-independent) — scale highlighting on the fretboard works by matching note names, so it automatically works once `getFretNote` uses the right tuning
- Chord shape `frets` arrays are fixed finger positions — in alternate tunings those positions produce different notes, which is intentional (and already warned about in the UI)
- No changes needed in `audio.ts`, `guitarData.ts`, or any other file
