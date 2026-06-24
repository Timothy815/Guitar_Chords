# Comparative Playback — Design Spec

## Goal

When a wrong answer is submitted in Guess mode, play the clicked note followed by the correct note so the user hears the interval gap between their guess and the target. This gives immediate auditory feedback that accelerates pitch recognition.

## Scope

- **Applies to:** Fretboard Guess mode only.
- **Does not apply to:** Hunt mode (users are still searching; playing the correct note would spoil the answer), chord mode, interval mode.
- **Always on:** No toggle. Comparative playback fires on every wrong answer in Guess mode. There is no setting to disable it.

## Architecture

One file changes: `src/components/FretboardTrainer.tsx`. One code block changes: the `else` branch of the wrong-answer path in `handleFretClick`. No new imports, no new state, no new exports, no new files.

## Audio Sequence

| Time | Event |
|------|-------|
| 0 ms | State updates (wrong highlight, correct positions revealed, note name shown) |
| 0 ms | `playNote(guessNote, '2n')` — plays the clicked note at its exact octave |
| 600 ms | Wrong-position red highlight fades (`setWrongPosition(null)`) |
| 800 ms | `playNote(round.targetNote, '2n')` — plays the correct note |
| 2000 ms | `onComplete(false)` — round advances |

Both notes use `'2n'` (half-note duration). The guess note and correct note are played at their exact octaves as returned by `getFretNote` and stored in `round.targetNote` — the user hears the precise interval they were off by.

## Implementation

Replace the `else` block in `handleFretClick` (currently lines 124–131 of `FretboardTrainer.tsx`):

**Before:**
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

**After:**
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

`initAudio`, `playNote`, `noteStr`, and `round.targetNote` are all already in scope at this call site. The `isRevealing` flag is set to `true` immediately, preventing any further clicks before the round advances — no double-trigger is possible.

## Replay Button

Unaffected. The replay button calls `playFretboardRound(round)`, which plays only the target note. Comparative playback is exclusive to the initial wrong-answer moment.

## Out of Scope

- Volume or timing controls for the comparison sequence
- Visual annotation of the interval gap (e.g. "3 semitones flat")
- Comparative playback in Hunt, chord, or interval modes
