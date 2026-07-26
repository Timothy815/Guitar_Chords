# Rhythm Ear Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `'rhythm'` mode to the Ear Training page where users hear a rhythmic pattern and notate it on a real VexFlow music staff.

**Architecture:** Pure rhythm (no pitch) ear training: a click-track count-in + clap sounds for note onsets. Users place duration tiles sequentially on a VexFlow treble-clef staff, then drag to swap positions before submitting. Per-note green/red feedback after submission. Five files changed across data, audio, components, and page layers.

**Tech Stack:** React 19 + TypeScript, VexFlow v5 (`Renderer`, `Stave`, `StaveNote`, `Voice`, `Formatter`, `Beam`, `Dot`), Tone.js (`MembraneSynth`, `NoiseSynth`, `Transport`), Tailwind v4 CSS variables.

## Global Constraints

- No new npm dependencies — VexFlow v5 and Tone.js already installed.
- `npm run lint` (tsc --noEmit) is the ONLY static check; no test suite exists.
- Tailwind v4 — no `tailwind.config.js`; use brand CSS variables (`brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`) and `cn()` from `src/lib/utils.ts` for conditional classes.
- Path alias: `@` resolves to the project root (not `src/`). Use relative imports inside `src/`.
- All notes keyed to `'b/4'` in VexFlow (middle line of treble clef — standard for unpitched rhythm exercises).
- `clickSynth: Tone.MembraneSynth` already exists in `audio.ts` (initialized in `initAudio()`). Do NOT redeclare it; use it directly for beat clicks in `playRhythmRound`.
- `Tone.Transport` is not used elsewhere in `audio.ts` — safe to use exclusively for rhythm.
- VexFlow pattern: `div.innerHTML = ''` + `new Renderer(div, Renderer.Backends.SVG)` + `useRef<HTMLDivElement>` + `useEffect`, exactly as in `src/components/ChordCard.tsx`.
- `EarTrainingSettings.mode` lives in `src/lib/earTraining.ts`; `Round` type union also lives there.
- `RhythmRound` needs `kind: 'rhythm'` for the discriminated `Round` union used throughout `EarTraining.tsx`.
- Deployment base path `/Guitar_Chords/` must not change.

---

### Task 1: Data Layer — `src/lib/rhythmTraining.ts` + `src/lib/earTraining.ts`

**Files:**
- Create: `src/lib/rhythmTraining.ts`
- Modify: `src/lib/earTraining.ts` (line 16 mode union, line 68 Round type, add import)

**Interfaces produced (consumed by Tasks 2–5):**
```typescript
// rhythmTraining.ts exports:
export type RhythmDuration = 'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd';
export interface RhythmUnit { duration: RhythmDuration; isRest: boolean; }
export type TimeSignature = '4/4' | '2/4' | '3/4' | '6/8';
export interface RhythmRound {
  kind: 'rhythm';           // discriminant for Round union
  units: RhythmUnit[];
  measures: number;
  timeSignature: TimeSignature;
  bpm: number;
}
export interface RhythmSettings {
  timeSignature: TimeSignature;
  enabledDurations: RhythmDuration[];
  enableRests: boolean;
  bpm: number;
}
export function durationBeats(duration: RhythmDuration): number
export function beatsPerMeasure(ts: TimeSignature): number
export function vexDuration(unit: RhythmUnit): string
export function generateRhythmRound(
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
  settings: RhythmSettings,
): RhythmRound

// earTraining.ts changes:
// mode union: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm'
// Round: ChordRound | IntervalRound | FretboardRound | RhythmRound
```

- [ ] **Step 1: Create `src/lib/rhythmTraining.ts`**

Write the entire file:

```typescript
export type RhythmDuration = 'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd';

export interface RhythmUnit {
  duration: RhythmDuration;
  isRest: boolean;
}

export type TimeSignature = '4/4' | '2/4' | '3/4' | '6/8';

export interface RhythmRound {
  kind: 'rhythm';
  units: RhythmUnit[];
  measures: number;
  timeSignature: TimeSignature;
  bpm: number;
}

export interface RhythmSettings {
  timeSignature: TimeSignature;
  enabledDurations: RhythmDuration[];
  enableRests: boolean;
  bpm: number;
}

export function durationBeats(duration: RhythmDuration): number {
  switch (duration) {
    case 'w':  return 4.0;
    case 'h':  return 2.0;
    case 'hd': return 3.0;
    case 'q':  return 1.0;
    case 'qd': return 1.5;
    case '8':  return 0.5;
    case '16': return 0.25;
  }
}

export function beatsPerMeasure(ts: TimeSignature): number {
  if (ts === '4/4') return 4.0;
  if (ts === '2/4') return 2.0;
  return 3.0; // '3/4' and '6/8' both use 3 quarter-beat units
}

export function vexDuration(unit: RhythmUnit): string {
  const isDotted = unit.duration === 'hd' || unit.duration === 'qd';
  const baseVex = isDotted
    ? (unit.duration === 'hd' ? 'h' : 'q')
    : unit.duration;
  return unit.isRest ? baseVex + 'r' : baseVex;
}

export function generateRhythmRound(
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
  settings: RhythmSettings,
): RhythmRound {
  const measures = difficulty === 'Beginner' ? 1 : difficulty === 'Intermediate' ? 2 : 3;
  const budget = beatsPerMeasure(settings.timeSignature) * measures;

  const units: RhythmUnit[] = [];
  let remaining = budget;
  let attempts = 0;

  while (remaining > 0.001 && attempts < 200) {
    attempts++;
    const available = settings.enabledDurations.filter(
      d => durationBeats(d) <= remaining + 0.001,
    );

    if (available.length === 0) {
      if (units.length > 0) {
        const last = units.pop()!;
        remaining += durationBeats(last.duration);
      }
      continue;
    }

    const duration = available[Math.floor(Math.random() * available.length)];
    const canBeRest = settings.enableRests && units.some(u => !u.isRest);
    const isRest = canBeRest && Math.random() < 0.3;
    units.push({ duration, isRest });
    remaining -= durationBeats(duration);
  }

  // Fallback: fill any remaining budget with the smallest fitting duration
  if (remaining > 0.001) {
    const fallback: RhythmDuration =
      remaining >= 1.0 ? 'q' : remaining >= 0.5 ? '8' : '16';
    while (remaining > 0.001) {
      units.push({ duration: fallback, isRest: false });
      remaining -= durationBeats(fallback);
    }
  }

  // Guarantee at least one non-rest note
  if (units.length > 0 && units.every(u => u.isRest)) {
    units[0] = { ...units[0], isRest: false };
  }

  return { kind: 'rhythm', units, measures, timeSignature: settings.timeSignature, bpm: settings.bpm };
}
```

- [ ] **Step 2: Add `'rhythm'` to mode union in `src/lib/earTraining.ts`**

Find line 16 (the mode field in `EarTrainingSettings`):
```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan';
```
Change to:
```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm';
```

- [ ] **Step 3: Add `RhythmRound` to the `Round` union in `src/lib/earTraining.ts`**

At the top of the file, after the existing imports, add:
```typescript
import type { RhythmRound } from './rhythmTraining';
```

Find line 68:
```typescript
export type Round = ChordRound | IntervalRound | FretboardRound;
```
Change to:
```typescript
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound;
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rhythmTraining.ts src/lib/earTraining.ts
git commit -m "feat: add rhythm training data layer and mode union"
```

---

### Task 2: Audio — `src/lib/audio.ts`

**Files:**
- Modify: `src/lib/audio.ts`

**Consumes from Task 1:**
- `import type { RhythmRound } from './rhythmTraining'`
- `import { durationBeats, beatsPerMeasure } from './rhythmTraining'`
- `RhythmRound.units`, `RhythmRound.bpm`, `RhythmRound.timeSignature`, `RhythmRound.measures`

**Produces for Tasks 4–5:**
```typescript
export function playRhythmRound(round: RhythmRound): void
export function stopRhythm(): void
```

**Key constraint:** `clickSynth: Tone.MembraneSynth` is already declared at line 7 and initialized in `initAudio()`. Do NOT add a new declaration for it. Add only `clapSynth`.

- [ ] **Step 1: Add `clapSynth` declaration**

In `src/lib/audio.ts`, after line 7 (`let clickSynth: Tone.MembraneSynth;`), add:
```typescript
let clapSynth: Tone.NoiseSynth | null = null;
```

- [ ] **Step 2: Add imports from `rhythmTraining`**

At the top of `src/lib/audio.ts`, after the existing `import` on line 2, add:
```typescript
import type { RhythmRound } from './rhythmTraining';
import { durationBeats, beatsPerMeasure } from './rhythmTraining';
```

- [ ] **Step 3: Add `stopRhythm` and `playRhythmRound` at the end of the file**

Append after the last export in `audio.ts`:

```typescript
export function stopRhythm(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export function playRhythmRound(round: RhythmRound): void {
  stopRhythm();

  if (!clapSynth) {
    clapSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
    }).toDestination();
    clapSynth.volume.value = -6;
  }

  const spb = 60 / round.bpm;         // seconds per quarter-note beat
  const bpb = beatsPerMeasure(round.timeSignature);
  const is6_8 = round.timeSignature === '6/8';

  Tone.Transport.bpm.value = round.bpm;

  // Count-in: one measure of clicks (no claps)
  if (is6_8) {
    // Heavy click on dotted-quarter beats (0 and 1.5), light on eighths
    ([0, 1.5] as number[]).forEach(b => {
      Tone.Transport.schedule(t => { clickSynth.triggerAttackRelease('C5', '32n', t); }, b * spb);
    });
    ([0.5, 1.0, 2.0, 2.5] as number[]).forEach(b => {
      Tone.Transport.schedule(t => { clickSynth.triggerAttackRelease('C4', '32n', t); }, b * spb);
    });
  } else {
    for (let b = 0; b < bpb; b++) {
      const note = b === 0 ? 'C5' : 'C4';
      Tone.Transport.schedule(t => { clickSynth.triggerAttackRelease(note, '32n', t); }, b * spb);
    }
  }

  // Pattern starts after count-in
  const patternStart = bpb * spb;

  // Beat clicks throughout the pattern
  if (is6_8) {
    for (let m = 0; m < round.measures; m++) {
      const mOffset = m * bpb * spb;
      ([0, 1.5] as number[]).forEach(b => {
        Tone.Transport.schedule(
          t => { clickSynth.triggerAttackRelease('C5', '32n', t); },
          patternStart + mOffset + b * spb,
        );
      });
      ([0.5, 1.0, 2.0, 2.5] as number[]).forEach(b => {
        Tone.Transport.schedule(
          t => { clickSynth.triggerAttackRelease('C4', '32n', t); },
          patternStart + mOffset + b * spb,
        );
      });
    }
  } else {
    const totalPatternBeats = bpb * round.measures;
    for (let b = 0; b < totalPatternBeats; b++) {
      const note = b % bpb === 0 ? 'C5' : 'C4';
      Tone.Transport.schedule(
        t => { clickSynth.triggerAttackRelease(note, '32n', t); },
        patternStart + b * spb,
      );
    }
  }

  // Note onsets (claps) on non-rest unit positions
  let cursor = 0;
  for (const unit of round.units) {
    if (!unit.isRest) {
      const t = patternStart + cursor * spb;
      Tone.Transport.schedule(time => { clapSynth!.triggerAttackRelease('32n', time); }, t);
    }
    cursor += durationBeats(unit.duration);
  }

  Tone.Transport.position = 0;
  Tone.Transport.start();
}
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat: add playRhythmRound and stopRhythm to audio engine"
```

---

### Task 3: Staff Component — `src/components/RhythmStaff.tsx`

**Files:**
- Create: `src/components/RhythmStaff.tsx`

**Consumes from Tasks 1–2:**
- `RhythmRound`, `RhythmUnit` from `'../lib/rhythmTraining'`
- `durationBeats`, `beatsPerMeasure`, `vexDuration` from `'../lib/rhythmTraining'`
- VexFlow from `'vexflow'`: `Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot`

**Produces for Task 4:**
```typescript
interface RhythmStaffProps {
  round: RhythmRound;
  placedUnits: RhythmUnit[];
  feedback: ('correct' | 'wrong' | null)[] | null;
  onSwap: (i: number, j: number) => void;
}
export function RhythmStaff(props: RhythmStaffProps): JSX.Element
```

**Rendering approach:**
- All notes keyed to `'b/4'` (middle B, unpitched rhythm standard)
- For dotted notes (`hd`/`qd`): use base VexFlow duration (`h`/`q`) + `note.addModifier(new Dot(), 0)`
- Placeholder rests (unfilled beat budget, shown in gray) rendered in the same voice
- Only placed, non-rest notes are passed to `Beam.generateBeams()`
- Drag overlays: thin transparent React divs absolutely positioned over note x-positions, obtained via `note.getAbsoluteX()` after `voice.draw(ctx, stave)` → stored in state → re-render positions overlays
- `dragSrc` state is local to this component; `onSwap` is called when drop completes

- [ ] **Step 1: Create `src/components/RhythmStaff.tsx`**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot } from 'vexflow';
import { RhythmRound, RhythmUnit, durationBeats, beatsPerMeasure, vexDuration } from '../lib/rhythmTraining';

interface RhythmStaffProps {
  round: RhythmRound;
  placedUnits: RhythmUnit[];
  feedback: ('correct' | 'wrong' | null)[] | null;
  onSwap: (i: number, j: number) => void;
}

const STAFF_H = 110;
const CLEF_EXTRA = 70; // extra px for clef + time signature on first stave

function makeStaveNote(unit: RhythmUnit): StaveNote {
  const isDotted = unit.duration === 'hd' || unit.duration === 'qd';
  const dur = vexDuration(unit);
  const note = new StaveNote({ keys: ['b/4'], duration: dur });
  if (isDotted) note.addModifier(new Dot(), 0);
  return note;
}

function fillPlaceholders(remaining: number): RhythmUnit[] {
  const durs = ['w', 'hd', 'h', 'qd', 'q', '8', '16'] as const;
  const result: RhythmUnit[] = [];
  let rem = remaining;
  while (rem > 0.001) {
    const d = durs.find(x => durationBeats(x) <= rem + 0.001);
    if (!d) break;
    result.push({ duration: d, isRest: true });
    rem -= durationBeats(d);
  }
  return result;
}

export function RhythmStaff({ round, placedUnits, feedback, onSwap }: RhythmStaffProps) {
  const vexRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [noteXs, setNoteXs] = useState<number[]>([]);
  const [dragSrc, setDragSrc] = useState<number | null>(null);

  useEffect(() => {
    const div = vexRef.current;
    if (!div) return;
    div.innerHTML = '';

    const W = Math.max((wrapRef.current?.clientWidth ?? 700) - 8, 400);
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, STAFF_H);
    const ctx = renderer.getContext();

    const bpb = beatsPerMeasure(round.timeSignature);
    const perMeasureW = (W - CLEF_EXTRA) / round.measures;

    const tsStr = round.timeSignature; // '4/4', '3/4', etc.

    // Split placedUnits into per-measure buckets
    const measureBuckets: RhythmUnit[][] = Array.from({ length: round.measures }, () => []);
    let cursor = 0;
    let mIdx = 0;
    for (const unit of placedUnits) {
      measureBuckets[mIdx].push(unit);
      cursor += durationBeats(unit.duration);
      if (cursor >= bpb * (mIdx + 1) - 0.001) mIdx = Math.min(mIdx + 1, round.measures - 1);
    }

    const placedNoteRefs: StaveNote[] = []; // only placed (non-placeholder) notes for x-tracking

    for (let m = 0; m < round.measures; m++) {
      const staveX = m === 0 ? 0 : CLEF_EXTRA + m * perMeasureW;
      const staveW = m === 0 ? CLEF_EXTRA + perMeasureW : perMeasureW;
      const stave = new Stave(staveX, 10, staveW);
      if (m === 0) stave.addClef('treble').addTimeSignature(tsStr);
      stave.setContext(ctx).draw();

      // Build notes for this measure
      const placed = measureBuckets[m];
      const placedBeats = placed.reduce((s, u) => s + durationBeats(u.duration), 0);
      const remaining = bpb - placedBeats;
      const placeholders = fillPlaceholders(remaining);

      const allNotes: StaveNote[] = [];
      const beamCandidates: StaveNote[] = [];

      for (let i = 0; i < placed.length; i++) {
        const unit = placed[i];
        const note = makeStaveNote(unit);

        // Determine global index for feedback
        const globalIdx = measureBuckets.slice(0, m).reduce((s, b) => s + b.length, 0) + i;
        let fill = '#000000';
        if (feedback) {
          const fb = feedback[globalIdx];
          fill = fb === 'correct' ? '#27ae60' : fb === 'wrong' ? '#c0392b' : '#000000';
        }
        note.setStyle({ fillStyle: fill, strokeStyle: fill });
        allNotes.push(note);
        placedNoteRefs.push(note);
        if (!unit.isRest && ['8', '16'].includes(unit.duration)) {
          beamCandidates.push(note);
        }
      }

      for (const ph of placeholders) {
        const note = makeStaveNote(ph);
        note.setStyle({ fillStyle: '#cccccc', strokeStyle: '#cccccc' });
        allNotes.push(note);
      }

      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
      voice.addTickables(allNotes);
      const usableW = staveW - 20;
      new Formatter().joinVoices([voice]).format([voice], usableW);
      voice.draw(ctx, stave);

      const beams = Beam.generateBeams(beamCandidates);
      beams.forEach(b => b.setContext(ctx).draw());
    }

    // Capture placed note x-positions for drag overlays
    const xs = placedNoteRefs.map(n => n.getAbsoluteX());
    setNoteXs(xs);
  }, [round, placedUnits, feedback]);

  return (
    <div ref={wrapRef} className="relative overflow-x-auto">
      <div ref={vexRef} style={{ height: STAFF_H }} />
      {!feedback && noteXs.map((x, i) => (
        <div
          key={i}
          className="absolute top-0 cursor-grab"
          style={{
            left: x - 12,
            width: 24,
            height: STAFF_H,
            zIndex: 10,
            background: dragSrc === i ? 'rgba(99,102,241,0.12)' : 'transparent',
          }}
          onMouseDown={e => { e.preventDefault(); setDragSrc(i); }}
          onMouseUp={() => {
            if (dragSrc !== null && dragSrc !== i) onSwap(dragSrc, i);
            setDragSrc(null);
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RhythmStaff.tsx
git commit -m "feat: add RhythmStaff VexFlow component"
```

---

### Task 4: Trainer Component — `src/components/RhythmTrainer.tsx`

**Files:**
- Create: `src/components/RhythmTrainer.tsx`

**Consumes from Tasks 1–3:**
- `RhythmRound`, `RhythmUnit`, `RhythmSettings`, `RhythmDuration`, `durationBeats`, `beatsPerMeasure` from `'../lib/rhythmTraining'`
- `SessionScore` from `'../lib/earTraining'`
- `playRhythmRound`, `stopRhythm`, `initAudio` from `'../lib/audio'`
- `RhythmStaff` from `'./RhythmStaff'`

**Produces for Task 5:**
```typescript
interface RhythmTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}
export function RhythmTrainer(props: RhythmTrainerProps): JSX.Element
```

**Logic:**
- On mount / round change: reset state, call `playRhythmRound(round)` (gated on `initAudio()`)
- Palette: one pill per `settings.enabledDurations`, labeled W/H/H./Q/Q./8/16
- Rest toggle pill
- Place: append `{ duration: selectedDuration, isRest }` when `durationBeats(selectedDuration) <= remainingBeats`
- Delete: remove last placed unit
- Submit: compare `placedUnits[i]` vs `round.units[i]` — correct iff same `duration` AND same `isRest`
- Next: call `onComplete(allCorrect)`, `stopRhythm()`

- [ ] **Step 1: Create `src/components/RhythmTrainer.tsx`**

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import {
  RhythmRound, RhythmUnit, RhythmSettings, RhythmDuration,
  durationBeats, beatsPerMeasure,
} from '../lib/rhythmTraining';
import { SessionScore } from '../lib/earTraining';
import { initAudio, playRhythmRound, stopRhythm } from '../lib/audio';
import { RhythmStaff } from './RhythmStaff';

interface RhythmTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}

const DURATION_LABELS: Record<RhythmDuration, string> = {
  w: 'W', h: 'H', hd: 'H.', q: 'Q', qd: 'Q.', '8': '8', '16': '16',
};

export function RhythmTrainer({ round, score, settings, onComplete }: RhythmTrainerProps) {
  const [placedUnits, setPlacedUnits] = useState<RhythmUnit[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<RhythmDuration>('q');
  const [isRest, setIsRest] = useState(false);
  const [feedback, setFeedback] = useState<('correct' | 'wrong' | null)[] | null>(null);

  const totalBeats = beatsPerMeasure(round.timeSignature) * round.measures;
  const usedBeats = placedUnits.reduce((s, u) => s + durationBeats(u.duration), 0);
  const remainingBeats = Math.max(0, totalBeats - usedBeats);

  const handlePlay = useCallback(() => {
    initAudio().then(() => playRhythmRound(round)).catch(() => {});
  }, [round]);

  // Auto-play on new round
  useEffect(() => {
    setPlacedUnits([]);
    setSelectedDuration('q');
    setIsRest(false);
    setFeedback(null);
    handlePlay();
    return () => stopRhythm();
  }, [round]);

  function handlePlace() {
    if (durationBeats(selectedDuration) > remainingBeats + 0.001) return;
    setPlacedUnits(prev => [...prev, { duration: selectedDuration, isRest }]);
  }

  function handleDelete() {
    if (feedback) return;
    setPlacedUnits(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (remainingBeats > 0.001 || feedback) return;
    const fb = round.units.map((correct, i) => {
      const placed = placedUnits[i];
      if (!placed) return 'wrong' as const;
      return placed.duration === correct.duration && placed.isRest === correct.isRest
        ? 'correct' as const
        : 'wrong' as const;
    });
    setFeedback(fb);
  }

  function handleSwap(i: number, j: number) {
    if (feedback) return;
    setPlacedUnits(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    stopRhythm();
    onComplete(allCorrect);
  }

  const canPlace = durationBeats(selectedDuration) <= remainingBeats + 0.001;
  const canSubmit = remainingBeats < 0.001 && !feedback;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Staff */}
      <RhythmStaff
        round={round}
        placedUnits={placedUnits}
        feedback={feedback}
        onSwap={handleSwap}
      />

      {/* Remaining beat indicator */}
      {!feedback && (
        <p className="text-xs text-brand-secondary text-center">
          {remainingBeats > 0.001
            ? `${remainingBeats.toFixed(2).replace(/\.?0+$/, '')} beats remaining`
            : 'All beats filled — ready to submit'}
        </p>
      )}

      {/* Feedback result */}
      {feedback && (
        <p className={cn(
          'text-sm font-semibold text-center',
          feedback.every(f => f === 'correct') ? 'text-green-600' : 'text-red-500',
        )}>
          {feedback.every(f => f === 'correct') ? 'Correct! 🎯' : 'Not quite — review in green/red above'}
        </p>
      )}

      {/* Palette */}
      {!feedback && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            {settings.enabledDurations.map(dur => (
              <button
                key={dur}
                onClick={() => { setSelectedDuration(dur); handlePlaceImmediate(dur); }}
                disabled={durationBeats(dur) > remainingBeats + 0.001}
                className={cn(
                  'w-10 h-10 rounded-lg text-sm font-bold border transition-colors',
                  selectedDuration === dur
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                  durationBeats(dur) > remainingBeats + 0.001 && 'opacity-40 cursor-not-allowed',
                )}
              >
                {DURATION_LABELS[dur]}
              </button>
            ))}
            {settings.enableRests && (
              <button
                onClick={() => setIsRest(r => !r)}
                className={cn(
                  'px-3 h-10 rounded-lg text-sm font-medium border transition-colors',
                  isRest
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                )}
              >
                Rest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePlay}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          ▶ Play
        </button>
        {!feedback && (
          <button
            onClick={handleDelete}
            disabled={placedUnits.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Delete
          </button>
        )}
        {canSubmit && !feedback && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Submit
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

  function handlePlaceImmediate(dur: RhythmDuration) {
    if (durationBeats(dur) > remainingBeats + 0.001 || !!feedback) return;
    setPlacedUnits(prev => [...prev, { duration: dur, isRest }]);
  }
}
```

**Note:** The palette buttons call `handlePlaceImmediate(dur)` directly (placing on single click) rather than requiring a separate Place button. `selectedDuration` is still updated for visual highlighting. The `handlePlace` function defined earlier is not used — remove it before committing (it's superseded by `handlePlaceImmediate`).

- [ ] **Step 2: Remove the unused `handlePlace` function**

The `handlePlace` function defined in step 1 is dead code (palette buttons call `handlePlaceImmediate`). Delete it from the file:
```typescript
// Delete this entire function:
function handlePlace() {
  if (durationBeats(selectedDuration) > remainingBeats + 0.001) return;
  setPlacedUnits(prev => [...prev, { duration: selectedDuration, isRest }]);
}
```

- [ ] **Step 3: Lint check**

```bash
npm run lint
```
Expected: no errors. If `handlePlace` reference survives, verify step 2 was applied.

- [ ] **Step 4: Commit**

```bash
git add src/components/RhythmTrainer.tsx
git commit -m "feat: add RhythmTrainer game component"
```

---

### Task 5: EarTraining.tsx Wiring

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Consumes from Tasks 1–4:**
- `RhythmRound`, `RhythmSettings`, `generateRhythmRound` from `'../lib/rhythmTraining'`
- `playRhythmRound`, `stopRhythm` from `'../lib/audio'` (add to existing import)
- `RhythmTrainer` from `'../components/RhythmTrainer'`

**Changes overview:**
1. New import lines
2. New `rhythmSettings` state (line ~81 area)
3. `advanceRound`: add rhythm branch before `makeRound` fallback
4. Mode tabs: add Rhythm button after Plan
5. Settings panel: add rhythm-specific settings section
6. Round area: add RhythmTrainer block inside `settings.mode !== 'plan'` guard

- [ ] **Step 1: Add imports**

At the top of `EarTraining.tsx`, add to the import from `'../lib/rhythmTraining'`:
```typescript
import {
  RhythmRound, RhythmSettings, RhythmDuration,
  generateRhythmRound, durationBeats, beatsPerMeasure,
} from '../lib/rhythmTraining';
```

Add to the existing `'../lib/audio'` import line — append `stopRhythm` and `playRhythmRound`:
```typescript
import { initAudio, playStrum, playNote, startDrone, stopDrone, stopRhythm } from '../lib/audio';
```

Add component import:
```typescript
import { RhythmTrainer } from '../components/RhythmTrainer';
```

- [ ] **Step 2: Add `rhythmSettings` state**

After the `pianoView` state declaration (line ~61), add:
```typescript
const [rhythmSettings, setRhythmSettings] = useState<RhythmSettings>({
  timeSignature: '4/4',
  enabledDurations: ['h', 'q'],
  enableRests: false,
  bpm: 80,
});
```

- [ ] **Step 3: Add rhythm branch to `advanceRound`**

Inside `advanceRound`, after the fretboard branch (after the closing `}` of the `effectiveMode === 'fretboard'` block but before `r = makeRound(...)`), add:

```typescript
if (effectiveMode === 'rhythm') {
  const r = generateRhythmRound(difficulty, rhythmSettings);
  setSelected(null);
  setTentative(null);
  setRound(r);
  roundStartTimeRef.current = Date.now();
  return;
}
```

- [ ] **Step 4: Add `handleRhythmMode` handler**

After `handleFretboardMode` (line ~195 area), add:
```typescript
function handleRhythmMode() {
  stopRhythm();
  const next = { ...settings, mode: 'rhythm' as const };
  setSettings(next);
  advanceRound(next);
}
```

- [ ] **Step 5: Add `handleRhythmComplete` handler**

After `handleRhythmMode`, add:
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

- [ ] **Step 6: Add Rhythm tab to mode selector**

In the mode tabs `<div>` (around line ~495), after the Plan button's closing `</button>` tag and before the closing `</div>` of the tab container, add:
```tsx
<button
  onClick={handleRhythmMode}
  className={cn(
    'flex-1 py-2.5 text-sm font-medium transition-colors',
    settings.mode === 'rhythm'
      ? 'bg-brand-primary text-white'
      : 'text-brand-secondary hover:bg-brand-sidebar'
  )}
>
  Rhythm
</button>
```

- [ ] **Step 7: Add rhythm settings section to settings panel**

Inside the settings panel (`settings.settingsPanelOpen && (...)` block), after the last existing settings section and before the closing `</div>`, add a conditional block for rhythm mode:

```tsx
{settings.mode === 'rhythm' && (
  <div className="pt-3 space-y-3 border-t border-brand-line">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary">Rhythm Settings</p>

    {/* Time Signature */}
    <div>
      <p className="text-xs text-brand-secondary mb-1.5">Time Signature</p>
      <div className="flex gap-1.5 flex-wrap">
        {(['4/4', '2/4', '3/4', '6/8'] as const).map(ts => (
          <button
            key={ts}
            onClick={() => setRhythmSettings(r => ({ ...r, timeSignature: ts }))}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium border transition-colors',
              rhythmSettings.timeSignature === ts
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
            )}
          >
            {ts}
          </button>
        ))}
      </div>
    </div>

    {/* BPM */}
    <div>
      <p className="text-xs text-brand-secondary mb-1.5">BPM: {rhythmSettings.bpm}</p>
      <input
        type="range"
        min={40}
        max={160}
        step={5}
        value={rhythmSettings.bpm}
        onChange={e => setRhythmSettings(r => ({ ...r, bpm: Number(e.target.value) }))}
        className="w-full accent-brand-primary"
      />
    </div>

    {/* Note types */}
    <div>
      <p className="text-xs text-brand-secondary mb-1.5">Note Types</p>
      <div className="flex gap-2 flex-wrap">
        {([
          { dur: 'w', label: 'Whole' },
          { dur: 'h', label: 'Half' },
          { dur: 'hd', label: 'Dotted Half' },
          { dur: 'q', label: 'Quarter' },
          { dur: 'qd', label: 'Dotted Quarter' },
          { dur: '8', label: 'Eighth' },
          { dur: '16', label: 'Sixteenth' },
        ] as { dur: RhythmDuration; label: string }[]).map(({ dur, label }) => {
          const active = rhythmSettings.enabledDurations.includes(dur);
          return (
            <button
              key={dur}
              onClick={() =>
                setRhythmSettings(r => ({
                  ...r,
                  enabledDurations: active
                    ? r.enabledDurations.length > 1
                      ? r.enabledDurations.filter(d => d !== dur)
                      : r.enabledDurations
                    : [...r.enabledDurations, dur],
                }))
              }
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                active
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>

    {/* Rests toggle */}
    <div className="flex items-center gap-2">
      <button
        onClick={() => setRhythmSettings(r => ({ ...r, enableRests: !r.enableRests }))}
        className={cn(
          'px-3 py-1 rounded text-xs font-medium border transition-colors',
          rhythmSettings.enableRests
            ? 'bg-brand-primary text-white border-brand-primary'
            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
        )}
      >
        {rhythmSettings.enableRests ? 'Rests: On' : 'Rests: Off'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 8: Add RhythmTrainer to the round area**

In the round area block (inside `settings.mode !== 'plan'`), the current structure is:
```tsx
{settings.mode === 'fretboard' ? (
  ...
) : settings.mode === 'study' ? (
  ...
) : (
  // chord/interval round
)}
```

Change the final `: (` to `: settings.mode === 'rhythm' ? (` and add the rhythm case before the chord/interval fallback:

```tsx
) : settings.mode === 'rhythm' ? (
  <RhythmTrainer
    round={round as RhythmRound}
    score={score}
    settings={rhythmSettings}
    onComplete={handleRhythmComplete}
  />
) : (
  // existing chord/interval round JSX (unchanged)
```

- [ ] **Step 9: Lint check**

```bash
npm run lint
```
Expected: no errors. If TypeScript complains about `round as RhythmRound`, verify that `RhythmRound` was added to the `Round` union in Task 1 Step 3.

- [ ] **Step 10: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: wire rhythm ear training mode into EarTraining page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: All types, `durationBeats`, `vexDuration`, `beatsPerMeasure`, `generateRhythmRound`, mode union, `Round` type
- ✅ Task 2: `clapSynth`, `playRhythmRound` (count-in + pattern + beats, 6/8 special case), `stopRhythm`
- ✅ Task 3: `RhythmStaff` — VexFlow rendering, per-measure layout, note colors (`setStyle`), dotted notes (`Dot`), beams, placeholder rests, drag overlays via `getAbsoluteX()`
- ✅ Task 4: `RhythmTrainer` — palette, rest toggle, beat budget tracking, place/delete/submit/next controls, per-note feedback evaluation, drag-to-swap via `onSwap`
- ✅ Task 5: imports, `rhythmSettings` state, `advanceRound` branch, `handleRhythmMode`, `handleRhythmComplete`, Rhythm tab, settings panel (time sig, BPM, note types, rests toggle), round area
- ✅ Existing modes untouched

**Type consistency check:**
- `RhythmRound.kind === 'rhythm'` — declared in Task 1, used as discriminant in Task 5 `round as RhythmRound`
- `vexDuration(unit)` returns string consumed by `new StaveNote({ duration: ... })` in Task 3 ✅
- `durationBeats` imported in audio.ts (Task 2) and RhythmTrainer (Task 4) from same source ✅
- `RhythmSettings.enabledDurations` consumed by palette in Task 4 and `generateRhythmRound` in Task 1 ✅
- `onComplete: (wasCorrect: boolean) => void` declared in Task 4, wired to `handleRhythmComplete` in Task 5 ✅

**Placeholder scan:** None found — all steps contain complete code.

**One cross-task concern:** Task 4 `handlePlaceImmediate` closes over `isRest` and `feedback` state, and also calls `setPlacedUnits` inside a function defined after these state hooks — verify these are in scope at function declaration site (they are, as all are declared in the same component body before `handlePlaceImmediate` is defined at the end).
