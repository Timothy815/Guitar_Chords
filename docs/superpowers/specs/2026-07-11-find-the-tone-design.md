# Find the Tone (Interval Ear Training) Design

**Goal:** Add a "Find the Tone" sub-mode to the existing Interval ear-training mode. Instead of picking a labeled option from multiple choice, the learner hears a root note, is told a target interval by name (e.g. "Find the Perfect 5th"), and must identify which of 13 unlabeled, ascending-pitch-ordered tones matches that interval by ear.

**Architecture:** A new round type, `IntervalPitchRound`, added to `src/lib/earTraining.ts` alongside the existing `IntervalRound`. A new `intervalSubMode` toggle (`'choice' | 'findTone'`), local component state in `EarTraining.tsx`, switches the standalone Interval mode's practice screen between the existing multiple-choice quiz and the new find-the-tone quiz. The two sub-modes share the same Settings panel (active intervals, difficulty presets, roots) and the same score/history bucket (`interval_history`, keyed by interval label) — this is additive to the existing interval quiz, not a replacement.

**Tech Stack:** No new dependencies. Reuses `playNote`/`initAudio` from `src/lib/audio.ts`, `addSemitones` and `INTERVAL_DEFS`/`INTERVAL_ROOTS` already in `src/lib/earTraining.ts`, and the existing tentative/Confirm selection pattern already used by the multiple-choice quiz.

---

## Global Constraints

- Modified files only: `src/lib/earTraining.ts`, `src/pages/EarTraining.tsx`. No new files.
- Find-the-Tone applies **only to standalone Interval mode** (`settings.mode === 'interval'`). Mixed mode and Plan-mode skill-ladder practice continue to use the existing multiple-choice `generateIntervalRound` exclusively — do not thread `intervalSubMode` into `makeRound`'s mixed/plan branches.
- `intervalSubMode` is **not persisted** to `localStorage` or `EarTrainingSettings` — it's local `useState` defaulting to `'choice'`, matching the existing `fretboardSubMode` convention (`src/pages/EarTraining.tsx:77`). Re-entering Interval mode always starts on Multiple Choice.
- The candidate window is always the full chromatic octave: semitones 0–12 above the root (13 candidates), regardless of difficulty or which target interval was picked. Difficulty/`activeIntervals` only controls which interval can be asked for, not the candidate window.
- Playing the root note must never also play the answer tone. This is a correctness requirement, not a style preference — the existing `playRoundAudio` for `IntervalRound` plays root then the correct top note, which would leak the answer if reused unmodified for `IntervalPitchRound`.
- `npm run lint` (`tsc --noEmit`) must pass with zero new errors (ignore the two pre-existing unrelated errors in untracked `src/pages/Caged 2.tsx`).

---

## Data Model (`src/lib/earTraining.ts`)

### `IntervalPitchRound`

```ts
export interface IntervalPitchRound {
  kind: 'intervalPitch';
  rootNote: string;
  correctSemitones: number; // 0-12, index into the 13 candidate buttons
  correctLabel: string;     // e.g. "Perfect 5th" — for the prompt text and score bucketing
}
```

Add `IntervalPitchRound` to the `Round` union type (currently `ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound | ScaleIntervalRound`).

### `generateIntervalPitchRound`

```ts
export function generateIntervalPitchRound(activeIntervals: string[]): IntervalPitchRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);
  return {
    kind: 'intervalPitch',
    rootNote,
    correctSemitones: correctDef.semitones,
    correctLabel: correctDef.label,
  };
}
```

Reuses the existing `pickRandom`, `INTERVAL_DEFS`, `INTERVAL_ROOTS` already defined in this file — same pattern as `generateIntervalRound`.

### Candidate tone lookup

No stored array — candidate `i` (0–12) is always `addSemitones(rootNote, i)`, using the existing `addSemitones` helper (already used by `generateIntervalRound`).

### Audio helpers

- `playRoundAudio` (in `EarTraining.tsx`) gets a new branch: `if (r.kind === 'intervalPitch') { playNote(r.rootNote, '2n'); return; }` — plays only the root, placed before the existing chord/interval branches.
- `playOptionAudio` (in `earTraining.ts`) gets a new branch: `if (round.kind === 'intervalPitch') { playNote(addSemitones(round.rootNote, index), '2n'); return; }` — clicking candidate `index` plays that single tone, not a root+top pair.

### History

No new storage. On grading, append to the existing `interval_history` store via `appendIntervalEntries([{ date, label: round.correctLabel, rootNote: round.rootNote, correct, responseTimeMs }])` — `IntervalHistoryEntry`'s shape (`date`, `label`, `rootNote`, `correct`, `responseTimeMs`) already matches exactly, no changes needed to `src/lib/intervalHistory.ts`.

---

## UI (`src/pages/EarTraining.tsx`)

### Sub-mode toggle

Two-button toggle ("Multiple Choice" / "Find the Tone"), visible only when `settings.mode === 'interval'` and not inside Plan-mode practice. Follows the existing pill-button toggle visual style used elsewhere in the file (e.g. the fretboard sub-mode buttons). Clicking it sets `intervalSubMode` and calls `advanceRound()` to generate a round of the matching kind.

### Find-the-Tone practice screen

Replaces the multiple-choice grid (only) when `intervalSubMode === 'findTone'`:

1. Root replay button + text prompt: `Find the {round.correctLabel}` (e.g. "Find the Perfect 5th").
2. Thirteen unlabeled circular buttons in a single row (wrap to 2 rows on narrow screens), left-to-right = ascending pitch (index 0 = root/unison through index 12 = octave). Clicking one:
   - Plays that candidate's tone (`playOptionAudio`)
   - Sets it as the tentative pick (reuses existing `tentative` state — no new state needed since indices 0–12 fit the existing `tentative: number | null` shape)
3. Confirm button (reuses existing `handleConfirm`) grades the tentative pick.
4. After grading: the correct dot highlights green; if the selected dot was wrong, it highlights red (same color classes as the existing MC buttons); a caption reveals the correct answer's actual note name for confirmation.

### Grading

`isOptionCorrect` (existing function) gets a new branch: `if (round.kind === 'intervalPitch') return index === round.correctSemitones;`

`handleSelect` (existing function) gets a new branch parallel to the existing chord/interval branches:
- `isCorrect = index === (round as IntervalPitchRound).correctSemitones`
- `typeKey = (round as IntervalPitchRound).correctLabel` (same score `byType` bucketing key the MC quiz already uses for that interval, so accuracy stats blend across both sub-modes)
- History append via `appendIntervalEntries` as described above, guarded by `round.kind === 'intervalPitch'` alongside the existing `round.kind === 'interval'` branch.

### Round generation routing

In `advanceRound`, add a branch before the final `else` that calls `makeRound`:

```ts
} else if (s.mode === 'interval' && intervalSubMode === 'findTone') {
  r = generateIntervalPitchRound(s.activeIntervals);
} else {
  r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
}
```

Gated on `s.mode` (the raw top-level mode), not `effectiveMode`, so Plan-mode ladders that resolve to interval practice are never affected by a stale `intervalSubMode` value left over from standalone Interval mode.

---

## Testing

No test framework in this repo (`npm run lint` — `tsc --noEmit` — is the only static check). Verification plan:
- `npm run lint` passes with zero new errors.
- Manual code-path check: confirm `playRoundAudio`/`playOptionAudio` never play `addSemitones(rootNote, correctSemitones)` before the user confirms an answer (the answer-leak risk called out in Global Constraints).
- If browser automation is available at implementation time, a live smoke test in Interval mode: toggle to Find the Tone, confirm 13 unlabeled dots render in ascending order, click a few to preview, confirm, and verify score/history updates alongside existing Multiple Choice stats. If unavailable (as in past sessions), this must be reported explicitly rather than assumed.
