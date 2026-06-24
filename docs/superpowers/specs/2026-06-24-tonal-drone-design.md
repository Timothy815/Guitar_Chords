# Tonal Drone — Design Spec

## Goal

Add a sustained tonic reference pitch that plays alongside fretboard ear training rounds to accelerate relative pitch learning. The drone is a pure sine wave at a fixed low volume, separate from the guitar sampler, so it continues uninterrupted while target notes play on top.

## Architecture

Three files change: `audio.ts` gains a drone oscillator voice, `EarTraining.tsx` gains drone state and lifecycle management, and `FretboardTrainer.tsx` gains cue-mode sequencing. No changes to `earTraining.ts`, `Fretboard.tsx`, or any data layer.

**Tech stack:** Tone.js (`Tone.Oscillator`), React 19, TypeScript, Tailwind v4.

---

## 1. Audio Layer (`src/lib/audio.ts`)

Add a module-level `Tone.Oscillator` singleton alongside the existing Sampler:

```typescript
let droneOsc: Tone.Oscillator | null = null;
```

Two new exports:

```typescript
export function startDrone(noteStr: string): void
// Ensures audio is started. Creates or re-uses droneOsc (type: 'sine').
// Sets frequency from noteStr (e.g. "E3" → 164.81 Hz) via Tone.Frequency.
// Volume: -18 dB. Connects directly to Destination (not the effect chain).
// If already running, updates frequency in place (no click).

export function stopDrone(): void
// Stops and disposes droneOsc if it exists. Sets droneOsc to null.
```

The oscillator connects directly to `Tone.getDestination()`, bypassing the guitar effect chain (overdrive, reverb, etc.) — the reference tone should be clean and uncoloured.

Tonic octave is always 3. The caller passes `"E3"`, `"A3"`, etc. — `startDrone` does not derive the octave.

---

## 2. State & Lifecycle (`src/pages/EarTraining.tsx`)

### New state

```typescript
const [droneNote, setDroneNote] = useState<string | null>(null); // e.g. "E3"
const [droneMode, setDroneMode] = useState<'off' | 'continuous' | 'cue'>('off');
```

Default is `'off'` — existing users see no change until they opt in.

### Continuous drone lifecycle

```typescript
useEffect(() => {
  if (settings.mode === 'fretboard' && droneMode === 'continuous' && droneNote) {
    initAudio().then(() => startDrone(droneNote)).catch(() => {});
  } else {
    stopDrone();
  }
  return () => stopDrone();
}, [settings.mode, droneMode, droneNote]);
```

This effect owns the oscillator for continuous mode. It starts, re-tunes, and stops the drone as settings change. Cleanup runs when the component unmounts.

### Drone controls UI

Rendered inside the existing Settings panel, only when `settings.mode === 'fretboard'`. Two rows using existing pill styles:

```
Drone:   [Off]  [Continuous]  [Cue]
Tonic:   [C] [C#] [D] [D#] [E] [F] [F#] [G] [G#] [A] [A#] [B]
```

The Tonic row is hidden when `droneMode === 'off'`. Selecting a note pill sets `droneNote` to `"${pitch}3"` (e.g. clicking `E` → `"E3"`).

When `droneMode` switches to `'off'`, `droneNote` is left unchanged so the previous tonic is remembered if the user switches back.

### Props passed to FretboardTrainer

```typescript
droneNote={droneNote}
droneMode={droneMode}
```

---

## 3. Round Sequencing (`src/components/FretboardTrainer.tsx`)

### New props

```typescript
droneNote?: string | null;
droneMode?: 'off' | 'continuous' | 'cue';
```

### Cue mode sequencing

In the existing `useEffect([round])`, replace the `playFretboardRound(round)` call with:

```typescript
if (droneMode === 'cue' && droneNote) {
  initAudio()
    .then(() => {
      playNote(droneNote, '2n');
      setTimeout(() => playFretboardRound(round).catch(() => {}), 600);
    })
    .catch(() => {});
} else {
  playFretboardRound(round).catch(() => {});
}
```

600 ms gives the tonic note time to ring before the target note plays. Continuous and off modes are unchanged — the drone is managed entirely by `EarTraining.tsx` in those cases.

---

## Out of scope

- Drone volume control (fixed at −18 dB)
- Persisting drone settings across sessions
- Drone in chord or interval modes
