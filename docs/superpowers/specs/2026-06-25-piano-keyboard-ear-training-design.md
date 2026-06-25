# Piano Keyboard View + Octave Range Filtering — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Overview

Add a piano keyboard view toggle to the fretboard ear training mode, plus a unified octave range filter that applies to both views. The keyboard uses Salamander Grand Piano samples for audio feedback. All existing sub-modes (Guess, Hunt, Sing, Sing+Hunt) carry over to the keyboard view unchanged. The guitar fretboard remains the primary training tool; the keyboard is a reference lens that shows the same notes on a linear layout.

---

## 1. Data Layer (`src/lib/earTraining.ts`)

### 1.1 Extend FretboardFocus

```typescript
export interface FretboardFocus {
  stringIdxs?: number[];  // [0..5]; empty or undefined = all strings
  fretMin?: number;       // inclusive; undefined = 0
  fretMax?: number;       // inclusive; undefined = fretsNum
  octaveMin?: number;     // inclusive; undefined = no restriction
  octaveMax?: number;     // inclusive; undefined = no restriction
}
```

### 1.2 Update buildFretboardNotePool

After building the candidate list from string/fret positions, filter out any note whose octave falls outside `[focus.octaveMin, focus.octaveMax]`. Octave is parsed from the trailing digit of the note string (e.g. `"C4"` → octave 4).

### 1.3 Add buildKeyboardNotePool

```typescript
export function buildKeyboardNotePool(
  octaveMin: number = 2,
  octaveMax: number = 4,
): string[]
```

Returns all 12 chromatic notes (`C, C#, D, D#, E, F, F#, G, G#, A, A#, B`) for each octave in `[octaveMin, octaveMax]`, in ascending order. The keyboard pool is fully chromatic — not constrained to guitar geometry. Example: octaveMin=3, octaveMax=4 → 24 notes, C3 through B4.

Default range when no octave filter is set: octaves 2–4 (matching open-string guitar range E2–E4).

---

## 2. Audio (`src/lib/audio.ts`)

### 2.1 Salamander piano sampler

Add a dedicated piano `Sampler` alongside the existing guitar sampler. Loaded lazily on first call to `initPianoSampler()`. Uses Salamander Grand Piano samples from `https://tonejs.github.io/audio/salamander/`. No shared effects chain with the guitar sampler — completely independent signal path straight to `Destination`.

### 2.2 New exports

```typescript
export async function initPianoSampler(): Promise<void>
export function playPianoNote(note: string, duration?: string): void
```

- `initPianoSampler()` — initializes the Salamander sampler if not already loaded; safe to call multiple times
- `playPianoNote(note, duration?)` — plays a single note through the piano sampler; duration defaults to `'4n'`

The existing `initAudio`, `playNote`, and all guitar functions are unchanged.

---

## 3. PianoKeyboard Component (`src/components/PianoKeyboard.tsx`)

Purely visual SVG component. No audio, no game logic.

### 3.1 Props

```typescript
interface PianoKeyboardProps {
  octaveMin: number;
  octaveMax: number;
  correctKeys: Set<string>;     // highlighted green
  wrongKey: string | null;      // highlighted red
  previewKey: string | null;    // highlighted blue/neutral (selected, not confirmed)
  onKeyClick: (note: string) => void;
}
```

### 3.2 Layout

- Full container width, fixed height 120px
- White keys: tall rectangles spanning full height
- Black keys: shorter, narrower rectangles overlaid at standard piano positions (between C#/D, D#/E, F#/G, G#/A, A#/B)
- Each octave: 7 white keys, 5 black keys
- Note label shown only on each C key (e.g. "C3", "C4") as a small landmark at the bottom of the white key
- Responsive: key widths calculated from container width ÷ total white key count

### 3.3 Key colors

| State | Color |
|-------|-------|
| Default white key | white with gray border |
| Default black key | `#1a1a1a` |
| Preview (selected) | `#3b82f6` (blue) |
| Correct | `#27ae60` (green) |
| Wrong | `#c0392b` (red) |

### 3.4 Interaction

Clicks fire `onKeyClick(note)` where `note` is the full note string including octave (e.g. `"C4"`, `"F#3"`). The component does not handle audio — the parent handles it in `onKeyClick`.

---

## 4. PianoTrainer Component (`src/components/PianoTrainer.tsx`)

Parallel to `FretboardTrainer.tsx`. Owns all game logic for keyboard view.

### 4.1 Props

```typescript
interface PianoTrainerProps {
  round: FretboardRound;
  score: SessionScore;
  octaveMin: number;
  octaveMax: number;
  mode: 'guess' | 'hunt' | 'sing' | 'singhunt';
  droneNote?: string | null;
  droneMode?: 'off' | 'continuous' | 'cue';
  onComplete: (wasCorrect: boolean) => void;
}
```

### 4.2 Interaction flow (all modes)

1. Round starts → target note played on guitar via `playFretboardRound(round)`
2. Sing/Sing+Hunt: overlay shown ("Sing the note → Ready"); keyboard locked until Ready tapped
3. User taps a key → `playPianoNote(note)` fires → key shows as preview
4. User taps Confirm → answer evaluated:
   - **Correct:** key highlights green, `onComplete(true)` after 600ms
   - **Wrong:** key highlights red, correct key highlights green, semitone distance feedback shown, `onComplete(false)` after 1500ms

Tap-to-hear applies in all modes — clicking any key always plays the Salamander note. Confirm is always the submission step (no immediate-reveal on click, unlike fretboard Guess mode). This simplifies the interaction: one consistent flow across all modes.

### 4.3 Semitone distance feedback

On wrong answer, show a one-line feedback string below the keyboard:
`"You picked D4 — correct was C#4 (1 semitone flat)"`

Uses the existing `getAbsoluteSemitoneDistance` and `getAbsoluteDirection` from `earTraining.ts`. No tap-count stat (not meaningful on keyboard).

### 4.4 Replay button

Same as FretboardTrainer — replays the guitar note via `playFretboardRound(round)`.

---

## 5. View Toggle + Octave Filter UI

### 5.1 View toggle (`src/pages/EarTraining.tsx`)

- Local state: `const [pianoView, setPianoView] = useState(false)`
- A "Fretboard | Piano" pill toggle rendered above the trainer area, visible only in fretboard ear training mode
- When `pianoView` is true: render `PianoTrainer`; when false: render `FretboardTrainer`
- Sub-mode (guess/hunt/sing/singhunt), difficulty, drone settings, score, and `fretboardFocus` all persist across the toggle
- Switching views mid-session does not reset score or advance the round

### 5.2 Octave range filter (`src/components/FretboardFocusSelector.tsx`)

Two dropdowns added below the existing string/fret controls, styled consistently with the existing From/To fret selectors:

- **From octave** — options: 2, 3, 4; default: unset
- **To octave** — options: 2, 3, 4; default: unset
- Validation: "To" must be ≥ "From"; if user sets To < From, clamp To to From
- Populates `focus.octaveMin` and `focus.octaveMax` on the shared `FretboardFocus`

The string/fret controls remain visible in fretboard view. In piano view, they are hidden (since strings and frets don't apply to keyboard) but their values are preserved in `fretboardFocus` state — toggling back to fretboard restores them.

---

## 6. Note Pool Behavior Summary

| View | Note pool source | Octave filter applied? | String/fret filter applied? |
|------|-----------------|----------------------|-----------------------------|
| Fretboard | `buildFretboardNotePool(difficulty, focus)` | Yes (via focus) | Yes (via focus) |
| Piano | `buildKeyboardNotePool(octaveMin, octaveMax)` | Yes | No (not applicable) |

When no octave filter is set, piano defaults to octaves 2–4. Fretboard defaults to its existing behavior (all strings, full fret range for difficulty).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/lib/earTraining.ts` | Extend `FretboardFocus`; update `buildFretboardNotePool`; add `buildKeyboardNotePool` |
| `src/lib/audio.ts` | Add `initPianoSampler`, `playPianoNote` (Salamander) |
| `src/components/PianoKeyboard.tsx` | **New** — SVG keyboard visual component |
| `src/components/PianoTrainer.tsx` | **New** — keyboard trainer with all four sub-modes |
| `src/components/FretboardFocusSelector.tsx` | Add From/To octave dropdowns |
| `src/pages/EarTraining.tsx` | Add `pianoView` toggle state; conditionally render PianoTrainer; pass octave range; hide string/fret controls in piano view |

---

## 8. What Does Not Change

- `FretboardTrainer.tsx` — unchanged
- `Fretboard.tsx` — unchanged
- Chord Recognition, Interval Recognition, Study, Plan modes — unchanged
- Hunt history recording, session summary, stats panel — unchanged
- Existing guitar audio chain and effects — unchanged
