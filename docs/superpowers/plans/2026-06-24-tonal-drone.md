# Tonal Drone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sustained sine-wave tonic reference pitch to fretboard ear training, with Continuous (always-on) and Cue (plays before each target note) modes selectable from the settings panel.

**Architecture:** A `Tone.Oscillator` singleton in `audio.ts` provides the drone voice, completely separate from the guitar Sampler so the two never interfere. `EarTraining.tsx` owns the Continuous drone lifecycle via a `useEffect`; `FretboardTrainer.tsx` handles Cue-mode sequencing inside the existing round-change effect.

**Tech Stack:** React 19, TypeScript, Tone.js (`Tone.Oscillator`), Tailwind v4.

## Global Constraints

- No new npm dependencies — Tone.js is already installed.
- `npm run lint` (runs `tsc --noEmit`) must pass at the end of every task with zero errors.
- There is no automated test suite. Verification is `npm run lint` + manual browser check.
- Follow existing module patterns in `audio.ts` (module-level `let` singletons, `isInitialized` guards).
- Tailwind v4 — no `tailwind.config.js`; use only existing brand token classes (`brand-primary`, `brand-line`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-ink`, `brand-bg`).
- Drone connects directly to `Tone.getDestination()` — bypasses the guitar effect chain (filter, overdrive, reverb, etc.).
- Drone oscillator volume: `−18` dB (fixed, no user control).
- Tonic always at octave 3 — caller passes `"E3"`, `"A3"`, etc.

---

### Task 1: Drone oscillator in audio.ts

**Files:**
- Modify: `src/lib/audio.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function startDrone(noteStr: string): void
  // noteStr: full note+octave string e.g. "E3", "A3"
  // Creates droneOsc if not running; re-tunes if already running.
  // No-op if audio not yet initialized.

  export function stopDrone(): void
  // Stops and disposes droneOsc. Safe to call when not running.
  ```

- [ ] **Step 1: Add the module-level drone variable**

Open `src/lib/audio.ts`. After the existing module-level declarations (after line `let initPromise: Promise<void> | null = null;`), add:

```typescript
let droneOsc: Tone.Oscillator | null = null;
```

- [ ] **Step 2: Add `startDrone`**

Add this function anywhere after `stopNote` (around line 188):

```typescript
export function startDrone(noteStr: string): void {
  if (!isInitialized) return;
  const freq = Tone.Frequency(noteStr).toFrequency();
  if (droneOsc) {
    // Already running — just re-tune without restarting.
    droneOsc.frequency.value = freq;
    return;
  }
  droneOsc = new Tone.Oscillator(freq, 'sine').toDestination();
  droneOsc.volume.value = -18;
  droneOsc.start();
}
```

- [ ] **Step 3: Add `stopDrone`**

Immediately after `startDrone`:

```typescript
export function stopDrone(): void {
  if (!droneOsc) return;
  droneOsc.stop();
  droneOsc.dispose();
  droneOsc = null;
}
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start the dev server (`npm run dev`). Open the browser console and run:

```javascript
// These are available if you import them — just verify no TS errors for now.
// Full UI test happens in Task 3.
```

Since there's no console access to test audio functions directly at this stage, the lint pass is sufficient for Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat: add startDrone/stopDrone sine oscillator to audio engine"
```

---

### Task 2: Cue-mode sequencing in FretboardTrainer

**Files:**
- Modify: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Consumes (already exists in `src/lib/audio.ts`):
  ```typescript
  import { ..., playNote } from '../lib/audio';
  // playNote(noteStr: string, duration: string): void — already imported
  ```
- New props added to `FretboardTrainerProps`:
  ```typescript
  droneNote?: string | null;   // e.g. "E3"; undefined/null = no drone
  droneMode?: 'off' | 'continuous' | 'cue';
  ```

- [ ] **Step 1: Add new props to the interface**

In `src/components/FretboardTrainer.tsx`, find the `FretboardTrainerProps` interface (currently at lines 11–19). Add two optional props:

```typescript
interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;
  focus?: FretboardFocus;
  onFocusChange?: (focus: FretboardFocus) => void;
  droneNote?: string | null;
  droneMode?: 'off' | 'continuous' | 'cue';
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}
```

- [ ] **Step 2: Destructure new props**

Find the function signature (line 21 onwards):

```typescript
export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  onComplete,
}: FretboardTrainerProps) {
```

Update it to:

```typescript
export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  droneNote, droneMode,
  onComplete,
}: FretboardTrainerProps) {
```

- [ ] **Step 3: Update the round-change `useEffect` to handle cue mode**

Find the existing `useEffect` that resets state and calls `playFretboardRound` (currently around lines 42–56):

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

Replace it with:

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
  // droneMode and droneNote intentionally omitted from deps: effect must only
  // fire when a new round starts, not when the user adjusts drone settings mid-round.
}, [round]);
```

Note: `initAudio` is already imported at the top of the file. `playNote` is also already imported. No new imports needed.

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Manual check**

`npm run dev` → open Fretboard mode. The trainer should behave identically to before (no visual change yet — props will be wired in Task 3). Verify lint is clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: add droneNote/droneMode props and cue-mode sequencing to FretboardTrainer"
```

---

### Task 3: Drone state, settings UI, and lifecycle in EarTraining

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1 (`src/lib/audio.ts`):
  ```typescript
  import { ..., startDrone, stopDrone } from '../lib/audio';
  ```
- Consumes from Task 2 (`src/components/FretboardTrainer.tsx`):
  ```typescript
  // FretboardTrainer now accepts:
  droneNote?: string | null;
  droneMode?: 'off' | 'continuous' | 'cue';
  ```

The 12 note pitch classes in order: `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`

- [ ] **Step 1: Add `startDrone` and `stopDrone` to the audio import**

Find the existing audio import line in `src/pages/EarTraining.tsx`:

```typescript
import { initAudio, playStrum, playNote } from '../lib/audio';
```

Replace with:

```typescript
import { initAudio, playStrum, playNote, startDrone, stopDrone } from '../lib/audio';
```

- [ ] **Step 2: Add drone state**

In `EarTraining`, find the block of `useState` declarations. After `const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});`, add:

```typescript
const [droneNote, setDroneNote] = useState<string | null>(null);
const [droneMode, setDroneMode] = useState<'off' | 'continuous' | 'cue'>('off');
```

- [ ] **Step 3: Add the continuous drone lifecycle effect**

After the existing `useEffect` blocks (after the `useEffect` that handles `settings.mode === 'study'`), add:

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

- [ ] **Step 4: Add drone controls to the settings panel UI**

In the settings panel JSX, find the Difficulty row inside `{settings.settingsPanelOpen && (...)`. It currently starts with:

```tsx
<div className="pt-3">
  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
```

Add the drone controls block **after** the closing `</div>` of the entire Difficulty section (which includes the Hunt button) and **before** the closing `</div>` of the `{settings.settingsPanelOpen && ...}` block. The new block goes only when `settings.mode === 'fretboard'`:

```tsx
{settings.mode === 'fretboard' && (
  <div className="space-y-2 pt-2 border-t border-brand-line">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary pt-1">Drone</p>

    {/* Mode pills */}
    <div className="flex gap-2 flex-wrap">
      {(['off', 'continuous', 'cue'] as const).map(mode => (
        <button
          key={mode}
          onClick={() => setDroneMode(mode)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize',
            droneMode === mode
              ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
              : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary',
          )}
        >
          {mode === 'off' ? 'Off' : mode === 'continuous' ? 'Continuous' : 'Cue'}
        </button>
      ))}
    </div>

    {/* Tonic note pills — hidden when Off */}
    {droneMode !== 'off' && (
      <div className="flex gap-1.5 flex-wrap">
        {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(pitch => (
          <button
            key={pitch}
            onClick={() => setDroneNote(`${pitch}3`)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
              droneNote === `${pitch}3`
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary',
            )}
          >
            {pitch}
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Pass drone props to FretboardTrainer**

Find the `<FretboardTrainer ... />` JSX (currently around line 429). Add the two new props:

```tsx
<FretboardTrainer
  round={round as FretboardRound}
  difficulty={difficulty}
  score={score}
  isHuntMode={fretboardSubMode === 'hunt'}
  focus={fretboardFocus}
  onFocusChange={handleFocusChange}
  droneNote={droneNote}
  droneMode={droneMode}
  onComplete={handleFretboardComplete}
/>
```

- [ ] **Step 6: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Manual browser test — Continuous mode**

```bash
npm run dev
```

1. Open http://localhost:3000/Guitar_Chords
2. Go to **Ear Training** → **Fretboard** tab
3. Open Settings → confirm the Drone row appears with Off / Continuous / Cue pills
4. Select **Continuous**, then select tonic **A** — a quiet sine tone should start immediately
5. Press **Replay** — the guitar note plays on top; the drone should continue uninterrupted
6. Switch to a different note pill (e.g. **E**) — drone should re-tune to E3 without stopping
7. Select **Off** — drone should stop

- [ ] **Step 8: Manual browser test — Cue mode**

1. Select **Cue**, select tonic **E**
2. Start a Fretboard session — each round should play the tonic E3 first (~0.6s), then the target note
3. Press **Replay** — only the target note plays (no cue on replay, which is correct)

- [ ] **Step 9: Manual browser test — mode switching**

1. Switch from Fretboard to Chord Recognition while drone is playing — drone should stop
2. Switch back to Fretboard — drone should not restart until user re-enables it

- [ ] **Step 10: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add tonal drone controls and lifecycle to EarTraining"
```
