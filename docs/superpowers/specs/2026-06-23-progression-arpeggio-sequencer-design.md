# Progression Arpeggio Sequencer Design

**Date:** 2026-06-23  
**Status:** Approved

## Goal

Add a per-chord step sequencer to the Progressions page. Each chord slot gets an optional arpeggio pattern: a grid of 6 string rows × N steps, where each cell is a string on/off toggle and each column has its own note duration (16th through whole). Playing the full progression fires each chord's pattern in sequence at a global BPM.

## Approach

Full-width expandable panel below the chord cards (Approach A). Clean card view, enough space for the grid, non-destructive — cards stay visible while the panel is open.

---

## Section 1 — Data Model (`src/types.ts`)

### New types

```ts
export interface ArpeggioStep {
  strings: number[];                        // 0 = low E, 5 = high e
  duration: '16n' | '8n' | '4n' | '2n' | '1n';
}

export interface ArpeggioPattern {
  steps: ArpeggioStep[];
}

export interface ChordSlot {
  chord: ChordShape;
  pattern?: ArpeggioPattern;               // absent = strum (legacy behaviour)
}
```

### Updated `Progression`

```ts
export interface Progression {
  id: string;
  name: string;
  bpm: number;                             // default 80, range 40–200
  slots: ChordSlot[];                      // replaces chords: ChordShape[]
}
```

### localStorage migration

On load, if a saved entry has the old `chords: ChordShape[]` shape, convert on the fly:
```ts
slots: savedProg.chords.map((chord: ChordShape) => ({ chord }))
bpm: 80
```
The old `chords` key is not written back — next save uses the new shape.

### BPM is progression-level

Per-step duration handles rhythmic variation within a tempo. Mixing BPM per step would make scheduling math and UX significantly harder for no meaningful gain.

---

## Section 2 — Sequencer UI (`src/pages/Progressions.tsx`)

### Chord card additions (print-hidden)

- **Step count badge**: shows `N steps` pill when a pattern is assigned
- **Edit pattern button**: pencil icon, opens the sequencer panel for that slot

### Sequencer panel

Opens full-width below the chord cards row when a slot's edit button is clicked. Replaces any previously open panel (only one open at a time).

#### Header bar
- Chord name (left)
- Preset dropdown: Ascending, Descending, Alternating Bass, Travis Pick, Clear — loads a starting pattern the user can freely edit
- Step controls: `−` / `+` to add/remove steps, range 1–16
- Close (`✕`) button

#### Grid
- 6 rows labeled `e  B  G  D  A  E` (high to low, top to bottom — matching fretboard visual convention)
- N columns (one per step)
- Each cell: toggle button — active = filled accent colour, inactive = empty
- Bottom of each column: duration selector, click cycles `16n → 8n → 4n → 2n → 1n`
- Display symbols: `𝅘𝅥𝅯` `𝅘𝅥𝅮` `♩` `𝅗𝅥` `𝅝`

#### Footer bar
- **Preview** button: plays just this slot's pattern once for auditioning
- Changes are applied live as the user edits (no draft/Apply gate). Closing the panel just hides it; the pattern is already saved to state/localStorage.

### BPM control
Slider in the progression header, next to the Play button. Range 40–200, default 80, label shows current value. Saved on the `Progression` object.

### Preset patterns (initial step arrays for 8 steps at `4n` default)

| Name | String sequence |
|---|---|
| Ascending | 0, 1, 2, 3, 4, 5 (low E → high e, padded to 8 steps by repeating) |
| Descending | 5, 4, 3, 2, 1, 0 |
| Alternating Bass | 0, 3, 4, 3, 0, 3, 4, 3 (low E + G/B alternation) |
| Travis Pick | 0, 4, 2, 4, 0, 4, 2, 4 (low E + B + D alternation) |
| Clear | empty pattern (0 steps) |

Each preset step has a single string active and duration `4n`, giving a straightforward starting point for editing.

---

## Section 3 — Playback Engine

### New audio function

```ts
// src/lib/audio.ts
export function playProgressionWithPatterns(
  slots: Array<{ notes: string[]; pattern?: ArpeggioPattern }>,
  bpm: number,
  onChordChange?: (slotIndex: number) => void,
): () => void   // returns stopFn
```

Replaces the existing `playSequence` timeout loop.

### Scheduling logic

Uses `Tone.now()` with accumulated time offsets — no Tone.js Transport required, consistent with existing `playArpeggio`:

```
offset = 0
cancelIds = []
for each slot at index i:
  if slot.pattern exists and has steps:
    for each step in slot.pattern.steps:
      schedule note events for step.strings at (now + offset)
      offset += durationInSeconds(step.duration, bpm)
  else:
    schedule strum of slot.notes at (now + offset)
    offset += barDuration(bpm)   // 4 beats = 4 × (60/bpm)
  schedule onChordChange(i) callback at slot's start time
```

Duration conversion:
```ts
const DURATION_MULTIPLIERS = { '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4 };
function durationInSeconds(d: ArpeggioStep['duration'], bpm: number) {
  return (60 / bpm) * DURATION_MULTIPLIERS[d];
}
```

### Stop support

`playProgressionWithPatterns` sets a shared `stopRequested` ref to `false` before scheduling. The returned `stopFn` sets `stopRequested = true` and calls `sampler.releaseAll()` to silence any currently-ringing notes. Each scheduled callback checks `stopRequested` before firing — consistent with the existing no-Transport pattern in `playArpeggio`.

The Play button in the UI toggles to a **Stop** button (square icon) while playback is running. Clicking Stop calls `stopFn`.

### Loop

A **Loop** toggle (icon button) in the progression header. When on, `playProgressionWithPatterns` reschedules itself at the end of the last slot. Stop always terminates the loop.

### `onChordChange` callback

Highlights the currently-playing chord card during playback (ring/glow effect) so the user can follow along.

---

## File Change Summary

| File | Change |
|---|---|
| `src/types.ts` | Add `ArpeggioStep`, `ArpeggioPattern`, `ChordSlot`; update `Progression` |
| `src/pages/Progressions.tsx` | Full rewrite of state/playback to use slots; add sequencer panel component inline; add BPM slider, loop toggle, stop button |
| `src/lib/audio.ts` | Add `playProgressionWithPatterns` function |

---

## Out of Scope

- Per-step velocity control (all notes play at default sampler velocity)
- Swing/humanize timing
- MIDI export
- Pattern copy/paste between chord slots
- Time signature changes (assumed 4/4 throughout)
