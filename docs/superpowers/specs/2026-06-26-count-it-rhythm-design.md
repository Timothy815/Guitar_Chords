# Count It Mode — Design Spec

**Date:** 2026-06-26

## Overview

"Count It" is a new ear-training mode in EarTraining that inverts the rhythm trainer: the user sees rhythm notation on the staff, hears it played, and then labels each rhythmic position in a count grid as a **note attack**, **rest**, or **held** note. The goal is to build fluency in the verbal counting system (`1`, `1e`, `1+`, `1a`, `2`, …) by connecting notation to counts explicitly.

---

## Mode Structure

Count It is added as a new mode value `'count'` in EarTraining alongside `'rhythm'`. It appears as a tab labeled **"Count It"** in the mode selector row.

**Settings** — Count It shares the same `RhythmSettings` state as the rhythm mode. Switching between "Rhythm" and "Count It" preserves all settings (time signature, enabled durations, rests, BPM, difficulty, lead-in). No new settings type is introduced.

**Round generation** — reuses `generateRhythmRound` from `rhythmTraining.ts` unchanged.

---

## Round Flow

1. A `RhythmRound` is generated and the rhythm auto-plays on mount (same `initAudio()` → `playRhythmRound()` pattern as the rhythm trainer, with active-unit highlighting).
2. The staff is displayed read-only — notation is visible from the start; this is not a listening test. No drag handles are shown.
3. A count grid appears below the staff in the same horizontal scroll container.
4. The user labels each slot as Attack / Rest / Held by clicking (see Slot Picker below).
5. Submit is enabled when all slots have a label. Grading runs on submit.
6. Wrong submission: per-slot green/red feedback plus the correct label shown for each wrong slot.
7. Try Again clears all labels. Next → generates a new round.

---

## Adaptive Resolution

Slot granularity is determined by the smallest enabled duration:

| Smallest enabled duration | Step (beats) | Slots per measure (4/4) |
|---|---|---|
| `'16'` | 0.25 | 16 |
| `'8'` or `'qd'` (no `'16'`) | 0.5 | 8 |
| `'q'` or coarser only | 1.0 | 4 |

Each slot at position `i * step` gets a count label from `getCountLabel(i * step, timeSignature)`, producing `"1"`, `"1+"`, `"1a"`, etc.

---

## Count Grid

Slots are displayed in a flex row, proportionally wide (same `widthPct` system as the existing count row in RhythmTrainer).

**Visual states:**

| State | Background | Label format |
|---|---|---|
| Unlabeled | Gray, dimmed | `1+` |
| Attack (N) | Blue | `1+` bold |
| Rest (R) | Muted amber | `[1+]` |
| Held (H) | Dim gray | `(1+)` italic |

This notation mirrors the existing count row so the two modes reinforce each other.

---

## Slot Picker

Clicking a slot opens a compact floating 3-button picker centered above the slot:

```
┌──────────────┐
│  [N]  [R]  [H]  │
└──────────────┘
       ▼
  [ 1+ ]  ← slot
```

- **N** — Note attack (blue)
- **R** — Rest (amber)
- **H** — Held (gray)

**Positioning** — absolutely positioned relative to the scroll container; left edge clamped to prevent overflow. Appears above the slot by default; flips below if the slot is near the top of the container.

**Dismissal** — selecting an option applies the label and closes the picker. Clicking outside closes without changing state.

**Relabeling** — clicking an already-labeled slot reopens the picker with the current label highlighted.

**Keyboard** — not in scope for v1.

---

## Grading

**Correct answer construction** (at adaptive resolution):

```typescript
type SlotLabel = 'N' | 'R' | 'H';
const step = adaptiveStep; // 0.25, 0.5, or 1.0
const correctLabels: SlotLabel[] = round.units.flatMap(u => {
  const n = Math.round(durationBeats(u.duration) / step);
  if (u.isRest) return Array(n).fill('R');
  return ['N', ...Array(n - 1).fill('H')];
});
```

**Comparison** — `userLabels[i]` vs `correctLabels[i]` for each slot. Submit is blocked until all slots are labeled, so unlabeled entries should not occur at grade time; treat them as wrong as a defensive fallback.

**Per-slot feedback** — slots turn green (correct) or red (wrong). For wrong slots, the correct label is displayed as a secondary indicator (e.g., small text or superscript in green) so the user can study the gap.

**Summary message:**
- All correct → `"Correct! 🎯"`
- Any wrong → `"Not quite — slots highlighted above"`

**Attempts / scoring** — `wasCorrect = attempts === 1 && allCorrect`. Same logic as rhythm mode.

---

## Files

### New

- **`src/components/CountItTrainer.tsx`** — the trainer component. Props: `{ round, score, settings, onComplete }` (identical shape to `RhythmTrainer`). Contains: adaptive slot computation, slot label state, picker open/close state, grading logic, and feedback rendering. Imports `RhythmStaff` and `staffMinWidth` from `RhythmStaff.tsx`.

### Modified

- **`src/pages/EarTraining.tsx`**
  - Add `'count'` to the mode union
  - Add "Count It" tab button in the mode selector row
  - Render `<CountItTrainer>` when mode is `'count'`
  - Share the existing `RhythmSettings` state between rhythm and Count It modes

### Unchanged

- `src/lib/rhythmTraining.ts` — all exports reused as-is
- `src/lib/audio.ts` — no changes
- `src/components/RhythmStaff.tsx` — no changes
- `src/types.ts` — no changes
