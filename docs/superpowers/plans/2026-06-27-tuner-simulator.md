# Tuner Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tuner Simulator page at `/tuner` where users practice tuning a randomly out-of-tune virtual guitar by ear, with real-time Hz/cent feedback and 5-level increment controls.

**Architecture:** A self-contained `Tuner.tsx` page backed by a `tunerData.ts` data/utility module. Audio uses the existing Tone.js sampler via a new `playTunedString(baseHz, centsOffset)` function in `audio.ts`. Settings (tuning, detuning window, audio mode) persist to `localStorage`; per-string cent offsets are session-only.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tone.js, canvas-confetti, lucide-react

## Global Constraints

- `@` alias resolves to project root — use `@/src/...` for all aliased imports
- Tailwind v4 only — use brand CSS variables (`brand-primary`, `brand-ink`, `brand-surface`, `brand-sidebar`, `brand-line`, `brand-secondary`, `brand-bg`); no arbitrary color values except inside `style={}` props where needed
- No test framework in this project — verify each task with `npm run lint` (runs `tsc --noEmit`)
- Dark mode — all UI elements must include `dark:` variants; do not hardcode light-only colors
- `await initAudio()` must be called before any sampler use (browser autoplay policy); `playTunedString` handles this internally
- No `console.log` in production code
- `IN_TUNE_THRESHOLD = 1.5` cents — strings within ±1.5¢ count as in tune
- Celebration fires when all 6 strings are simultaneously in tune
- String display order: high E (index 5) at top, low E (index 0) at bottom

---

### Task 1: Add `playTunedString` to `audio.ts`

**Files:**
- Modify: `src/lib/audio.ts` — add one exported async function after `stopDrone`

**Interfaces:**
- Produces: `export async function playTunedString(baseHz: number, centsOffset: number, duration?: string): Promise<void>`

- [ ] **Step 1: Find the insertion point**

  Open `src/lib/audio.ts`. Locate the `stopDrone` function (around line 261). The new function goes immediately after the closing `}` of `stopDrone` and before `playStrum`.

- [ ] **Step 2: Add the function**

  Insert after `stopDrone`:

  ```typescript
  export async function playTunedString(
    baseHz: number,
    centsOffset: number,
    duration = '2n'
  ): Promise<void> {
    await initAudio();
    if (!sampler) return;
    const detunedHz = baseHz * Math.pow(2, centsOffset / 1200);
    sampler.triggerAttackRelease(`${detunedHz.toFixed(3)}hz`, duration);
  }
  ```

  Note: passing `"440.000hz"` as a string is the correct Tone.js format for raw Hz values. Do **not** use a plain number — Tone.js interprets plain numbers as MIDI note numbers, not Hz.

- [ ] **Step 3: Verify**

  ```bash
  npm run lint
  ```
  Expected: no type errors, no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/audio.ts
  git commit -m "feat: add playTunedString to audio.ts for tuner simulator"
  ```

---

### Task 2: Create `src/lib/tunerData.ts`

**Files:**
- Create: `src/lib/tunerData.ts`

**Interfaces:**
- Produces (all exported):
  ```typescript
  type TuningName
  type DetuneName
  interface TuningDef { name: TuningName; labels: [string×6]; hz: [number×6] }
  interface StringState { targetNote: string; targetHz: number; centsOffset: number }
  interface TunerSettings { tuning: TuningName; detuneWindowCents: number; audioMode: 'simultaneous' | 'sequential' }
  const TUNING_DEFS: TuningDef[]
  const DETUNE_WINDOWS: { Subtle: 15; Moderate: 30; Wild: 50 }
  const CENT_STEPS: readonly [0.5, 2, 5, 10, 20]
  const DEFAULT_SETTINGS: TunerSettings
  const IN_TUNE_THRESHOLD: 1.5
  function isInTune(centsOffset: number): boolean
  function displayHz(targetHz: number, centsOffset: number): string
  function randomizeOffsets(tuning: TuningDef, windowCents: number): StringState[]
  function getDetuneColors(centsOffset: number): { bar: string; text: string; row: string }
  ```

- [ ] **Step 1: Create the file**

  Create `src/lib/tunerData.ts` with this exact content:

  ```typescript
  export type TuningName =
    | 'Standard'
    | 'Drop D'
    | 'Open G'
    | 'Open D'
    | 'DADGAD'
    | 'Half Step Down'
    | 'Full Step Down';

  export interface TuningDef {
    name: TuningName;
    labels: [string, string, string, string, string, string];
    hz: [number, number, number, number, number, number];
  }

  export interface StringState {
    targetNote: string;
    targetHz: number;
    centsOffset: number;
  }

  export interface TunerSettings {
    tuning: TuningName;
    detuneWindowCents: number;
    audioMode: 'simultaneous' | 'sequential';
  }

  // Hz values pre-calculated at A4 = 440 Hz to avoid enharmonic note-name issues
  export const TUNING_DEFS: TuningDef[] = [
    {
      name: 'Standard',
      labels: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      hz: [82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
    },
    {
      name: 'Drop D',
      labels: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      hz: [73.42, 110.00, 146.83, 196.00, 246.94, 329.63],
    },
    {
      name: 'Open G',
      labels: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
      hz: [73.42, 98.00, 146.83, 196.00, 246.94, 293.66],
    },
    {
      name: 'Open D',
      labels: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
      hz: [73.42, 110.00, 146.83, 185.00, 220.00, 293.66],
    },
    {
      name: 'DADGAD',
      labels: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
      hz: [73.42, 110.00, 146.83, 196.00, 220.00, 293.66],
    },
    {
      name: 'Half Step Down',
      labels: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
      hz: [77.78, 103.83, 138.59, 185.00, 233.08, 311.13],
    },
    {
      name: 'Full Step Down',
      labels: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
      hz: [73.42, 98.00, 130.81, 174.61, 220.00, 293.66],
    },
  ];

  export const DETUNE_WINDOWS = { Subtle: 15, Moderate: 30, Wild: 50 } as const;
  export type DetuneName = keyof typeof DETUNE_WINDOWS;

  export const CENT_STEPS = [0.5, 2, 5, 10, 20] as const;

  export const DEFAULT_SETTINGS: TunerSettings = {
    tuning: 'Standard',
    detuneWindowCents: 30,
    audioMode: 'simultaneous',
  };

  export const IN_TUNE_THRESHOLD = 1.5;

  export function isInTune(centsOffset: number): boolean {
    return Math.abs(centsOffset) <= IN_TUNE_THRESHOLD;
  }

  export function displayHz(targetHz: number, centsOffset: number): string {
    return (targetHz * Math.pow(2, centsOffset / 1200)).toFixed(1);
  }

  export function randomizeOffsets(tuning: TuningDef, windowCents: number): StringState[] {
    return tuning.hz.map((hz, i) => {
      let offset: number;
      do {
        offset = (Math.random() * 2 - 1) * windowCents;
      } while (Math.abs(offset) < 2);
      return { targetNote: tuning.labels[i], targetHz: hz, centsOffset: offset };
    });
  }

  export function getDetuneColors(centsOffset: number): { bar: string; text: string; row: string } {
    const abs = Math.abs(centsOffset);
    if (abs <= IN_TUNE_THRESHOLD) {
      return {
        bar: 'bg-green-500',
        text: 'text-green-600 dark:text-green-400',
        row: 'border-green-400 bg-green-50 dark:bg-green-950/30',
      };
    }
    if (abs <= 6) {
      return {
        bar: 'bg-yellow-400',
        text: 'text-yellow-600 dark:text-yellow-400',
        row: 'border-brand-line',
      };
    }
    return {
      bar: 'bg-red-500',
      text: 'text-red-500 dark:text-red-400',
      row: 'border-brand-line',
    };
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/tunerData.ts
  git commit -m "feat: add tunerData.ts — types, tuning constants, and helpers for tuner simulator"
  ```

---

### Task 3: Create `src/pages/Tuner.tsx`

**Files:**
- Create: `src/pages/Tuner.tsx`

**Interfaces:**
- Consumes:
  - `playTunedString(baseHz: number, centsOffset: number, duration?: string): Promise<void>` from `@/src/lib/audio`
  - All named exports from `@/src/lib/tunerData`
  - `cn` from `@/src/lib/utils`
  - `confetti` (default import) from `canvas-confetti`
  - `RefreshCw, Play, Square` from `lucide-react`

**Behavior details:**
- `strings` state is indexed 0 (low E) → 5 (high E); display reverses this so high E renders at top
- In **simultaneous** mode: the per-row ▶ button calls `handlePlayAll` (strums all 6); `Play All` also calls `handlePlayAll`
- In **sequential** mode: the per-row ▶ button calls `playSingleString(realIdx)`; `Play All` plays strings 5→0 with 2000 ms between each
- `handlePlayAll` doubles as a Stop button when `isPlayingAll` is true — it sets `playingRef.current = false` to break the sequential loop
- `adjustOffset` clamps the result to `[−60, +60]`
- Celebration (`allInTune`) fires on `strings` change when every string satisfies `isInTune`; `allInTune` resets to `false` on any re-randomize or tuning change

- [ ] **Step 1: Create the file**

  Create `src/pages/Tuner.tsx`:

  ```tsx
  import React, { useState, useEffect, useRef } from 'react';
  import confetti from 'canvas-confetti';
  import { RefreshCw, Play, Square } from 'lucide-react';
  import { cn } from '@/src/lib/utils';
  import { playTunedString } from '@/src/lib/audio';
  import {
    TUNING_DEFS,
    DETUNE_WINDOWS,
    CENT_STEPS,
    DEFAULT_SETTINGS,
    IN_TUNE_THRESHOLD,
    isInTune,
    displayHz,
    randomizeOffsets,
    getDetuneColors,
    type TuningName,
    type TunerSettings,
    type StringState,
    type DetuneName,
  } from '@/src/lib/tunerData';

  const STORAGE_KEY = 'guitar_tuner_settings';

  function loadSettings(): TunerSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  }

  export function Tuner() {
    const [settings, setSettings] = useState<TunerSettings>(loadSettings);
    const [strings, setStrings] = useState<StringState[]>(() => {
      const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
      return randomizeOffsets(tuning, settings.detuneWindowCents);
    });
    const [allInTune, setAllInTune] = useState(false);
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const playingRef = useRef(false);

    // Persist settings on change
    useEffect(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    }, [settings]);

    // Detect all-in-tune and fire celebration
    useEffect(() => {
      if (!allInTune && strings.every(s => isInTune(s.centsOffset))) {
        setAllInTune(true);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
      }
    }, [strings, allInTune]);

    function reRandomize() {
      const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
      setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
      setAllInTune(false);
      playingRef.current = false;
      setIsPlayingAll(false);
    }

    function handleTuningChange(name: TuningName) {
      const tuning = TUNING_DEFS.find(t => t.name === name) ?? TUNING_DEFS[0];
      setSettings(s => ({ ...s, tuning: name }));
      setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
      setAllInTune(false);
    }

    function handleWindowChange(cents: number) {
      const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
      setSettings(s => ({ ...s, detuneWindowCents: cents }));
      setStrings(randomizeOffsets(tuning, cents));
      setAllInTune(false);
    }

    function adjustOffset(idx: number, delta: number) {
      setStrings(prev => prev.map((s, i) => {
        if (i !== idx) return s;
        return { ...s, centsOffset: Math.max(-60, Math.min(60, s.centsOffset + delta)) };
      }));
    }

    async function playSingleString(idx: number) {
      await playTunedString(strings[idx].targetHz, strings[idx].centsOffset, '1n');
    }

    async function handlePlayAll() {
      if (playingRef.current) {
        playingRef.current = false;
        setIsPlayingAll(false);
        return;
      }
      playingRef.current = true;
      setIsPlayingAll(true);
      try {
        if (settings.audioMode === 'simultaneous') {
          // Strum: low E (idx 0) → high E (idx 5), 20 ms stagger
          strings.forEach((s, i) => {
            setTimeout(() => {
              playTunedString(s.targetHz, s.centsOffset, '1n');
            }, i * 20);
          });
          await new Promise<void>(r => setTimeout(r, 2500));
        } else {
          // Sequential: high E (idx 5) → low E (idx 0), 2 s apart
          for (let i = 5; i >= 0; i--) {
            if (!playingRef.current) break;
            await playTunedString(strings[i].targetHz, strings[i].centsOffset, '1n');
            if (i > 0) await new Promise<void>(r => setTimeout(r, 2000));
          }
        }
      } finally {
        playingRef.current = false;
        setIsPlayingAll(false);
      }
    }

    // Render high E (idx 5) at top → low E (idx 0) at bottom
    const displayedStrings = [...strings].reverse();

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-brand-surface border border-brand-line">
          <h1 className="text-lg font-bold text-brand-ink font-serif mr-2">Tuner Simulator</h1>

          <select
            value={settings.tuning}
            onChange={e => handleTuningChange(e.target.value as TuningName)}
            className="px-3 py-1.5 rounded-md border border-brand-line bg-brand-bg text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          >
            {TUNING_DEFS.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>

          <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
            {(Object.entries(DETUNE_WINDOWS) as [DetuneName, number][]).map(([label, cents]) => (
              <button
                key={label}
                onClick={() => handleWindowChange(cents)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  settings.detuneWindowCents === cents
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
            {(['simultaneous', 'sequential'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSettings(s => ({ ...s, audioMode: mode }))}
                className={cn(
                  'px-3 py-1.5 capitalize transition-colors',
                  settings.audioMode === mode
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={reRandomize}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-line text-sm text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
            >
              <RefreshCw size={14} />
              Re-randomize
            </button>
            <button
              onClick={handlePlayAll}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isPlayingAll
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-brand-primary text-white hover:bg-brand-primary/90'
              )}
            >
              {isPlayingAll
                ? <><Square size={14} /> Stop</>
                : <><Play size={14} /> Play All</>}
            </button>
          </div>
        </div>

        {/* Celebration banner */}
        {allInTune && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-400">
            <div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">Guitar in tune!</p>
              <p className="text-sm text-green-600 dark:text-green-500">All strings within ±{IN_TUNE_THRESHOLD}¢</p>
            </div>
            <button
              onClick={reRandomize}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <RefreshCw size={14} />
              Tune Again
            </button>
          </div>
        )}

        {/* String rows — high E at top, low E at bottom */}
        <div className="space-y-2">
          {displayedStrings.map((s, displayIdx) => {
            const realIdx = strings.length - 1 - displayIdx;
            const colors = getDetuneColors(s.centsOffset);
            const inTune = isInTune(s.centsOffset);
            const isSharp = s.centsOffset > 0;
            // Fill bar: extends at most 50% from center (center = 0¢, edge = 60¢)
            const pct = Math.min(50, (Math.abs(s.centsOffset) / 60) * 50);

            return (
              <div
                key={realIdx}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border transition-colors',
                  colors.row
                )}
              >
                {/* Label */}
                <div className="w-12 shrink-0 text-center">
                  <div className="text-sm font-bold text-brand-ink">{s.targetNote}</div>
                  <div className="text-xs text-brand-secondary">str {realIdx + 1}</div>
                </div>

                {/* Hz */}
                <div className="w-24 shrink-0 text-right">
                  <span className="text-sm font-mono text-brand-ink">{displayHz(s.targetHz, s.centsOffset)} Hz</span>
                </div>

                {/* Deviation meter + label */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="relative h-3 bg-brand-sidebar rounded-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-brand-secondary/50 -translate-x-1/2" />
                    <div
                      className={cn('absolute top-0 bottom-0 transition-all duration-75', colors.bar)}
                      style={
                        inTune
                          ? { left: '48%', right: '48%' }
                          : isSharp
                            ? { left: '50%', width: `${pct}%` }
                            : { right: '50%', width: `${pct}%` }
                      }
                    />
                  </div>
                  <div className={cn('text-xs font-medium', colors.text)}>
                    {inTune
                      ? 'IN TUNE ✓'
                      : `${isSharp ? '+' : ''}${s.centsOffset.toFixed(1)}¢ ${isSharp ? 'SHARP' : 'FLAT'}`}
                  </div>
                </div>

                {/* Decrement buttons (gross → fine, right to left) */}
                <div className="flex gap-0.5 shrink-0">
                  {[...CENT_STEPS].reverse().map(step => (
                    <button
                      key={`dec-${step}`}
                      onClick={() => adjustOffset(realIdx, -step)}
                      className={cn(
                        'rounded text-xs font-mono border border-brand-line transition-colors',
                        'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                        step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                      )}
                    >
                      −{step}
                    </button>
                  ))}
                </div>

                {/* Increment buttons (fine → gross, left to right) */}
                <div className="flex gap-0.5 shrink-0">
                  {[...CENT_STEPS].map(step => (
                    <button
                      key={`inc-${step}`}
                      onClick={() => adjustOffset(realIdx, step)}
                      className={cn(
                        'rounded text-xs font-mono border border-brand-line transition-colors',
                        'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                        step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                      )}
                    >
                      +{step}
                    </button>
                  ))}
                </div>

                {/* Play button */}
                <button
                  onClick={() =>
                    settings.audioMode === 'simultaneous'
                      ? handlePlayAll()
                      : playSingleString(realIdx)
                  }
                  title={settings.audioMode === 'simultaneous' ? 'Play all strings (strum)' : 'Play this string'}
                  className="shrink-0 p-2 rounded-lg border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
                >
                  <Play size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-brand-secondary text-center pb-4">
          Use the increment buttons to tune by ear — listen for the beating to slow and stop as each string approaches its target pitch.
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/Tuner.tsx
  git commit -m "feat: add Tuner.tsx page — string rows, deviation meters, increment controls, celebration"
  ```

---

### Task 4: Wire `/tuner` route and nav link in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Tuner` named export from `./pages/Tuner`

- [ ] **Step 1: Add `Gauge` to the lucide-react import**

  Current import line (line 26):
  ```typescript
  import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock, Layers } from 'lucide-react';
  ```

  Replace with:
  ```typescript
  import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock, Layers, Gauge } from 'lucide-react';
  ```

- [ ] **Step 2: Add the NavLink**

  After the Scale Positions NavLink (around line 72–74), inside the `<nav className="flex gap-1">` element, add:

  ```tsx
  <NavLink title="Tuner" to="/tuner" className={({isActive}) => `p-2 rounded-md transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}>
    <Gauge size={18} />
  </NavLink>
  ```

- [ ] **Step 3: Add the page import**

  After the `import { ScalePositions } from './pages/ScalePositions';` line (around line 98), add:

  ```typescript
  import { Tuner } from './pages/Tuner';
  ```

- [ ] **Step 4: Add the route**

  After `<Route path="/scale-positions" element={<ScalePositions />} />` inside `<Routes>`, add:

  ```tsx
  <Route path="/tuner" element={<Tuner />} />
  ```

- [ ] **Step 5: Verify**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 6: Manual smoke test**

  Run `npm run dev`, open `http://localhost:3000/Guitar_Chords/tuner`. Verify:
  1. A `Gauge` icon appears in the nav bar; clicking it navigates to the Tuner page
  2. Six string rows render — `E4` at top, `E2` at bottom
  3. Each row shows a note label, Hz value, deviation bar, cent label, 10 increment buttons, and a ▶ button
  4. Clicking ▶ triggers audio (browser may require a prior interaction to unlock audio context)
  5. Clicking increment buttons updates the Hz display and moves the deviation bar
  6. Adjusting all 6 strings to within ±1.5¢ shows the green celebration banner and fires confetti
  7. "Re-randomize" and "Tune Again" buttons reset string states
  8. Tuning dropdown and window buttons (Subtle/Moderate/Wild) re-randomize strings
  9. Simultaneous/Sequential toggle persists across page refreshes

- [ ] **Step 7: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: wire /tuner route and nav link for tuner simulator"
  ```
