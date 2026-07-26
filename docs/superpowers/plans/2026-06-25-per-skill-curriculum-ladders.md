# Per-Skill Curriculum Ladders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 11-stage linear Plan ladder with 6 independent per-skill ladders displayed in a 2-column dashboard grid.

**Architecture:** Rewrite `planProgress.ts` with per-ladder types and a `SKILL_LADDERS` constant; extend `earTraining.ts` with `'mixed'` mode and frequency-based `DIFFICULTY_PRESETS`; then update `EarTraining.tsx` in two passes — state/handlers first, Plan tab UI second.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4. Lint check: `npm run lint` (tsc --noEmit only). No test suite.

## Global Constraints

- `npm run lint` must pass after every task (no new TypeScript errors)
- No new npm dependencies
- New localStorage key for plan data: `'ear_training_plan_v2'` (avoids old `'ear_training_plan'` conflict)
- `'mixed'` mode is plan-internal only — no free-practice tab button for it
- Melody ladder: 10 rounds required, 80% accuracy threshold
- All other ladders: 20 rounds required, 85% accuracy threshold
- Interval pool labels must exactly match `INTERVAL_DEFS` labels in `earTraining.ts`
- Chord pool IDs must exactly match chord type IDs used by `getChordType()` in `earTraining.ts`
- Rhythm stage `enabledDurations` values: only codes from `RhythmDuration = 'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd'`

---

### Task 1: Rewrite `src/lib/planProgress.ts`

**Files:**
- Modify: `src/lib/planProgress.ts`

**Interfaces:**
- Consumes: `DifficultyLevel` from `./earTraining`; `RhythmDuration` from `./rhythmTraining`
- Produces (used by Tasks 3 & 4):
  - `LadderId = 'intervals' | 'chords' | 'mixed' | 'melody' | 'fretboard' | 'rhythm'`
  - `LadderGroup = 'pitch' | 'instrument'`
  - `LadderStage { label, difficulty, subMode?, melodyShowFirstNote?, rhythmDurations?, requiredRounds, requiredAccuracy }`
  - `SkillLadder { id, label, group, mode, stages }`
  - `LadderProgress { stageIndex, completedStages }`
  - `PlanProgress = Record<LadderId, LadderProgress>`
  - `SKILL_LADDERS: SkillLadder[]`
  - `DEFAULT_PROGRESS: PlanProgress`
  - `loadPlanProgress(): PlanProgress`
  - `savePlanProgress(p: PlanProgress): void`
  - `resetPlanProgress(): PlanProgress`
  - `isMixedUnlocked(stageIndex: number, progress: PlanProgress): boolean`

- [ ] **Step 1: Replace the entire file content**

Write `src/lib/planProgress.ts` with:

```typescript
import type { DifficultyLevel } from './earTraining';
import type { RhythmDuration } from './rhythmTraining';

export type LadderId = 'intervals' | 'chords' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
export type LadderGroup = 'pitch' | 'instrument';

export interface LadderStage {
  label: string;
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
  melodyShowFirstNote?: boolean;
  rhythmDurations?: RhythmDuration[];
  requiredRounds: number;
  requiredAccuracy: number;
}

export interface SkillLadder {
  id: LadderId;
  label: string;
  group: LadderGroup;
  mode: 'chord' | 'interval' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
  stages: LadderStage[];
}

export interface LadderProgress {
  stageIndex: number;
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export type PlanProgress = Record<LadderId, LadderProgress>;

export const SKILL_LADDERS: SkillLadder[] = [
  {
    id: 'intervals',
    label: 'Intervals',
    group: 'pitch',
    mode: 'interval',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    group: 'pitch',
    mode: 'chord',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed',
    group: 'pitch',
    mode: 'mixed',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'melody',
    label: 'Melody',
    group: 'pitch',
    mode: 'melody',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', melodyShowFirstNote: true, requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Ears Only', difficulty: 'Advanced', melodyShowFirstNote: false, requiredRounds: 10, requiredAccuracy: 0.80 },
    ],
  },
  {
    id: 'fretboard',
    label: 'Fretboard',
    group: 'instrument',
    mode: 'fretboard',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Hunt', difficulty: 'Advanced', subMode: 'hunt', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Sing', difficulty: 'Advanced', subMode: 'sing', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    group: 'instrument',
    mode: 'rhythm',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', rhythmDurations: ['w', 'h', 'q'], requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', rhythmDurations: ['w', 'h', 'q', '8', 'qd'], requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', rhythmDurations: ['w', 'h', 'q', '8', '16', 'hd', 'qd'], requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
];

const LADDER_IDS: LadderId[] = ['intervals', 'chords', 'mixed', 'melody', 'fretboard', 'rhythm'];
const STORAGE_KEY = 'ear_training_plan_v2';

function defaultProgress(): PlanProgress {
  return Object.fromEntries(
    LADDER_IDS.map(id => [id, { stageIndex: 0, completedStages: {} }])
  ) as PlanProgress;
}

export const DEFAULT_PROGRESS: PlanProgress = defaultProgress();

export function loadPlanProgress(): PlanProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Record<LadderId, Partial<LadderProgress>>>;
    return Object.fromEntries(
      LADDER_IDS.map(id => [
        id,
        {
          stageIndex: parsed[id]?.stageIndex ?? 0,
          completedStages: parsed[id]?.completedStages ?? {},
        },
      ])
    ) as PlanProgress;
  } catch {
    return defaultProgress();
  }
}

export function savePlanProgress(p: PlanProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function resetPlanProgress(): PlanProgress {
  const fresh = defaultProgress();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function isMixedUnlocked(stageIndex: number, progress: PlanProgress): boolean {
  return (
    !!progress.intervals.completedStages[stageIndex] &&
    !!progress.chords.completedStages[stageIndex]
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no output (clean). EarTraining.tsx may still have errors from missing `PLAN_STAGES` etc — that's OK, those are fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/planProgress.ts
git commit -m "feat: rewrite planProgress.ts with per-skill ladder types and SKILL_LADDERS"
```

---

### Task 2: Update `src/lib/earTraining.ts` — mode union and DIFFICULTY_PRESETS

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Produces: `'mixed'` added to `EarTrainingSettings.mode` union; updated `DIFFICULTY_PRESETS.interval` (frequency-based pools)

- [ ] **Step 1: Add `'mixed'` to the mode union**

In `src/lib/earTraining.ts` line 18, change:
```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody';
```
to:
```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed';
```

- [ ] **Step 2: Update `DIFFICULTY_PRESETS.interval` to frequency-based pools**

In `src/lib/earTraining.ts` around lines 121–124, replace the `interval` block:
```typescript
  interval: {
    Beginner: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
    Intermediate: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Major 6th'],
    Advanced: INTERVAL_DEFS.map(d => d.label),
  },
```
with:
```typescript
  interval: {
    Beginner: ['Unison', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th', 'Octave'],
    Intermediate: [
      'Unison', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th', 'Octave',
      'Major 2nd', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th',
    ],
    Advanced: INTERVAL_DEFS.map(d => d.label),
  },
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no output (clean). EarTraining.tsx may still error on old planProgress imports — acceptable until Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add mixed mode to EarTrainingSettings and update interval difficulty presets"
```

---

### Task 3: Update `src/pages/EarTraining.tsx` — state, imports, and handlers

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1: `LadderId`, `LadderStage`, `SkillLadder`, `SKILL_LADDERS`, `PlanProgress` (new type), `loadPlanProgress`, `savePlanProgress`, `resetPlanProgress`, `isMixedUnlocked`
- Consumes from Task 2: `'mixed'` in mode union

This task covers all logic/handler changes: imports, state, `makeRound`, `advanceRound`, `handlePlanMode`, `handlePlanStart`, `handlePlanAdvance`, `handleRhythmComplete`, `handleMelodyComplete`, plus the plan advancement checks in `handleSelect` and `handleFretboardComplete`.

- [ ] **Step 1: Update the planProgress import (line 17)**

Replace:
```typescript
import { PlanProgress, PlanStage, PLAN_STAGES, loadPlanProgress, savePlanProgress, resetPlanProgress } from '../lib/planProgress';
```
with:
```typescript
import { LadderId, LadderStage, SkillLadder, SKILL_LADDERS, PlanProgress, loadPlanProgress, savePlanProgress, resetPlanProgress, isMixedUnlocked } from '../lib/planProgress';
```

- [ ] **Step 2: Add `activeLadder` state**

After the line `const [planPracticing, setPlanPracticing] = useState(false);` (currently line 85), add:
```typescript
  const [activeLadder, setActiveLadder] = useState<LadderId | null>(null);
```

- [ ] **Step 3: Update `makeRound` to handle `'mixed'` mode**

The current `makeRound` function (around lines 46–54) is:
```typescript
function makeRound(
  s: EarTrainingSettings,
  difficulty: DifficultyLevel = 'Beginner',
  focus: FretboardFocus = {},
): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty, focus);
  return generateIntervalRound(s.activeIntervals);
}
```

Replace with:
```typescript
function makeRound(
  s: EarTrainingSettings,
  difficulty: DifficultyLevel = 'Beginner',
  focus: FretboardFocus = {},
): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'mixed') return Math.random() < 0.5 ? generateChordRound(s.activeChordTypes) : generateIntervalRound(s.activeIntervals);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty, focus);
  return generateIntervalRound(s.activeIntervals);
}
```

- [ ] **Step 4: Update `advanceRound` — effectiveMode lookup**

In `advanceRound` (around line 164), replace:
```typescript
    const effectiveMode = s.mode === 'plan'
      ? PLAN_STAGES[planProgress.stageIndex].mode
      : s.mode;
```
with:
```typescript
    const effectiveMode = s.mode === 'plan' && activeLadder
      ? SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!.mode
      : s.mode;
```

- [ ] **Step 5: Add `'mixed'` branch to `advanceRound`**

In `advanceRound`, find the final else branch (around line 193):
```typescript
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
```

Replace with (inserting the mixed branch before the catchall):
```typescript
    } else if (effectiveMode === 'mixed') {
      r = Math.random() < 0.5
        ? generateChordRound(s.activeChordTypes)
        : generateIntervalRound(s.activeIntervals);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
```

- [ ] **Step 6: Update `handlePlanMode` to clear activeLadder**

Replace:
```typescript
  function handlePlanMode() {
    setSettings(s => ({ ...s, mode: 'plan' }));
    setPlanPracticing(false);
  }
```
with:
```typescript
  function handlePlanMode() {
    setSettings(s => ({ ...s, mode: 'plan' }));
    setPlanPracticing(false);
    setActiveLadder(null);
  }
```

- [ ] **Step 7: Replace `handlePlanStart`**

Replace the entire current `handlePlanStart` function:
```typescript
  function handlePlanStart() {
    const stage = PLAN_STAGES[planProgress.stageIndex];
    const next: EarTrainingSettings = {
      ...settings,
      mode: 'plan',
      activeChordTypes: stage.mode === 'chord'
        ? [...DIFFICULTY_PRESETS.chord[stage.difficulty]]
        : settings.activeChordTypes,
      activeIntervals: stage.mode === 'interval'
        ? [...DIFFICULTY_PRESETS.interval[stage.difficulty]]
        : settings.activeIntervals,
    };
    setSettings(next);
    setDifficulty(stage.difficulty);
    setFretboardSubMode(stage.subMode ?? 'guess');
    setHuntSessionRounds([]);
    setScore(initialScore());
    deckRef.current = [];
    deckKeyRef.current = '';
    setPlanPracticing(true);
    advanceRound(next);
  }
```

with:
```typescript
  function handlePlanStart(ladderId: LadderId) {
    const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === ladderId)!;
    const stageIdx = planProgress[ladderId].stageIndex;
    const stage = ladder.stages[stageIdx];
    const next: EarTrainingSettings = {
      ...settings,
      mode: 'plan' as const,
      activeChordTypes: (ladder.mode === 'chord' || ladder.mode === 'mixed')
        ? [...DIFFICULTY_PRESETS.chord[stage.difficulty]]
        : settings.activeChordTypes,
      activeIntervals: (ladder.mode === 'interval' || ladder.mode === 'mixed')
        ? [...DIFFICULTY_PRESETS.interval[stage.difficulty]]
        : settings.activeIntervals,
      melodySettings: stage.melodyShowFirstNote !== undefined
        ? { ...settings.melodySettings, showFirstNote: stage.melodyShowFirstNote }
        : settings.melodySettings,
    };
    setActiveLadder(ladderId);
    setSettings(next);
    setDifficulty(stage.difficulty);
    setFretboardSubMode(stage.subMode ?? 'guess');
    setHuntSessionRounds([]);
    setScore(initialScore());
    deckRef.current = [];
    deckKeyRef.current = '';
    setPlanPracticing(true);
    if (ladder.mode === 'rhythm' && stage.rhythmDurations) {
      const newRhythmSettings = { ...rhythmSettings, enabledDurations: stage.rhythmDurations };
      setRhythmSettings(newRhythmSettings);
      const rr = generateRhythmRound(stage.difficulty, newRhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
    } else {
      advanceRound(next);
    }
  }
```

- [ ] **Step 8: Replace `handlePlanAdvance`**

Replace the entire current `handlePlanAdvance` function:
```typescript
  function handlePlanAdvance(accuracyFraction: number) {
    const accuracyPct = Math.round(accuracyFraction * 100);
    const currentStage = PLAN_STAGES[planProgress.stageIndex];
    const nextIndex = planProgress.stageIndex + 1;
    const isFinal = nextIndex >= PLAN_STAGES.length;
    const updatedProgress: PlanProgress = {
      stageIndex: isFinal ? planProgress.stageIndex : nextIndex,
      completedStages: {
        ...planProgress.completedStages,
        [planProgress.stageIndex]: {
          accuracy: accuracyPct,
          completedAt: new Date().toISOString(),
        },
      },
    };
    setPlanProgress(updatedProgress);
    setScore(initialScore());
    setPlanPracticing(false);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setShowPlanComplete({ accuracy: accuracyPct, stageLabel: currentStage.label, isFinal });
  }
```

with:
```typescript
  function handlePlanAdvance(accuracyFraction: number) {
    if (activeLadder === null) return;
    const accuracyPct = Math.round(accuracyFraction * 100);
    const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
    const currentStageIdx = planProgress[activeLadder].stageIndex;
    const nextStageIdx = currentStageIdx + 1;
    const isFinal = nextStageIdx >= ladder.stages.length;
    const updatedProgress: PlanProgress = {
      ...planProgress,
      [activeLadder]: {
        stageIndex: isFinal ? currentStageIdx : nextStageIdx,
        completedStages: {
          ...planProgress[activeLadder].completedStages,
          [currentStageIdx]: {
            accuracy: accuracyPct,
            completedAt: new Date().toISOString(),
          },
        },
      },
    };
    setPlanProgress(updatedProgress);
    setScore(initialScore());
    setPlanPracticing(false);
    setActiveLadder(null);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setShowPlanComplete({
      accuracy: accuracyPct,
      stageLabel: `${ladder.label} · ${ladder.stages[currentStageIdx].label}`,
      isFinal,
    });
  }
```

- [ ] **Step 9: Update plan advancement check in `handleFretboardComplete`**

Find (around line 365):
```typescript
    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
      return;
    }
```

Replace with:
```typescript
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
        return;
      }
    }
```

- [ ] **Step 10: Update plan advancement check in `handleSelect`**

Find (around line 464):
```typescript
    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
    }
```

Replace with:
```typescript
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
      }
    }
```

- [ ] **Step 11: Update `handleRhythmComplete` to support plan advancement**

Replace the current `handleRhythmComplete`:
```typescript
  function handleRhythmComplete(wasCorrect: boolean) {
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    setTimeout(() => advanceRound(), 400);
  }
```

with:
```typescript
  function handleRhythmComplete(wasCorrect: boolean) {
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        setTimeout(() => handlePlanAdvance(newCorrect / newTotal), 400);
        return;
      }
    }
    setTimeout(() => advanceRound(), 400);
  }
```

- [ ] **Step 12: Update `handleMelodyComplete` to support plan advancement**

Replace the current `handleMelodyComplete`:
```typescript
  function handleMelodyComplete(wasCorrect: boolean) {
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    setTimeout(() => advanceRound(), 400);
  }
```

with:
```typescript
  function handleMelodyComplete(wasCorrect: boolean) {
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        setTimeout(() => handlePlanAdvance(newCorrect / newTotal), 400);
        return;
      }
    }
    setTimeout(() => advanceRound(), 400);
  }
```

- [ ] **Step 13: Run lint**

```bash
npm run lint
```
Expected: no output (clean). Fix any type errors before committing.

- [ ] **Step 14: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: update EarTraining state and handlers for per-skill plan ladders"
```

---

### Task 4: Update `src/pages/EarTraining.tsx` — Plan tab UI

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1: `LadderStage`, `SkillLadder`, `SKILL_LADDERS`, `isMixedUnlocked` (already imported in Task 3)
- Consumes from Task 3: `activeLadder` state, `handlePlanStart(ladderId)`, `handlePlanAdvance`

This task replaces the Plan tab JSX (lines 1079–1227) with:
1. A slim practicing header (shown while planPracticing)
2. A 2-column dashboard grid (shown when !planPracticing)
3. A practice area that branches on the active ladder's mode (shown while planPracticing)
4. An updated stage-complete modal

- [ ] **Step 1: Replace the Plan tab body**

Find the entire Plan tab body block starting at `{/* Plan tab body */}`:
```typescript
      {/* Plan tab body */}
      {settings.mode === 'plan' && (
        <>
          {/* Stage ladder */}
          <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
            {planPracticing ? (
              /* Collapsed header while practicing */
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-brand-ink">
                  Plan · Stage {planProgress.stageIndex + 1} of {PLAN_STAGES.length} · {PLAN_STAGES[planProgress.stageIndex].label}
                </span>
                <button
                  onClick={() => setPlanPracticing(false)}
                  className="text-xs text-brand-secondary hover:text-brand-primary transition-colors"
                >
                  View ladder ↑
                </button>
              </div>
            ) : (
              /* Full ladder */
              <div className="divide-y divide-brand-line">
                {PLAN_STAGES.map((stage: PlanStage, i: number) => {
                  const completed = !!planProgress.completedStages[i];
                  const current = i === planProgress.stageIndex;
                  const locked = i > planProgress.stageIndex;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'px-4 py-3 flex items-center gap-3',
                        locked && 'opacity-40'
                      )}
                    >
                      <span className="w-5 shrink-0 flex items-center justify-center">
                        {completed
                          ? <Check size={14} className="text-green-500" />
                          : current
                            ? <span className="text-brand-primary font-bold text-sm">→</span>
                            : <span className="text-brand-line text-sm">·</span>}
                      </span>
                      <span className={cn(
                        'flex-1 text-sm',
                        current ? 'font-medium text-brand-ink' : 'text-brand-secondary'
                      )}>
                        {stage.label}
                      </span>
                      {completed && (
                        <span className="text-xs text-brand-secondary">
                          {planProgress.completedStages[i].accuracy}%
                        </span>
                      )}
                      {current && (
                        <button
                          onClick={handlePlanStart}
                          className="px-3 py-1 rounded-md bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Practice area — only shown after Start is clicked */}
          {planPracticing && (() => {
            const stage = PLAN_STAGES[planProgress.stageIndex];
            if (stage.mode === 'fretboard') {
              return (
                <FretboardTrainer
                  round={round as FretboardRound}
                  difficulty={difficulty}
                  score={score}
                  isHuntMode={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt'}
                  singMode={fretboardSubMode === 'sing' || fretboardSubMode === 'singhunt'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
                  sessionAvgSemitones={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgSemitones : undefined}
                  sessionAvgTaps={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgTaps : undefined}
                  onComplete={handleFretboardComplete}
                />
              );
            }
            return (
              <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
                <div className="flex justify-center">
                  <button
                    onClick={() => playRoundAudio(round)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                  >
                    <Volume2 size={18} /> Replay
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }, (_, i) => {
                    const answered = selected !== null;
                    const correct = isOptionCorrect(i);
                    const isSelected = selected === i;
                    const isTentative = tentative === i;
                    const hasTentative = tentative !== null;
                    return (
                      <button
                        key={i}
                        onClick={() => handleTentative(i)}
                        disabled={answered}
                        className={cn(
                          'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                          !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
                          !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
                          !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
                          answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                          answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                          answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
                        )}
                      >
                        {getOptionLabel(i)}
                      </button>
                    );
                  })}
                </div>
                {tentative !== null && selected === null && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleConfirm}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                )}
                {selected !== null && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => advanceRound()}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
```

Replace with:

```typescript
      {/* Plan tab body */}
      {settings.mode === 'plan' && (
        <>
          {/* Practicing header — shown while in a session */}
          {planPracticing && activeLadder && (() => {
            const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
            const stageIdx = planProgress[activeLadder].stageIndex;
            return (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-brand-line bg-brand-surface">
                <span className="text-sm font-medium text-brand-ink">
                  Plan · {ladder.label} · {ladder.stages[stageIdx].label}
                </span>
                <button
                  onClick={() => { setPlanPracticing(false); setActiveLadder(null); }}
                  className="text-xs text-brand-secondary hover:text-brand-primary transition-colors"
                >
                  ← Back to Plan
                </button>
              </div>
            );
          })()}

          {/* Dashboard grid — hidden while practicing */}
          {!planPracticing && (
            <div className="space-y-4">
              {(['pitch', 'instrument'] as const).map(group => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">
                    {group === 'pitch' ? 'Pitch Skills' : 'Instrument Skills'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {SKILL_LADDERS.filter((l: SkillLadder) => l.group === group).map((ladder: SkillLadder) => {
                      const lp = planProgress[ladder.id];
                      const currentStageIdx = lp.stageIndex;
                      const currentStage = ladder.stages[currentStageIdx];
                      const isComplete = ladder.stages.every((_: LadderStage, i: number) => !!lp.completedStages[i]);
                      const mixedLocked = ladder.id === 'mixed' && !isMixedUnlocked(currentStageIdx, planProgress);
                      const missingPrereqs: string[] = ladder.id === 'mixed' && mixedLocked
                        ? [
                            ...(!planProgress.intervals.completedStages[currentStageIdx] ? [`Intervals ${currentStage.label}`] : []),
                            ...(!planProgress.chords.completedStages[currentStageIdx] ? [`Chords ${currentStage.label}`] : []),
                          ]
                        : [];
                      return (
                        <div
                          key={ladder.id}
                          className={cn(
                            'rounded-lg border border-brand-line bg-brand-surface p-3 space-y-2',
                            mixedLocked && 'opacity-60',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-brand-ink">{ladder.label}</span>
                            {isComplete && <Check size={14} className="text-green-500" />}
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {ladder.stages.map((_: LadderStage, i: number) => {
                              const done = !!lp.completedStages[i];
                              const active = i === currentStageIdx && !isComplete;
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    'w-2 h-2 rounded-full',
                                    done && 'bg-green-500',
                                    active && !done && 'bg-brand-primary ring-2 ring-brand-primary ring-offset-1',
                                    !done && !active && 'bg-brand-line',
                                  )}
                                />
                              );
                            })}
                          </div>
                          {isComplete && (
                            <p className="text-xs text-green-600 font-medium">Complete</p>
                          )}
                          {!isComplete && (
                            <p className="text-xs text-brand-secondary">{currentStage.label}</p>
                          )}
                          {!isComplete && !mixedLocked && (
                            <button
                              onClick={() => handlePlanStart(ladder.id)}
                              className="w-full py-1.5 rounded-md bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors"
                            >
                              Start
                            </button>
                          )}
                          {mixedLocked && missingPrereqs.length > 0 && (
                            <p className="text-xs text-brand-secondary leading-tight">
                              Complete {missingPrereqs.join(' & ')} first
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Practice area — shown after Start is clicked */}
          {planPracticing && activeLadder && (() => {
            const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
            const stageIdx = planProgress[activeLadder].stageIndex;
            const stage = ladder.stages[stageIdx];

            if (ladder.mode === 'fretboard') {
              return (
                <FretboardTrainer
                  round={round as FretboardRound}
                  difficulty={difficulty}
                  score={score}
                  isHuntMode={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt'}
                  singMode={fretboardSubMode === 'sing' || fretboardSubMode === 'singhunt'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
                  sessionAvgSemitones={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgSemitones : undefined}
                  sessionAvgTaps={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgTaps : undefined}
                  onComplete={handleFretboardComplete}
                />
              );
            }

            if (ladder.mode === 'rhythm') {
              return round.kind === 'rhythm'
                ? <RhythmTrainer round={round as RhythmRound} score={score} settings={rhythmSettings} onComplete={handleRhythmComplete} />
                : <RhythmRoundLoader onLoad={() => advanceRound()} />;
            }

            if (ladder.mode === 'melody') {
              void stage;
              return round.kind === 'melody'
                ? <MelodyTrainer round={round as MelodyRound} score={score} settings={settings.melodySettings} difficulty={difficulty} onComplete={handleMelodyComplete} />
                : null;
            }

            // chord, interval, mixed — standard quiz UI
            void stage;
            return (
              <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
                <div className="flex justify-center">
                  <button
                    onClick={() => playRoundAudio(round)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                  >
                    <Volume2 size={18} /> Replay
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }, (_, i) => {
                    const answered = selected !== null;
                    const correct = isOptionCorrect(i);
                    const isSelected = selected === i;
                    const isTentative = tentative === i;
                    const hasTentative = tentative !== null;
                    return (
                      <button
                        key={i}
                        onClick={() => handleTentative(i)}
                        disabled={answered}
                        className={cn(
                          'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                          !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
                          !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
                          !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
                          answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                          answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                          answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
                        )}
                      >
                        {getOptionLabel(i)}
                      </button>
                    );
                  })}
                </div>
                {tentative !== null && selected === null && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleConfirm}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                )}
                {selected !== null && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => advanceRound()}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
```

- [ ] **Step 2: Update the stage-complete modal**

Find the `showPlanComplete` modal block (around line 1476–1505). The current modal reads something like:
```typescript
      {showPlanComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface rounded-xl border border-brand-line p-6 max-w-sm w-full space-y-4 text-center">
            <h2 className="text-xl font-serif font-bold text-brand-ink">
              {showPlanComplete.isFinal ? '🎉 Plan complete!' : 'Stage complete!'}
            </h2>
            <p className="text-brand-secondary text-sm">
              {showPlanComplete.stageLabel} — {showPlanComplete.accuracy}%
            </p>
            ...
          </div>
        </div>
      )}
```

Update the heading text so "Plan complete!" becomes "Ladder complete!" when isFinal:
- Change `'🎉 Plan complete!'` → `'🎉 Ladder complete!'`

No other changes to the modal are needed — `stageLabel` is now set as `"Intervals · Beginner"` format from `handlePlanAdvance`, which already describes the completed skill + stage.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no output (clean). Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: replace Plan tab with per-skill dashboard grid"
```

---

## Self-Review

**Spec coverage:**
- ✅ 6 independent ladders (Intervals, Chords, Mixed, Melody, Fretboard, Rhythm)
- ✅ Pitch / Instrument grouping
- ✅ Frequency-based interval pools (Beginner: Minor 3rd, Major 3rd, P4, P5; Intermediate adds Major 2nd, Minor 6th, Major 6th, Minor 7th, Major 7th)
- ✅ Mixed unlock rule (same-tier Intervals + Chords required)
- ✅ Melody 4 tiers including Ears Only (melodyShowFirstNote: false)
- ✅ Melody 10 rounds / 80%, all others 20 rounds / 85%
- ✅ Dashboard grid UI (2-column, grouped, stage dots, Start button, locked notice)
- ✅ Practicing header with "← Back to Plan" link
- ✅ Stage-complete modal updated
- ✅ New localStorage key `'ear_training_plan_v2'`
- ✅ Rhythm plan advancement check added to handleRhythmComplete
- ✅ Melody plan advancement check added to handleMelodyComplete

**Placeholder scan:** No TBD or TODO items. All code is complete.

**Type consistency:**
- `LadderId`, `SkillLadder`, `LadderStage`, `PlanProgress` defined in Task 1, imported in Tasks 3 & 4 ✅
- `handlePlanStart(ladderId: LadderId)` signature matches all call sites ✅
- `handlePlanAdvance(accuracyFraction: number)` signature unchanged at call sites ✅
- `isMixedUnlocked(stageIndex: number, progress: PlanProgress)` matches Task 4 usage ✅
