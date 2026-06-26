# Count It Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Count It" ear-training mode where the user sees rhythm notation, hears it played, and labels each rhythmic slot (note attack / rest / held) using a floating picker, then receives per-slot feedback.

**Architecture:** New `CountItTrainer` component renders a read-only `RhythmStaff` and an adaptive count grid below it. Each slot opens a floating N/R/H picker on click. On submit, user's slot labels are compared against the correct grid derived from `round.units` at adaptive resolution. The mode is wired into `EarTraining` alongside `'rhythm'`, sharing the existing `rhythmSettings` state and `RhythmRound` generation.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, VexFlow (via `RhythmStaff`), Tone.js (via existing `audio.ts`), `rhythmTraining.ts` utilities.

## Global Constraints

- `npm run lint` (tsc --noEmit) is the only static check — must pass after every task
- Tailwind v4, no config file; use `cn()` from `src/lib/utils.ts` for all conditional classes
- No new npm dependencies; reuse `RhythmStaff`, `staffMinWidth`, `initAudio`, `playRhythmRound`, `stopRhythm`
- `RhythmStaff` requires all four props: `round`, `placedUnits`, `feedback`, `onSwap`
- `SlotLabel` type: `'N' | 'R' | 'H'`
- Adaptive step: `0.25` if `'16'` in enabledDurations; `0.5` if `'8'` or `'qd'`; else `1.0`
- Base path is `/Guitar_Chords/` — no routing changes needed

---

## Task 1: Wire Count It mode into EarTraining

**Files:**
- Modify: `src/lib/earTraining.ts` — add `'count'` to mode union (line 18)
- Modify: `src/pages/EarTraining.tsx` — tab button, handlers, `advanceRound` branch, settings panel condition, placeholder render

**Interfaces:**
- Produces: `handleCountMode()`, `handleCountComplete(wasCorrect: boolean)` — consumed by Task 2's render wiring

---

- [ ] **Step 1: Add `'count'` to the mode union in `src/lib/earTraining.ts`**

  Line 18 currently reads:
  ```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed';
  ```
  Change it to:
  ```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count';
  ```

- [ ] **Step 2: Add `handleCountMode` and `handleCountComplete` in `src/pages/EarTraining.tsx`**

  After `handleMelodyComplete` (around line 296), insert:
  ```typescript
  function handleCountMode() {
    stopRhythm();
    const next = { ...settings, mode: 'count' as const };
    setSettings(next);
    advanceRound(next);
  }

  function handleCountComplete(wasCorrect: boolean) {
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    setTimeout(() => advanceRound(), 400);
  }
  ```

- [ ] **Step 3: Add `'count'` branch in `advanceRound` in `src/pages/EarTraining.tsx`**

  In `advanceRound`, after the `effectiveMode === 'melody'` block (around line 188–195) and before the `effectiveMode === 'mixed'` check, insert:
  ```typescript
  } else if (effectiveMode === 'count') {
    const rr = generateRhythmRound(difficulty, rhythmSettings);
    setSelected(null);
    setTentative(null);
    setRound(rr);
    roundStartTimeRef.current = Date.now();
    return;
  ```

- [ ] **Step 4: Add "Count It" tab button in `src/pages/EarTraining.tsx`**

  After the "Melody" `<button>` in the mode tab row (around line 680–690), add:
  ```tsx
  <button
    onClick={handleCountMode}
    className={cn(
      'flex-1 py-2.5 text-sm font-medium transition-colors',
      settings.mode === 'count'
        ? 'bg-brand-primary text-white'
        : 'text-brand-secondary hover:bg-brand-sidebar'
    )}
  >
    Count It
  </button>
  ```

- [ ] **Step 5: Show rhythm settings panel for Count It mode**

  Find the line (around line 913):
  ```tsx
  {settings.mode === 'rhythm' && (
  ```
  Change it to:
  ```tsx
  {(settings.mode === 'rhythm' || settings.mode === 'count') && (
  ```

- [ ] **Step 6: Add placeholder render for Count It in the non-plan render block**

  In the chain of `settings.mode === 'melody' ? ... : (` (around line 1476–1488), insert before the final `else` clause (the chord/interval quiz):
  ```tsx
  ) : settings.mode === 'count' ? (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-center text-brand-secondary text-sm">
      Count It — coming soon
    </div>
  ```

- [ ] **Step 7: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no TypeScript errors.

- [ ] **Step 8: Smoke-test visually**

  Run `npm run dev` and open the Ear Training page. Verify:
  - "Count It" tab appears at the end of the mode row
  - Clicking it shows "Count It — coming soon"
  - Switching back to Rhythm preserves settings
  - Settings panel (time sig, BPM, note types) appears for Count It

- [ ] **Step 9: Commit**

  ```bash
  git add src/lib/earTraining.ts src/pages/EarTraining.tsx
  git commit -m "feat: wire Count It mode into EarTraining with placeholder"
  ```

---

## Task 2: Build CountItTrainer and connect to EarTraining

**Files:**
- Create: `src/components/CountItTrainer.tsx`
- Modify: `src/pages/EarTraining.tsx` — import + replace placeholder

**Interfaces:**
- Consumes: `handleCountComplete(wasCorrect: boolean)` from Task 1
- Consumes: `RhythmStaff`, `staffMinWidth` from `src/components/RhythmStaff.tsx`
- Consumes: `initAudio`, `playRhythmRound`, `stopRhythm` from `src/lib/audio.ts`
- Consumes: `durationBeats`, `beatsPerMeasure`, `getCountLabel`, `RhythmRound`, `RhythmSettings` from `src/lib/rhythmTraining.ts`
- Consumes: `SessionScore` from `src/lib/earTraining.ts`
- Consumes: `cn` from `src/lib/utils.ts`

---

- [ ] **Step 1: Create `src/components/CountItTrainer.tsx`**

  Create the file with this complete content:

  ```typescript
  import React, { useEffect, useState, useCallback, useRef } from 'react';
  import { cn } from '../lib/utils';
  import {
    RhythmRound, RhythmSettings, RhythmDuration,
    durationBeats, beatsPerMeasure, getCountLabel,
  } from '../lib/rhythmTraining';
  import { SessionScore } from '../lib/earTraining';
  import { initAudio, playRhythmRound, stopRhythm } from '../lib/audio';
  import { RhythmStaff, staffMinWidth } from './RhythmStaff';

  type SlotLabel = 'N' | 'R' | 'H';

  interface CountItTrainerProps {
    round: RhythmRound;
    score: SessionScore;
    settings: RhythmSettings;
    onComplete: (wasCorrect: boolean) => void;
  }

  function getAdaptiveStep(enabledDurations: RhythmDuration[]): number {
    if (enabledDurations.includes('16')) return 0.25;
    if (enabledDurations.includes('8') || enabledDurations.includes('qd')) return 0.5;
    return 1.0;
  }

  export function CountItTrainer({ round, score, settings, onComplete }: CountItTrainerProps) {
    const step = getAdaptiveStep(settings.enabledDurations);
    const totalBeats = beatsPerMeasure(round.timeSignature) * round.measures;
    const totalSlots = Math.round(totalBeats / step);

    const correctLabels: SlotLabel[] = round.units.flatMap(u => {
      const n = Math.round(durationBeats(u.duration) / step);
      if (u.isRest) return Array<SlotLabel>(n).fill('R');
      return ['N' as SlotLabel, ...Array<SlotLabel>(n - 1).fill('H')];
    });

    const slots = Array.from({ length: totalSlots }, (_, i) => ({
      pos: i * step,
      label: getCountLabel(i * step, round.timeSignature),
      widthPct: (step / totalBeats) * 100,
    }));

    const [userLabels, setUserLabels] = useState<(SlotLabel | null)[]>(() => Array(totalSlots).fill(null));
    const [pickerIdx, setPickerIdx] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<('correct' | 'wrong')[] | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePlay = useCallback(() => {
      setActiveUnitIdx(null);
      initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
    }, [round, settings.enableLeadIn]);

    useEffect(() => {
      setUserLabels(Array(totalSlots).fill(null));
      setFeedback(null);
      setAttempts(0);
      setPickerIdx(null);
      setActiveUnitIdx(null);
      initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
      return () => stopRhythm();
    }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close picker on outside click
    useEffect(() => {
      if (pickerIdx === null) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setPickerIdx(null);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [pickerIdx]);

    function handleSlotClick(i: number) {
      if (feedback) return;
      setPickerIdx(prev => (prev === i ? null : i));
    }

    function handlePickLabel(i: number, label: SlotLabel) {
      setUserLabels(prev => {
        const next = [...prev];
        next[i] = label;
        return next;
      });
      setPickerIdx(null);
    }

    const allFilled = userLabels.every(l => l !== null);
    const unlabeledCount = userLabels.filter(l => l === null).length;

    function handleSubmit() {
      if (!allFilled || feedback) return;
      setAttempts(a => a + 1);
      const fb = userLabels.map((ul, i) =>
        (ul === correctLabels[i] ? 'correct' : 'wrong') as 'correct' | 'wrong'
      );
      setFeedback(fb);
    }

    function handleTryAgain() {
      setUserLabels(Array(totalSlots).fill(null));
      setFeedback(null);
    }

    function handleNext() {
      const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
      const wasCorrect = attempts === 1 && allCorrect;
      stopRhythm();
      setActiveUnitIdx(null);
      onComplete(wasCorrect);
    }

    return (
      <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
        {/* Score badge */}
        <div className="flex items-center justify-between text-xs text-brand-secondary">
          <span>Round {score.total + 1}</span>
          <span>{score.correct}/{score.total} correct</span>
        </div>

        {/* Staff + count grid in shared horizontal scroll */}
        <div className="overflow-x-auto" ref={containerRef}>
          <div style={{ minWidth: staffMinWidth(round, round.units) }} className="relative">
            <RhythmStaff
              round={round}
              placedUnits={round.units}
              feedback={null}
              onSwap={() => {}}
            />

            {/* Count grid */}
            <div className="flex font-mono select-none">
              {slots.map((slot, i) => {
                const ul = userLabels[i];
                const fb = feedback?.[i];
                const isPickerOpen = pickerIdx === i;
                const correctLabel = feedback ? correctLabels[i] : null;

                // Determine display label text
                let displayLabel = slot.label;
                if (ul === 'R') displayLabel = `[${slot.label}]`;
                else if (ul === 'H') displayLabel = `(${slot.label})`;

                // Slot background + text color
                const slotClass = fb === 'correct'
                  ? 'bg-green-500/20 text-green-700 dark:text-green-400 font-bold'
                  : fb === 'wrong'
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-bold'
                    : ul === 'N'
                      ? 'bg-brand-primary/15 text-brand-primary font-bold'
                      : ul === 'R'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : ul === 'H'
                          ? 'bg-brand-line/20 text-brand-secondary italic'
                          : 'text-brand-line';

                return (
                  <div
                    key={i}
                    style={{ width: `${slot.widthPct}%` }}
                    className={cn(
                      'relative text-center text-[11px] leading-none py-1 border border-transparent',
                      slotClass,
                      !feedback && 'cursor-pointer hover:border-brand-primary/40 rounded',
                      feedback && 'cursor-default',
                    )}
                    onClick={() => handleSlotClick(i)}
                  >
                    <span className="block truncate">{displayLabel}</span>

                    {/* Correct answer hint on wrong slots */}
                    {fb === 'wrong' && correctLabel && (
                      <span className="block text-[9px] text-green-600 font-normal not-italic">
                        {correctLabel === 'R'
                          ? `[${slot.label}]`
                          : correctLabel === 'H'
                            ? `(${slot.label})`
                            : slot.label}
                      </span>
                    )}

                    {/* Floating picker */}
                    {isPickerOpen && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 flex gap-1 bg-brand-surface border border-brand-line rounded-lg shadow-lg p-1">
                        {(['N', 'R', 'H'] as SlotLabel[]).map(opt => (
                          <button
                            key={opt}
                            onMouseDown={e => { e.preventDefault(); handlePickLabel(i, opt); }}
                            className={cn(
                              'w-8 h-8 rounded-md text-xs font-bold border transition-colors',
                              ul === opt && opt === 'N' && 'bg-brand-primary text-white border-brand-primary',
                              ul === opt && opt === 'R' && 'bg-amber-500 text-white border-amber-500',
                              ul === opt && opt === 'H' && 'bg-brand-secondary/70 text-white border-brand-secondary',
                              ul !== opt && 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status line */}
        {!feedback && (
          <p className="text-xs text-brand-secondary text-center">
            {unlabeledCount > 0
              ? `${unlabeledCount} slot${unlabeledCount === 1 ? '' : 's'} unlabeled — click a slot to label it`
              : 'All slots labeled — ready to submit'}
          </p>
        )}

        {/* Feedback summary */}
        {feedback && (
          <p className={cn(
            'text-sm font-semibold text-center',
            feedback.every(f => f === 'correct') ? 'text-green-600' : 'text-red-500',
          )}>
            {feedback.every(f => f === 'correct') ? 'Correct! 🎯' : 'Not quite — slots highlighted above'}
          </p>
        )}

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handlePlay}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            ▶ Play
          </button>
          {allFilled && !feedback && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Submit
            </button>
          )}
          {feedback && !feedback.every(f => f === 'correct') && (
            <button
              onClick={handleTryAgain}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
            >
              Try Again
            </button>
          )}
          {feedback && (
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Import `CountItTrainer` in `src/pages/EarTraining.tsx`**

  After the existing `import { MelodyTrainer } from '../components/MelodyTrainer';` line, add:
  ```typescript
  import { CountItTrainer } from '../components/CountItTrainer';
  ```

- [ ] **Step 3: Replace placeholder with `<CountItTrainer>` in `src/pages/EarTraining.tsx`**

  Find the placeholder added in Task 1:
  ```tsx
  ) : settings.mode === 'count' ? (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-center text-brand-secondary text-sm">
      Count It — coming soon
    </div>
  ```
  Replace with:
  ```tsx
  ) : settings.mode === 'count' ? (
    round.kind === 'rhythm' ? (
      <CountItTrainer
        round={round as RhythmRound}
        score={score}
        settings={rhythmSettings}
        onComplete={handleCountComplete}
      />
    ) : (
      <RhythmRoundLoader onLoad={() => advanceRound()} />
    )
  ```

- [ ] **Step 4: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no TypeScript errors.

- [ ] **Step 5: Visual test — golden path**

  Run `npm run dev` and test:
  1. Click "Count It" tab → rhythm generates and staff renders with full notation
  2. Rhythm auto-plays on load; ▶ Play replays it
  3. Click any slot → floating N/R/H picker appears above it
  4. Click N → slot turns blue, label bold; picker closes
  5. Click R → slot turns amber, label becomes `[1+]`; picker closes
  6. Click H → slot turns gray, label becomes `(1+)` italic; picker closes
  7. Clicking outside the grid closes the picker
  8. Clicking an already-labeled slot reopens picker with current label highlighted
  9. Status line shows "X slots unlabeled" counting down to "All slots labeled"
  10. Submit button appears only when all slots are labeled
  11. Submit with wrong answers → red slots + green correct-answer hint below
  12. Submit with all correct → green slots + "Correct! 🎯"
  13. Try Again clears all labels
  14. Next → advances to a new round
  15. Settings changes (BPM, time sig, note types) take effect on the next round

- [ ] **Step 6: Visual test — edge cases**

  1. With only quarter notes enabled: 4 slots per measure, no 8th/16th positions
  2. With 16ths enabled: 16 slots per measure; narrow slots still show pickers correctly
  3. With 2 measures: horizontal scroll works; staff and count grid scroll together
  4. Picker on the first slot (leftmost): picker doesn't overflow left edge of container
  5. Dark mode: slot colors and picker remain readable

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/CountItTrainer.tsx src/pages/EarTraining.tsx
  git commit -m "feat: add Count It rhythm mode with adaptive count grid and slot picker"
  ```
