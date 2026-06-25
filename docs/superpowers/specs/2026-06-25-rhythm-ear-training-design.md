# Rhythm Ear Training — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Overview

Add a `'rhythm'` mode to the Ear Training page. The user hears a rhythmic pattern (click track for the beat, clap-like sound for note onsets) and notates it on a real music staff using VexFlow. Per-note feedback highlights correct/wrong placements after submission. No pitch involved — only duration.

---

## 1. Data Layer (`src/lib/rhythmTraining.ts`)

### 1.1 Types

```typescript
export type RhythmDuration = 'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd';
// w=whole, h=half, q=quarter, 8=eighth, 16=sixteenth, hd=dotted-half, qd=dotted-quarter

export interface RhythmUnit {
  duration: RhythmDuration;
  isRest: boolean;
}

export type TimeSignature = '4/4' | '2/4' | '3/4' | '6/8';

export interface RhythmRound {
  units: RhythmUnit[];         // the correct answer pattern
  measures: number;
  timeSignature: TimeSignature;
  bpm: number;
}

export interface RhythmSettings {
  timeSignature: TimeSignature;
  enabledDurations: RhythmDuration[];
  enableRests: boolean;
  bpm: number;
}
```

### 1.2 Duration values (in quarter-note beats)

| Duration | Beats |
|----------|-------|
| `'w'`    | 4.0   |
| `'h'`    | 2.0   |
| `'hd'`   | 3.0   |
| `'q'`    | 1.0   |
| `'qd'`   | 1.5   |
| `'8'`    | 0.5   |
| `'16'`   | 0.25  |

For 6/8 time: beats per measure = 3 dotted-quarter beats = 6 eighth-note beats. Internally represent as 3.0 quarter-beat units (same as 3/4 for budget purposes). The time signature label differs; playback subdivision differs.

Time signature beat budgets (in quarter-note beats):
- `'4/4'` → 4.0 per measure
- `'2/4'` → 2.0 per measure
- `'3/4'` → 3.0 per measure
- `'6/8'` → 3.0 per measure (6 eighth notes = 3 quarter beats)

### 1.3 `generateRhythmRound(difficulty, settings)`

```typescript
export function generateRhythmRound(
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  settings: RhythmSettings,
): RhythmRound
```

**Measure count by difficulty:**
- beginner → 1 measure
- intermediate → 2 measures
- advanced → 3 measures

**Default enabled durations by difficulty** (used when settings have not been customized):
- beginner → `['h', 'q']` (+ rests off by default)
- intermediate → `['h', 'q', '8', 'qd']` (+ rests on)
- advanced → `['w', 'h', 'hd', 'q', 'qd', '8', '16']` (+ rests on)

**Pattern generation algorithm:**
Fill a beat budget per measure using a constrained random walk:
1. Start with remaining budget = beats per measure × measure count.
2. Pick a random duration from `enabledDurations` whose value ≤ remaining.
3. Randomly decide isRest (only if `enableRests` and not every unit so far is a rest).
4. Append the unit, subtract its beat value.
5. If remaining > 0 but no enabled duration fits, backtrack one step and retry (max 50 retries before falling back to quarter notes to fill).
6. Ensure at least one non-rest note exists in the pattern.

### 1.4 `durationBeats(duration: RhythmDuration): number`

Returns the beat value for a given duration. Exported for use by audio and staff components.

### 1.5 `vexDuration(unit: RhythmUnit): string`

Converts a `RhythmUnit` to a VexFlow duration string:
- `{ duration: 'q', isRest: false }` → `'q'`
- `{ duration: 'q', isRest: true }` → `'qr'`
- `{ duration: 'qd', isRest: false }` → `'qd'`
- `{ duration: 'qd', isRest: true }` → `'qdr'`

---

## 2. Audio (`src/lib/audio.ts`)

### 2.1 New synths

Two module-level singletons, initialized lazily on first call:

```typescript
let clickSynth: Tone.MembraneSynth | null = null;
let clapSynth: Tone.NoiseSynth | null = null;
```

- **clickSynth** — `MembraneSynth` pitched to C5, short decay (0.05s), used for beat subdivisions
- **clapSynth** — `NoiseSynth` with fast attack (0.001s), short decay (0.08s), bandpass envelope — used for rhythm note onsets

Both route straight to `Destination`, no shared effects chain.

### 2.2 New exports

```typescript
export function playRhythmRound(round: RhythmRound): void
export function stopRhythm(): void
```

**`playRhythmRound`:**
1. Calls `stopRhythm()` to clear any in-flight transport.
2. Initializes `clickSynth` and `clapSynth` if null.
3. Schedules a one-measure count-in: clicks on every beat subdivision with no claps.
4. After count-in, schedules clicks on every beat and claps on every non-rest note onset, derived from `round.units` using `durationBeats`.
5. For 6/8: click fires on dotted-quarter positions (beats 1 and 4 of the 6 eighth-note grid), with lighter subdivision clicks on the remaining eighths.
6. Uses `Tone.Transport.schedule` for all events. Starts transport if not running.

**`stopRhythm`:**
Calls `Tone.Transport.stop()` and `Tone.Transport.cancel()` to clear all scheduled events.

---

## 3. Staff Component (`src/components/RhythmStaff.tsx`)

Purely visual — no audio, no game logic. Uses VexFlow via `useRef<HTMLDivElement>` + `useEffect`, following the exact pattern in `ChordCard.tsx`.

### 3.1 Props

```typescript
interface RhythmStaffProps {
  round: RhythmRound;
  placedUnits: RhythmUnit[];
  feedback: ('correct' | 'wrong' | null)[] | null;  // null = not submitted
  onSwap: (i: number, j: number) => void;
}
```

### 3.2 Rendering

All notes keyed to `'b/4'` (middle B — middle line of treble clef, standard for unpitched rhythm exercises).

**Per measure:**
1. Compute which `placedUnits` fall in this measure (by accumulated beat budget).
2. Fill any remaining beat budget with gray placeholder rests (duration chosen to fill remaining space, shown in light gray).
3. Create a `Stave` with treble clef + time signature (first measure only), bar lines auto-handled by VexFlow.
4. Create `StaveNote` objects for placed units. Apply VexFlow note color via `note.setStyle({ fillStyle, strokeStyle })`:
   - Not submitted: black (`#000`)
   - feedback `'correct'`: green (`#27ae60`)
   - feedback `'wrong'`: red (`#c0392b`)
5. Placeholder notes: gray (`#aaa`), `setStyle` applied.
6. Create `Voice` with correct `numBeats`/`beatValue` for the time signature.
7. Call `Beam.generateBeams(notes)` for automatic eighth/sixteenth beaming.
8. `new Formatter().joinVoices([voice]).format([voice], staveWidth)`.
9. Draw voice, then draw each beam.

Multiple measures are laid out left-to-right in a single SVG container, with stave width calculated from container width ÷ measure count.

### 3.3 Drag-to-swap

Two state values tracked in the parent (`RhythmTrainer`): `dragSrc: number | null`. `onMouseDown` on a placed note sets `dragSrc`; `onMouseUp` on a different note index calls `onSwap(dragSrc, targetIdx)` and clears `dragSrc`. VexFlow does not natively support mouse events on individual notes — drag handles are thin transparent `<rect>` overlays positioned over each note's x offset in the SVG. Positions are obtained via `staveNote.getAbsoluteX()` after `formatter.format()` completes, giving the pixel x coordinate of each note within the SVG. Each overlay is ~24px wide, centered on that x, full staff height.

---

## 4. Trainer Component (`src/components/RhythmTrainer.tsx`)

Owns all game state for the rhythm mode.

### 4.1 Props

```typescript
interface RhythmTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}
```

### 4.2 State

```typescript
const [placedUnits, setPlacedUnits] = useState<RhythmUnit[]>([]);
const [selectedDuration, setSelectedDuration] = useState<RhythmDuration>('q');
const [isRest, setIsRest] = useState(false);
const [dragSrc, setDragSrc] = useState<number | null>(null);
const [feedback, setFeedback] = useState<('correct' | 'wrong' | null)[] | null>(null);
```

### 4.3 Beat budget tracking

`remainingBeats` computed from `round` minus sum of `durationBeats` for all `placedUnits`. Submit enabled when `remainingBeats === 0`. Place button disabled when selected duration's beat value > `remainingBeats`.

### 4.4 Palette

A row of buttons, one per `settings.enabledDurations`. Each shows a text label: `'w'`→"1", `'h'`→"2", `'hd'`→"2.", `'q'`→"4", `'qd'`→"4.", `'8'`→"8", `'16'`→"16". Active duration highlighted with `brand-primary`. A "Rest" toggle pill sits at the end — toggles `isRest`. Place button (or clicking the palette button directly when space is available) appends `{ duration: selectedDuration, isRest }` to `placedUnits`.

### 4.5 Controls

| Button | Condition | Action |
|--------|-----------|--------|
| Play | always | `playRhythmRound(round)` |
| Delete | `placedUnits.length > 0` and no feedback | removes last unit |
| Submit | `remainingBeats === 0` and no feedback | evaluates answer |
| Next | feedback set | `onComplete(allCorrect)`, `stopRhythm()` |

### 4.6 Evaluation

On Submit, compare `placedUnits[i]` to `round.units[i]` for each index. A unit is correct if `duration` matches AND `isRest` matches. Set `feedback` array. Score: correct if all units match.

### 4.7 Round start

`useEffect([round])`: reset all state, call `playRhythmRound(round)`.

---

## 5. EarTraining.tsx Wiring

### 5.1 Mode union

In `src/lib/earTraining.ts`, add `'rhythm'` to the mode union:
```typescript
mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm';
```

### 5.2 Settings state

```typescript
const [rhythmSettings, setRhythmSettings] = useState<RhythmSettings>({
  timeSignature: '4/4',
  enabledDurations: ['h', 'q'],
  enableRests: false,
  bpm: 80,
});
```

### 5.3 Round generation

In `advanceRound`, add:
```typescript
if (s.mode === 'rhythm') {
  const r = generateRhythmRound(difficulty, rhythmSettings);
  setRound(r);
  return;
}
```

### 5.4 Nav tab

Add a "Rhythm" pill to the mode selector row alongside existing tabs.

### 5.5 Round area

When `settings.mode === 'rhythm'` and `round` is a `RhythmRound`:
```tsx
<RhythmTrainer
  round={round as RhythmRound}
  score={score}
  settings={rhythmSettings}
  onComplete={handleRhythmComplete}
/>
```

`handleRhythmComplete(wasCorrect)` increments score, calls `advanceRound()` after a short delay.

### 5.6 Settings panel

When `settings.mode === 'rhythm'`, show rhythm-specific settings:
- Time signature pill selector (4/4 · 2/4 · 3/4 · 6/8)
- BPM slider (40–160, step 5)
- Note type checkboxes (Whole · Half · Dotted Half · Quarter · Dotted Quarter · Eighth · Sixteenth)
- Rests toggle

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/lib/rhythmTraining.ts` | **New** — types, round generation, duration utilities |
| `src/lib/audio.ts` | Add click/clap synths, `playRhythmRound`, `stopRhythm` |
| `src/components/RhythmStaff.tsx` | **New** — VexFlow staff renderer |
| `src/components/RhythmTrainer.tsx` | **New** — game logic, palette, controls |
| `src/lib/earTraining.ts` | Add `'rhythm'` to mode union |
| `src/pages/EarTraining.tsx` | Add tab, settings panel, round area wiring |

---

## 7. What Does Not Change

- All existing ear training modes (chord, interval, study, fretboard, plan)
- Guitar audio chain and effects
- SessionScore interface
- VexFlow import pattern (follows ChordCard.tsx exactly)

---

## 8. Key Constraints

- VexFlow v5 already installed — use `Renderer`, `Stave`, `StaveNote`, `Voice`, `Formatter`, `Beam` from `'vexflow'`
- All notes keyed to `'b/4'` (middle line of treble clef) — no pitch selection
- `npm run lint` (tsc --noEmit) is the only static check — no test suite
- No new npm dependencies
- Tailwind v4 — use brand CSS variables for colors; use `cn()` for class merging
- Note colors applied via VexFlow's `note.setStyle({ fillStyle, strokeStyle })` API
