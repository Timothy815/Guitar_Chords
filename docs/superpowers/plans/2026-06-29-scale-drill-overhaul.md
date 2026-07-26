# Scale Drill Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Scale Drill's shared random-round system with a fully self-contained trainer featuring user-controlled scale/root/position/difficulty pickers, a Study mode for learning before drilling, progressive reveal on wrong answers, and per-scale streak tracking.

**Architecture:** Make `ScaleDrillTrainer` self-contained — it owns its pickers, round generation, study/drill mode, and streak state; EarTraining.tsx only passes `score` and `onComplete`. Two supporting changes: `Fretboard` gains `labeledDots` (selective dot labels for intermediate mode) and `flashHighlight` (pulsing star overlay for wrong-answer reveal); `generateScaleDrillRound` accepts filtering options and adds an anchor dot position to the returned round data.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Tone.js (`playArpeggio`, `initAudio`), `cn()` from `@/src/lib/utils`.

## Global Constraints

- No test files exist; lint gate is `npm run lint` (runs `tsc --noEmit`); expected output is empty (no errors)
- Tailwind v4 — no `tailwind.config.js`; use brand CSS variables: `brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-line`, `brand-active`, `brand-bg`
- No emojis in UI copy or code comments
- No new npm dependencies
- `@` resolves to project root; use `@/src/...` for aliased cross-directory imports; use relative `../` imports within `src/`
- `Fretboard` prop `showNoteNames` defaults to `true`; new `labeledDots` takes precedence per-dot when provided
- String indexing: `stringIdx 0` = low E (E2), `stringIdx 5` = high E (E4); `frets[i] === -1` = muted, `frets[i] === 0` = open
- `COMMON_SCALES` entries: `{ name: string; intervals: number[]; category: 'Pentatonic' | 'Blues' | 'Modes' | 'Minor' | 'Symmetric' }`
- `ALL_NOTES` is the 12-element chromatic array exported from `@/src/data/guitarData`
- `getFretNote(stringIdx, fret)` returns note string like `"A4"`; strip digits for just the pitch class
- `playArpeggio(notes: string[], tempoBpm?: number, duration?: string)` in `@/src/lib/audio` plays notes sequentially; `initAudio()` must be awaited before any playback (browser autoplay gate)
- `STANDARD_TUNING` is exported from `@/src/types`

---

## Task 1: Fretboard — add `labeledDots` and `flashHighlight` props

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Produces: `labeledDots?: { stringIdx: number; fret: number }[]` — when provided, a scale dot at a position in this list shows its note-name label even when `showNoteNames` is `false`; dots not in the list show no label (unless `showNoteNames` is `true`)
- Produces: `flashHighlight?: boolean` — when `true`, the `highlightNote` star overlay pulses with `animate-pulse`

- [ ] **Step 1: Read the current file**

  ```bash
  # The file is at:
  src/components/Fretboard.tsx
  ```

  Read lines 30–50 (FretboardProps interface + function signature) and lines 128–148 (scale dot text assignment) and lines 332–345 (highlightNote rendering).

- [ ] **Step 2: Add the two props to `FretboardProps`**

  In the `interface FretboardProps` block, after the `highlightNote` line, add:

  ```tsx
  labeledDots?: { stringIdx: number; fret: number }[];
  flashHighlight?: boolean;
  ```

- [ ] **Step 3: Add `labeledDots` and `flashHighlight` to the function destructuring**

  The function signature starts with:
  ```tsx
  export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote }: FretboardProps) {
  ```

  Replace the destructuring (all one line) with:
  ```tsx
  export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote, labeledDots, flashHighlight }: FretboardProps) {
  ```

- [ ] **Step 4: Apply `labeledDots` in the scale-dot text assignment**

  Locate the line inside `renderNoteMarker` in the `// Check Scale` block that reads:
  ```tsx
  text = labelMode !== 'none' ? getLabelText(noteJustName) : (showNoteNames ? noteJustName : "");
  ```

  Replace it with:
  ```tsx
  const isExplicitlyLabeled = labeledDots?.some(d => d.stringIdx === stringIdx && d.fret === fretIdx) ?? false;
  text = labelMode !== 'none' ? getLabelText(noteJustName) : (showNoteNames || isExplicitlyLabeled ? noteJustName : "");
  ```

- [ ] **Step 5: Apply `flashHighlight` to the star overlay**

  Locate the `highlightNote` rendering block (around line 332). The `<g>` element currently reads:
  ```tsx
  <g key="highlight-note" style={{ pointerEvents: 'none' }}>
    <circle cx={x} cy={y} r={r} fill="var(--color-brand-primary)" opacity={0.9} />
    <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">★</text>
  </g>
  ```

  Replace the `<g>` opening tag with one that conditionally adds `animate-pulse`:
  ```tsx
  <g key="highlight-note" style={{ pointerEvents: 'none' }} className={flashHighlight ? 'animate-pulse' : undefined}>
    <circle cx={x} cy={y} r={r} fill="var(--color-brand-primary)" opacity={0.9} />
    <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">★</text>
  </g>
  ```

- [ ] **Step 6: Lint**

  ```bash
  npm run lint
  ```

  Expected: no output (zero errors).

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/Fretboard.tsx
  git commit -m "feat: add labeledDots and flashHighlight props to Fretboard"
  ```

---

## Task 2: earTraining.ts — extend `generateScaleDrillRound` with options and anchor

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Consumes: `ScaleDrillRound` interface (lines 72–80 of earTraining.ts)
- Produces (updated `ScaleDrillRound`):
  ```ts
  export interface ScaleDrillRound {
    kind: 'scaleDrill';
    scaleName: string;
    root: Note;
    targetStringIdx: number;
    targetFret: number;
    targetNote: Note;
    options: Note[];
    anchorStringIdx: number;  // NEW — non-target scale dot used as labeled anchor in intermediate mode
    anchorFret: number;       // NEW
  }
  ```
- Produces (updated function signature):
  ```ts
  export function generateScaleDrillRound(opts?: {
    scaleName?: string;
    root?: Note;
    fretRange?: [number, number];
  }): ScaleDrillRound
  ```
- Produces (exported constant):
  ```ts
  export const SCALE_DRILL_POSITIONS: Record<string, [number, number]> = {
    full:  [0, 12],
    open:  [0, 4],
    mid:   [5, 9],
    upper: [9, 12],
  };
  ```

- [ ] **Step 1: Read the current function**

  Read `src/lib/earTraining.ts` lines 72–80 (ScaleDrillRound interface) and lines 559–589 (generateScaleDrillRound).

- [ ] **Step 2: Add the two new fields to `ScaleDrillRound`**

  Change the interface from:
  ```ts
  export interface ScaleDrillRound {
    kind: 'scaleDrill';
    scaleName: string;
    root: Note;
    targetStringIdx: number;
    targetFret: number;
    targetNote: Note;
    options: Note[];
  }
  ```

  To:
  ```ts
  export interface ScaleDrillRound {
    kind: 'scaleDrill';
    scaleName: string;
    root: Note;
    targetStringIdx: number;
    targetFret: number;
    targetNote: Note;
    options: Note[];
    anchorStringIdx: number;
    anchorFret: number;
  }
  ```

- [ ] **Step 3: Export the positions constant**

  Immediately above the `generateScaleDrillRound` function, add:
  ```ts
  export const SCALE_DRILL_POSITIONS: Record<string, [number, number]> = {
    full:  [0, 12],
    open:  [0, 4],
    mid:   [5, 9],
    upper: [9, 12],
  };
  ```

- [ ] **Step 4: Rewrite `generateScaleDrillRound` to accept options and produce anchor**

  Replace the entire current function with:

  ```ts
  export function generateScaleDrillRound(opts?: {
    scaleName?: string;
    root?: Note;
    fretRange?: [number, number];
  }): ScaleDrillRound {
    const scaleDef = opts?.scaleName
      ? (COMMON_SCALES.find(s => s.name === opts.scaleName) ?? COMMON_SCALES[0])
      : COMMON_SCALES[Math.floor(Math.random() * COMMON_SCALES.length)];

    const root: Note = opts?.root ?? ALL_NOTES[Math.floor(Math.random() * 12)];
    const pattern = generateScalePattern(root, scaleDef);
    const [minFret, maxFret] = opts?.fretRange ?? [0, 12];

    const positions: { stringIdx: number; fret: number; note: Note }[] = [];
    STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
      for (let fret = minFret; fret <= maxFret; fret++) {
        const note = getNoteFromFret(openNote, fret);
        if (pattern.notes.includes(note)) {
          positions.push({ stringIdx, fret, note });
        }
      }
    });

    // Fall back to full neck if the position window has no scale notes
    if (positions.length === 0) {
      STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
        for (let fret = 0; fret <= 12; fret++) {
          const note = getNoteFromFret(openNote, fret);
          if (pattern.notes.includes(note)) {
            positions.push({ stringIdx, fret, note });
          }
        }
      });
    }

    const target = positions[Math.floor(Math.random() * positions.length)];

    // Anchor: a different position (prefer a different string) for the labeled hint in intermediate mode
    const otherPositions = positions.filter(
      p => !(p.stringIdx === target.stringIdx && p.fret === target.fret)
    );
    const anchorPool = otherPositions.filter(p => p.stringIdx !== target.stringIdx);
    const anchorSource = anchorPool.length > 0 ? anchorPool : otherPositions;
    const anchor = anchorSource.length > 0
      ? anchorSource[Math.floor(Math.random() * anchorSource.length)]
      : target; // degenerate: single-note position, anchor = target

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
      anchorStringIdx: anchor.stringIdx,
      anchorFret: anchor.fret,
    };
  }
  ```

- [ ] **Step 5: Lint**

  ```bash
  npm run lint
  ```

  Expected: no output. If TypeScript complains that `anchorStringIdx` / `anchorFret` are missing from callers, that is expected — Task 4 will fix EarTraining.tsx which previously constructed `ScaleDrillRound` indirectly. The only direct caller is `generateScaleDrillRound` itself, which now always sets both fields.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/earTraining.ts
  git commit -m "feat: extend generateScaleDrillRound with options and anchor position"
  ```

---

## Task 3: ScaleDrillTrainer — full rebuild as self-contained component

This is the largest task. The component gains its own pickers (scale, root, position, difficulty), a Study mode, progressive reveal on wrong answers, and per-scale streak tracking. EarTraining.tsx will no longer pass `round` — the component manages it internally.

**Files:**
- Modify: `src/components/ScaleDrillTrainer.tsx` (full replacement)

**Interfaces:**
- Consumes from Task 1: `Fretboard` props `labeledDots` and `flashHighlight`
- Consumes from Task 2: `generateScaleDrillRound(opts?)`, `SCALE_DRILL_POSITIONS`, updated `ScaleDrillRound` (with `anchorStringIdx`, `anchorFret`)
- New props interface:
  ```ts
  interface ScaleDrillTrainerProps {
    score: SessionScore;
    onComplete: (wasCorrect: boolean) => void;
  }
  ```
  (Remove the old `round: ScaleDrillRound` prop — it is now internal state.)

**Difficulty behaviour:**
- `'Beginner'`: `showNoteNames={true}` on Fretboard — all scale dots labeled
- `'Intermediate'`: `showNoteNames={false}`, `labeledDots={[{ stringIdx: round.anchorStringIdx, fret: round.anchorFret }]}` — only the anchor dot is labeled
- `'Advanced'`: `showNoteNames={false}`, no `labeledDots` — no labels at all

**Study mode behaviour:**
- Shown when `studyMode === true` (default on first load and when pickers change scale/root)
- Full fretboard (`fretsNum={12}`) with `showNoteNames={true}`, no `fretRange` restriction (shows whole neck)
- Play button: awaits `initAudio()`, collects all scale notes sorted by MIDI pitch, calls `playArpeggio`
- "Start Drilling" button flips `studyMode` to `false` and generates the first round

**Progressive reveal:**
- On wrong answer: set `flashCorrect = true`, call `onComplete(false)` after 1500 ms, generate next round after 1500 ms
- While `flashCorrect` is true: pass `flashHighlight={true}` to Fretboard so the ★ pulses

**Streak tracking:**
- `streaks: Record<string, number>` — key is `"${root}|${scaleName}"`
- Incremented on correct, reset to 0 on incorrect
- Displayed as `"Streak: N"` chip next to score

**Position picker values:**
```
full  → label "Full neck"  → fretRange [0, 12]
open  → label "Open (0–4)" → fretRange [0, 4]
mid   → label "Mid (5–9)"  → fretRange [5, 9]
upper → label "Upper (9–12)"→ fretRange [9, 12]
```
Import `SCALE_DRILL_POSITIONS` from `@/src/lib/earTraining` to get the ranges.

- [ ] **Step 1: Write the complete new component**

  Replace the entire contents of `src/components/ScaleDrillTrainer.tsx` with:

  ```tsx
  import React, { useState, useCallback } from 'react';
  import { cn } from '@/src/lib/utils';
  import { ScaleDrillRound, SessionScore, generateScaleDrillRound, SCALE_DRILL_POSITIONS } from '@/src/lib/earTraining';
  import { Fretboard } from '@/src/components/Fretboard';
  import { generateScalePattern, COMMON_SCALES } from '@/src/data/guitarData';
  import { ALL_NOTES } from '@/src/data/guitarData';
  import { initAudio, playArpeggio, getFretNote } from '@/src/lib/audio';
  import { STANDARD_TUNING } from '@/src/types';
  import type { Note } from '@/src/types';

  type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
  type Position = 'full' | 'open' | 'mid' | 'upper';

  const POSITION_LABELS: Record<Position, string> = {
    full:  'Full neck',
    open:  'Open (0–4)',
    mid:   'Mid (5–9)',
    upper: 'Upper (9–12)',
  };

  // Group COMMON_SCALES by category for the dropdown
  const SCALE_CATEGORIES = Array.from(new Set(COMMON_SCALES.map(s => s.category)));

  interface ScaleDrillTrainerProps {
    score: SessionScore;
    onComplete: (wasCorrect: boolean) => void;
  }

  export function ScaleDrillTrainer({ score, onComplete }: ScaleDrillTrainerProps) {
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [scaleName, setScaleName] = useState<string>(COMMON_SCALES[0].name);
    const [root, setRoot] = useState<Note>('A');
    const [position, setPosition] = useState<Position>('full');

    const [studyMode, setStudyMode] = useState(true);
    const [round, setRound] = useState<ScaleDrillRound>(() =>
      generateScaleDrillRound({ scaleName: COMMON_SCALES[0].name, root: 'A', fretRange: SCALE_DRILL_POSITIONS.full })
    );
    const [selected, setSelected] = useState<Note | null>(null);
    const [flashCorrect, setFlashCorrect] = useState(false);
    const [streaks, setStreaks] = useState<Record<string, number>>({});

    const streakKey = `${root}|${scaleName}`;
    const currentStreak = streaks[streakKey] ?? 0;

    const scaleDef = COMMON_SCALES.find(s => s.name === scaleName) ?? COMMON_SCALES[0];
    const scalePattern = generateScalePattern(root, scaleDef);

    function makeRound(sName: string, r: Note, pos: Position): ScaleDrillRound {
      return generateScaleDrillRound({ scaleName: sName, root: r, fretRange: SCALE_DRILL_POSITIONS[pos] });
    }

    function handlePickerChange(newScale: string, newRoot: Note, newPos: Position) {
      setScaleName(newScale);
      setRoot(newRoot);
      setPosition(newPos);
      setStudyMode(true);
      setSelected(null);
      setFlashCorrect(false);
      setRound(makeRound(newScale, newRoot, newPos));
    }

    async function handlePlayScale() {
      await initAudio();
      // Collect all fretted positions of scale notes sorted by pitch (ascending)
      const notes: { note: string; midi: number }[] = [];
      STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
        for (let fret = 0; fret <= 12; fret++) {
          const noteStr = getFretNote(stringIdx, fret);
          const noteName = noteStr.replace(/[0-9]/g, '');
          if (scalePattern.notes.includes(noteName as Note)) {
            // Rough MIDI: parse octave from noteStr
            const octave = parseInt(noteStr.replace(/[^0-9]/g, ''), 10);
            const chromaticIdx = ALL_NOTES.indexOf(noteName as Note);
            notes.push({ note: noteStr, midi: octave * 12 + chromaticIdx });
          }
        }
      });
      // Deduplicate by MIDI pitch, keep lowest-fret representative
      const seen = new Set<number>();
      const unique = notes
        .sort((a, b) => a.midi - b.midi)
        .filter(n => { if (seen.has(n.midi)) return false; seen.add(n.midi); return true; });
      playArpeggio(unique.map(n => n.note), 80, '4n');
    }

    function handleStartDrilling() {
      setStudyMode(false);
      setSelected(null);
      setFlashCorrect(false);
      setRound(makeRound(scaleName, root, position));
    }

    function handleSelect(note: Note) {
      if (selected !== null) return;
      setSelected(note);
      const isCorrect = note === round.targetNote;

      if (isCorrect) {
        setStreaks(prev => ({ ...prev, [streakKey]: (prev[streakKey] ?? 0) + 1 }));
        onComplete(true);
        setTimeout(() => {
          setSelected(null);
          setRound(makeRound(scaleName, root, position));
        }, 600);
      } else {
        setStreaks(prev => ({ ...prev, [streakKey]: 0 }));
        setFlashCorrect(true);
        setTimeout(() => {
          setFlashCorrect(false);
          setSelected(null);
          onComplete(false);
          setRound(makeRound(scaleName, root, position));
        }, 1500);
      }
    }

    const labeledDots: { stringIdx: number; fret: number }[] | undefined =
      difficulty === 'Intermediate'
        ? [{ stringIdx: round.anchorStringIdx, fret: round.anchorFret }]
        : undefined;

    const fretRange: [number, number] = SCALE_DRILL_POSITIONS[position];

    return (
      <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">

        {/* Pickers row */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            {/* Root picker */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Root</label>
              <select
                value={root}
                onChange={e => handlePickerChange(scaleName, e.target.value as Note, position)}
                className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                {ALL_NOTES.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Scale picker */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Scale</label>
              <select
                value={scaleName}
                onChange={e => handlePickerChange(e.target.value, root, position)}
                className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                {SCALE_CATEGORIES.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {COMMON_SCALES.filter(s => s.category === cat).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Position picker */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Position</label>
              <select
                value={position}
                onChange={e => handlePickerChange(scaleName, root, e.target.value as Position)}
                className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                {(Object.keys(POSITION_LABELS) as Position[]).map(p => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Difficulty pills */}
          <div className="flex gap-2">
            {(['Beginner', 'Intermediate', 'Advanced'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                  difficulty === d
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Score + streak row */}
        <div className="flex items-center justify-between text-xs text-brand-secondary">
          <span>Round {score.total + 1}</span>
          <div className="flex items-center gap-3">
            {currentStreak >= 3 && (
              <span className="text-brand-primary font-semibold">
                Streak: {currentStreak}
              </span>
            )}
            <span>{score.correct}/{score.total} correct</span>
          </div>
        </div>

        {studyMode ? (
          /* ── Study mode ─────────────────────────────────────────────── */
          <div className="space-y-3">
            <p className="text-sm font-medium text-brand-ink">
              Study: <span className="text-brand-primary font-bold">{root} {scaleName}</span>
              <span className="text-brand-secondary font-normal"> — {POSITION_LABELS[position]}</span>
            </p>
            <p className="text-xs text-brand-secondary">
              All notes are labeled. Use Play to hear the scale, then start drilling when ready.
            </p>
            <div className="overflow-x-auto">
              <Fretboard
                scale={scalePattern}
                showNoteNames={true}
                fretsNum={12}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePlayScale}
                className="px-4 py-2 rounded-lg border border-brand-line text-sm font-medium text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
              >
                Play scale
              </button>
              <button
                onClick={handleStartDrilling}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                Start Drilling →
              </button>
            </div>
          </div>
        ) : (
          /* ── Drill mode ──────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-brand-ink">
                What note is highlighted (★) in{' '}
                <span className="text-brand-primary font-bold">{round.root} {round.scaleName}</span>?
              </p>
              {difficulty === 'Intermediate' && (
                <p className="text-xs text-brand-secondary">
                  The labeled dot is your anchor — use it to navigate to the star.
                </p>
              )}
              <p className="text-xs text-brand-secondary">
                String {round.targetStringIdx + 1} (from low E), fret {round.targetFret}
              </p>
            </div>

            <div className="overflow-x-auto">
              <Fretboard
                scale={scalePattern}
                fretRange={fretRange}
                highlightNote={{ stringIdx: round.targetStringIdx, fret: round.targetFret }}
                showNoteNames={difficulty === 'Beginner'}
                labeledDots={labeledDots}
                flashHighlight={flashCorrect}
                fretsNum={12}
              />
            </div>

            {/* Answer buttons */}
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
              <p className={cn(
                'text-sm font-semibold text-center',
                selected === round.targetNote ? 'text-green-600' : 'text-red-500'
              )}>
                {selected === round.targetNote
                  ? 'Correct!'
                  : `Not quite — it\'s ${round.targetNote}`}
              </p>
            )}

            <button
              onClick={() => { setStudyMode(true); setSelected(null); setFlashCorrect(false); }}
              className="w-full py-1.5 rounded-lg border border-brand-line text-xs text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
            >
              Back to Study
            </button>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Lint**

  ```bash
  npm run lint
  ```

  Expected: no output. If there is an error about `STANDARD_TUNING` import, check that it is exported from `src/types.ts` (it is — confirmed in CLAUDE.md). If there's an error about `ALL_NOTES` having two imports from the same module, merge the two `from '@/src/data/guitarData'` imports into one line.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/ScaleDrillTrainer.tsx
  git commit -m "feat: rebuild ScaleDrillTrainer as self-contained component with pickers, study mode, and streaks"
  ```

---

## Task 4: EarTraining.tsx — simplify Scale Drill wiring

ScaleDrillTrainer is now self-contained. EarTraining.tsx needs to:
1. Remove the `scaleDrillRound` state (no longer needed)
2. Remove the `React.Fragment` key trick (no longer needed)
3. Remove `generateScaleDrillRound` from its imports
4. Pass only `score` and `onComplete` to `<ScaleDrillTrainer>`
5. Hide the shared Difficulty row in the settings panel when `settings.mode === 'scaleDrill'`

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: updated `ScaleDrillTrainer` props `{ score, onComplete }` (Task 3)

- [ ] **Step 1: Read the relevant sections**

  Read these line ranges in `src/pages/EarTraining.tsx`:
  - Lines 10–15 (imports — find `generateScaleDrillRound, ScaleDrillRound`)
  - Lines 106–110 (scaleDrillRound state)
  - Lines 335–349 (handleScaleDrillMode + handleScaleDrillComplete)
  - Lines 812–832 (settings panel Difficulty row)
  - Lines 1673–1681 (ScaleDrillTrainer render block)

- [ ] **Step 2: Remove `generateScaleDrillRound` and `ScaleDrillRound` from the import**

  Find the import line that looks like:
  ```ts
  generateScaleDrillRound, ScaleDrillRound,
  ```
  inside the earTraining import. Remove both names from that destructure (keep the rest of the import intact).

- [ ] **Step 3: Remove the `scaleDrillRound` state**

  Remove this line (around line 108):
  ```ts
  const [scaleDrillRound, setScaleDrillRound] = useState<ScaleDrillRound>(() => generateScaleDrillRound());
  ```

- [ ] **Step 4: Simplify `handleScaleDrillMode` and `handleScaleDrillComplete`**

  The current `handleScaleDrillMode` sets `scaleDrillRound`. Remove that call:
  ```ts
  function handleScaleDrillMode() {
    const next = { ...settings, mode: 'scaleDrill' as const };
    setSettings(next);
    // removed: setScaleDrillRound(generateScaleDrillRound());
  }
  ```

  The current `handleScaleDrillComplete` sets `scaleDrillRound`. Remove that call:
  ```ts
  function handleScaleDrillComplete(wasCorrect: boolean) {
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    // removed: setScaleDrillRound(generateScaleDrillRound());
  }
  ```

- [ ] **Step 5: Hide the shared Difficulty row when in scaleDrill mode**

  Find the difficulty row in the settings panel (around line 814):
  ```tsx
  {/* Difficulty presets */}
  <div className="pt-3">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
  ```

  Wrap the entire `<div className="pt-3">` block in a conditional that hides it when in scaleDrill mode:
  ```tsx
  {settings.mode !== 'scaleDrill' && (
    <div className="pt-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
      {/* ... rest of the difficulty block unchanged ... */}
    </div>
  )}
  ```

- [ ] **Step 6: Simplify the ScaleDrillTrainer render block**

  Find the current render block (around line 1673):
  ```tsx
  ) : settings.mode === 'scaleDrill' ? (
    <React.Fragment key={`${scaleDrillRound.root}-${scaleDrillRound.scaleName}-${scaleDrillRound.targetStringIdx}-${scaleDrillRound.targetFret}`}>
      <ScaleDrillTrainer
        round={scaleDrillRound}
        score={score}
        onComplete={handleScaleDrillComplete}
      />
    </React.Fragment>
  ```

  Replace with:
  ```tsx
  ) : settings.mode === 'scaleDrill' ? (
    <ScaleDrillTrainer
      score={score}
      onComplete={handleScaleDrillComplete}
    />
  ```

- [ ] **Step 7: Lint**

  ```bash
  npm run lint
  ```

  Expected: no output. If there are errors about `scaleDrillRound` still being referenced elsewhere, search for all uses with:
  ```bash
  grep -n "scaleDrillRound" src/pages/EarTraining.tsx
  ```
  and remove any remaining references.

- [ ] **Step 8: Commit**

  ```bash
  git add src/pages/EarTraining.tsx
  git commit -m "feat: simplify EarTraining scale drill wiring; trainer is now self-contained"
  ```

---

## Self-Review

**1. Spec coverage:**
- [x] Scale/root/position pickers — Task 3 (pickers row in ScaleDrillTrainer)
- [x] Difficulty scaffold (Beginner/Intermediate/Advanced) replacing shared controls — Task 3 (difficulty pills) + Task 4 (hide shared Difficulty row)
- [x] Beginner = all labels visible — `showNoteNames={true}` in drill mode
- [x] Intermediate = anchor dot labeled, rest unlabeled — `labeledDots` prop + Task 1 Fretboard change
- [x] Advanced = no labels — `showNoteNames={false}`, no `labeledDots`
- [x] Study mode with full labeled fretboard and Play button — Task 3 study mode block
- [x] "Start Drilling" flip from study to drill — Task 3 `handleStartDrilling`
- [x] Progressive reveal — `flashCorrect` state, `flashHighlight` Fretboard prop (Task 1), 1500 ms timeout
- [x] Streak tracking per scale+root — `streaks` Record in Task 3, shown when ≥ 3
- [x] Pickers change resets to study mode — `handlePickerChange` sets `studyMode = true`
- [x] Position picker filters which dots are quiz targets — `fretRange` passed to `generateScaleDrillRound`
- [x] Full neck still visible with fretRange filtering — Fretboard shows full 12-fret neck; `fretRange` controls which dots are quiz targets via earTraining.ts position filter

**2. Placeholder scan:** No TBD, TODO, or incomplete sections found.

**3. Type consistency:**
- `SCALE_DRILL_POSITIONS` defined in Task 2, imported in Task 3 — names match
- `ScaleDrillRound.anchorStringIdx` / `.anchorFret` defined in Task 2, consumed in Task 3 — names match
- `labeledDots` prop defined in Task 1, consumed in Task 3 — names match
- `flashHighlight` prop defined in Task 1, consumed in Task 3 — names match
- `ScaleDrillTrainer` new props `{ score, onComplete }` defined in Task 3, consumed in Task 4 — names match
