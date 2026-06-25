# Structured Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Plan" tab to Ear Training that walks the user through 11 fixed stages, auto-advancing when they hit 85% accuracy over 20 rounds, with progress persisted to localStorage.

**Architecture:** One new file (`src/lib/planProgress.ts`) holds all stage definitions and localStorage helpers. Two existing files change: `earTraining.ts` gains `'plan'` in the mode union; `EarTraining.tsx` gains plan state, handlers, and a full Plan tab UI. No new npm dependencies — `canvas-confetti` is already installed.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `canvas-confetti`.

## Global Constraints

- No new npm dependencies.
- `npm run lint` (tsc --noEmit) exits 0 after every task.
- localStorage key: `ear_training_plan`.
- Advancement threshold: `score.correct / score.total >= 0.85` AND `score.total >= 20`, checked after every round.
- Stage sequence: exactly the 11 stages in the spec table (index 0–10), in order.
- `canvas-confetti` burst on advance: `{ particleCount: 100, spread: 70, origin: { y: 0.6 } }`.
- Brand tokens only; exceptions: `text-green-500` for completed stages, `text-green-600` for threshold-met indicator.
- Stage complete modal copy: `"Stage complete!"` / `"Plan complete! 🎉"` for final stage.
- Continue button copy: `"Continue → {nextStageLabel}"` (not the current stage, the next one).
- Final-stage "Start over" resets `stageIndex` to 0 and `completedStages` to `{}`.

---

### Task 1: `src/lib/planProgress.ts` — data layer

**Files:**
- Create: `src/lib/planProgress.ts`

**Interfaces:**
- Produces (consumed by Task 3):
  ```typescript
  export interface PlanStage {
    label: string;
    mode: 'chord' | 'interval' | 'fretboard';
    difficulty: DifficultyLevel;
    subMode?: 'hunt' | 'sing';
  }

  export interface PlanProgress {
    stageIndex: number;
    completedStages: Record<number, { accuracy: number; completedAt: string }>;
  }

  export const PLAN_STAGES: PlanStage[]          // 11 entries, index 0–10
  export function loadPlanProgress(): PlanProgress
  export function savePlanProgress(p: PlanProgress): void
  export function resetPlanProgress(): void        // sets stageIndex:0, completedStages:{}
  ```

- [ ] **Step 1: Create `src/lib/planProgress.ts`**

Write the file with this exact content:

```typescript
import { DifficultyLevel } from './earTraining';

export interface PlanStage {
  label: string;
  mode: 'chord' | 'interval' | 'fretboard';
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
}

export interface PlanProgress {
  stageIndex: number;
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export const PLAN_STAGES: PlanStage[] = [
  { label: 'Intervals: Beginner',     mode: 'interval',  difficulty: 'Beginner' },
  { label: 'Intervals: Intermediate', mode: 'interval',  difficulty: 'Intermediate' },
  { label: 'Intervals: Advanced',     mode: 'interval',  difficulty: 'Advanced' },
  { label: 'Chords: Beginner',        mode: 'chord',     difficulty: 'Beginner' },
  { label: 'Chords: Intermediate',    mode: 'chord',     difficulty: 'Intermediate' },
  { label: 'Chords: Advanced',        mode: 'chord',     difficulty: 'Advanced' },
  { label: 'Fretboard: Beginner',     mode: 'fretboard', difficulty: 'Beginner' },
  { label: 'Fretboard: Intermediate', mode: 'fretboard', difficulty: 'Intermediate' },
  { label: 'Fretboard: Advanced',     mode: 'fretboard', difficulty: 'Advanced' },
  { label: 'Fretboard: Hunt',         mode: 'fretboard', difficulty: 'Advanced', subMode: 'hunt' },
  { label: 'Fretboard: Sing',         mode: 'fretboard', difficulty: 'Advanced', subMode: 'sing' },
];

const STORAGE_KEY = 'ear_training_plan';

const DEFAULT_PROGRESS: PlanProgress = { stageIndex: 0, completedStages: {} };

export function loadPlanProgress(): PlanProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, completedStages: {} };
    const parsed = JSON.parse(raw) as Partial<PlanProgress>;
    return {
      stageIndex: parsed.stageIndex ?? 0,
      completedStages: parsed.completedStages ?? {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS, completedStages: {} };
  }
}

export function savePlanProgress(p: PlanProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function resetPlanProgress(): PlanProgress {
  const fresh: PlanProgress = { stageIndex: 0, completedStages: {} };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
```

Note: `resetPlanProgress` returns the fresh progress object so the caller can update state in one call without a separate `loadPlanProgress()`.

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/planProgress.ts
git commit -m "feat: add plan progress data layer with PLAN_STAGES and localStorage helpers"
```

---

### Task 2: `src/lib/earTraining.ts` — add `'plan'` to mode union

**Files:**
- Modify: `src/lib/earTraining.ts` (line 16)

**Interfaces:**
- Consumes: nothing new
- Produces: `EarTrainingSettings.mode` now includes `'plan'`

- [ ] **Step 1: Extend the mode union**

Find line 16 in `src/lib/earTraining.ts`:

```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard';
```

Replace with:

```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan';
```

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0). TypeScript will infer the extended union correctly; `loadSettings` spreads over `DEFAULT_SETTINGS` which has `mode: 'chord'`, so no existing localStorage value breaks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add 'plan' to EarTrainingSettings mode union"
```

---

### Task 3: `src/pages/EarTraining.tsx` — plan state, handlers, and advancement logic

**Files:**
- Modify: `src/pages/EarTraining.tsx`

No visible UI change from this task — only logic. Lint is the verification gate.

**Interfaces:**
- Consumes from Task 1: `PlanProgress`, `PlanStage`, `PLAN_STAGES`, `loadPlanProgress`, `savePlanProgress`, `resetPlanProgress`
- Consumes from Task 2: `settings.mode === 'plan'` is now valid
- Produces (consumed by Task 4):
  - State: `planProgress`, `setPlanProgress`, `planPracticing`, `setPlanPracticing`, `showPlanComplete`, `setShowPlanComplete`
  - Handlers: `handlePlanMode()`, `handlePlanStart()`, `handlePlanAdvance(accuracy: number)`

- [ ] **Step 1: Add imports**

Find line 1–13 (existing imports). Add two new imports:

After line 2 (`import { Volume2, ChevronDown, ChevronUp, Headphones } from 'lucide-react';`), add:

```typescript
import { Check } from 'lucide-react';
import confetti from 'canvas-confetti';
```

After line 13 (`import { FretboardTrainer } from '../components/FretboardTrainer';`), add:

```typescript
import { PlanProgress, PlanStage, PLAN_STAGES, loadPlanProgress, savePlanProgress, resetPlanProgress } from '../lib/planProgress';
```

The full imports block at the top of the file will look like:

```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronDown, ChevronUp, Headphones } from 'lucide-react';
import { Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateFretboardRound, generateStudyDeck,
  makeFretboardRound, buildFretboardNotePool, playFretboardRound, playRoundAudio, playStudyCard, playOptionAudio,
} from '../lib/earTraining';
import { initAudio, playStrum, playNote, startDrone, stopDrone } from '../lib/audio';
import { FretboardTrainer } from '../components/FretboardTrainer';
import { PlanProgress, PlanStage, PLAN_STAGES, loadPlanProgress, savePlanProgress, resetPlanProgress } from '../lib/planProgress';
```

Note: the two lucide-react imports can be merged: `import { Volume2, ChevronDown, ChevronUp, Headphones, Check } from 'lucide-react';` — either form works; do whichever keeps existing lines unchanged.

- [ ] **Step 2: Add plan state declarations**

Find the existing state declarations block (lines 26–42). After the `deckKeyRef` line, add:

```typescript
  const [planProgress, setPlanProgress] = useState<PlanProgress>(loadPlanProgress);
  const [planPracticing, setPlanPracticing] = useState(false);
  const [showPlanComplete, setShowPlanComplete] = useState<{ accuracy: number; stageLabel: string; isFinal: boolean } | null>(null);
```

- [ ] **Step 3: Persist planProgress to localStorage**

Find the `useEffect` that saves settings (around line 67):

```typescript
  useEffect(() => { saveSettings(settings); }, [settings]);
```

Add a new `useEffect` immediately after it:

```typescript
  useEffect(() => { savePlanProgress(planProgress); }, [planProgress]);
```

- [ ] **Step 4: Update `advanceRound` to handle plan mode**

Find `advanceRound` (around line 105):

```typescript
  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus) {
    const activeFocus = focusOverride ?? fretboardFocus;
    let r: Round;
    if (s.mode === 'fretboard') {
      const note = nextFretboardNote(difficulty, activeFocus);
      r = makeFretboardRound(note, FRETS_FOR[difficulty]);
    } else {
      r = makeRound(s, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```

Replace with:

```typescript
  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus) {
    const activeFocus = focusOverride ?? fretboardFocus;
    const effectiveMode = s.mode === 'plan'
      ? PLAN_STAGES[planProgress.stageIndex].mode
      : s.mode;
    let r: Round;
    if (effectiveMode === 'fretboard') {
      const note = nextFretboardNote(difficulty, activeFocus);
      r = makeFretboardRound(note, FRETS_FOR[difficulty]);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```

- [ ] **Step 5: Add `handlePlanMode`, `handlePlanStart`, and `handlePlanAdvance`**

After `handleFretboardMode` (around line 143), add three new functions:

```typescript
  function handlePlanMode() {
    setSettings(s => ({ ...s, mode: 'plan' }));
    setPlanPracticing(false);
  }

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
    setScore(initialScore());
    deckRef.current = [];
    deckKeyRef.current = '';
    setPlanPracticing(true);
    advanceRound(next);
  }

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

- [ ] **Step 6: Add advancement check in `handleFretboardComplete`**

Find `handleFretboardComplete` (around line 150). The current last two lines are:

```typescript
    advanceRound();
  }
```

Change to compute new totals locally and check the threshold before advancing. Replace the full function:

```typescript
  function handleFretboardComplete(wasCorrect: boolean, huntResult?: HuntResult) {
    const typeKey = (round as FretboardRound).targetNote;
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(prev => ({
      correct: prev.correct + (wasCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: wasCorrect ? prev.streak + 1 : 0,
      byType: {
        ...prev.byType,
        [typeKey]: {
          correct: (prev.byType[typeKey]?.correct ?? 0) + (wasCorrect ? 1 : 0),
          total: (prev.byType[typeKey]?.total ?? 0) + 1,
        },
      },
      totalStars: huntResult ? (prev.totalStars ?? 0) + huntResult.stars : prev.totalStars,
      huntAttempts: huntResult ? [...(prev.huntAttempts ?? []), huntResult.attempts] : prev.huntAttempts,
    }));
    if (huntResult) {
      setBiasTally(prev => ({
        ...prev,
        [huntResult.direction]: prev[huntResult.direction] + 1,
      }));
    }
    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
      return;
    }
    advanceRound();
  }
```

- [ ] **Step 7: Add advancement check in `handleSelect`**

Find `handleSelect` (around line 217). Currently it ends with `setScore(prev => ({ ... }));`. Compute the new totals locally and add a plan check after.

Replace the entire `handleSelect` function:

```typescript
  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = round.kind === 'chord'
      ? (round as ChordRound).options[index].displayLabel === (round as ChordRound).correct.displayLabel
      : (round as IntervalRound).options[index].label === (round as IntervalRound).correct.label;

    const typeKey = round.kind === 'chord'
      ? (round as ChordRound).correct.typeLabel
      : (round as IntervalRound).correct.label;

    const newCorrect = score.correct + (isCorrect ? 1 : 0);
    const newTotal = score.total + 1;

    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
      byType: {
        ...prev.byType,
        [typeKey]: {
          correct: (prev.byType[typeKey]?.correct ?? 0) + (isCorrect ? 1 : 0),
          total: (prev.byType[typeKey]?.total ?? 0) + 1,
        },
      },
    }));

    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
    }
  }
```

Note: plan advancement in handleSelect fires immediately on the answer that crosses the threshold. The "Next →" button still appears (selected is set), so the user sees the feedback before the modal appears. The confetti + modal fire synchronously with the score update — this is intentional.

- [ ] **Step 8: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 9: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add plan state, handlers, and advancement checks to EarTraining"
```

---

### Task 4: `src/pages/EarTraining.tsx` — Plan tab UI, ladder, practice area, modal

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 3: all plan state and handlers
- Produces: fully functional Plan tab visible in the browser

- [ ] **Step 1: Add the Plan tab button to the mode tabs row**

Find the closing `</button>` of the Fretboard tab button (around line 326). Immediately after it (before `</div>` that closes the mode tabs row), add:

```tsx
        <button
          onClick={handlePlanMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'plan'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Plan
        </button>
```

- [ ] **Step 2: Hide the Settings panel in plan mode**

Find the Settings panel toggle button (around line 331):

```tsx
      <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
        <button
          onClick={() => setSettings(s => ({ ...s, settingsPanelOpen: !s.settingsPanelOpen }))}
```

Wrap the entire Settings `<div>` in a conditional so it only renders when not in plan mode. Find the outer container:

```tsx
      {/* Settings panel */}
      <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
```

Replace with:

```tsx
      {/* Settings panel */}
      {settings.mode !== 'plan' && (
      <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
```

Then find the closing `</div>` of the settings panel (the one that closes the outer settings container, just before `{/* Round area */}`). Add the closing `)}` after it:

```tsx
      </div>
      )}
```

- [ ] **Step 3: Add the plan ladder and practice area**

Find the main render branch (around line 537):

```tsx
      {/* Round area / Study view / Fretboard trainer */}
      {settings.mode === 'fretboard' ? (
```

Before this block, add the plan view. Insert the following JSX:

```tsx
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
                  isHuntMode={fretboardSubMode === 'hunt'}
                  singMode={fretboardSubMode === 'sing'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
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

- [ ] **Step 4: Update the score bar for plan mode**

Find the fixed score bar left div (around line 672):

```tsx
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-brand-ink">
              {score.correct}
              <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
            </span>
            {score.streak >= 2 && (
              <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
            )}
            {weakNotes.length > 0 && (
              <span className="text-brand-secondary">
                Weak: <span className="text-brand-ink font-medium">
                  {weakNotes.slice(0, 3).map(e => e.note.replace(/\d$/, '')).join(' · ')}
                </span>
              </span>
            )}
          </div>
```

Replace with (adds plan progress indicator, suppresses weak notes in plan mode):

```tsx
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-brand-ink">
              {score.correct}
              <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
            </span>
            {score.streak >= 2 && (
              <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
            )}
            {settings.mode === 'plan' && planPracticing ? (
              <span className={cn(
                'text-sm font-medium tabular-nums',
                score.total >= 20 && accuracy >= 85 ? 'text-green-600' : 'text-brand-secondary'
              )}>
                {score.total} / 20 rounds · {accuracy}%
              </span>
            ) : weakNotes.length > 0 && (
              <span className="text-brand-secondary">
                Weak: <span className="text-brand-ink font-medium">
                  {weakNotes.slice(0, 3).map(e => e.note.replace(/\d$/, '')).join(' · ')}
                </span>
              </span>
            )}
          </div>
```

Also update the "End Session" button to be hidden in plan mode. Find:

```tsx
          <button
            onClick={() => setShowSummary(true)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
          >
            End Session
          </button>
```

Replace with:

```tsx
          {settings.mode !== 'plan' && (
            <button
              onClick={() => setShowSummary(true)}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              End Session
            </button>
          )}
```

- [ ] **Step 5: Add the stage complete modal**

Find the session summary modal (around line 697):

```tsx
      {/* Session summary modal */}
      {showSummary && settings.mode !== 'study' && (
```

Before this block, add the plan complete modal:

```tsx
      {/* Plan stage complete modal */}
      {showPlanComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface rounded-xl border border-brand-line p-6 max-w-sm w-full space-y-4 text-center">
            <h2 className="text-xl font-serif font-bold text-brand-ink">
              {showPlanComplete.isFinal ? 'Plan complete! 🎉' : 'Stage complete!'}
            </h2>
            <p className="text-brand-secondary text-sm">
              {showPlanComplete.stageLabel} — {showPlanComplete.accuracy}% accuracy
            </p>
            {showPlanComplete.isFinal ? (
              <button
                onClick={() => {
                  setPlanProgress(resetPlanProgress());
                  setShowPlanComplete(null);
                }}
                className="w-full py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Start over
              </button>
            ) : (
              <button
                onClick={() => setShowPlanComplete(null)}
                className="w-full py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Continue → {PLAN_STAGES[planProgress.stageIndex].label}
              </button>
            )}
          </div>
        </div>
      )}
```

Note: when the Continue button renders, `planProgress.stageIndex` has already been incremented to the next stage by `handlePlanAdvance`, so `PLAN_STAGES[planProgress.stageIndex].label` correctly shows the next stage's label.

- [ ] **Step 6: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 7: Manual browser test**

```bash
npm run dev
```

Test the following scenarios:

1. **Ladder view**: Click **Plan** tab → see 11 stages, stage 1 (Intervals: Beginner) highlighted with a Start button, stages 2–11 dimmed.
2. **Start stage**: Click **Start** → fretboard focus selector disappears (Settings panel hidden), interval practice appears below the collapsed ladder banner. Score bar shows `0 / 20 rounds · 0%`.
3. **Practice**: Answer several interval questions correctly. Score bar updates live.
4. **Advance**: Answer enough correctly to reach 85% over 20 rounds → confetti fires → "Stage complete!" modal shows "Intervals: Beginner — X% accuracy" and "Continue → Intervals: Intermediate" button.
5. **Continue**: Click Continue → modal closes → full ladder re-expands → Intervals: Beginner shows ✓ with accuracy, Intervals: Intermediate is now current with Start button.
6. **Persistence**: Refresh the page → click Plan tab → progress is preserved.
7. **Other tabs unaffected**: Click Chord Recognition → chord practice works exactly as before. Click Plan → returns to plan view with preserved stage.
8. **View ladder while practicing**: Click Start on current stage → click "View ladder ↑" link in compact banner → full ladder re-expands. Click Start again → returns to practice.

- [ ] **Step 8: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add Plan tab UI, stage ladder, practice area, and stage complete modal"
```
