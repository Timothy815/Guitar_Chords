# Fretboard Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth "Fretboard" tab to the ear training page where a note is played and the user taps its location on the fretboard.

**Architecture:** Four tasks in dependency order: data layer (earTraining.ts) → Fretboard.tsx new props → new FretboardTrainer component → wire everything into EarTraining.tsx. Each task is independently lint-checkable.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tone.js via `src/lib/audio.ts`

## Global Constraints

- No test framework exists — `npm run lint` (`tsc --noEmit`) is the only static check; run it after every task
- Tailwind v4: no config file; use brand tokens (`brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-line`, `brand-active`) not raw Tailwind colors for themed UI — but `#22c55e` (green) and `#ef4444` (red) are used as literal SVG fill colors for feedback dots only
- `initAudio()` must be awaited before any Tone.js call (browser autoplay policy)
- Path alias `@` resolves to project root; use relative imports within `src/`
- Do not add comments to code unless the WHY is non-obvious

---

### Task 1: Add FretboardRound + data functions to earTraining.ts

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Consumes: `getFretNote` (already imported in the file), `initAudio`, `playNote` (already imported), `ALL_NOTES`, `DifficultyLevel`, `pickRandom` (internal helper)
- Produces:
  - `FretboardRound` interface (exported)
  - `Round` type widened to include `FretboardRound`
  - `EarTrainingSettings.mode` widened to include `'fretboard'`
  - `generateFretboardRound(difficulty: DifficultyLevel): FretboardRound` (exported)
  - `getCorrectPositions(targetNote: string, fretsNum: number): Set<string>` (exported)
  - `playFretboardRound(round: FretboardRound): Promise<void>` (exported)

- [ ] **Step 1: Widen EarTrainingSettings.mode**

In `src/lib/earTraining.ts`, find line 16:
```typescript
  mode: 'chord' | 'interval' | 'study';
```
Replace with:
```typescript
  mode: 'chord' | 'interval' | 'study' | 'fretboard';
```

- [ ] **Step 2: Add FretboardRound interface and widen Round**

In `src/lib/earTraining.ts`, find:
```typescript
export type Round = ChordRound | IntervalRound;
```
Replace with:
```typescript
export interface FretboardRound {
  kind: 'fretboard';
  targetNote: string;
  fretsNum: number;
}

export type Round = ChordRound | IntervalRound | FretboardRound;
```

- [ ] **Step 3: Add the three new exported functions**

Append to the end of `src/lib/earTraining.ts` (after `playStudyCard`):

```typescript
export function generateFretboardRound(difficulty: DifficultyLevel): FretboardRound {
  const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
  return { kind: 'fretboard', targetNote: pickRandom([...ALL_NOTES]), fretsNum: fretsMap[difficulty] };
}

export function getCorrectPositions(targetNote: string, fretsNum: number): Set<string> {
  const positions = new Set<string>();
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < fretsNum; f++) {
      const note = getFretNote(s, f);
      if (note && note.replace(/\d$/, '') === targetNote) positions.add(`${s}-${f}`);
    }
  }
  return positions;
}

export async function playFretboardRound(round: FretboardRound): Promise<void> {
  await initAudio();
  playNote(round.targetNote + '3', '2n');
}
```

- [ ] **Step 4: Lint check**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add FretboardRound type and data functions to earTraining"
```

---

### Task 2: Add correctPositions and wrongPosition props to Fretboard.tsx

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces:
  - `FretboardProps.correctPositions?: Set<string>` — position keys `"stringIdx-fretIdx"` rendered as green circles
  - `FretboardProps.wrongPosition?: string | null` — single position key rendered as red circle
  - Both rendered as SVG circles on top of existing note markers, with `pointerEvents: 'none'`

- [ ] **Step 1: Add props to FretboardProps interface**

In `src/components/Fretboard.tsx`, find:
```typescript
  playingNotes?: Set<string>;
  compact?: boolean; // removes min-width constraint and hides label toggle (for grid contexts)
```
Replace with:
```typescript
  playingNotes?: Set<string>;
  compact?: boolean; // removes min-width constraint and hides label toggle (for grid contexts)
  correctPositions?: Set<string>;
  wrongPosition?: string | null;
```

- [ ] **Step 2: Add props to function destructuring**

Find:
```typescript
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false }: FretboardProps) {
```
Replace with:
```typescript
export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null }: FretboardProps) {
```

- [ ] **Step 3: Render trainer feedback dots in the SVG**

Find the comment `{/* Fret numbers — screen only */}` in the SVG body. Insert the following block immediately before it:

```tsx
        {/* Trainer feedback dots */}
        {(correctPositions.size > 0 || wrongPosition !== null) && Array.from({ length: stringsNum }).map((_, stringIdx) =>
          Array.from({ length: fretsNum + 1 }).map((_, fretIdx) => {
            const key = `${stringIdx}-${fretIdx}`;
            const isCorrect = correctPositions.has(key);
            const isWrong = wrongPosition === key;
            if (!isCorrect && !isWrong) return null;
            const visualStringIdx = 5 - stringIdx;
            const x = fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
            const y = paddingY + visualStringIdx * stringSpacing;
            return (
              <circle
                key={`trainer-${key}`}
                cx={x}
                cy={y}
                r={fretIdx === 0 ? 10 : 14}
                fill={isWrong ? '#ef4444' : '#22c55e'}
                opacity={0.85}
                style={{ pointerEvents: 'none' }}
              />
            );
          })
        )}

```

- [ ] **Step 4: Lint check**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add correctPositions and wrongPosition props to Fretboard"
```

---

### Task 3: Create FretboardTrainer component

**Files:**
- Create: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Consumes from Task 1: `FretboardRound`, `DifficultyLevel`, `SessionScore`, `getCorrectPositions`, `playFretboardRound`
- Consumes from Task 2: `Fretboard` with `correctPositions`, `wrongPosition` props
- Consumes from audio: `getFretNote` from `../lib/audio`
- Produces: `FretboardTrainer` component exported as named export

Props:
```typescript
interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}
```

- [ ] **Step 1: Create the file**

Create `src/components/FretboardTrainer.tsx` with this complete content:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import {
  FretboardRound, DifficultyLevel, SessionScore,
  getCorrectPositions, playFretboardRound,
} from '../lib/earTraining';
import { getFretNote } from '../lib/audio';

interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function FretboardTrainer({ round, score, onComplete }: FretboardTrainerProps) {
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);

  useEffect(() => {
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    playFretboardRound(round).catch(() => {});
  }, [round]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const pitchClass = noteStr.replace(/\d$/, '');
    const key = `${stringIdx}-${fretIdx}`;

    if (pitchClass === round.targetNote) {
      setCorrectPositions(new Set([key]));
      setNoteRevealed(true);
      setTimeout(() => onComplete(true), 600);
    } else {
      setWrongPosition(key);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => setWrongPosition(null), 600);
      setTimeout(() => onComplete(false), 1500);
    }
  }, [isRevealing, round, onComplete]);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          Find the note
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={wrongPosition}
        compact
      />

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: add FretboardTrainer component"
```

---

### Task 4: Wire FretboardTrainer into EarTraining.tsx

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1: `FretboardRound`, `generateFretboardRound`, `playFretboardRound` (imported from `../lib/earTraining`)
- Consumes from Task 3: `FretboardTrainer` (imported from `../components/FretboardTrainer`)
- All other imports already present

Changes needed (in order):
1. Add `FretboardRound`, `generateFretboardRound`, `playFretboardRound` to the earTraining import
2. Add `FretboardTrainer` import
3. Update `makeRound` (module-level function) to accept `difficulty` param and handle fretboard mode
4. Add `difficulty` state inside the component
5. Add `handleFretboardMode` function
6. Add `handleFretboardComplete` function
7. Update `handleDifficulty` to set `difficulty` state and guard fretboard mode
8. Update `playRoundAudio` to skip fretboard rounds
9. Update `advanceRound` to pass `difficulty` to `makeRound`
10. Add the Fretboard tab button
11. Add fretboard render branch in the round area
12. Update the initial round state initialization

- [ ] **Step 1: Update earTraining import**

Find:
```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
```
Replace with:
```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  getCorrectPositions as _getCorrectPositions, chordToNotes, playOptionAudio, playStudyCard, playFretboardRound,
} from '../lib/earTraining';
```

Note: `getCorrectPositions` is used inside `FretboardTrainer` (already imported there), not in `EarTraining.tsx` directly. Import it aliased only if needed; otherwise omit it from this import. Since EarTraining.tsx does not call `getCorrectPositions` directly, the import line should be:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  chordToNotes, playOptionAudio, playStudyCard, playFretboardRound,
} from '../lib/earTraining';
```

- [ ] **Step 2: Add FretboardTrainer import**

After the existing `import { initAudio, playStrum, playNote } from '../lib/audio';` line, add:
```typescript
import { FretboardTrainer } from '../components/FretboardTrainer';
```

- [ ] **Step 3: Update makeRound to handle fretboard mode**

Find:
```typescript
function makeRound(s: EarTrainingSettings): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  return generateIntervalRound(s.activeIntervals);
}
```
Replace with:
```typescript
function makeRound(s: EarTrainingSettings, difficulty: DifficultyLevel = 'Beginner'): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty);
  return generateIntervalRound(s.activeIntervals);
}
```

- [ ] **Step 4: Add difficulty state inside the component**

Inside `EarTraining()`, find:
```typescript
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
```
Replace with:
```typescript
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Beginner');
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
```

- [ ] **Step 5: Update advanceRound to pass difficulty**

Find:
```typescript
  function advanceRound(s: EarTrainingSettings = settings) {
    const r = makeRound(s);
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```
Replace with:
```typescript
  function advanceRound(s: EarTrainingSettings = settings) {
    const r = makeRound(s, difficulty);
    setSelected(null);
    setTentative(null);
    setRound(r);
  }
```

- [ ] **Step 6: Update handleDifficulty to set difficulty state and guard fretboard**

Find:
```typescript
  function handleDifficulty(level: DifficultyLevel) {
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    if (next.mode !== 'study') advanceRound(next);
  }
```
Replace with:
```typescript
  function handleDifficulty(level: DifficultyLevel) {
    setDifficulty(level);
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    if (next.mode !== 'study' && next.mode !== 'fretboard') advanceRound(next);
  }
```

- [ ] **Step 7: Add handleFretboardMode and handleFretboardComplete**

After the `handleStudyMode` function, add:
```typescript
  function handleFretboardMode() {
    const next = { ...settings, mode: 'fretboard' as const };
    setSettings(next);
    advanceRound(next);
  }

  function handleFretboardComplete(wasCorrect: boolean) {
    const typeKey = (round as FretboardRound).targetNote;
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
    }));
    advanceRound();
  }
```

- [ ] **Step 8: Update playRoundAudio to skip fretboard rounds**

Find:
```typescript
  const playRoundAudio = useCallback(async (r: Round) => {
    await initAudio();
    audioUnlocked.current = true;
    if (r.kind === 'chord') {
```
Replace with:
```typescript
  const playRoundAudio = useCallback(async (r: Round) => {
    if (r.kind === 'fretboard') return;
    await initAudio();
    audioUnlocked.current = true;
    if (r.kind === 'chord') {
```

- [ ] **Step 9: Add the Fretboard tab button**

Find:
```typescript
        <button
          onClick={handleStudyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'study'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Study
        </button>
```
Replace with:
```typescript
        <button
          onClick={handleStudyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'study'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Study
        </button>
        <button
          onClick={handleFretboardMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'fretboard'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Fretboard
        </button>
```

- [ ] **Step 10: Add fretboard render branch in the round area**

Find:
```typescript
      {/* Round area / Study view */}
      {settings.mode === 'study' ? (
```
Replace with:
```typescript
      {/* Round area / Study view / Fretboard trainer */}
      {settings.mode === 'fretboard' ? (
        <FretboardTrainer
          round={round as FretboardRound}
          difficulty={difficulty}
          score={score}
          onComplete={handleFretboardComplete}
        />
      ) : settings.mode === 'study' ? (
```

This requires closing the new ternary. The existing structure ends with `) : (` for the quiz view. Find the end of the study/quiz conditional block — the last `)` before the score bar comment. The structure becomes:

```tsx
{settings.mode === 'fretboard' ? (
  <FretboardTrainer ... />
) : settings.mode === 'study' ? (
  ... existing study JSX ...
) : (
  ... existing quiz JSX ...
)}
```

The existing code reads:
```tsx
      {settings.mode === 'study' ? (
        ...study JSX...
      ) : (
        ...quiz JSX...
      )}
```

Replace `{settings.mode === 'study' ? (` with `{settings.mode === 'fretboard' ? (<FretboardTrainer round={round as FretboardRound} difficulty={difficulty} score={score} onComplete={handleFretboardComplete} />) : settings.mode === 'study' ? (`

In practice, make two targeted edits:

**Edit A** — change the opening of the conditional:

Find:
```tsx
      {/* Round area / Study view */}
      {settings.mode === 'study' ? (
        studyDeck.length === 0 ? (
```
Replace with:
```tsx
      {/* Round area / Study view / Fretboard trainer */}
      {settings.mode === 'fretboard' ? (
        <FretboardTrainer
          round={round as FretboardRound}
          difficulty={difficulty}
          score={score}
          onComplete={handleFretboardComplete}
        />
      ) : settings.mode === 'study' ? (
        studyDeck.length === 0 ? (
```

**Edit B** — the closing of the study/quiz ternary is already `) : (` and `)}` at the end, so no change needed there — the existing structure already terminates correctly once Edit A is applied.

- [ ] **Step 11: Lint check**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/pages/EarTraining.tsx src/components/FretboardTrainer.tsx src/lib/earTraining.ts src/components/Fretboard.tsx
git commit -m "feat: wire FretboardTrainer into EarTraining — fourth ear training mode"
```

Wait — Tasks 1, 2, 3 already committed individually. Commit only the EarTraining.tsx change:

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add Fretboard tab to EarTraining and wire FretboardTrainer"
```
