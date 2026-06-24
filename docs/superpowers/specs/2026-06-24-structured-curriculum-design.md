# Structured Curriculum — Design Spec

## Goal

Add a "Plan" tab to the Ear Training page that guides the user through a fixed 11-stage practice sequence. The app auto-advances when the user hits an accuracy threshold, and progress persists to localStorage.

## Scope

- **Applies to:** Ear Training page only. No new routes.
- **Persistence:** `localStorage` key `ear_training_plan`. Resets only if the user explicitly resets.
- **Freeform modes unchanged:** Chord, Interval, and Fretboard tabs are unaffected. Plan is additive.

## Stages

A fixed linear sequence. Each stage maps to an existing mode + difficulty (or sub-mode) combination.

| Index | Label | Mode | Config |
|-------|-------|------|--------|
| 0 | Intervals: Beginner | interval | Beginner preset |
| 1 | Intervals: Intermediate | interval | Intermediate preset |
| 2 | Intervals: Advanced | interval | Advanced preset |
| 3 | Chords: Beginner | chord | Beginner preset |
| 4 | Chords: Intermediate | chord | Intermediate preset |
| 5 | Chords: Advanced | chord | Advanced preset |
| 6 | Fretboard: Beginner | fretboard | Guess, Beginner (frets 0–6) |
| 7 | Fretboard: Intermediate | fretboard | Guess, Intermediate (frets 0–10) |
| 8 | Fretboard: Advanced | fretboard | Guess, Advanced (frets 0–13) |
| 9 | Fretboard: Hunt | fretboard | Hunt, Advanced |
| 10 | Fretboard: Sing | fretboard | Sing, Advanced |

The `DIFFICULTY_PRESETS` constants already define the active chord types and intervals for each difficulty level. Fretboard stages use default focus (all strings, no fret restriction) — the user can still override focus within the session.

## Advancement Mechanic

- **Threshold:** 85% accuracy (`correct / total >= 0.85`) AND at least 20 rounds completed in the current session on the current stage.
- **Checked after every round** while in Plan mode on the current stage.
- **On advance:**
  1. `canvas-confetti` burst fires.
  2. A modal appears: *"Stage complete!"* with the stage label, the accuracy achieved, and a **Continue** button.
  3. Pressing Continue: saves completion to localStorage, increments `stageIndex`, resets the session score, collapses the modal, and expands the ladder showing the new current stage.
- **Final stage (index 10 — Fretboard: Sing):** Same flow, but the modal reads *"Plan complete!"* and there is no next stage to advance to.
- **Mid-session close:** Session round counts are not persisted. If the user closes before hitting the threshold, they restart the stage's round count next session. The `stageIndex` is always persisted.

## Architecture

One new file, two files modified.

### New file: `src/lib/planProgress.ts`

Manages localStorage serialization.

```typescript
export interface PlanProgress {
  stageIndex: number;
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export const PLAN_STAGES: { label: string; mode: 'chord' | 'interval' | 'fretboard'; difficulty: DifficultyLevel; subMode?: 'hunt' | 'sing' }[]

export function loadPlanProgress(): PlanProgress
export function savePlanProgress(p: PlanProgress): void
export function resetPlanProgress(): void  // sets stageIndex: 0, completedStages: {}
```

`PLAN_STAGES` is the authoritative ordered array of all 11 stage definitions. Each entry carries enough data to configure EarTraining state when the stage is started.

### Modified: `src/pages/EarTraining.tsx`

- Add `'plan'` to the `settings.mode` union type (via `EarTrainingSettings` in `earTraining.ts`).
- Add `planProgress` state (`useState<PlanProgress>(loadPlanProgress)`), persisted via `useEffect`.
- Add `showPlanComplete` modal state (`useState<{ accuracy: number } | null>(null)`).
- Plan tab button alongside existing Chord / Interval / Fretboard tabs.
- When `settings.mode === 'plan'`: render the Plan tab body (ladder + practice area).
- Advancement check: after each round completes (in `handleFretboardComplete`, `handleChordComplete`, `handleIntervalComplete`), if mode is `'plan'` and `score.total >= 20` and `accuracy >= 85`, trigger advancement.
- Reset session score on stage advance.

### Modified: `src/lib/earTraining.ts`

- Add `'plan'` to the `mode` field of `EarTrainingSettings`.

## Plan Tab UI

### Ladder (always visible when Plan tab is open)

A vertical list of all 11 stages. Each row:
- **Completed:** checkmark icon, muted text, shows accuracy percentage (e.g., `✓ 91%`).
- **Current:** highlighted border/background, stage label bold, **Start** / **Continue** button on the right.
- **Locked:** dimmed text, no button.

While practicing (after Start is clicked), the ladder collapses to a single summary line:
`Plan · Stage 5 of 11 · Chords: Intermediate`
Clicking the summary line re-expands the ladder.

### Practice banner

When the practice area is active, a compact bar above the practice component shows:
`12 / 20 rounds · 88%`
Updates live after each round. Turns green when threshold is met (before the confetti modal fires).

### Practice area

Below the ladder (or summary line), the standard mode component renders:
- Interval/Chord modes: existing `IntervalTrainer` / `ChordTrainer` components, settings pre-configured to the stage's difficulty preset.
- Fretboard modes: existing `FretboardTrainer`, configured to the stage's difficulty and sub-mode.

No new trainer components. Plan mode reuses all existing trainers.

### Stage complete modal

Overlay modal (same style as the existing session summary modal):
```
Stage complete!
Intervals: Intermediate — 91% accuracy

[ Continue → Chords: Beginner ]
```
For the final stage:
```
Plan complete! 🎉
Fretboard: Sing — 87% accuracy

[ Start over ]
```
"Start over" calls `resetPlanProgress()` and resets session score.

## Out of Scope

- Custom stage ordering or skipping stages
- Multiple plan tracks or branching paths
- Per-stage streak or spaced repetition integration
- Backend persistence
- Threshold configuration by the user
