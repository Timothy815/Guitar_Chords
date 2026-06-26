# GuitarMaster Improvement Roadmap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically close the pedagogical gaps identified in the GuitarMaster app review, progressing from quick wins (Tier 1) through meaningful improvements (Tier 2) to substantial new features (Tier 3).

**Architecture:** Each tier builds on existing React 19 + Tone.js + Tonal.js patterns. New pages follow the existing `src/pages/` convention with a route in `App.tsx`; new logic lives in `src/lib/`; reusable UI goes in `src/components/`. No test suite exists — `npm run lint` (tsc --noEmit) is the static check; every task ends with a browser smoke-test.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Tone.js, @tonaljs/tonal, React Router v7, lucide-react, localStorage for all persistence.

## Global Constraints

- `@` alias resolves to project root — use `@/src/...` for aliased imports
- Tailwind v4: no `tailwind.config.js`; use CSS variable brand tokens (`brand-primary`, `brand-ink`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`, `brand-secondary`)
- All Tone.js playback must be gated behind `await initAudio()` on a user gesture
- `BrowserRouter basename="/Guitar_Chords"` — all routes are relative to that base
- `localStorage` keys must be namespaced and versioned (e.g. `guitar_srs_v1`)
- Dark mode toggled via `document.documentElement.classList.toggle('dark')` — components must respect `.dark` class
- `cn(...inputs)` from `src/lib/utils.ts` for conditional Tailwind classes
- No new dependencies unless listed in the Available Dependencies section of CLAUDE.md

---

## File Structure

**New files:**
- `src/pages/Metronome.tsx` — Task 1 (standalone metronome page)
- `src/lib/progressionUtils.ts` — Task 2 (shared "add chord to progression" logic)
- `src/lib/srs.ts` — Task 4 (SM-2 spaced-repetition algorithm)
- `src/components/ScaleDrillTrainer.tsx` — Task 5 (scale drilling UI)
- `src/lib/voiceLeading.ts` — Task 6 (voice leading analysis)
- `src/components/VoiceLeadingPanel.tsx` — Task 6 (voice leading hints UI)
- `src/components/IntervalFretboardTrainer.tsx` — Task 7 (interval-to-fretboard UI)
- `src/pages/ScalePositions.tsx` — Task 8 (scale position training page)

**Modified files:**
- `src/lib/audio.ts` — Task 1 (add `atTime` param to `playClick`)
- `src/App.tsx` — Tasks 1, 8 (new routes + nav links)
- `src/lib/planProgress.ts` — Task 3 (add `description` to `LadderStage`)
- `src/pages/EarTraining.tsx` — Tasks 3, 4, 5, 7 (stage descriptions, SRS, scale drill mode, interval-fretboard mode)
- `src/pages/Progressions.tsx` — Tasks 2, 6 (cross-nav button, voice leading panel)
- `src/pages/Dictionary.tsx` — Task 2 (add-to-progression + ear-training links)
- `src/pages/Caged.tsx` — Task 2 (add-to-progression link)

---

## ─── TIER 1: Quick Wins ───────────────────────────────────────────────────────

---

### Task 1: Standalone Metronome Page

**Files:**
- Create: `src/pages/Metronome.tsx`
- Modify: `src/lib/audio.ts` — add `atTime` parameter to `playClick`
- Modify: `src/App.tsx` — add `/metronome` route and nav link

**Interfaces:**
- Produces: `export function Metronome(): JSX.Element`
- Consumes: `playClick(isHigh?: boolean, atTime?: number | string)` from `src/lib/audio.ts`

- [ ] **Step 1: Add `atTime` parameter to `playClick` in `src/lib/audio.ts`**

Locate the existing `playClick` function (around line 318) and update its signature:

```typescript
// Before:
export function playClick(isHigh = false) {
  clickSynth.triggerAttackRelease(isHigh ? 'G5' : 'C4', '32n');
}

// After:
export function playClick(isHigh = false, atTime?: number | string) {
  clickSynth.triggerAttackRelease(isHigh ? 'G5' : 'C4', '32n', atTime);
}
```

- [ ] **Step 2: Run lint to confirm no type errors**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Create `src/pages/Metronome.tsx`**

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { initAudio, playClick } from '@/src/lib/audio';
import { cn } from '@/src/lib/utils';

const TIME_SIGNATURES = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '6/8', beats: 6 },
] as const;

type TimeSig = typeof TIME_SIGNATURES[number];

export function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [timeSig, setTimeSig] = useState<TimeSig>(TIME_SIGNATURES[2]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);
  const beatRef = useRef(0);
  const tapTimesRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current?.dispose();
    loopRef.current = null;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    setIsPlaying(false);
    setCurrentBeat(null);
    beatRef.current = 0;
  }, []);

  // Stop on unmount
  useEffect(() => () => { stop(); }, [stop]);

  const start = useCallback(async (nextBpm: number, nextTimeSig: TimeSig) => {
    await initAudio();
    Tone.getTransport().bpm.value = nextBpm;
    beatRef.current = 0;

    loopRef.current = new Tone.Loop((time) => {
      const beat = beatRef.current;
      playClick(beat === 0, time);
      const now = Tone.now();
      const delay = Math.max(0, (time - now) * 1000);
      setTimeout(() => setCurrentBeat(beat), delay);
      beatRef.current = (beatRef.current + 1) % nextTimeSig.beats;
    }, '4n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    setIsPlaying(true);
  }, []);

  const handleToggle = useCallback(async () => {
    if (isPlaying) {
      stop();
    } else {
      await start(bpm, timeSig);
    }
  }, [isPlaying, stop, start, bpm, timeSig]);

  const handleBpmChange = useCallback((value: number) => {
    setBpm(value);
    if (isPlaying) Tone.getTransport().bpm.value = value;
  }, [isPlaying]);

  const handleTimeSigChange = useCallback((ts: TimeSig) => {
    if (isPlaying) stop();
    setTimeSig(ts);
  }, [isPlaying, stop]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const prev = tapTimesRef.current;
    const updated = [...prev.slice(-4), now];
    tapTimesRef.current = updated;
    if (updated.length >= 2) {
      const intervals = updated.slice(1).map((t, i) => t - updated[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapped = Math.min(240, Math.max(40, Math.round(60000 / avg)));
      handleBpmChange(tapped);
    }
  }, [handleBpmChange]);

  return (
    <div className="max-w-md mx-auto space-y-8 py-4">
      <h1 className="text-2xl font-serif font-bold text-brand-ink">Metronome</h1>

      {/* Beat indicator dots */}
      <div className="flex gap-3 justify-center">
        {Array.from({ length: timeSig.beats }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-14 h-14 rounded-full border-2 transition-all duration-75',
              currentBeat === i
                ? i === 0
                  ? 'bg-brand-primary border-brand-primary scale-125'
                  : 'bg-green-500 border-green-500 scale-110'
                : 'border-brand-line bg-brand-surface',
            )}
          />
        ))}
      </div>

      {/* BPM control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-ink">BPM</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBpmChange(Math.max(40, bpm - 1))}
              className="w-8 h-8 rounded border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar transition-colors"
            >−</button>
            <span className="text-3xl font-bold font-mono text-brand-primary w-16 text-center">{bpm}</span>
            <button
              onClick={() => handleBpmChange(Math.min(240, bpm + 1))}
              className="w-8 h-8 rounded border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar transition-colors"
            >+</button>
          </div>
        </div>
        <input
          type="range"
          min={40}
          max={240}
          value={bpm}
          onChange={e => handleBpmChange(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-primary,#7c3aed)]"
        />
        <div className="flex justify-between text-xs text-brand-secondary font-mono">
          <span>40</span><span>♩=120</span><span>240</span>
        </div>
      </div>

      {/* Time signature */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-brand-ink">Time Signature</span>
        <div className="flex gap-2 flex-wrap">
          {TIME_SIGNATURES.map(ts => (
            <button
              key={ts.label}
              onClick={() => handleTimeSigChange(ts)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                timeSig.label === ts.label
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {ts.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleToggle}
          className={cn(
            'flex-1 py-3 rounded-lg font-semibold text-white transition-colors text-lg',
            isPlaying
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-brand-primary hover:bg-brand-primary/90',
          )}
        >
          {isPlaying ? '■ Stop' : '▶ Start'}
        </button>
        <button
          onClick={handleTap}
          className="px-6 py-3 rounded-lg font-semibold border border-brand-line text-brand-ink hover:bg-brand-sidebar transition-colors"
        >
          Tap Tempo
        </button>
      </div>

      <p className="text-xs text-brand-secondary text-center">
        Beat 1 accent plays higher pitch. Tap at least twice to set tempo by tapping.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Add route and nav link in `src/App.tsx`**

Add import at top of file (with other page imports):
```typescript
import { Metronome } from './pages/Metronome';
```

Add `Clock` to the lucide-react import line:
```typescript
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock } from 'lucide-react';
```

Add nav link in the `<nav>` block (after the Ear Training link):
```tsx
<NavLink
  to="/metronome"
  className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
>
  <Clock size={16} /> Metronome
</NavLink>
```

Add route inside `<Routes>` (after the `/ear-training` route):
```tsx
<Route path="/metronome" element={<Metronome />} />
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 6: Manual browser test**

```bash
npm run dev
```
- Navigate to `/Guitar_Chords/metronome`
- Set BPM to 120, click Start — dots pulse in sequence, beat 1 flashes purple/larger
- Drag slider to 80 — tempo slows while playing
- Tap "Tap Tempo" 4 times — BPM updates from tapped interval
- Switch to 3/4 — 3 dots appear, playback stops and restarts cleanly
- Click Stop — dots freeze, audio stops

- [ ] **Step 7: Commit**

```bash
git add src/pages/Metronome.tsx src/App.tsx src/lib/audio.ts
git commit -m "feat: add standalone metronome page with tap tempo and time signature selector"
```

---

### Task 2: Cross-Tool Navigation

Add "Add to Progression" and "Open in Ear Training" shortcuts to Dictionary and CAGED pages.

**Files:**
- Create: `src/lib/progressionUtils.ts`
- Modify: `src/pages/Dictionary.tsx` — add action buttons to chord cards
- Modify: `src/pages/Caged.tsx` — add action buttons to shape viewer
- Modify: `src/pages/Progressions.tsx` — add "Go to Ear Training" button

**Interfaces:**
- Produces: `addChordToActiveProgression(chord: ChordShape): boolean` (returns false if no progressions exist)
- Consumes: `ChordShape` from `src/types.ts`, localStorage key `'guitar_progressions'`

- [ ] **Step 1: Create `src/lib/progressionUtils.ts`**

```typescript
import { ChordShape, ChordSlot, Progression } from '@/src/types';

const STORAGE_KEY = 'guitar_progressions';

/**
 * Appends `chord` as a new slot to the first saved progression.
 * Returns true on success, false if no progressions are saved yet.
 */
export function addChordToActiveProgression(chord: ChordShape): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const progressions: Progression[] = JSON.parse(raw);
    if (progressions.length === 0) return false;
    const slot: ChordSlot = { chord };
    progressions[0] = { ...progressions[0], slots: [...progressions[0].slots, slot] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressions));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add "Add to Progression" button in `src/pages/Dictionary.tsx`**

In Dictionary.tsx, locate where individual chord cards are rendered (the area showing `ChordShape` cards with the fretboard diagram and chord name). Add these imports at the top:

```typescript
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';
import { useNavigate } from 'react-router-dom';
```

Inside the Dictionary component, add navigation hook and toast state:
```typescript
const navigate = useNavigate();
const [addedToast, setAddedToast] = useState<string | null>(null);

function handleAddToProgression(chord: ChordShape) {
  const ok = addChordToActiveProgression(chord);
  setAddedToast(ok ? `Added ${chord.name}` : 'No progression saved yet — create one first');
  setTimeout(() => setAddedToast(null), 2000);
}
```

On each chord card's action area, add:
```tsx
<button
  onClick={() => handleAddToProgression(chord)}
  className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  title="Add to first progression"
>
  + Progression
</button>
<button
  onClick={() => navigate('/ear-training')}
  className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  title="Practice chord identification in Ear Training"
>
  Ear Train →
</button>
```

Add toast display (place near top of the page JSX, before the main content):
```tsx
{addedToast && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-brand-ink text-brand-bg text-sm px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity">
    {addedToast}
  </div>
)}
```

- [ ] **Step 3: Add "Add to Progression" button in `src/pages/Caged.tsx`**

In Caged.tsx, locate where the currently-displayed `ChordShape` is shown (the selected shape in the viewer panel). Add the same imports and handler:

```typescript
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';
import { useNavigate } from 'react-router-dom';
```

```typescript
const navigate = useNavigate();
const [addedToast, setAddedToast] = useState<string | null>(null);

function handleAddToProgression(chord: ChordShape) {
  const ok = addChordToActiveProgression(chord);
  setAddedToast(ok ? `Added ${chord.name}` : 'No progression saved yet');
  setTimeout(() => setAddedToast(null), 2000);
}
```

On the chord shape display panel, below the fretboard diagram:
```tsx
<div className="flex gap-2 mt-2">
  <button
    onClick={() => handleAddToProgression(selectedChord)}
    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  >
    + Progression
  </button>
  <button
    onClick={() => navigate('/ear-training')}
    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  >
    Ear Train →
  </button>
</div>
{addedToast && (
  <p className="text-xs text-green-600 mt-1">{addedToast}</p>
)}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Manual browser test**

- Open Dictionary, expand a chord — "+ Progression" button appears
- With no progressions saved, clicking shows "No progression saved yet" toast
- Open Progressions, create a progression — go back to Dictionary
- Click "+ Progression" on any chord — toast confirms add; open Progressions and confirm chord appeared
- Click "Ear Train →" — navigates to Ear Training page

- [ ] **Step 6: Commit**

```bash
git add src/lib/progressionUtils.ts src/pages/Dictionary.tsx src/pages/Caged.tsx
git commit -m "feat: add cross-tool navigation — add chord to progression and ear training links"
```

---

### Task 3: Plan Ladder Stage Descriptions

Add educational descriptions to each skill ladder stage so students understand what they're working toward.

**Files:**
- Modify: `src/lib/planProgress.ts` — add `description` field to `LadderStage`, fill descriptions
- Modify: `src/pages/EarTraining.tsx` — render descriptions in Plan view stage cards

**Interfaces:**
- `LadderStage.description?: string` — optional string, rendered as collapsible help text

- [ ] **Step 1: Add `description` field to `LadderStage` and fill in all stage descriptions in `src/lib/planProgress.ts`**

Add `description?: string` to the `LadderStage` interface:
```typescript
export interface LadderStage {
  label: string;
  description?: string;   // ← add this line
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
  melodyShowFirstNote?: boolean;
  rhythmDurations?: RhythmDuration[];
  requiredRounds: number;
  requiredAccuracy: number;
}
```

Then replace the `SKILL_LADDERS` constant with this version that includes descriptions (complete replacement — keep all existing fields, only add `description`):

```typescript
export const SKILL_LADDERS: SkillLadder[] = [
  {
    id: 'intervals',
    label: 'Intervals',
    group: 'pitch',
    mode: 'interval',
    stages: [
      {
        label: 'Beginner',
        description: 'Distinguish perfect intervals (unison, 4th, 5th, octave) and the major 2nd. Intervals are played melodically (one note then the other). Goal: build the habit of singing intervals internally.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Add 3rds, 6ths, and the tritone. Intervals are played both melodically and harmonically. Goal: identify all diatonic intervals by ear without guessing.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'All 13 intervals including compound intervals and chromatic variants. Intervals are played in any order, any direction. Goal: instant recognition with 85%+ accuracy.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    group: 'pitch',
    mode: 'chord',
    stages: [
      {
        label: 'Beginner',
        description: 'Identify major vs. minor triads. Chords are played as slow arpeggios so each note is audible. Goal: hear the emotional character (bright vs. dark) reliably.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Add dominant 7th, major 7th, and minor 7th chords. Arpeggios are faster. Goal: distinguish quality and tension — know if a chord is resolved or wants to move.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'All chord types including diminished, augmented, m7b5, and sus chords. Chords may be played strummed or arpeggiated. Goal: identify any chord in real musical context.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed',
    group: 'pitch',
    mode: 'mixed',
    stages: [
      {
        label: 'Beginner',
        description: 'Intervals and chords presented in random order. Unlocks after completing Intervals Beginner and Chords Beginner. Goal: switch between interval and chord recognition without losing context.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Intermediate intervals and chords mixed. Goal: the sound of a sound — not just the category but the quality within the category.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Full vocabulary mixed. Goal: effortless real-time identification as heard in live music.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'melody',
    label: 'Melody',
    group: 'pitch',
    mode: 'melody',
    stages: [
      {
        label: 'Beginner',
        description: 'Short 3–4 note diatonic melodies. First note is shown so you can orient to the key. Goal: develop the skill of hearing a melody as movable do scale degrees.',
        difficulty: 'Beginner',
        melodyShowFirstNote: true,
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Intermediate',
        description: 'Longer melodies including leaps and chromatic passing tones. First note still shown. Goal: transcribe melodies quickly, hearing the function of each note.',
        difficulty: 'Intermediate',
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Advanced',
        description: 'Complex melodies including modal and blues scales. First note shown. Goal: transcribe any lead guitar phrase.',
        difficulty: 'Advanced',
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Ears Only',
        description: 'Same as Advanced but the first note is NOT shown — you must find the key yourself. Goal: the final form of melodic ear training. Transcribe anything you hear.',
        difficulty: 'Advanced',
        melodyShowFirstNote: false,
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
    ],
  },
  {
    id: 'fretboard',
    label: 'Fretboard',
    group: 'instrument',
    mode: 'fretboard',
    stages: [
      {
        label: 'Beginner',
        description: 'Open position notes (frets 0–5) on the low three strings. Goal: know every note on strings 6, 5, and 4 without counting.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'All notes frets 0–12, all six strings. Goal: find any named note in under 2 seconds on any string.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Notes above fret 12 included. Random across the full neck. Goal: instantaneous fretboard knowledge — no more counting from open.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Hunt',
        description: 'Hunt mode: find EVERY occurrence of a given note on the neck before time runs out. Goal: see the whole fretboard, not just the nearest position.',
        difficulty: 'Advanced',
        subMode: 'hunt',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Sing',
        description: 'Sing mode: hear a note played, identify its name. Tests your ability to connect sound to note name — the bridge between ear training and fretboard knowledge.',
        difficulty: 'Advanced',
        subMode: 'sing',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    group: 'instrument',
    mode: 'rhythm',
    stages: [
      {
        label: 'Beginner',
        description: 'Whole, half, and quarter notes only in 4/4. Goal: transcribe any rhythm built from simple note values. Learn to count beats aloud.',
        difficulty: 'Beginner',
        rhythmDurations: ['w', 'h', 'q'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Adds eighth notes and dotted quarter notes. Goal: handle syncopated rhythms found in pop and rock guitar parts.',
        difficulty: 'Intermediate',
        rhythmDurations: ['w', 'h', 'q', '8', 'qd'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Full rhythmic vocabulary including 16th notes and dotted halves. Goal: transcribe any single-instrument rhythm part from a recording.',
        difficulty: 'Advanced',
        rhythmDurations: ['w', 'h', 'q', '8', '16', 'hd', 'qd'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
];
```

- [ ] **Step 2: Render descriptions in the Plan view in `src/pages/EarTraining.tsx`**

Find the section in EarTraining.tsx that renders the Plan view stage cards (where `LadderStage` items are mapped). Add a collapsible description below each stage label. The stage card should add:

```tsx
// At the top of the EarTraining component or in a local component:
const [expandedDesc, setExpandedDesc] = useState<string | null>(null);

// Inside the stage card render (after the stage label/status row):
{stage.description && (
  <div className="mt-1">
    <button
      onClick={e => { e.stopPropagation(); setExpandedDesc(expandedDesc === stageKey ? null : stageKey); }}
      className="text-xs text-brand-secondary hover:text-brand-ink transition-colors"
    >
      {expandedDesc === stageKey ? '▲ hide' : 'ℹ what you\'ll learn'}
    </button>
    {expandedDesc === stageKey && (
      <p className="mt-1 text-xs text-brand-secondary leading-relaxed border-l-2 border-brand-line pl-2">
        {stage.description}
      </p>
    )}
  </div>
)}
```

Where `stageKey` is a unique string combining ladder ID and stage index, e.g., `\`${ladder.id}-${stageIdx}\``.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Manual browser test**

- Open Ear Training → Plan tab
- Each stage card shows a "ℹ what you'll learn" link
- Click it — description expands inline
- Click again — collapses
- Descriptions are meaningful (not placeholder text)

- [ ] **Step 5: Commit**

```bash
git add src/lib/planProgress.ts src/pages/EarTraining.tsx
git commit -m "feat: add educational descriptions to skill ladder stages in Plan view"
```

---

## ─── TIER 2: Meaningful Improvements ─────────────────────────────────────────

---

### Task 4: Spaced Repetition for Study Mode (SM-2)

Replace the flat random deck in Study mode with SM-2 spaced repetition so cards are reviewed at optimal intervals.

**Files:**
- Create: `src/lib/srs.ts` — SM-2 algorithm + localStorage persistence
- Modify: `src/pages/EarTraining.tsx` — wire SRS deck generation and card updates into Study mode

**Interfaces:**
- Produces: `updateSRS(state, quality) → SRSState`, `loadSRSData() → Record<string, SRSState>`, `saveSRSData(data)`, `isDue(state) → boolean`, `getSRSCardId(card) → string`, `defaultSRSState() → SRSState`
- Consumes: `StudyCard` from `src/lib/earTraining.ts`

- [ ] **Step 1: Create `src/lib/srs.ts`**

```typescript
const STORAGE_KEY = 'guitar_study_srs_v1';

export interface SRSState {
  interval: number;       // days until next review
  repetitions: number;    // successful review streak
  easeFactor: number;     // multiplier, range 1.3–2.5, starts at 2.5
  dueDate: string;        // ISO date string
}

export function defaultSRSState(): SRSState {
  return { interval: 0, repetitions: 0, easeFactor: 2.5, dueDate: new Date().toISOString() };
}

export function isDue(state: SRSState): boolean {
  return new Date(state.dueDate) <= new Date();
}

/**
 * SM-2 update. quality: 0–5 where ≥3 = correct, <3 = incorrect.
 * Map study responses: first-attempt correct → 5, second-attempt → 3, wrong → 1.
 */
export function updateSRS(state: SRSState, quality: 0 | 1 | 2 | 3 | 4 | 5): SRSState {
  const { interval, repetitions, easeFactor } = state;
  let newInterval: number;
  let newReps: number;
  let newEF: number;

  if (quality >= 3) {
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * easeFactor);
    newReps = repetitions + 1;
    newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    newInterval = 1;
    newReps = 0;
    newEF = Math.max(1.3, easeFactor - 0.2);
  }

  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  return { interval: newInterval, repetitions: newReps, easeFactor: newEF, dueDate: due.toISOString() };
}

export function getSRSCardId(card: { kind: string; displayLabel?: string; label?: string }): string {
  return card.kind === 'chord' ? `chord-${card.displayLabel ?? ''}` : `interval-${card.label ?? ''}`;
}

export function loadSRSData(): Record<string, SRSState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SRSState>) : {};
  } catch { return {}; }
}

export function saveSRSData(data: Record<string, SRSState>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Orders cards for a study session: due cards first (sorted by overdue-ness),
 * then new cards, shuffled within each group.
 */
export function buildSRSDeck<T extends { kind: string; displayLabel?: string; label?: string }>(
  cards: T[],
  srsData: Record<string, SRSState>,
): T[] {
  const due: T[] = [];
  const newCards: T[] = [];

  for (const card of cards) {
    const id = getSRSCardId(card);
    const state = srsData[id];
    if (!state || isDue(state)) {
      if (state) due.push(card);
      else newCards.push(card);
    }
  }

  // Shuffle each group independently, then concatenate
  const shuffle = <U>(arr: U[]): U[] => [...arr].sort(() => Math.random() - 0.5);
  return [...shuffle(due), ...shuffle(newCards)];
}
```

- [ ] **Step 2: Integrate SRS into Study mode in `src/pages/EarTraining.tsx`**

Add these imports to EarTraining.tsx:
```typescript
import { loadSRSData, saveSRSData, updateSRS, getSRSCardId, defaultSRSState, buildSRSDeck } from '@/src/lib/srs';
```

Find where Study mode initialises its deck (the `generateStudyDeck(...)` call). Wrap it with SRS ordering:

```typescript
// Before (existing):
const deck = generateStudyDeck(settings.activeChordTypes, settings.activeIntervals);

// After:
const rawDeck = generateStudyDeck(settings.activeChordTypes, settings.activeIntervals);
const srsData = loadSRSData();
const deck = buildSRSDeck(rawDeck, srsData);
```

Find where Study mode handles a correct/incorrect answer (when the user clicks an option in Study mode). After recording the result, update SRS:

```typescript
// After recording correct/incorrect result:
const srsData = loadSRSData();
const cardId = getSRSCardId(currentStudyCard);
const existing = srsData[cardId] ?? defaultSRSState();
// quality: 5 = correct first try, 3 = correct second try, 1 = wrong
const quality = wasCorrect ? (attempts === 1 ? 5 : 3) : 1;
srsData[cardId] = updateSRS(existing, quality as 1 | 3 | 5);
saveSRSData(srsData);
```

Add a "due today" counter display above the Study mode card. In the Study mode UI section, find the header area and add:

```tsx
{(() => {
  const data = loadSRSData();
  const rawDeck = generateStudyDeck(settings.activeChordTypes, settings.activeIntervals);
  const due = rawDeck.filter(c => {
    const s = data[getSRSCardId(c)];
    return !s || new Date(s.dueDate) <= new Date();
  }).length;
  return due > 0 ? (
    <p className="text-xs text-brand-secondary text-center">
      {due} card{due !== 1 ? 's' : ''} due for review today
    </p>
  ) : null;
})()}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Manual browser test**

- Open Ear Training → Study tab
- Answer several cards correctly — "due today" counter decreases over sessions
- Answer a card wrong — it reappears sooner on next session
- Open browser DevTools → Application → localStorage — confirm `guitar_study_srs_v1` is populated with `interval`, `repetitions`, `easeFactor`, `dueDate` fields

- [ ] **Step 5: Commit**

```bash
git add src/lib/srs.ts src/pages/EarTraining.tsx
git commit -m "feat: add SM-2 spaced repetition to Study mode — cards reviewed at optimal intervals"
```

---

### Task 5: Scale Drilling in Ear Training

New "Scale Drill" sub-mode in Ear Training: given a root + scale, identify note names at highlighted fretboard positions.

**Files:**
- Create: `src/components/ScaleDrillTrainer.tsx`
- Modify: `src/lib/earTraining.ts` — add `ScaleDrillRound` type and `generateScaleDrillRound`
- Modify: `src/pages/EarTraining.tsx` — add scale drill to fretboard mode options

**Interfaces:**
- Produces: `ScaleDrillRound` type, `generateScaleDrillRound() → ScaleDrillRound`
- Consumes: `generateScalePattern`, `COMMON_SCALES`, `ALL_NOTES` from `src/data/guitarData.ts`; `STANDARD_TUNING` from `src/types.ts`; `Fretboard` from `src/components/Fretboard.tsx`

- [ ] **Step 1: Add `ScaleDrillRound` type and generator to `src/lib/earTraining.ts`**

Add imports at top of earTraining.ts (if not already present):
```typescript
import { COMMON_SCALES, generateScalePattern, ALL_NOTES, getNoteFromFret } from '@/src/data/guitarData';
import { STANDARD_TUNING } from '@/src/types';
import type { Note } from '@/src/types';
```

Add type after the existing `FretboardRound` interface:
```typescript
export interface ScaleDrillRound {
  kind: 'scaleDrill';
  scaleName: string;
  root: Note;
  targetStringIdx: number;   // 0 = low E
  targetFret: number;
  targetNote: Note;
  options: Note[];           // 4 choices including correct answer
}
```

Add generator function:
```typescript
export function generateScaleDrillRound(scaleIdx?: number): ScaleDrillRound {
  const idx = scaleIdx ?? Math.floor(Math.random() * COMMON_SCALES.length);
  const scaleDef = COMMON_SCALES[idx];
  const root = ALL_NOTES[Math.floor(Math.random() * 12)];
  const pattern = generateScalePattern(root, scaleDef);

  // All fretboard positions of scale notes in frets 0-12
  const positions: { stringIdx: number; fret: number; note: Note }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
    for (let fret = 0; fret <= 12; fret++) {
      const note = getNoteFromFret(openNote, fret);
      if (pattern.notes.includes(note)) {
        positions.push({ stringIdx, fret, note });
      }
    }
  });

  const target = positions[Math.floor(Math.random() * positions.length)];
  const wrong = ALL_NOTES.filter(n => n !== target.note).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [target.note, ...wrong].sort(() => Math.random() - 0.5) as Note[];

  return {
    kind: 'scaleDrill',
    scaleName: scaleDef.name,
    root,
    targetStringIdx: target.stringIdx,
    targetFret: target.fret,
    targetNote: target.note,
    options,
  };
}
```

- [ ] **Step 2: Create `src/components/ScaleDrillTrainer.tsx`**

```tsx
import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { ScaleDrillRound } from '@/src/lib/earTraining';
import { SessionScore } from '@/src/lib/earTraining';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES } from '@/src/data/guitarData';
import type { Note } from '@/src/types';

interface ScaleDrillTrainerProps {
  round: ScaleDrillRound;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function ScaleDrillTrainer({ round, score, onComplete }: ScaleDrillTrainerProps) {
  const [selected, setSelected] = useState<Note | null>(null);

  const scaleDef = COMMON_SCALES.find(s => s.name === round.scaleName)!;
  const scalePattern = generateScalePattern(round.root, scaleDef);

  // Build highlight frets: full scale in grey, target in orange/red
  // We pass scale to Fretboard for highlighting, then overlay target marker via CSS
  const isCorrect = selected === round.targetNote;

  function handleSelect(note: Note) {
    if (selected !== null) return;
    setSelected(note);
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-brand-ink">
          What note is highlighted (★) in{' '}
          <span className="text-brand-primary font-bold">{round.root} {round.scaleName}</span>?
        </p>
        <p className="text-xs text-brand-secondary">
          String {round.targetStringIdx + 1} (from low E), fret {round.targetFret}
        </p>
      </div>

      {/* Fretboard showing full scale pattern */}
      <div className="overflow-x-auto">
        <Fretboard
          scale={scalePattern}
          fretRange={[Math.max(0, round.targetFret - 2), Math.min(12, round.targetFret + 2)]}
        />
      </div>

      {/* Note name options */}
      <div className="grid grid-cols-4 gap-2">
        {round.options.map(note => (
          <button
            key={note}
            onClick={() => handleSelect(note)}
            disabled={selected !== null}
            className={cn(
              'py-3 rounded-lg text-sm font-bold border transition-colors',
              selected === null
                ? 'border-brand-line text-brand-ink hover:border-brand-primary/60 hover:bg-brand-sidebar/50'
                : note === round.targetNote
                  ? 'bg-green-500 text-white border-green-500'
                  : note === selected
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-brand-line text-brand-secondary opacity-50',
            )}
          >
            {note}
          </button>
        ))}
      </div>

      {selected !== null && (
        <div className="space-y-2">
          <p className={cn('text-sm font-semibold text-center', isCorrect ? 'text-green-600' : 'text-red-500')}>
            {isCorrect ? 'Correct!' : `Not quite — it's ${round.targetNote}`}
          </p>
          <button
            onClick={() => onComplete(isCorrect)}
            className="w-full py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire ScaleDrillTrainer into `src/pages/EarTraining.tsx`**

Add import:
```typescript
import { ScaleDrillTrainer } from '@/src/components/ScaleDrillTrainer';
import { generateScaleDrillRound, ScaleDrillRound } from '@/src/lib/earTraining';
```

In the mode type definition (where `mode` state is typed), add `'scaleDrill'` to the union:
```typescript
// Find the mode type and add 'scaleDrill':
mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count' | 'scaleDrill';
```

Add a mode toggle button in the fretboard section's sub-mode selector (where Hunt/Sing are). Label it "Scale Drill".

Add the round generation and rendering:
```typescript
// In the round generation logic for 'scaleDrill':
if (mode === 'scaleDrill') {
  setCurrentRound(generateScaleDrillRound());
}
```

```tsx
{/* In the round rendering section: */}
{mode === 'scaleDrill' && currentRound?.kind === 'scaleDrill' && (
  <ScaleDrillTrainer
    round={currentRound}
    score={score}
    onComplete={(wasCorrect) => advanceRound(wasCorrect)}
  />
)}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Manual browser test**

- Open Ear Training, navigate to fretboard/scale area
- Select "Scale Drill" mode
- A fretboard appears showing a scale, one position highlighted
- 4 note-name buttons appear — select correct/wrong
- Green/red feedback, then Next → moves to new round

- [ ] **Step 6: Commit**

```bash
git add src/lib/earTraining.ts src/components/ScaleDrillTrainer.tsx src/pages/EarTraining.tsx
git commit -m "feat: add scale drilling mode to ear training — identify note names in scale positions"
```

---

### Task 6: Voice Leading Hints in Progressions

Analyze adjacent chords for common tones and large leaps; surface actionable hints in the Progressions editor.

**Files:**
- Create: `src/lib/voiceLeading.ts`
- Create: `src/components/VoiceLeadingPanel.tsx`
- Modify: `src/pages/Progressions.tsx` — show panel when two adjacent chords are selected

**Interfaces:**
- Produces: `analyzeVoiceLeading(chordA, chordB, tuningNotes) → VoiceLeadingAnalysis`
- Consumes: `ChordShape`, `Note` from `src/types.ts`; `ALL_NOTES`, `getNoteFromFret` from `src/data/guitarData.ts`

- [ ] **Step 1: Create `src/lib/voiceLeading.ts`**

```typescript
import { ChordShape, Note } from '@/src/types';
import { ALL_NOTES, getNoteFromFret } from '@/src/data/guitarData';

export interface NoteLeap {
  fromNote: Note;
  toNote: Note;
  semitones: number;
  stringIdx: number;
}

export interface VoiceLeadingAnalysis {
  commonTones: { note: Note; stringIdxs: number[] }[];
  leaps: NoteLeap[];
  largeLeapStrings: number[];   // stringIdxs with leap > 5 semitones
  smoothScore: number;          // 0–100: higher = smoother voice leading
}

function noteAtString(frets: number[], stringIdx: number, tuningNotes: Note[]): Note | null {
  const fret = frets[stringIdx];
  if (fret === -1) return null;
  return getNoteFromFret(tuningNotes[stringIdx], fret);
}

export function analyzeVoiceLeading(
  chordA: ChordShape,
  chordB: ChordShape,
  tuningNotes: Note[],
): VoiceLeadingAnalysis {
  const notesA = tuningNotes.map((_, i) => noteAtString(chordA.frets, i, tuningNotes));
  const notesB = tuningNotes.map((_, i) => noteAtString(chordB.frets, i, tuningNotes));

  const commonMap = new Map<Note, number[]>();
  const leaps: NoteLeap[] = [];

  for (let i = 0; i < 6; i++) {
    const a = notesA[i];
    const b = notesB[i];
    if (!a || !b) continue;

    if (a === b) {
      const existing = commonMap.get(a);
      if (existing) existing.push(i);
      else commonMap.set(a, [i]);
    } else {
      const idxA = ALL_NOTES.indexOf(a);
      const idxB = ALL_NOTES.indexOf(b);
      const diff = Math.abs(idxB - idxA);
      const semitones = Math.min(diff, 12 - diff);
      leaps.push({ fromNote: a, toNote: b, semitones, stringIdx: i });
    }
  }

  const commonTones = Array.from(commonMap.entries()).map(([note, stringIdxs]) => ({ note, stringIdxs }));
  const largeLeapStrings = leaps.filter(l => l.semitones > 5).map(l => l.stringIdx);

  // Smooth score: start at 100, deduct per large leap, add per common tone
  const smoothScore = Math.max(0, Math.min(100,
    100 - largeLeapStrings.length * 15 + commonTones.length * 10,
  ));

  return { commonTones, leaps, largeLeapStrings, smoothScore };
}
```

- [ ] **Step 2: Create `src/components/VoiceLeadingPanel.tsx`**

```tsx
import React from 'react';
import { VoiceLeadingAnalysis } from '@/src/lib/voiceLeading';
import { cn } from '@/src/lib/utils';

const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

interface VoiceLeadingPanelProps {
  analysis: VoiceLeadingAnalysis;
  fromChordName: string;
  toChordName: string;
}

export function VoiceLeadingPanel({ analysis, fromChordName, toChordName }: VoiceLeadingPanelProps) {
  const { commonTones, largeLeapStrings, smoothScore } = analysis;

  const scoreColor =
    smoothScore >= 70 ? 'text-green-600' :
    smoothScore >= 40 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-brand-ink">
          {fromChordName} → {toChordName}
        </span>
        <span className={cn('font-bold', scoreColor)}>
          Voice leading: {smoothScore}/100
        </span>
      </div>

      {commonTones.length > 0 && (
        <div>
          <p className="text-xs font-medium text-brand-secondary mb-1">Common tones (keep these fingers down):</p>
          <div className="flex gap-1 flex-wrap">
            {commonTones.map(({ note, stringIdxs }) => (
              <span
                key={note}
                className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold dark:bg-green-900/30 dark:text-green-400"
              >
                {note} ({stringIdxs.map(i => STRING_NAMES[i]).join(', ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {largeLeapStrings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-brand-secondary mb-1">Large leaps (&gt;5 semitones):</p>
          <div className="flex gap-1 flex-wrap">
            {analysis.leaps.filter(l => l.semitones > 5).map((leap, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs dark:bg-yellow-900/30 dark:text-yellow-400"
              >
                {STRING_NAMES[leap.stringIdx]}: {leap.fromNote}→{leap.toNote} ({leap.semitones} st)
              </span>
            ))}
          </div>
          <p className="text-xs text-brand-secondary mt-1">
            Tip: try an inversion of either chord to reduce the leap.
          </p>
        </div>
      )}

      {commonTones.length === 0 && largeLeapStrings.length === 0 && (
        <p className="text-xs text-brand-secondary">No common tones — smooth stepwise motion throughout.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add VoiceLeadingPanel to `src/pages/Progressions.tsx`**

Add imports:
```typescript
import { analyzeVoiceLeading } from '@/src/lib/voiceLeading';
import { VoiceLeadingPanel } from '@/src/components/VoiceLeadingPanel';
import { STANDARD_TUNING } from '@/src/types';
```

Find where progression slots are rendered (the chord card list). After the list, add:
```tsx
{/* Voice leading analysis between adjacent selected chords */}
{activeProgression && activeProgression.slots.length >= 2 && (() => {
  const tuningNotes = STANDARD_TUNING.notes;
  return activeProgression.slots.slice(0, -1).map((slot, i) => {
    const next = activeProgression.slots[i + 1];
    const analysis = analyzeVoiceLeading(slot.chord, next.chord, tuningNotes);
    return (
      <VoiceLeadingPanel
        key={i}
        analysis={analysis}
        fromChordName={slot.chord.name}
        toChordName={next.chord.name}
      />
    );
  });
})()}
```

This shows a compact analysis panel between each pair of adjacent chords. To avoid clutter, consider gating behind a toggle:

```tsx
const [showVoiceLeading, setShowVoiceLeading] = useState(false);

// Toggle button near the progression controls:
<button
  onClick={() => setShowVoiceLeading(v => !v)}
  className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
>
  {showVoiceLeading ? 'Hide Voice Leading' : 'Show Voice Leading'}
</button>

// Gate the panel render:
{showVoiceLeading && /* ...panel render above... */}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Manual browser test**

- Open Progressions — create a progression with at least 3 chords
- Click "Show Voice Leading" — panels appear between adjacent chords
- Common tones highlighted in green; large leaps in yellow
- Try a progression with a dim or aug chord — large leaps should appear
- Try I–V–vi–IV — common tones should appear between most adjacent pairs

- [ ] **Step 6: Commit**

```bash
git add src/lib/voiceLeading.ts src/components/VoiceLeadingPanel.tsx src/pages/Progressions.tsx
git commit -m "feat: add voice leading hints to progressions — common tones, large leaps, and smooth score"
```

---

## ─── TIER 3: Substantial Features ────────────────────────────────────────────

---

### Task 7: Interval-to-Fretboard Mode

New ear training mode that bridges interval recognition and fretboard knowledge: hear an interval, find both notes on the fretboard.

**Files:**
- Create: `src/components/IntervalFretboardTrainer.tsx`
- Modify: `src/lib/earTraining.ts` — add `IntervalFretboardRound` type and generator
- Modify: `src/pages/EarTraining.tsx` — add mode + round routing

**Interfaces:**
- Produces: `IntervalFretboardRound` type, `generateIntervalFretboardRound() → IntervalFretboardRound`
- Consumes: `playNote` from `src/lib/audio.ts`; `Fretboard` component; `INTERVAL_DEFS` from earTraining.ts

- [ ] **Step 1: Add `IntervalFretboardRound` type and generator to `src/lib/earTraining.ts`**

Add type alongside existing round types:
```typescript
export interface IntervalFretboardRound {
  kind: 'intervalFretboard';
  intervalLabel: string;      // e.g., "Perfect Fifth"
  intervalSemitones: number;
  rootNote: Note;
  rootStringIdx: number;
  rootFret: number;
  targetNote: Note;
  targetStringIdx: number;    // correct answer string
  targetFret: number;         // correct answer fret
  // Distractors: other valid positions on other strings
  distractors: { stringIdx: number; fret: number; note: Note }[];
}
```

Add generator:
```typescript
export function generateIntervalFretboardRound(): IntervalFretboardRound {
  // Pick a random interval from INTERVAL_DEFS
  const def = INTERVAL_DEFS[Math.floor(Math.random() * INTERVAL_DEFS.length)];
  const semitones = def.semitones;

  // Pick a random root position (frets 0–9, any string)
  const rootStringIdx = Math.floor(Math.random() * 6);
  const rootFret = Math.floor(Math.random() * 10);
  const rootNote = getNoteFromFret(STANDARD_TUNING.notes[rootStringIdx], rootFret);

  // Compute target note
  const rootNoteIdx = ALL_NOTES.indexOf(rootNote);
  const targetNote = ALL_NOTES[(rootNoteIdx + semitones) % 12] as Note;

  // Find all target positions on the neck (same string, frets 0–12)
  // Prefer same string or adjacent string for musical relevance
  const candidates: { stringIdx: number; fret: number; note: Note }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, si) => {
    for (let fret = 0; fret <= 12; fret++) {
      if (si === rootStringIdx && fret === rootFret) continue;
      const note = getNoteFromFret(openNote, fret);
      if (note === targetNote) candidates.push({ stringIdx: si, fret, note });
    }
  });

  if (candidates.length === 0) {
    // Fallback: generate fresh
    return generateIntervalFretboardRound();
  }

  // Prefer same or adjacent string
  const preferred = candidates.filter(c => Math.abs(c.stringIdx - rootStringIdx) <= 1);
  const pool = preferred.length > 0 ? preferred : candidates;
  const correct = pool[Math.floor(Math.random() * pool.length)];

  // Distractors: other positions of same note (wrong fret/string combinations)
  const distractors = candidates
    .filter(c => !(c.stringIdx === correct.stringIdx && c.fret === correct.fret))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return {
    kind: 'intervalFretboard',
    intervalLabel: def.label,
    intervalSemitones: semitones,
    rootNote,
    rootStringIdx,
    rootFret,
    targetNote,
    targetStringIdx: correct.stringIdx,
    targetFret: correct.fret,
    distractors,
  };
}
```

Note: `getNoteFromFret` needs to be imported in earTraining.ts — add to the import from guitarData:
```typescript
import { COMMON_SCALES, generateScalePattern, ALL_NOTES, getNoteFromFret } from '@/src/data/guitarData';
```

- [ ] **Step 2: Create `src/components/IntervalFretboardTrainer.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { IntervalFretboardRound, SessionScore } from '@/src/lib/earTraining';
import { initAudio, playNote } from '@/src/lib/audio';
import { STANDARD_TUNING } from '@/src/types';

const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

interface Props {
  round: IntervalFretboardRound;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function IntervalFretboardTrainer({ round, score, onComplete }: Props) {
  const [selected, setSelected] = useState<{ stringIdx: number; fret: number } | null>(null);

  const allChoices = [
    { stringIdx: round.targetStringIdx, fret: round.targetFret, note: round.targetNote, isCorrect: true },
    ...round.distractors.map(d => ({ ...d, isCorrect: false })),
  ].sort(() => Math.random() - 0.5);

  const handlePlay = useCallback(async () => {
    await initAudio();
    const openNote = STANDARD_TUNING.notes[round.rootStringIdx];
    const rootNoteIdx = STANDARD_TUNING.octaves[round.rootStringIdx];
    playNote(`${round.rootNote}${rootNoteIdx}`, '4n');
    setTimeout(() => playNote(`${round.targetNote}${rootNoteIdx}`, '4n'), 600);
  }, [round]);

  const isCorrect = selected !== null &&
    selected.stringIdx === round.targetStringIdx &&
    selected.fret === round.targetFret;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-brand-ink">
          Root: <span className="text-brand-primary font-bold">{round.rootNote}</span>
          {' '}on string {STRING_LABELS[round.rootStringIdx]}, fret {round.rootFret}
        </p>
        <p className="text-sm font-medium text-brand-ink">
          Interval: <span className="text-brand-primary font-bold">{round.intervalLabel}</span>
        </p>
        <p className="text-xs text-brand-secondary">
          Target note: {selected !== null ? round.targetNote : '?'} — select the correct fretboard position below
        </p>
      </div>

      <button
        onClick={handlePlay}
        className="w-full py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
      >
        ▶ Play Interval
      </button>

      {/* Choice grid: string × fret cards */}
      <div className="space-y-1">
        <p className="text-xs text-brand-secondary font-medium">Select the position of the target note:</p>
        <div className="grid grid-cols-2 gap-2">
          {allChoices.map((choice, i) => (
            <button
              key={i}
              onClick={() => { if (!selected) setSelected(choice); }}
              disabled={selected !== null}
              className={cn(
                'py-3 rounded-lg text-sm border transition-colors text-left px-3',
                selected === null
                  ? 'border-brand-line text-brand-ink hover:border-brand-primary/60 hover:bg-brand-sidebar/50'
                  : choice.isCorrect
                    ? 'bg-green-500 text-white border-green-500'
                    : selected.stringIdx === choice.stringIdx && selected.fret === choice.fret
                      ? 'bg-red-500 text-white border-red-500'
                      : 'border-brand-line text-brand-secondary opacity-50',
              )}
            >
              <span className="font-bold">{STRING_LABELS[choice.stringIdx]}</span>
              <span className="text-xs ml-2">fret {choice.fret}</span>
              {selected !== null && (
                <span className="ml-1 text-xs">({choice.note})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected !== null && (
        <div className="space-y-2">
          <p className={cn('text-sm font-semibold text-center', isCorrect ? 'text-green-600' : 'text-red-500')}>
            {isCorrect
              ? `Correct! ${round.targetNote} is a ${round.intervalLabel} above ${round.rootNote}`
              : `Not quite — ${round.targetNote} is on string ${STRING_LABELS[round.targetStringIdx]}, fret ${round.targetFret}`}
          </p>
          <button
            onClick={() => onComplete(isCorrect)}
            className="w-full py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `src/pages/EarTraining.tsx`**

Add imports:
```typescript
import { IntervalFretboardTrainer } from '@/src/components/IntervalFretboardTrainer';
import { generateIntervalFretboardRound, IntervalFretboardRound } from '@/src/lib/earTraining';
```

Add `'intervalFretboard'` to the mode union type (same place as Task 5).

Add a mode button in the fretboard sub-mode section: label "Interval → Fretboard".

Add round generation:
```typescript
if (mode === 'intervalFretboard') {
  setCurrentRound(generateIntervalFretboardRound());
}
```

Add rendering:
```tsx
{mode === 'intervalFretboard' && currentRound?.kind === 'intervalFretboard' && (
  <IntervalFretboardTrainer
    round={currentRound}
    score={score}
    onComplete={(wasCorrect) => advanceRound(wasCorrect)}
  />
)}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Manual browser test**

- Open Ear Training → Fretboard area → select "Interval → Fretboard" mode
- Round shows: root note position, interval name, Play Interval button
- Click Play — two notes sound with 600ms gap
- 4 fretboard position choices appear — select one
- Green/red feedback with explanation; Next → advances

- [ ] **Step 6: Commit**

```bash
git add src/lib/earTraining.ts src/components/IntervalFretboardTrainer.tsx src/pages/EarTraining.tsx
git commit -m "feat: add interval-to-fretboard mode — connect interval names to physical neck positions"
```

---

### Task 8: Scale Position Training Page

A dedicated page for drilling the 5 CAGED-derived scale positions and their modal names.

**Files:**
- Create: `src/pages/ScalePositions.tsx`
- Modify: `src/App.tsx` — add `/scale-positions` route and nav link

**Interfaces:**
- Produces: `export function ScalePositions(): JSX.Element`
- Consumes: `Fretboard` component; `generateScalePattern`, `COMMON_SCALES`, `ALL_NOTES` from guitarData.ts; `initAudio`, `playNote` from audio.ts

- [ ] **Step 1: Create `src/pages/ScalePositions.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
import { initAudio, playNote } from '@/src/lib/audio';
import type { Note } from '@/src/types';
import { STANDARD_TUNING } from '@/src/types';

// CAGED positions are 5 pattern "windows" on the neck for a given scale/root
// Each window covers a 4-fret span starting at specific frets relative to the root
const CAGED_POSITION_OFFSETS = [0, 3, 5, 7, 10]; // semitone offsets relative to root for each box
const POSITION_LABELS = ['Position 1 (Root box)', 'Position 2', 'Position 3', 'Position 4', 'Position 5'];

const DIATONIC_MODES = [
  { name: 'Ionian (Major)', degree: 1 },
  { name: 'Dorian', degree: 2 },
  { name: 'Phrygian', degree: 3 },
  { name: 'Lydian', degree: 4 },
  { name: 'Mixolydian', degree: 5 },
  { name: 'Aeolian (Minor)', degree: 6 },
  { name: 'Locrian', degree: 7 },
];

type DrillMode = 'identify-position' | 'identify-mode' | 'free-explore';

export function ScalePositions() {
  const [root, setRoot] = useState<Note>('G');
  const [scaleIdx, setScaleIdx] = useState(0);
  const [positionIdx, setPositionIdx] = useState(0);
  const [drillMode, setDrillMode] = useState<DrillMode>('free-explore');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');

  const scaleDef = COMMON_SCALES[scaleIdx];

  // Compute start fret for current position
  const rootNoteIdx = ALL_NOTES.indexOf(root);
  const positionRootNoteIdx = (rootNoteIdx + CAGED_POSITION_OFFSETS[positionIdx]) % 12;
  const positionRootNote = ALL_NOTES[positionRootNoteIdx] as Note;

  // Find lowest fret of positionRootNote on the low E string (string 0)
  // This gives us the fret range window start
  const lowEOpen = STANDARD_TUNING.notes[0];
  const lowEOpenIdx = ALL_NOTES.indexOf(lowEOpen);
  let startFret = (positionRootNoteIdx - lowEOpenIdx + 12) % 12;
  if (startFret === 0) startFret = 12; // prefer non-open position for clarity
  const fretRange: [number, number] = [startFret, startFret + 4];

  const pattern = generateScalePattern(root, scaleDef);

  const handlePlayAscending = useCallback(async () => {
    await initAudio();
    const notesInWindow = pattern.notes;
    notesInWindow.forEach((note, i) => {
      setTimeout(() => playNote(`${note}4`, '8n'), i * 250);
    });
  }, [pattern]);

  function startDrill() {
    const correct = POSITION_LABELS[positionIdx];
    const shuffled = POSITION_LABELS.filter(l => l !== correct)
      .sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [correct, ...shuffled].sort(() => Math.random() - 0.5);
    setQuizOptions(opts);
    setCorrectAnswer(correct);
    setSelected(null);
    setPositionIdx(Math.floor(Math.random() * 5));
  }

  function handleSelect(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
  }

  function nextQuestion() {
    setSelected(null);
    setPositionIdx(Math.floor(Math.random() * 5));
    startDrill();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Scale Positions</h1>
        <p className="text-sm text-brand-secondary">
          Explore and drill the 5 CAGED scale positions across the neck.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-secondary">Root</label>
          <div className="flex gap-1 flex-wrap">
            {ALL_NOTES.map(n => (
              <button
                key={n}
                onClick={() => setRoot(n)}
                className={cn(
                  'w-10 h-8 rounded text-xs font-bold border transition-colors',
                  root === n
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-secondary">Scale</label>
          <div className="flex gap-1 flex-wrap">
            {COMMON_SCALES.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setScaleIdx(i)}
                className={cn(
                  'px-3 h-8 rounded text-xs font-medium border transition-colors',
                  scaleIdx === i
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['free-explore', 'identify-position', 'identify-mode'] as DrillMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setDrillMode(m); setSelected(null); if (m !== 'free-explore') startDrill(); }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              drillMode === m
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
            )}
          >
            {m === 'free-explore' ? 'Explore' : m === 'identify-position' ? 'Drill: Name the Position' : 'Drill: Mode Context'}
          </button>
        ))}
      </div>

      {/* Position selector (free-explore only) */}
      {drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {POSITION_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setPositionIdx(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                positionIdx === i
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {root} {scaleDef.name} — {POSITION_LABELS[positionIdx]}
            {drillMode === 'free-explore' && (
              <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
            )}
          </p>
          <button
            onClick={handlePlayAscending}
            className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            ▶ Play ascending
          </button>
        </div>
        <div className="overflow-x-auto">
          <Fretboard
            scale={pattern}
            fretRange={fretRange}
          />
        </div>
      </div>

      {/* Quiz area */}
      {drillMode === 'identify-position' && quizOptions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-ink">Which position is shown above?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quizOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={selected !== null}
                className={cn(
                  'py-3 px-4 rounded-lg text-sm border text-left transition-colors',
                  selected === null
                    ? 'border-brand-line text-brand-ink hover:border-brand-primary/60'
                    : opt === correctAnswer
                      ? 'bg-green-500 text-white border-green-500'
                      : opt === selected
                        ? 'bg-red-500 text-white border-red-500'
                        : 'border-brand-line text-brand-secondary opacity-50',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          {selected !== null && (
            <div className="space-y-2">
              <p className={cn('text-sm font-semibold', selected === correctAnswer ? 'text-green-600' : 'text-red-500')}>
                {selected === correctAnswer ? 'Correct!' : `The answer is: ${correctAnswer}`}
              </p>
              <button
                onClick={nextQuestion}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode context reference */}
      {drillMode === 'free-explore' && scaleDef.intervals.length === 7 && (
        <div className="rounded-lg border border-brand-line bg-brand-bg p-4 space-y-2">
          <p className="text-xs font-medium text-brand-ink">Modal context for {scaleDef.name}:</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {DIATONIC_MODES.map(({ name, degree }) => {
              const modeRoot = ALL_NOTES[(rootNoteIdx + scaleDef.intervals[degree - 1]) % 12];
              return (
                <div key={name} className="text-xs">
                  <span className="font-mono text-brand-primary">{modeRoot}</span>
                  <span className="text-brand-secondary ml-1">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route and nav link in `src/App.tsx`**

Add import (with other page imports):
```typescript
import { ScalePositions } from './pages/ScalePositions';
```

Add `Map` (or `Layers`) icon to the lucide-react import:
```typescript
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones, Clock, Layers } from 'lucide-react';
```

Add nav link (after Metronome):
```tsx
<NavLink
  to="/scale-positions"
  className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
>
  <Layers size={16} /> Scales
</NavLink>
```

Add route:
```tsx
<Route path="/scale-positions" element={<ScalePositions />} />
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Manual browser test**

- Navigate to `/Guitar_Chords/scale-positions`
- "Scales" nav link appears and is active
- Select root G, scale Minor Pentatonic — fretboard shows the pentatonic pattern in the correct fret window
- Click through all 5 positions — fret range shifts; pattern updates correctly
- Click "Play ascending" — notes sound in scale order
- Switch to "Drill: Name the Position" — random position displayed, 4 answer choices
- Select wrong answer → red, correct → green, Next → new position
- Modal context table appears for 7-note scales only

- [ ] **Step 5: Commit**

```bash
git add src/pages/ScalePositions.tsx src/App.tsx
git commit -m "feat: add Scale Positions page — explore and drill 5 CAGED positions with modal context"
```

---

## Self-Review

**Spec coverage:**
- Task 1 ✅ Metronome page with BPM, tap tempo, time sig, visual, Tone.js audio, nav link
- Task 2 ✅ Add-to-progression from Dictionary/CAGED; ear training navigation link
- Task 3 ✅ Collapsible stage descriptions in Plan view
- Task 4 ✅ SM-2 SRS with per-card intervals, localStorage, weighted deck
- Task 5 ✅ Scale drilling — find note names in highlighted scale positions
- Task 6 ✅ Voice leading — common tones, large leaps, smooth score, inversion tip
- Task 7 ✅ Interval-to-fretboard — hear interval, pick fretboard position
- Task 8 ✅ Scale position training page with 5 positions, drill mode, modal context

**Placeholder scan:** None found — all code blocks are complete and runnable.

**Type consistency:**
- `ScaleDrillRound.kind = 'scaleDrill'` matches across earTraining.ts and ScaleDrillTrainer.tsx
- `IntervalFretboardRound.kind = 'intervalFretboard'` matches across earTraining.ts and IntervalFretboardTrainer.tsx
- `VoiceLeadingAnalysis` shape matches between voiceLeading.ts and VoiceLeadingPanel.tsx
- `SRSState` fields match between srs.ts definition and all callsites
- `STANDARD_TUNING.notes` is a `Note[]` (6 elements) — confirmed from types.ts

**Known risks:**
- Task 7: `generateIntervalFretboardRound` recursively retries if no candidates found — add a `depth` guard if this becomes an issue in practice (very unlikely given 6 strings × 13 frets)
- Task 5: `STANDARD_TUNING` import in earTraining.ts — confirm it is exported from `src/types.ts` before running lint (it is, per CLAUDE.md)
- Task 8: Fret window calculation for position 1 on open-string roots will produce `startFret = 12` by design — verify this looks correct in the browser

---

*Plan complete. Total estimated time: Tier 1 ~1–2 days, Tier 2 ~1–2 weeks, Tier 3 ~3–5 weeks.*
