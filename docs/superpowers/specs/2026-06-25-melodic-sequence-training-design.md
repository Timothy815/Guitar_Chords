# Melodic Sequence Training — Design Spec

**Date:** 2026-06-25
**Feature:** New ear training mode — hear a melody, reconstruct it by pitch

---

## Overview

Add a `'melody'` mode to the Ear Training page. The user hears a short sequence of notes, then reconstructs the melody by selecting pitches one at a time on either a piano keyboard or guitar fretboard. Notes play as they are selected. The user can replay the original and their own answer at any time, then submit for scoring. On a wrong answer, retries are allowed (first-attempt score only).

---

## Data Layer

### `src/lib/melodyTraining.ts` (new file)

```typescript
export interface MelodyRound {
  kind: 'melody';
  notes: string[];    // pitch classes only, e.g. ['C', 'E', 'G', 'A']
  rootKey: string;    // e.g. 'C'
  bpm: number;
}

export interface MelodySettings {
  rootKey: string;    // 'random' or a specific root like 'C'
  bpm: number;
}
```

**Pitch representation:** pitch class only (no octave number). `'C'`, `'F#'`, `'Bb'`. Any fret or piano key that produces the correct pitch name counts as correct.

**Difficulty gating — allowed pitch pools:**

| Difficulty | Length | Pool |
|---|---|---|
| Beginner | 3 notes | Diatonic major only (7 pitches of chosen key) |
| Intermediate | 4–5 notes | Diatonic major + natural minor (no extra accidentals beyond the key) |
| Advanced | 5–7 notes | All 12 chromatic pitches |

**Generator:** `generateMelodyRound(difficulty, settings): MelodyRound`
- If `settings.rootKey === 'random'`, picks a random root from all 12
- Builds the allowed pool for the difficulty
- Samples `length` notes with no consecutive repeats
- Returns `{ kind: 'melody', notes, rootKey, bpm }`

**Note duration for playback:** fixed at one quarter note per pitch. Duration in ms = `(60 / bpm) * 1000`.

---

## Components

### `src/components/PianoInput.tsx` (new)

- Renders two octaves (C3–B4) as a keyboard (div-based or SVG)
- White keys: C D E F G A B per octave; black keys: C# D# F# G# A#
- `onClick(key)`: calls `playNote(pitchClass + '4')` for audio preview, then calls `onNoteSelect(pitchClass)`
- Selected key flashes briefly (100ms highlight) on click
- Dark mode: white keys → light gray (`#e5e7eb`), black keys → dark gray (`#374151`)
- Props: `onNoteSelect: (pitch: string) => void; allowedPitches?: string[]`
- `allowedPitches` dims out-of-pool keys visually (still clickable — hint only, no hard block)

### `src/components/FretboardInput.tsx` (new)

- 6 strings × 12 frets grid; uses `STANDARD_TUNING` + `addSemitones` to derive note name per cell
- Each cell shows the pitch class name (e.g., `C`, `F#`)
- `onClick(string, fret)`: derives full note with octave (e.g. `'E2'`) from `STANDARD_TUNING` + `addSemitones`, calls `playNote(fullNote)` for audio preview, then calls `onNoteSelect(pitchClass)` (octave stripped for comparison)
- `allowedPitches` dims out-of-pool cells visually (still clickable)
- Props: `onNoteSelect: (pitch: string) => void; allowedPitches?: string[]`

### `src/components/MelodyTrainer.tsx` (new)

State:
- `placedNotes: string[]` — pitches placed so far
- `feedback: ('correct' | 'wrong' | null)[] | null` — null until submitted
- `inputMode: 'piano' | 'fretboard'`
- `attempts: number` — increments on each submit; score only counted on `attempts === 1`

Layout (top to bottom):
1. **Round / score badge** — "Round N" and "X/Y correct" (same as RhythmTrainer)
2. **Placed notes row** — sequence of tiles: `[C] [E] [G] [—]`. After submit: green for correct, red for wrong. Count shows e.g. "3 / 4 placed"
3. **Input toggle** — "Fretboard | Piano" pill toggle
4. **Active input** — renders `<FretboardInput>` or `<PianoInput>` based on `inputMode`
5. **Controls row**:
   - `▶ Play` — plays original `round.notes` sequence
   - `▶ My Answer` — plays `placedNotes` sequence (disabled if empty)
   - `← Delete` — removes last placed note (disabled if feedback shown)
   - `Submit` — enabled only when `placedNotes.length === round.notes.length` and no feedback yet
   - After wrong submit: `Try Again` (resets `placedNotes` and `feedback`, increments `attempts`) + `Next →`
   - After correct submit: `Next →` only

**Scoring rule:** `wasCorrect = attempts === 1 && feedback.every(f => f === 'correct')`

**Allowed pitches passed down:** derived from `round.rootKey` + current difficulty in EarTraining.

---

## RhythmTrainer Modification

**`src/components/RhythmTrainer.tsx`** — add retry support:

- Add `attempts: number` state (starts at 0, increments on each `handleSubmit`)
- `wasCorrect` in `handleNext` uses `attempts === 1 && feedback.every(f => f === 'correct')`
- After a wrong submit, show both:
  - `Try Again` button → resets `placedUnits` and `feedback`, increments `attempts`
  - `Next →` button → calls `onComplete(false)` since first attempt was wrong
- After a correct submit: `Next →` only (no Try Again needed)

No changes to `RhythmStaff.tsx` or `rhythmTraining.ts`.

---

## EarTraining Integration

### `src/lib/earTraining.ts`

- Add `MelodyRound` to the `Round` union: `Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound`
- Add `'melody'` to `EarTrainingSettings.mode`
- Add `melodySettings: MelodySettings` to `EarTrainingSettings`
- Default `melodySettings`: `{ rootKey: 'random', bpm: 80 }`

### `src/pages/EarTraining.tsx`

- Add "Melody" tab to the mode tab bar (after Rhythm)
- `advanceRound()`: when `mode === 'melody'`, call `generateMelodyRound(difficulty, settings.melodySettings)`
- Round area: when `round.kind === 'melody'`, render `<MelodyTrainer round={round} score={score} settings={settings.melodySettings} difficulty={difficulty} onComplete={handleComplete} />`
- Settings panel: Melody section with root key selector (Random + 12 roots) and BPM slider (40–120, default 80)

---

## Audio Playback

Melody playback uses `playNote(pitch + '4', duration)` for each note in sequence with timing derived from BPM:

```typescript
const noteDuration = (60 / round.bpm) * 1000; // ms per note
round.notes.forEach((pitch, i) => {
  setTimeout(() => playNote(pitch + '4'), i * noteDuration);
});
```

Both "Play" (original) and "Play My Answer" use the same sequencing logic. A `stopMelody()` utility cancels pending timeouts (stored in a ref) when the component unmounts or a new round starts.

---

## Scoring & Session Flow

- Session score counts `correct` only when `attempts === 1 && all notes match`
- Retry resets placed notes and feedback; the round itself does not regenerate
- `onComplete(wasCorrect)` is called exactly once per round (either from Next → or after correct submit)
- Stats and session history follow the same pattern as all other modes

---

## File Summary

| File | Status |
|---|---|
| `src/lib/melodyTraining.ts` | New |
| `src/components/PianoInput.tsx` | New |
| `src/components/FretboardInput.tsx` | New |
| `src/components/MelodyTrainer.tsx` | New |
| `src/lib/earTraining.ts` | Modify — add MelodyRound to Round union, add melody to settings |
| `src/pages/EarTraining.tsx` | Modify — add tab, wire mode, add settings panel section |
| `src/components/RhythmTrainer.tsx` | Modify — add retry mechanic |
