# Comparative Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a wrong fret is clicked in Guess mode, play the clicked note then the correct note so the user hears the interval gap.

**Architecture:** A single `else`-branch replacement in `FretboardTrainer.tsx`'s `handleFretClick` callback. No new files, no new imports, no new state. `initAudio`, `playNote`, `noteStr`, and `round.targetNote` are all already in scope at the call site.

**Tech Stack:** React 19, TypeScript, Tone.js (`playNote` via `src/lib/audio.ts`).

## Global Constraints

- No new npm dependencies.
- `npm run lint` (runs `tsc --noEmit`) must pass with zero errors.
- There is no automated test suite — verification is lint + manual browser check.
- No settings toggle — comparative playback is always on for Guess mode wrong answers.
- Does not affect Hunt mode, chord mode, or interval mode.
- No new imports required — `initAudio` and `playNote` are already imported in `FretboardTrainer.tsx`.

---

### Task 1: Comparative playback on wrong answer in Guess mode

**Files:**
- Modify: `src/components/FretboardTrainer.tsx` (lines 124–131 — the `else` branch of `handleFretClick`)

**Interfaces:**
- Consumes (already imported at top of file):
  ```typescript
  import { getFretNote, initAudio, playNote, startNote, stopNote } from '../lib/audio';
  // playNote(noteStr: string, duration: string): void
  // initAudio(): Promise<void>
  ```
- The variables `noteStr` (clicked fret's full note+octave, e.g. `"C4"`) and `round.targetNote` (correct note+octave, e.g. `"E3"`) are already in scope inside `handleFretClick`.

- [ ] **Step 1: Locate the target code block**

Open `src/components/FretboardTrainer.tsx`. Find `handleFretClick` (around line 97). The wrong-answer `else` block currently looks exactly like this:

```typescript
    } else {
      setWrongPosition(key);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => setWrongPosition(null), 600);
      setTimeout(() => onComplete(false), 1500);
    }
```

- [ ] **Step 2: Replace the else block**

Replace the entire `else` block above with:

```typescript
    } else {
      setWrongPosition(key);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => setWrongPosition(null), 600);
      initAudio().then(() => {
        playNote(noteStr, '2n');
        setTimeout(() => playNote(round.targetNote, '2n'), 800);
      }).catch(() => {});
      setTimeout(() => onComplete(false), 2000);
    }
```

The only changes from the original:
1. Added the `initAudio().then(...)` block that plays the guess note immediately and the correct note 800 ms later.
2. Extended the `onComplete(false)` delay from `1500` to `2000`.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected output:
```
> react-example@0.0.0 lint
> tsc --noEmit
```
(No errors — command exits 0.)

- [ ] **Step 4: Manual browser test**

```bash
npm run dev
```

1. Open `http://localhost:3000/Guitar_Chords`
2. Go to **Ear Training** → **Fretboard** tab
3. Start a session in **Guess** mode
4. Click a wrong fret
5. Verify: the clicked note plays immediately, then ~800 ms later the correct note plays, then the round advances at ~2000 ms
6. Click a correct fret — verify the correct-answer flow is unchanged (no extra notes, advances at 600 ms)
7. Click **Replay** on any round — verify only the target note plays (no comparison)
8. Switch to **Hunt** mode — verify wrong confirms flash and retry without any comparison audio

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: play guess then correct note on wrong answer in Guess mode"
```
