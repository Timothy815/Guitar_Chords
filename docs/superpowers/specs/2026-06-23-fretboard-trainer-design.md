# Fretboard Trainer Design

## Overview

Add a fourth "Fretboard" tab to the ear training page. A note is played; the learner taps where it lives on the fretboard. Tests ear → fretboard geography mapping. No note name is shown upfront — the challenge is identifying the pitch by ear and locating it on the neck.

---

## Access

Fourth tab in the ear training tab bar: **Chord Recognition | Interval Recognition | Study | Fretboard**. Selecting the tab sets `settings.mode = 'fretboard'` and generates the first round immediately.

---

## Round Format

| Element | Content |
|---------|---------|
| Prompt label | `"Find the note →"` (note name hidden) |
| Replay button | Replays the note audio on tap |
| Fretboard | Blank neck; tapping a fret registers an answer |
| Feedback dots | Green = correct position(s); Red = wrong tap |

The note is played automatically when a new round loads. The note name is revealed only after the user taps (correct → green flash with name; wrong → red flash + all correct positions shown in green + name revealed).

---

## Interaction Flow

1. Round loads → `playFretboardRound(round)` fires automatically
2. User taps any fret position:
   - **Correct tap** (pitch class matches): tapped position flashes green, note name revealed, `onComplete(true)` fires after 600 ms → next round
   - **Wrong tap**: tapped position flashes red, all correct positions on the visible neck light green, note name revealed, `onComplete(false)` fires after 1500 ms → next round
3. Taps are blocked (`isRevealing = true`) during the reveal→advance window

---

## Difficulty & Fret Range

| Difficulty | Frets shown | `fretsNum` |
|------------|-------------|-----------|
| Beginner | 0–5 | 6 |
| Intermediate | 0–9 | 10 |
| Advanced | 0–12 | 13 |

Integrates with the existing difficulty preset dropdown. Changing difficulty takes effect on the next round.

---

## Scoring

Uses the existing `SessionScore` structure unchanged. `byType` is keyed by note name (e.g. `"E"`, `"A#"`). Score bar remains visible in fretboard mode. Session summary fires at `SESSION_LENGTH` questions, same as chord/interval modes.

---

## Data Layer (`earTraining.ts`)

### `FretboardRound` type

```typescript
export interface FretboardRound {
  kind: 'fretboard';
  targetNote: string;   // pitch class only, e.g. "E", "A#"
  fretsNum: number;     // 6 | 10 | 13
}
```

`Round` union widens to: `ChordRound | IntervalRound | FretboardRound`

### `generateFretboardRound(difficulty: DifficultyLevel): FretboardRound`

```typescript
export function generateFretboardRound(difficulty: DifficultyLevel): FretboardRound {
  const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
  return { kind: 'fretboard', targetNote: pickRandom(ALL_NOTES), fretsNum: fretsMap[difficulty] };
}
```

### `getCorrectPositions(targetNote: string, fretsNum: number): Set<string>`

```typescript
export function getCorrectPositions(targetNote: string, fretsNum: number): Set<string> {
  const positions = new Set<string>();
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < fretsNum; f++) {
      const note = getFretNote(s, f);
      if (note && note.replace(/\d$/, '') === targetNote) positions.add(`${s}-${f}`);
    }
  }
  return positions;
}
```

### `playFretboardRound(round: FretboardRound): Promise<void>`

```typescript
export async function playFretboardRound(round: FretboardRound): Promise<void> {
  await initAudio();
  playNote(round.targetNote + '3', '2n');
}
```

---

## Fretboard Component (`Fretboard.tsx`)

Two new optional props — additive only, no existing props changed:

```typescript
correctPositions?: Set<string>   // "stringIdx-fretIdx" keys → green dots
wrongPosition?: string | null    // "stringIdx-fretIdx" key → red dot
```

Rendering: colored SVG circles drawn in the existing dot loop, on top of hover hit areas, below finger-number labels.
- Correct: `#22c55e` (green-500)
- Wrong: `#ef4444` (red-500)

---

## FretboardTrainer Component (`src/components/FretboardTrainer.tsx`)

### Props

```typescript
interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}
```

### State

```typescript
const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
const [wrongPosition, setWrongPosition] = useState<string | null>(null);
const [isRevealing, setIsRevealing] = useState(false);
const [noteRevealed, setNoteRevealed] = useState(false);
```

### Behaviour

- On `round` prop change: reset all state, call `playFretboardRound(round)`
- Replay button: calls `playFretboardRound(round)` directly
- `handleFretClick(stringIdx, fretIdx)`:
  - Guard: if `isRevealing` → no-op
  - `pitchClass = getFretNote(stringIdx, fretIdx)?.replace(/\d$/, '')`
  - **Correct:** `setCorrectPositions(new Set([key]))`, `setNoteRevealed(true)`, `setTimeout(() => onComplete(true), 600)`
  - **Wrong:** `setWrongPosition(key)`, `setCorrectPositions(getCorrectPositions(...))`, `setNoteRevealed(true)`, `setIsRevealing(true)`, `setTimeout(() => onComplete(false), 1500)`, `setTimeout(() => setWrongPosition(null), 600)`

### Layout

```
┌─────────────────────────────┐
│  Find the note →   [E]¹     │
│                             │
│  [♪ Replay]                 │
│                             │
│  ┌─── Fretboard ──────────┐ │
│  │  (blank, tappable)     │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```
¹ `[E]` only appears after the user taps (note name revealed on answer)

---

## EarTraining.tsx Changes

- Widen `mode`: `'chord' | 'interval' | 'study' | 'fretboard'`
- Add fourth tab button: `"Fretboard"`
- `makeRound`: add branch `if (s.mode === 'fretboard') return generateFretboardRound(currentDifficulty)`
- `handleDifficulty` guard: `if (next.mode !== 'study' && next.mode !== 'fretboard') advanceRound(next)`
- Render `<FretboardTrainer>` when `settings.mode === 'fretboard'`
- `handleFretboardComplete(wasCorrect)`: update score via existing `updateScore` logic, then `advanceRound`
- `pb-24` padding: fretboard mode keeps it (score bar is visible)
- Session summary: fires normally at `SESSION_LENGTH`

---

## Files

| File | Change |
|------|--------|
| `src/lib/earTraining.ts` | Add `FretboardRound`; widen `Round`; add `generateFretboardRound`, `getCorrectPositions`, `playFretboardRound` |
| `src/components/Fretboard.tsx` | Add `correctPositions` and `wrongPosition` props |
| `src/components/FretboardTrainer.tsx` | New component |
| `src/pages/EarTraining.tsx` | Add fretboard tab, mode wiring, render `<FretboardTrainer>` |
