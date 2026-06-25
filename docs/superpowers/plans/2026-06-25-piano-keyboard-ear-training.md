# Piano Keyboard View + Octave Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a piano keyboard view toggle to the fretboard ear training mode, plus a unified octave range filter for both keyboard and fretboard views, using Salamander Grand Piano samples for audio feedback on keyboard key taps.

**Architecture:** Six focused tasks: (1) extend the earTraining.ts data layer with octave-aware note pools; (2) add a dedicated Salamander piano sampler to audio.ts; (3) create an SVG PianoKeyboard visual component; (4) create a PianoTrainer component (parallel to FretboardTrainer) supporting all four sub-modes; (5) add octave From/To filter controls to FretboardFocusSelector; (6) wire a Fretboard/Piano pill toggle and PianoTrainer into EarTraining.tsx.

**Tech Stack:** React 19, TypeScript, Tone.js (Sampler), SVG, Tailwind v4, `@tonaljs/tonal` (not needed — all note logic stays in earTraining.ts).

## Global Constraints

- `npm run lint` (tsc --noEmit) is the ONLY static check — no tests exist. Run it after every task.
- No `tailwind.config.js` — use inline Tailwind v4 classes and CSS variables directly.
- Use brand CSS variables for all colors: `brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`. Exception: the three keyboard feedback colors are spec-defined hex values — use them literally.
- Path alias: `@` resolves to the project root (not `src/`). Use `@/src/...` for aliased imports. Or use relative `../lib/...` imports.
- Deployment base path is `/Guitar_Chords/` — do not change vite.config.ts or App.tsx.
- Target note is ALWAYS played on **guitar** (via `playFretboardRound`). Piano audio fires only when the user **clicks a keyboard key** (via `playPianoNote`). Never swap these.

---

### Task 1: Extend earTraining.ts data layer

**Files:**
- Modify: `src/lib/earTraining.ts` (currently 446 lines)

**Interfaces:**
- Produces:
  - `FretboardFocus` gains `octaveMin?: number; octaveMax?: number`
  - `buildFretboardNotePool` filters by octave when those fields are set
  - `buildKeyboardNotePool(octaveMin?: number, octaveMax?: number): string[]` — new export
  - `generateKeyboardRound(octaveMin?: number, octaveMax?: number): FretboardRound` — new export

- [ ] **Step 1: Locate the FretboardFocus interface and buildFretboardNotePool function**

  Open `src/lib/earTraining.ts`. The `FretboardFocus` interface is at lines 404–408:
  ```typescript
  export interface FretboardFocus {
    stringIdxs?: number[];
    fretMin?: number;
    fretMax?: number;
  }
  ```
  The `buildFretboardNotePool` function is at lines 338–364.

- [ ] **Step 2: Extend FretboardFocus with octave fields**

  Replace the interface (lines 404–408) with:
  ```typescript
  export interface FretboardFocus {
    stringIdxs?: number[];  // [0..5]; empty or undefined = all strings
    fretMin?: number;       // inclusive; undefined = 0
    fretMax?: number;       // inclusive; undefined = fretsNum
    octaveMin?: number;     // inclusive; undefined = no restriction
    octaveMax?: number;     // inclusive; undefined = no restriction
  }
  ```

- [ ] **Step 3: Update buildFretboardNotePool to filter by octave**

  The existing function (lines 338–364) adds notes to a `Set<string>` from string/fret traversal. After the inner `pool.add(note)` call but before the fallback block, add octave filtering.

  Replace the existing `buildFretboardNotePool` function with:
  ```typescript
  export function buildFretboardNotePool(difficulty: DifficultyLevel, focus: FretboardFocus = {}): string[] {
    const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
    const fretsNum = fretsMap[difficulty];
    const pool = new Set<string>();

    for (let s = 0; s < 6; s++) {
      if (focus.stringIdxs && focus.stringIdxs.length > 0 && !focus.stringIdxs.includes(s)) continue;
      for (let f = 0; f <= fretsNum; f++) {
        const fMin = focus.fretMin ?? 0;
        const fMax = focus.fretMax ?? fretsNum;
        if (f < fMin || f > fMax) continue;
        const note = getFretNote(s, f);
        if (!note) continue;
        const octaveMatch = note.match(/(\d)$/);
        if (octaveMatch) {
          const oct = parseInt(octaveMatch[1], 10);
          if (focus.octaveMin !== undefined && oct < focus.octaveMin) continue;
          if (focus.octaveMax !== undefined && oct > focus.octaveMax) continue;
        }
        pool.add(note);
      }
    }

    if (pool.size === 0) {
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= fretsNum; f++) {
          const note = getFretNote(s, f);
          if (note) pool.add(note);
        }
      }
    }

    return [...pool];
  }
  ```

- [ ] **Step 4: Add buildKeyboardNotePool and generateKeyboardRound**

  The constant `ALL_NOTES` is already in scope at the top of `earTraining.ts` (imported from `guitarData.ts` — it is `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`).

  Append these two exported functions after the `buildFretboardNotePool` function (after line 364):
  ```typescript
  export function buildKeyboardNotePool(octaveMin = 2, octaveMax = 4): string[] {
    const pool: string[] = [];
    for (let oct = octaveMin; oct <= octaveMax; oct++) {
      for (const pc of ALL_NOTES) {
        pool.push(`${pc}${oct}`);
      }
    }
    return pool;
  }

  export function generateKeyboardRound(octaveMin = 2, octaveMax = 4): FretboardRound {
    const pool = buildKeyboardNotePool(octaveMin, octaveMax);
    const targetNote = pickRandom(pool);
    return { kind: 'fretboard', targetNote, fretsNum: 13 };
  }
  ```

  `pickRandom` is already defined earlier in earTraining.ts (it picks a random element from an array). `FretboardRound` is already defined in the same file.

- [ ] **Step 5: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors. If TypeScript complains about `ALL_NOTES` not being in scope, check the import at the top of earTraining.ts — it should already be imported from `../data/guitarData`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/earTraining.ts
  git commit -m "feat: extend FretboardFocus with octave filter; add buildKeyboardNotePool"
  ```

---

### Task 2: Salamander piano sampler in audio.ts

**Files:**
- Modify: `src/lib/audio.ts` (currently 370 lines)

**Interfaces:**
- Produces:
  - `initPianoSampler(): Promise<void>` — exported async function, idempotent
  - `playPianoNote(note: string, duration?: string): void` — exported function

- [ ] **Step 1: Locate the module-level state variables**

  Open `src/lib/audio.ts`. The top of the file declares module-level variables (`let sampler`, `let filterNode`, `let isInitialized`, etc.) and the `initAudio()` function. The guitar sampler is a `Tone.Sampler` that loads gleitz soundfonts.

- [ ] **Step 2: Add piano sampler state variables**

  After the existing module-level `let` declarations (they end around line 42), add:
  ```typescript
  let pianoSampler: Tone.Sampler | null = null;
  let isPianoInitialized = false;
  let pianoInitPromise: Promise<void> | null = null;
  ```

- [ ] **Step 3: Add initPianoSampler function**

  Add this function after the `initAudio` function body (which ends at line ~149 with `return initPromise;`):
  ```typescript
  export function initPianoSampler(): Promise<void> {
    if (isPianoInitialized && pianoSampler) return Promise.resolve();
    if (pianoInitPromise) return pianoInitPromise;

    pianoInitPromise = new Promise<void>((resolve) => {
      pianoSampler = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
          C2: 'C2.mp3',
          'D#2': 'Ds2.mp3',
          'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',
          C3: 'C3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
          C5: 'C5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        onload: () => {
          isPianoInitialized = true;
          resolve();
        },
      }).toDestination();
      pianoSampler.volume.value = 0;
    });

    return pianoInitPromise;
  }
  ```

  > **Note:** Salamander sample filenames use `Ds` for `D#` and `Fs` for `F#`. The `urls` object maps Tone.js note names to filenames. `baseUrl` must end with `/`.

- [ ] **Step 4: Add playPianoNote function**

  Add immediately after `initPianoSampler`:
  ```typescript
  export function playPianoNote(note: string, duration = '4n'): void {
    if (!isPianoInitialized || !pianoSampler) return;
    pianoSampler.triggerAttackRelease(note, duration);
  }
  ```

- [ ] **Step 5: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/audio.ts
  git commit -m "feat: add Salamander piano sampler (initPianoSampler, playPianoNote)"
  ```

---

### Task 3: PianoKeyboard SVG component

**Files:**
- Create: `src/components/PianoKeyboard.tsx`

**Interfaces:**
- Consumes: nothing from previous tasks (purely visual)
- Produces:
  ```typescript
  interface PianoKeyboardProps {
    octaveMin: number;
    octaveMax: number;
    correctKeys: Set<string>;
    wrongKey: string | null;
    previewKey: string | null;
    onKeyClick: (note: string) => void;
  }
  export function PianoKeyboard(props: PianoKeyboardProps): JSX.Element
  ```

- [ ] **Step 1: Create the component file**

  Create `src/components/PianoKeyboard.tsx` with this content:

  ```typescript
  import React from 'react';

  interface PianoKeyboardProps {
    octaveMin: number;
    octaveMax: number;
    correctKeys: Set<string>;
    wrongKey: string | null;
    previewKey: string | null;
    onKeyClick: (note: string) => void;
  }

  const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
  const WHITE_SET = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

  interface KeyRect {
    note: string;
    x: number;
    w: number;
    h: number;
    isBlack: boolean;
  }

  export function PianoKeyboard({ octaveMin, octaveMax, correctKeys, wrongKey, previewKey, onKeyClick }: PianoKeyboardProps) {
    const octaves = Array.from({ length: octaveMax - octaveMin + 1 }, (_, i) => octaveMin + i);
    const totalWhiteKeys = octaves.length * 7;

    const VW = 1000;
    const VH = 120;
    const ww = VW / totalWhiteKeys;
    const wh = VH;
    const bw = ww * 0.6;
    const bh = VH * 0.62;

    const whiteKeys: KeyRect[] = [];
    const blackKeys: KeyRect[] = [];

    let wi = 0;
    for (const oct of octaves) {
      for (const pc of CHROMATIC) {
        const note = `${pc}${oct}`;
        if (WHITE_SET.has(pc)) {
          whiteKeys.push({ note, x: wi * ww, w: ww, h: wh, isBlack: false });
          wi++;
        } else {
          blackKeys.push({ note, x: wi * ww - bw / 2, w: bw, h: bh, isBlack: true });
        }
      }
    }

    function keyFill(note: string, isBlack: boolean): string {
      if (note === wrongKey) return '#c0392b';
      if (correctKeys.has(note)) return '#27ae60';
      if (note === previewKey) return '#3b82f6';
      return isBlack ? '#1a1a1a' : 'white';
    }

    function labelColor(note: string): string {
      if (note === wrongKey || correctKeys.has(note) || note === previewKey) return 'white';
      return '#888';
    }

    return (
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full select-none"
        style={{ height: '120px', display: 'block' }}
        aria-label="Piano keyboard"
      >
        {whiteKeys.map(k => (
          <g key={k.note} onClick={() => onKeyClick(k.note)} style={{ cursor: 'pointer' }}>
            <rect
              x={k.x + 0.5}
              y={0.5}
              width={k.w - 1}
              height={k.h - 1}
              fill={keyFill(k.note, false)}
              stroke="#ccc"
              strokeWidth={1}
              rx={2}
            />
            {k.note.startsWith('C') && (
              <text
                x={k.x + k.w / 2}
                y={k.h - 6}
                textAnchor="middle"
                fontSize={10}
                fill={labelColor(k.note)}
                style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
              >
                {k.note}
              </text>
            )}
          </g>
        ))}
        {blackKeys.map(k => (
          <rect
            key={k.note}
            x={k.x}
            y={0}
            width={k.w}
            height={k.h}
            fill={keyFill(k.note, true)}
            rx={2}
            onClick={() => onKeyClick(k.note)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>
    );
  }
  ```

  **Layout logic explained:**
  - `wi` = global white key index across all octaves
  - For each chromatic note in an octave: if it's white, `x = wi * ww` then `wi++`; if it's black, `x = wi * ww - bw/2` (centered at the boundary between adjacent white keys)
  - Black keys are rendered after white keys so they appear on top
  - C keys get a note label at the bottom

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PianoKeyboard.tsx
  git commit -m "feat: add PianoKeyboard SVG component"
  ```

---

### Task 4: PianoTrainer component

**Files:**
- Create: `src/components/PianoTrainer.tsx`

**Interfaces:**
- Consumes from Task 1: `FretboardRound`, `FretboardFocus`, `SessionScore` from `earTraining.ts`; `getAbsoluteSemitoneDistance`, `getAbsoluteDirection`, `playFretboardRound` from `earTraining.ts`
- Consumes from Task 2: `initPianoSampler`, `playPianoNote` from `audio.ts`
- Consumes from Task 3: `PianoKeyboard` from `./PianoKeyboard`
- Produces:
  ```typescript
  interface PianoTrainerProps {
    round: FretboardRound;
    score: SessionScore;
    octaveMin: number;
    octaveMax: number;
    mode: 'guess' | 'hunt' | 'sing' | 'singhunt';
    droneNote?: string | null;
    droneMode?: 'off' | 'continuous' | 'cue';
    onComplete: (wasCorrect: boolean) => void;
  }
  export function PianoTrainer(props: PianoTrainerProps): JSX.Element
  ```

- [ ] **Step 1: Create PianoTrainer.tsx**

  Create `src/components/PianoTrainer.tsx`:

  ```typescript
  import React, { useState, useEffect, useCallback } from 'react';
  import { Volume2 } from 'lucide-react';
  import {
    FretboardRound, SessionScore,
    getAbsoluteSemitoneDistance, getAbsoluteDirection,
    playFretboardRound,
  } from '../lib/earTraining';
  import { initAudio, playNote, initPianoSampler, playPianoNote } from '../lib/audio';
  import { PianoKeyboard } from './PianoKeyboard';

  interface PianoTrainerProps {
    round: FretboardRound;
    score: SessionScore;
    octaveMin: number;
    octaveMax: number;
    mode: 'guess' | 'hunt' | 'sing' | 'singhunt';
    droneNote?: string | null;
    droneMode?: 'off' | 'continuous' | 'cue';
    onComplete: (wasCorrect: boolean) => void;
  }

  export function PianoTrainer({
    round, score, octaveMin, octaveMax, mode, droneNote, droneMode, onComplete,
  }: PianoTrainerProps) {
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    const [correctKeys, setCorrectKeys] = useState<Set<string>>(new Set());
    const [wrongKey, setWrongKey] = useState<string | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const [noteRevealed, setNoteRevealed] = useState(false);
    const [locked, setLocked] = useState(mode === 'sing' || mode === 'singhunt');
    const [feedback, setFeedback] = useState<string | null>(null);

    const isSingMode = mode === 'sing' || mode === 'singhunt';

    useEffect(() => {
      setPreviewKey(null);
      setCorrectKeys(new Set());
      setWrongKey(null);
      setIsRevealing(false);
      setNoteRevealed(false);
      setFeedback(null);
      setLocked(isSingMode);

      initPianoSampler().catch(() => {});

      if (droneMode === 'cue' && droneNote) {
        initAudio()
          .then(() => {
            playNote(droneNote, '2n');
            setTimeout(() => playFretboardRound(round).catch(() => {}), 600);
          })
          .catch(() => {});
      } else {
        playFretboardRound(round).catch(() => {});
      }
    }, [round]);

    const handleKeyClick = useCallback((note: string) => {
      if (isRevealing || locked) return;
      setPreviewKey(note);
      initPianoSampler()
        .then(() => playPianoNote(note, '4n'))
        .catch(() => {});
    }, [isRevealing, locked]);

    const handleConfirm = useCallback(() => {
      if (!previewKey || isRevealing) return;
      const isCorrect = previewKey === round.targetNote;

      if (isCorrect) {
        setCorrectKeys(new Set([previewKey]));
        setNoteRevealed(true);
        setIsRevealing(true);
        setTimeout(() => onComplete(true), 600);
      } else {
        const semitones = getAbsoluteSemitoneDistance(previewKey, round.targetNote);
        const direction = getAbsoluteDirection(previewKey, round.targetNote);
        const dirStr = direction === 'correct' ? '' : ` (${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction})`;
        setFeedback(`You picked ${previewKey} — correct was ${round.targetNote}${dirStr}`);
        setWrongKey(previewKey);
        setCorrectKeys(new Set([round.targetNote]));
        setNoteRevealed(true);
        setIsRevealing(true);
        initPianoSampler()
          .then(() => playPianoNote(round.targetNote, '4n'))
          .catch(() => {});
        setTimeout(() => onComplete(false), 1500);
      }
    }, [previewKey, isRevealing, round, onComplete]);

    const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    const targetPitchClass = round.targetNote.replace(/\d$/, '');

    return (
      <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-secondary">
            {isSingMode ? 'Sing the note' : 'Find the note on the keyboard'}
            {noteRevealed && (
              <span className="ml-1 text-brand-ink font-bold">→ {targetPitchClass}</span>
            )}
          </p>
          <button
            onClick={() => playFretboardRound(round).catch(() => {})}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Volume2 size={16} /> Replay
          </button>
        </div>

        <div className="relative">
          <PianoKeyboard
            octaveMin={octaveMin}
            octaveMax={octaveMax}
            correctKeys={correctKeys}
            wrongKey={wrongKey}
            previewKey={!wrongKey ? previewKey : null}
            onKeyClick={handleKeyClick}
          />
          {isSingMode && locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-bg/80 rounded-lg z-10">
              <p className="text-sm text-brand-secondary text-center px-4">
                Sing or hum the note, then tap Ready
              </p>
              <button
                onClick={() => setLocked(false)}
                className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Ready
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <p className="text-sm text-brand-secondary">{feedback}</p>
        )}

        <div className="flex items-center justify-between min-h-[36px]">
          <span />
          <button
            onClick={handleConfirm}
            disabled={!previewKey || isRevealing}
            className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>

        {score.total > 0 && (
          <p className="text-xs text-brand-secondary text-right">
            {score.correct} / {score.total} correct ({accuracy}%)
          </p>
        )}
      </div>
    );
  }
  ```

  **Key behaviors:**
  - `useEffect` on `[round]`: reset all state, init piano sampler, play guitar target via `playFretboardRound`
  - Sing/SingHunt: `locked` starts true; overlay with "Ready" button unlocks keyboard
  - Key click: set preview + play piano note — always shows the selected key in blue
  - Confirm: if correct → green + `onComplete(true)` after 600ms; if wrong → red + reveal correct green + semitone feedback + play correct note + `onComplete(false)` after 1500ms
  - Replay button: re-plays the guitar round audio (does NOT call `playPianoNote`)
  - Hunt and guess modes differ only in that hunt shows the sub-mode name label — the interaction flow is identical (preview → Confirm)

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors. Common pitfall: make sure `initPianoSampler` and `playPianoNote` are exported from `audio.ts` (Task 2) before running lint on PianoTrainer.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PianoTrainer.tsx
  git commit -m "feat: add PianoTrainer component with all four sub-modes"
  ```

---

### Task 5: Octave filter in FretboardFocusSelector

**Files:**
- Modify: `src/components/FretboardFocusSelector.tsx` (127 lines)

**Interfaces:**
- Consumes from Task 1: `FretboardFocus` now has `octaveMin?: number; octaveMax?: number`
- Produces: two pill rows (From octave / To octave) that populate `focus.octaveMin` and `focus.octaveMax`

- [ ] **Step 1: Read the current file**

  Open `src/components/FretboardFocusSelector.tsx`. The file has:
  - `pillCls(active)` helper
  - String row (multi-select pills)
  - Fret row (preset zone pills + number inputs)
  - The return is a `<div className="space-y-1.5 text-xs pb-2">` with two children divs

- [ ] **Step 2: Add the octave rows**

  The `OCTAVE_OPTIONS` and two new pill rows go inside the same top-level `<div>`. Add them after the closing `</div>` of the Fret row (line 124, the second `</div>` before `</div>` on line 125). The complete updated return block is:

  ```tsx
  return (
    <div className="space-y-1.5 text-xs pb-2">
      {/* String row — multi-select */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">String:</span>
        <button
          className={pillCls(stringIdxs.length === 0)}
          onClick={() => onChange({ ...focus, stringIdxs: [] })}
        >
          All
        </button>
        {STRING_LABELS.map(([idx, label]) => (
          <button
            key={idx}
            className={pillCls(stringIdxs.includes(idx))}
            onClick={() => toggleString(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fret row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">Frets:</span>
        <button
          className={pillCls(focus.fretMin === undefined && focus.fretMax === undefined)}
          onClick={() => onChange({ ...focus, fretMin: undefined, fretMax: undefined })}
        >
          All
        </button>
        {FRET_ZONES.map(zone => (
          <button
            key={zone.label}
            className={pillCls(activeZone?.label === zone.label)}
            onClick={() =>
              onChange({
                ...focus,
                fretMin: zone.fretMin,
                fretMax: Math.min(zone.fretMax, fretsNum),
              })
            }
          >
            {zone.label}
          </button>
        ))}
        <input
          type="number"
          min={0}
          max={fretsNum}
          value={focus.fretMin ?? ''}
          placeholder="0"
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= fretsNum) {
              onChange({ ...focus, fretMin: v, fretMax: focus.fretMax ?? fretsNum });
            } else if (e.target.value === '') {
              onChange({ ...focus, fretMin: undefined });
            }
          }}
          className="ml-2 w-10 text-center rounded border border-brand-line text-xs py-0.5 bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
        />
        <span className="text-brand-secondary">–</span>
        <input
          type="number"
          min={0}
          max={fretsNum}
          value={focus.fretMax ?? ''}
          placeholder={String(fretsNum)}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= fretsNum) {
              onChange({ ...focus, fretMin: focus.fretMin ?? 0, fretMax: v });
            } else if (e.target.value === '') {
              onChange({ ...focus, fretMax: undefined });
            }
          }}
          className="w-10 text-center rounded border border-brand-line text-xs py-0.5 bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
        />
      </div>

      {/* Octave From row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">Oct from:</span>
        <button
          className={pillCls(focus.octaveMin === undefined)}
          onClick={() => onChange({ ...focus, octaveMin: undefined })}
        >
          Any
        </button>
        {[2, 3, 4].map(oct => (
          <button
            key={oct}
            className={pillCls(focus.octaveMin === oct)}
            onClick={() => {
              const nextMin = oct;
              const nextMax = focus.octaveMax !== undefined && focus.octaveMax < nextMin
                ? nextMin
                : focus.octaveMax;
              onChange({ ...focus, octaveMin: nextMin, octaveMax: nextMax });
            }}
          >
            {oct}
          </button>
        ))}
      </div>

      {/* Octave To row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">Oct to:</span>
        <button
          className={pillCls(focus.octaveMax === undefined)}
          onClick={() => onChange({ ...focus, octaveMax: undefined })}
        >
          Any
        </button>
        {[2, 3, 4].map(oct => (
          <button
            key={oct}
            className={pillCls(focus.octaveMax === oct)}
            onClick={() => {
              const nextMax = oct;
              const nextMin = focus.octaveMin !== undefined && focus.octaveMin > nextMax
                ? nextMax
                : focus.octaveMin;
              onChange({ ...focus, octaveMax: nextMax, octaveMin: nextMin });
            }}
          >
            {oct}
          </button>
        ))}
      </div>
    </div>
  );
  ```

  **Validation logic:** When the user selects "From octave = 4" but "To octave" is already 3, clamp "To" up to 4 (From). When the user selects "To octave = 2" but "From octave" is already 3, clamp "From" down to 2 (To).

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/FretboardFocusSelector.tsx
  git commit -m "feat: add octave From/To filter pills to FretboardFocusSelector"
  ```

---

### Task 6: Wire view toggle and PianoTrainer into EarTraining.tsx

**Files:**
- Modify: `src/pages/EarTraining.tsx` (1516 lines)

**Interfaces:**
- Consumes from Task 1: `buildKeyboardNotePool`, `generateKeyboardRound` from `earTraining.ts`
- Consumes from Task 4: `PianoTrainer` from `../components/PianoTrainer`
- Produces: `pianoView` toggle state, Fretboard|Piano pill, conditional rendering of PianoTrainer vs FretboardTrainer

- [ ] **Step 1: Add import for PianoTrainer and new earTraining exports**

  At line 10-12 of `EarTraining.tsx`, the earTraining import currently reads:
  ```typescript
  import {
    EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
    DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
    loadSettings, saveSettings, initialScore,
    generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
    buildFretboardNotePool, makeFretboardRound,
    chordToNotes, playOptionAudio, playStudyCard,
  } from '../lib/earTraining';
  ```

  Add `buildKeyboardNotePool` and `generateKeyboardRound` to this import:
  ```typescript
  import {
    EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
    DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
    loadSettings, saveSettings, initialScore,
    generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
    buildFretboardNotePool, makeFretboardRound, buildKeyboardNotePool, generateKeyboardRound,
    chordToNotes, playOptionAudio, playStudyCard,
  } from '../lib/earTraining';
  ```

  Also add the `FretboardTrainer` import (line 14) stays unchanged. Add the PianoTrainer import after it:
  ```typescript
  import { FretboardTrainer } from '../components/FretboardTrainer';
  import { PianoTrainer } from '../components/PianoTrainer';
  ```

- [ ] **Step 2: Add pianoView state**

  In the `EarTraining` function body, the existing state declarations start at line 54. After `const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});` (line 58), add:
  ```typescript
  const [pianoView, setPianoView] = useState(false);
  ```

- [ ] **Step 3: Update advanceRound to use keyboard pool in piano view**

  The `advanceRound` function (lines 141–157) currently has:
  ```typescript
  if (effectiveMode === 'fretboard') {
    const note = nextFretboardNote(difficulty, activeFocus);
    r = makeFretboardRound(note, FRETS_FOR[difficulty]);
  }
  ```

  Replace with:
  ```typescript
  if (effectiveMode === 'fretboard') {
    let note: string;
    if (pianoView) {
      const kbPool = buildKeyboardNotePool(activeFocus.octaveMin ?? 2, activeFocus.octaveMax ?? 4);
      note = kbPool[Math.floor(Math.random() * kbPool.length)];
      r = makeFretboardRound(note, 13);
    } else {
      note = nextFretboardNote(difficulty, activeFocus);
      r = makeFretboardRound(note, FRETS_FOR[difficulty]);
    }
  }
  ```

  > **Note:** `pianoView` is captured from the enclosing scope. This is correct because `advanceRound` is a regular function (not a callback) and reads the current closure value. Since `advanceRound` is called on user gesture events, `pianoView` will always reflect the latest state.

- [ ] **Step 4: Add the Fretboard|Piano pill toggle**

  Find the fretboard trainer render area around line 961–978:
  ```tsx
  {/* Round area / Study view / Fretboard trainer */}
  {settings.mode !== 'plan' && (
    <>
      {settings.mode === 'fretboard' ? (
        <FretboardTrainer
          ...
        />
  ```

  Replace this entire block (settings.mode === 'fretboard' ? ... branch only) with:
  ```tsx
  {/* Round area / Study view / Fretboard trainer */}
  {settings.mode !== 'plan' && (
    <>
      {settings.mode === 'fretboard' ? (
        <div className="space-y-3">
          {/* Fretboard | Piano toggle */}
          <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-brand-sidebar border border-brand-line w-fit mx-auto">
            <button
              onClick={() => { setPianoView(false); advanceRound(); }}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                !pianoView
                  ? 'bg-brand-surface text-brand-ink shadow-sm'
                  : 'text-brand-secondary hover:text-brand-ink',
              )}
            >
              Fretboard
            </button>
            <button
              onClick={() => { setPianoView(true); advanceRound(); }}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                pianoView
                  ? 'bg-brand-surface text-brand-ink shadow-sm'
                  : 'text-brand-secondary hover:text-brand-ink',
              )}
            >
              Piano
            </button>
          </div>

          {pianoView ? (
            <PianoTrainer
              round={round as FretboardRound}
              score={score}
              octaveMin={fretboardFocus.octaveMin ?? 2}
              octaveMax={fretboardFocus.octaveMax ?? 4}
              mode={fretboardSubMode}
              droneNote={droneNote}
              droneMode={droneMode}
              onComplete={handleFretboardComplete}
            />
          ) : (
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
          )}
        </div>
  ```

  The rest of the ternary (study mode and chord/interval mode) stays unchanged.

  > **Exact match tip:** Search the file for the text `{settings.mode === 'fretboard' ? (` to locate the right place. The replacement wraps the entire fretboard branch in a `<div className="space-y-3">` that contains the toggle + either PianoTrainer or FretboardTrainer.

- [ ] **Step 5: Run lint**

  ```bash
  npm run lint
  ```
  Expected: no errors. Common issues:
  - `pianoView` not found — make sure the state was added in Step 2
  - `buildKeyboardNotePool` not found — make sure the import was updated in Step 1
  - `PianoTrainer` not found — make sure the import was added in Step 1
  - `sessionAvgSemitones` / `sessionAvgTaps` not in scope — these are computed from `huntSessionRounds` earlier in EarTraining.tsx; search for them to confirm they exist

- [ ] **Step 6: Verify visually (dev server)**

  ```bash
  npm run dev
  ```
  Open `http://localhost:3000/Guitar_Chords/` → Ear Training → Fretboard mode.

  Check:
  1. "Fretboard | Piano" toggle appears above the trainer area
  2. Clicking "Piano" shows the PianoKeyboard with white and black keys, C labels at each C
  3. Keys span octaves 2–4 by default
  4. Clicking a key plays a piano note and highlights it blue
  5. Confirm button evaluates the answer; correct = green, wrong = red + correct green revealed
  6. Replay button plays the guitar audio (not piano)
  7. Switching back to "Fretboard" shows the fretboard; score is preserved
  8. FretboardFocusSelector shows "Oct from:" and "Oct to:" rows; selecting octaves changes the note pool
  9. Sing sub-mode: overlay "Sing the note → Ready" appears; keyboard locked until Ready tapped

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/EarTraining.tsx
  git commit -m "feat: add Piano view toggle and PianoTrainer to fretboard ear training"
  ```
