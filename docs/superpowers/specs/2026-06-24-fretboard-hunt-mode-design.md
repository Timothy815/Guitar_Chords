# Fretboard Hunt Mode Design

## Overview

Add a Hunt sub-mode to the Fretboard ear training tab. In Hunt mode the user taps frets freely to audition notes (each tap plays the note and shows its name on the dot), then presses a Confirm button when ready to submit their answer. Wrong confirms are penalised but the round continues — the user must find the correct note themselves. Scoring rewards both first-tap pitch accuracy and search efficiency, and accumulates directional bias data (sharp/flat tendency) across the session.

---

## Access

Hunt appears as a fourth entry in the difficulty selector rendered inside the Fretboard tab: `Beginner | Intermediate | Advanced | Hunt`. Selecting Hunt sets `fretboardSubMode = 'hunt'` in `EarTraining.tsx` local state and generates a new round immediately with `fretsNum: 13` (full neck). Selecting Beginner/Intermediate/Advanced restores Guess behaviour and clears `fretboardSubMode` back to `'guess'`. The global `difficulty` state and `DifficultyLevel` type are unchanged.

---

## Round Format

Hunt rounds reuse the existing `FretboardRound` type unchanged (`kind: 'fretboard'`, `targetNote`, `fretsNum: 13`). No new round type is needed.

Hunt-specific state lives entirely inside `FretboardTrainer`:

| State field | Type | Purpose |
|---|---|---|
| `selectedPosition` | `string \| null` | `"stringIdx-fretIdx"` of the currently previewed fret |
| `selectedNote` | `string \| null` | Pitch class shown on the preview dot label |
| `attemptCount` | `number` | Total Confirm presses before a correct answer |
| `firstConfirmSemitones` | `number \| null` | Semitone distance from target on first Confirm (captured once) |
| `firstConfirmDirection` | `'sharp' \| 'flat' \| 'correct' \| null` | Direction of first Confirm relative to target |

---

## Interaction Flow

1. Round loads → `playFretboardRound(round)` fires automatically; Confirm button is disabled
2. User taps any fret → that fret's note plays; blue preview dot with pitch-class label appears at that position; Confirm enables
3. User taps a different fret → previous dot disappears; new dot + label appears; new note plays
4. Replay button replays the target note at any time during hunting
5. User presses Confirm:
   - If this is the first Confirm: capture `firstConfirmSemitones` and `firstConfirmDirection` (never overwritten)
   - **Correct** (pitch class of `selectedPosition` matches `round.targetNote`):
     - Preview dot flashes green
     - `isRevealing = true` blocks further input
     - Per-round feedback shown (stars + attempts + direction hint)
     - `onComplete(true, huntResult)` fires after 600 ms → next round
   - **Wrong**:
     - Preview dot flashes red for 600 ms, then returns to blue
     - `isRevealing = true` during the 600 ms flash, then `isRevealing = false`
     - `attemptCount++`
     - User continues hunting — no correct positions revealed, no auto-advance
6. Taps and Confirms are blocked (`isRevealing = true`) during both correct and wrong flash windows

---

## Difficulty & Fret Range

| Dropdown entry | `fretboardSubMode` | `fretsNum` |
|---|---|---|
| Beginner | `'guess'` | 6 |
| Intermediate | `'guess'` | 10 |
| Advanced | `'guess'` | 13 |
| Hunt | `'hunt'` | 13 |

---

## Scoring

### Per-round proximity score (stars)

Based on `firstConfirmSemitones` — first Confirm only, never updated on subsequent wrong confirms:

| Semitones from target | Stars |
|---|---|
| 0 (correct first try) | ★★★ |
| 1–2 | ★★☆ |
| 3–5 | ★☆☆ |
| 6+ | ☆☆☆ |

### Per-round efficiency

`attemptCount` (total Confirms before correct) is shown as feedback: "Found in N attempt(s)."

### Session tracking

`SessionScore` gains two new optional fields:
- `totalStars?: number` — sum of stars across all Hunt rounds in the session
- `huntAttempts?: number[]` — one entry per Hunt round (the `attemptCount` value)

These accumulate via `handleFretboardComplete` in `EarTraining.tsx`.

### Directional bias

`firstConfirmDirection` (`'sharp'`, `'flat'`, or `'correct'`) is recorded for every Hunt round and passed to `handleFretboardComplete`. `EarTraining.tsx` accumulates a flat tally `{ sharp: number; flat: number; correct: number }` in local state. The session summary displays the dominant tendency (e.g., "You tend to guess flat") if either sharp or flat exceeds the other by more than 2.

### Per-round feedback (shown after correct Confirm, before advancing)

A brief overlay or inline message:
> "★★☆ — Found in 2 attempts — You guessed 2 semitones flat on your first try"

In Guess mode this message is not shown (behaviour unchanged).

---

## Session Summary

The existing session summary (fires at `SESSION_LENGTH` rounds) gains a Hunt section when at least one Hunt round was played:

- Average stars: `totalStars / huntRoundCount`
- Average attempts: mean of `huntAttempts`
- Directional bias note (if pronounced)

---

## Data Layer (`earTraining.ts`)

### New types

```typescript
export interface HuntResult {
  stars: number;
  attempts: number;
  direction: 'sharp' | 'flat' | 'correct';
}
```

Exported from `earTraining.ts` so both `FretboardTrainer.tsx` and `EarTraining.tsx` share the same type without a re-export chain.

### New helpers

```typescript
// Returns absolute semitone distance between two pitch classes (0–6, wraps at tritone)
export function getSemitoneDistance(played: string, target: string): number {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const diff = Math.abs(idx(played) - idx(target));
  return Math.min(diff, 12 - diff);
}

// Returns direction of played relative to target
export function getSemitoneDirection(
  played: string,
  target: string
): 'sharp' | 'flat' | 'correct' {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const raw = idx(played) - idx(target);
  const wrapped = ((raw % 12) + 12) % 12;
  if (wrapped === 0) return 'correct';
  return wrapped <= 6 ? 'sharp' : 'flat';
}
```

### `SessionScore` additions

```typescript
export interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
  totalStars?: number;          // Hunt mode only
  huntAttempts?: number[];      // Hunt mode only — one entry per round
}
```

---

## Fretboard Component (`Fretboard.tsx`)

One new optional prop — additive only, no existing props changed:

```typescript
previewPosition?: string | null   // "stringIdx-fretIdx" → blue dot with note name label
```

Rendering: a blue SVG circle (`#3b82f6`, blue-500) at the fret position, with the pitch-class note name rendered as a white SVG `<text>` element centred inside the circle. The dot size matches the existing trainer dots (r=14 for fretted positions, r=10 for open string). `pointerEvents: 'none'` so it doesn't interfere with click hit areas.

---

## FretboardTrainer Component (`src/components/FretboardTrainer.tsx`)

### New prop

```typescript
interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;                           // NEW
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;  // extended
}

// HuntResult is imported from earTraining.ts (defined there)
```

### Hunt mode behaviour

When `isHuntMode` is true:
- `handleFretClick` plays the tapped note and sets `selectedPosition` + `selectedNote` — no grading
- `handleConfirm` performs the grading logic described in the Interaction Flow section
- Fretboard receives `previewPosition={selectedPosition}` in Hunt mode (instead of `correctPositions`/`wrongPosition`)
- Confirm button renders below the Fretboard, disabled until `selectedPosition !== null` and `!isRevealing`

When `isHuntMode` is false (Guess mode): existing behaviour unchanged.

### Per-round feedback

After a correct Hunt Confirm, before `onComplete` fires, a brief inline message renders. Two forms:

- **Correct first try** (`firstConfirmSemitones === 0`): `"★★★  Found in 1 attempt  ·  Perfect — correct first try!"`
- **Wrong first try**: `"★★☆  Found in 2 attempts  ·  2 semitones flat on first try"` (stars and semitone/direction values substituted)

This disappears when the next round loads.

---

## EarTraining.tsx Changes

- New local state: `const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt'>('guess')`
- New local state: `const [biasTally, setBiasTally] = useState({ sharp: 0, flat: 0, correct: 0 })`
- The difficulty dropdown in fretboard mode gains a fourth visual option "Hunt":
  - Selecting Hunt: `setFretboardSubMode('hunt')`, keep `difficulty` at `'Advanced'` (for fretsNum via `generateFretboardRound`)
  - Selecting Beginner/Intermediate/Advanced: `setFretboardSubMode('guess')`, set difficulty normally
- `handleFretboardComplete(wasCorrect, huntResult?)`:
  - Updates `score` as before
  - If `huntResult` present: accumulates `totalStars`, `huntAttempts`, `biasTally`
- `<FretboardTrainer>` receives `isHuntMode={fretboardSubMode === 'hunt'}`
- Session summary: if `score.huntAttempts?.length > 0`, render Hunt stats section

---

## Files

| File | Change |
|---|---|
| `src/lib/earTraining.ts` | Add `getSemitoneDistance`, `getSemitoneDirection`; extend `SessionScore` |
| `src/components/Fretboard.tsx` | Add `previewPosition` prop |
| `src/components/FretboardTrainer.tsx` | Add `isHuntMode` prop, Hunt state, Confirm button, per-round feedback |
| `src/pages/EarTraining.tsx` | Add `fretboardSubMode`, `biasTally` state; extend difficulty selector; update `handleFretboardComplete` |
