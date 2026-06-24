# Fretboard Focus Filter + Octave-Precise Matching — Design Spec

## Goal

Add a focused-practice filter to Hunt mode that lets players drill notes on a specific string, fret zone, or both simultaneously. Simultaneously upgrade both Guess and Hunt modes from pitch-class matching to octave-precise matching, and extend Hunt mode stats to capture first-tap accuracy and total taps before confirming.

## Architecture

Focus state lives in `EarTraining.tsx` because it must constrain note generation (which happens at that level) before the round is passed to `FretboardTrainer`. All three concerns — focus filter, octave matching, richer stats — touch the same data path (`generateFretboardRound` → `FretboardTrainer` → `Fretboard`) so they ship together in one plan.

**Tech stack:** React 19, TypeScript, Tailwind v4, existing `earTraining.ts` / `audio.ts` / `Fretboard.tsx` / `FretboardTrainer.tsx` / `EarTraining.tsx`.

---

## 1. Data Layer (`src/lib/earTraining.ts`)

### `FretboardFocus` type (new)

```typescript
export interface FretboardFocus {
  stringIdx?: number;   // 0 = low E … 5 = high E; undefined = all strings
  fretMin?: number;     // inclusive lower bound; undefined = 0
  fretMax?: number;     // inclusive upper bound; undefined = fretsNum
}
```

Zone pills set `fretMin`/`fretMax` to band bounds. A specific fret sets `fretMin === fretMax`. "All" leaves both undefined. String and fret axes are independent and combinable (e.g. `{ stringIdx: 0, fretMin: 1, fretMax: 4 }` = low E string, frets 1–4).

### `FretboardRound` change

`targetNote` changes from pitch class (`"E"`) to full note+octave (`"E3"`). No other fields change.

### `generateFretboardRound(difficulty, focus?)` change

Builds a pool of every full note+octave reachable within `fretsNum`. If `focus.stringIdx` is set, only positions on that string enter the pool. If `focus.fretMin`/`fretMax` are set, only positions within that fret range enter the pool. Picks one full note at random from the pool (guarantees the chosen note has at least one valid position in the focus zone).

### `playFretboardRound` change

Plays `round.targetNote` directly — no re-randomization. The octave is already embedded in the round.

### `getCorrectPositions(targetNote, fretsNum)` change

Matches the full note string including octave. C4 at D-string fret 10 and C4 at G-string fret 5 are both correct; C3 is not. Focus zone does not restrict correct positions — dimming provides the visual distinction; tapping outside the zone carries no penalty.

### New helper functions

```typescript
function noteToMidi(noteStr: string): number
// "C4" → 48, "E3" → 40. Used internally.

export function getAbsoluteSemitoneDistance(a: string, b: string): number
// Absolute semitone difference including octave. "E3" vs "G3" → 3.

export function getAbsoluteDirection(played: string, target: string): 'sharp' | 'flat' | 'correct'
// played > target → 'sharp'; played < target → 'flat'.
```

These replace `getSemitoneDistance` and `getSemitoneDirection` for the fretboard modes. The old functions can be removed if no other callers remain after the migration — the implementation plan should verify this.

### `HuntResult` extension

```typescript
export interface HuntResult {
  stars: number;
  attempts: number;                // confirm presses before success
  selectionCount: number;          // total fret taps before confirm
  direction: 'sharp' | 'flat' | 'correct';
  firstSelectionSemitones: number; // distance of very first tap from target
}
```

Stars are calculated from `firstSelectionSemitones` (not first-confirm semitones), since that is the truer measure of raw ear accuracy. Thresholds (absolute semitones): 0 → 3 stars, 1–2 → 2 stars, 3–5 → 1 star, 6+ → 0 stars.

---

## 2. Focus Selector UI (`src/components/FretboardFocusSelector.tsx`)

New component. Props:

```typescript
interface FretboardFocusSelectorProps {
  focus: FretboardFocus;
  fretsNum: number;
  onChange: (focus: FretboardFocus) => void;
}
```

Renders two compact pill rows:

```
String:  [All] [E₂] [A] [D] [G] [B] [E₄]
Frets:   [All] [Open] [1–4] [5–8] [9–12]   Fret: [ 3 ▲▼ ]
```

**String row:** Seven pills. Active pill uses `bg-brand-primary text-white`; inactive uses `border-brand-line text-brand-secondary`. Selecting a pill sets `focus.stringIdx`; selecting "All" clears it.

**Fret row:** Four zone pills + a small numeric stepper (input bounded 1–`fretsNum`). Zone pill bounds:
- Open → `{ fretMin: 0, fretMax: 0 }`
- 1–4 → `{ fretMin: 1, fretMax: 4 }`
- 5–8 → `{ fretMin: 5, fretMax: 8 }`
- 9–12 → `{ fretMin: 9, fretMax: 12 }` (capped at fretsNum if lower)

Selecting a zone pill clears the specific-fret input. Entering a number in the stepper deselects any zone pill and sets `fretMin === fretMax`. Selecting "All" clears both `fretMin` and `fretMax`.

The component is visible only in Hunt mode (rendered by `FretboardTrainer` just above the fretboard).

---

## 3. Fretboard Dimming (`src/components/Fretboard.tsx`)

New prop: `focusZone?: FretboardFocus`.

A helper `isInFocus(stringIdx, fretIdx, focus, fretsNum): boolean` returns true when:
- `focus.stringIdx` is undefined OR equals `stringIdx`
- `fretIdx` is within `[fretMin ?? 0, fretMax ?? fretsNum]`

When `focusZone` is set, a dimming layer is inserted in the SVG after the string lines but before the note markers. For each out-of-focus cell, render a `<rect>` covering that fret column × string row with `fill="rgba(0,0,0,0.35)"` and `pointerEvents="none"`. Hit-area rects are unchanged — all frets remain clickable.

Open string cells (fret 0) are treated as `fretIdx === 0` in the `isInFocus` calculation: they are in focus when `fretMin === undefined` or `fretMin === 0`.

---

## 4. `FretboardTrainer.tsx`

### State changes

`selectedNote` changes from pitch class to full note string (e.g. `"C4"`), set on every `handleFretMouseDown`/`handleFretClick`.

Three new state fields:
```typescript
const [selectionCount, setSelectionCount] = useState(0);
const [firstSelectionSemitones, setFirstSelectionSemitones] = useState<number | null>(null);
const [firstSelectionDirection, setFirstSelectionDirection] = useState<'sharp' | 'flat' | 'correct' | null>(null);
```

Captured on the first `handleFretMouseDown`/`handleFretClick` of a round; never overwritten. `selectionCount` increments on every tap. All three reset in the `useEffect` that fires on `round` change.

### `handleConfirm` change

Correct check: `selectedNote === round.targetNote` (full note+octave comparison). Stars calculated from `firstSelectionSemitones`. Feedback text:

```
★★★  Direct hit — confirmed first try
★★☆  3 taps · confirmed 2nd try · first tap 2 semitones flat
★☆☆  7 taps · confirmed 3rd try · first tap 5 semitones sharp
```

`onComplete` passes the updated `HuntResult` with all five fields.

### New props

```typescript
focus: FretboardFocus;   // forwarded to Fretboard as focusZone; also renders FretboardFocusSelector
onFocusChange: (focus: FretboardFocus) => void;
```

`FretboardFocusSelector` renders inside the trainer card, above the `<Fretboard>`, when `isHuntMode` is true.

---

## 5. `EarTraining.tsx`

```typescript
const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});
```

`generateFretboardRound(difficulty, fretboardFocus)` — focus passed at generation time.

`handleFocusChange(focus)` — calls `setFretboardFocus(focus)` and immediately regenerates the round so the new note is guaranteed to live in the new focus zone.

`handleStartOver` resets focus to `{}`.

`FretboardTrainer` receives `focus={fretboardFocus}` and `onFocusChange={handleFocusChange}`.

**Guess mode** gets octave-precise matching for free: `handleFretClick` in the trainer now compares the full note string against `round.targetNote`, which already stores a full note since both modes share the same round type and generation function.

---

## Out-of-scope

- Combining focus with Guess mode difficulty selector UI (Guess mode shows no focus controls)
- Persisting focus selection across sessions
- Focus affecting the session summary stats breakdown
