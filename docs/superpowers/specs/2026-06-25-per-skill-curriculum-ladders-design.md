# Per-Skill Curriculum Ladders — Design Spec

**Date:** 2026-06-25
**Feature:** Replace the single linear Plan ladder with 6 independent skill ladders in a dashboard grid layout

---

## Overview

The current Plan tab has one 11-stage linear ladder (Intervals → Chords → Fretboard, locked sequentially). This redesign replaces it with 6 independent skill ladders arranged in a 2-column dashboard grid, grouped by skill type. Each ladder tracks its own progress independently. The one exception is the Mixed ladder, which requires completing both Intervals and Chords at the same tier before unlocking.

---

## Ladders

### Pitch Group (4 ladders)

#### Intervals — 3 stages
Trains interval recognition in isolation. Values are `INTERVAL_DEFS` labels used in `DIFFICULTY_PRESETS.interval`.

| Stage | Active Intervals |
|---|---|
| Beginner | `'Unison'`, `'Minor 3rd'`, `'Major 3rd'`, `'Perfect 4th'`, `'Perfect 5th'`, `'Octave'` |
| Intermediate | Beginner + `'Major 2nd'`, `'Minor 6th'`, `'Major 6th'`, `'Minor 7th'`, `'Major 7th'` |
| Advanced | All — `INTERVAL_DEFS.map(d => d.label)` (all 13 intervals) |

#### Chords — 3 stages
Trains chord type identification in isolation. Values are chord type IDs used in `DIFFICULTY_PRESETS.chord`.

| Stage | Active Chord Types (IDs) |
|---|---|
| Beginner | `'major'`, `'minor'` |
| Intermediate | Beginner + `'dom7'`, `'Maj7'`, `'m7'` |
| Advanced | Intermediate + `'dim'`, `'aug'`, `'m7b5'`, `'dim7'` |

#### Mixed — 3 stages
Interleaves interval and chord rounds. Round type (chord or interval) is randomly assigned each round. Uses the same pools as Intervals and Chords at the matching difficulty tier.

**Unlock rule:** Mixed Beginner requires Intervals Beginner + Chords Beginner both complete. Mixed Intermediate requires both at Intermediate. Mixed Advanced requires both at Advanced.

| Stage | Interval Pool | Chord Pool |
|---|---|---|
| Beginner | `['Unison','Minor 3rd','Major 3rd','Perfect 4th','Perfect 5th','Octave']` | `['major','minor']` |
| Intermediate | Beginner + `['Major 2nd','Minor 6th','Major 6th','Minor 7th','Major 7th']` | Beginner + `['dom7','Maj7','m7']` |
| Advanced | All 13 intervals | Intermediate + `['dim','aug','m7b5','dim7']` |

#### Melody — 4 stages
Trains melodic sequence reconstruction. Difficulty increases in both sequence length and pitch pool. The fourth tier "Ears Only" removes the first-note scaffold.

| Stage | Notes | Pool | First Note |
|---|---|---|---|
| Beginner | 3 | Diatonic major (7 pitches) | Given |
| Intermediate | 4–5 | Major + natural minor | Optional (settings-controlled) |
| Advanced | 5–7 | Chromatic (all 12) | Optional (settings-controlled) |
| Ears Only | 5–7 | Chromatic (all 12) | Always hidden |

### Instrument Group (2 ladders)

#### Fretboard — 5 stages
Unchanged from current curriculum. Trains note-on-fretboard identification.

| Stage | Sub-mode |
|---|---|
| Beginner | Guess |
| Intermediate | Guess |
| Advanced | Guess |
| Hunt | Hunt mode |
| Sing | Sing mode |

#### Rhythm — 3 stages
Trains rhythmic pattern recognition and reconstruction. Values are `RhythmDuration` codes (`'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd'`).

| Stage | `enabledDurations` |
|---|---|
| Beginner | `['w', 'h', 'q']` |
| Intermediate | `['w', 'h', 'q', '8', 'qd']` |
| Advanced | `['w', 'h', 'q', '8', '16', 'hd', 'qd']` |

---

## Completion Criteria

| Ladder | Rounds Required | Accuracy Threshold |
|---|---|---|
| Intervals | 20 | 85% |
| Chords | 20 | 85% |
| Mixed | 20 | 85% |
| Melody | 10 | 80% |
| Fretboard | 20 | 85% |
| Rhythm | 20 | 85% |

Melody uses fewer rounds (10) because each round is longer — a full sequence generation, playback, and reconstruction cycle.

---

## UI — Plan Tab

### Dashboard Grid

The Plan tab body is a 2-column card grid divided into two sections: **Pitch Skills** and **Instrument Skills**.

Each card shows:
- Skill name (e.g., "Intervals")
- Current stage name (e.g., "Intermediate") or "Complete" if all stages done
- Stage progress dots: one dot per stage — filled green (complete), filled brand-primary with ring (current), gray (locked)
- **Start** button for the current stage
- If the Mixed card is locked: a small note listing which prerequisites are still needed (e.g., "Complete Intervals Beginner first")

### Practice Flow

Clicking **Start** on a card:
1. Hides the dashboard grid
2. Shows a slim header: `Plan · Intervals · Intermediate` with a **← Back to Plan** link
3. Renders the appropriate trainer component for the current stage
4. On completion (20 rounds at 85%), shows the stage-complete modal (accuracy %, stage label)
5. Returns to the dashboard on dismiss

### Existing Plan Progress

Existing `localStorage` data under `ear_training_plan` is structured differently (single stageIndex). On first load with the new structure, if old data is detected (has a `stageIndex` field), it is discarded and replaced with fresh per-ladder defaults. A one-time migration notice is not needed — the user will see their ladders reset to the start.

---

## Data Layer Changes

### `src/lib/planProgress.ts` — full rewrite

New types:

```typescript
export type LadderId = 'intervals' | 'chords' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';

export type LadderGroup = 'pitch' | 'instrument';

export interface LadderStage {
  label: string;
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
  melodyShowFirstNote?: boolean;  // Ears Only stage sets this to false
}

export interface SkillLadder {
  id: LadderId;
  label: string;
  group: LadderGroup;
  mode: 'chord' | 'interval' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
  stages: LadderStage[];
}

export interface LadderProgress {
  stageIndex: number;  // index into SkillLadder.stages
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export type PlanProgress = Record<LadderId, LadderProgress>;
```

`SKILL_LADDERS: SkillLadder[]` — ordered array defining all 6 ladders in display order (Intervals, Chords, Mixed, Melody, Fretboard, Rhythm).

`DEFAULT_PROGRESS: PlanProgress` — all ladders start at stageIndex 0 with empty completedStages.

`loadPlanProgress(): PlanProgress` — reads from localStorage key `ear_training_plan_v2`. If key missing or invalid, returns DEFAULT_PROGRESS. (Using a new key avoids parsing conflicts with the old format.)

`savePlanProgress(p: PlanProgress): void`

`resetPlanProgress(): PlanProgress`

`isMixedUnlocked(ladderId: 'mixed', tier: number, progress: PlanProgress): boolean` — returns true if Intervals and Chords have both completed at least `tier + 1` stages (i.e., stage index `tier` is in completedStages).

### `src/lib/earTraining.ts` — update `DIFFICULTY_PRESETS`

Replace current interval and chord difficulty presets with frequency-based pools matching the table above.

Current `DIFFICULTY_PRESETS.interval` active set names must match the interval labels used in `COMMON_INTERVALS` (e.g., `'Perfect 4th'`, `'Minor 3rd'`).

Current `DIFFICULTY_PRESETS.chord` active set names must match chord type labels returned by `getChordType()` (e.g., `'major'`, `'minor'`, `'dom7'`).

Add `'mixed'` to the mode union. `'mixed'` is plan-internal only — it does not appear as a free-practice tab in the mode tab bar. When `mode === 'mixed'`, `advanceRound` randomly picks (50/50) between generating a chord round or an interval round using the active pools for the current difficulty.

### `src/pages/EarTraining.tsx`

- Replace `planProgress: PlanProgress` state (old type → new type)
- Replace `PLAN_STAGES` references with `SKILL_LADDERS`
- Add `activeLadder: LadderId | null` state (null = showing dashboard)
- `handlePlanStart(ladderId: LadderId)` — sets activeLadder, configures settings/difficulty for the stage, sets `planPracticing = true`
- `handlePlanAdvance(accuracyFraction: number)` — updates per-ladder progress, shows completion modal
- Plan tab renders: dashboard grid when `!planPracticing`, slim header + trainer when `planPracticing`

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/planProgress.ts` | Full rewrite — new types, SKILL_LADDERS, per-ladder progress, Mixed unlock logic |
| `src/lib/earTraining.ts` | Update DIFFICULTY_PRESETS (frequency-based); add 'mixed' to mode union and advanceRound |
| `src/pages/EarTraining.tsx` | Replace Plan tab UI with dashboard grid; update plan state handlers |
