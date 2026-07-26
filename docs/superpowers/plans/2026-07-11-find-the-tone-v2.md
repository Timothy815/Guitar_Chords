# Find the Tone v2 (Match-Then-Name) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Interval mode's Find the Tone sub-mode from a single "find the pitch" round into a two-phase "match the sound, then name it" flow, closing a semitone-counting exploit and adding direction control, melodic/harmonic reveal playback, and split match/name scoring.

**Architecture:** A single `IntervalPitchRound` is generated once per round (now carrying a `direction: 'asc' | 'desc'` field instead of a precomputed `correctNote`). A new component-local `phase: 'match' | 'name'` state (plus a `matchPick` state that freezes the user's Phase A choice for the post-confirm recap) drives which UI renders and how grading/scoring/history branch. Phase A's Confirm grades the pitch match, plays a melodic (and optionally harmonic) reveal of root+target, records history/score under a `(match)` key, and flips to Phase B in the same render — it never calls `advanceRound()`. Phase B renders a fresh interval-name grid (options computed once per round via `useMemo`), grades the naming attempt separately under a `(name)` key, and its Next button is what actually calls `advanceRound()`, resetting `phase`/`matchPick` for the next round.

**Tech Stack:** React 19 + TypeScript, existing `earTraining.ts` round/settings model, existing `intervalHistory.ts` CSV-backed history, Tone.js via `src/lib/audio.ts` (`playNote`).

## Global Constraints

- Scope-gated to `intervalSubMode === 'findTone'` only. Mixed mode and Plan-mode skill-ladder practice continue to use `generateIntervalRound` exclusively — do not thread `phase` or the new settings fields into those code paths.
- Only these files may be modified: `src/lib/earTraining.ts`, `src/lib/intervalHistory.ts`, `src/pages/EarTraining.tsx`. No new files.
- 13 candidate dots remain (indices 0–12), now direction-aware: candidate `i` maps to `addSemitones(rootNote, direction === 'asc' ? i : -i)`.
- Answer-leak prevention: before Phase A confirm, no note name or correctness signal may be visible anywhere (button labels, audio, console). After Phase A confirm, the target may be revealed (audio + note names) but only via the actual correct note/semitones — never via the user's picked (possibly wrong) index.
- `npm run lint` must show no new errors (ignoring the two pre-existing `TS2322` errors in untracked `src/pages/Caged 2.tsx`).
- `intervalDirection` defaults to `'both'`; `intervalPlayHarmonic` defaults to `false`. Both persist via the existing `saveSettings`/`localStorage` mechanism (no new persistence code needed — `DEFAULT_SETTINGS` spread + existing `useEffect` auto-save cover it).
- CSV format for interval history stays a fixed 5 columns (`date,label,root_note,correct,response_time_ms`) — the new `skill` field is in-memory/object-only, never written to or read from CSV.

---

### Task 1: Data layer — `src/lib/earTraining.ts` and `src/lib/intervalHistory.ts`

**Files:**
- Modify: `src/lib/earTraining.ts`
- Modify: `src/lib/intervalHistory.ts`

**Interfaces:**
- Produces: `addSemitones(noteStr: string, semitones: number): string` — now exported, fixed for negative `semitones`.
- Produces: `shuffle<T>(arr: T[]): T[]` — now exported.
- Produces: `IntervalPitchRound` — `{ kind: 'intervalPitch'; rootNote: string; direction: 'asc' | 'desc'; correctSemitones: number; correctLabel: string }` (no more `correctNote`).
- Produces: `generateIntervalPitchRound(activeIntervals: string[], directionSetting: 'asc' | 'desc' | 'both'): IntervalPitchRound`.
- Produces: `EarTrainingSettings` gains `intervalDirection: 'asc' | 'desc' | 'both'` and `intervalPlayHarmonic: boolean`.
- Produces: `IntervalHistoryEntry` gains optional `skill?: 'match' | 'name'`.
- Consumes: nothing from other tasks (this is the foundation task).

- [ ] **Step 1: Fix and export `addSemitones`**

Find (in `src/lib/earTraining.ts`):

```ts
// Add semitones to a note string like "E3" → result at correct octave.
function addSemitones(noteStr: string, semitones: number): string {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return noteStr;
  const note = match[1] as Note;
  const octave = parseInt(match[2]);
  const idx = ALL_NOTES.indexOf(note);
  const newIdx = (idx + semitones) % 12;
  const octaveShift = Math.floor((idx + semitones) / 12);
  return `${ALL_NOTES[newIdx]}${octave + octaveShift}`;
}
```

Replace with:

```ts
// Add semitones to a note string like "E3" → result at correct octave.
// Handles negative semitones (descending intervals) — JS `%` can return a
// negative result for a negative operand, so the extra `+ 12) % 12` wraps
// it back into range before indexing ALL_NOTES.
export function addSemitones(noteStr: string, semitones: number): string {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return noteStr;
  const note = match[1] as Note;
  const octave = parseInt(match[2]);
  const idx = ALL_NOTES.indexOf(note);
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  const octaveShift = Math.floor((idx + semitones) / 12);
  return `${ALL_NOTES[newIdx]}${octave + octaveShift}`;
}
```

- [ ] **Step 2: Export `shuffle`**

Find:

```ts
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

Replace with:

```ts
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 3: Update `IntervalPitchRound`**

Find:

```ts
export interface IntervalPitchRound {
  kind: 'intervalPitch';
  rootNote: string;
  correctSemitones: number; // 0-12, index into the 13 ascending candidate buttons
  correctLabel: string;     // e.g. "Perfect 5th" — target prompt and score/history key
  correctNote: string;      // e.g. "D3" — actual note name, shown in the post-grading reveal caption
}
```

Replace with:

```ts
export interface IntervalPitchRound {
  kind: 'intervalPitch';
  rootNote: string;
  direction: 'asc' | 'desc'; // which way the 13 candidate dots count from rootNote
  correctSemitones: number; // 0-12, index into the 13 candidate buttons
  correctLabel: string;     // e.g. "Perfect 5th" — target prompt and score/history key
}
```

- [ ] **Step 4: Add the new settings fields to `EarTrainingSettings` and `DEFAULT_SETTINGS`**

Find:

```ts
export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count' | 'scaleDrill' | 'intervalFretboard';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
  melodySettings: MelodySettings;
}
```

Replace with:

```ts
export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count' | 'scaleDrill' | 'intervalFretboard';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
  melodySettings: MelodySettings;
  intervalDirection: 'asc' | 'desc' | 'both';
  intervalPlayHarmonic: boolean;
}
```

Find:

```ts
export const DEFAULT_SETTINGS: EarTrainingSettings = {
  mode: 'chord',
  activeChordTypes: ['major', 'minor'],
  activeIntervals: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
  settingsPanelOpen: true,
  melodySettings: { rootKey: 'random', bpm: 80, showFirstNote: true },
};
```

Replace with:

```ts
export const DEFAULT_SETTINGS: EarTrainingSettings = {
  mode: 'chord',
  activeChordTypes: ['major', 'minor'],
  activeIntervals: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
  settingsPanelOpen: true,
  melodySettings: { rootKey: 'random', bpm: 80, showFirstNote: true },
  intervalDirection: 'both',
  intervalPlayHarmonic: false,
};
```

(`loadSettings` already spreads `DEFAULT_SETTINGS` under parsed `localStorage` overrides, so both new fields flow through automatically for existing saved settings with no further change.)

- [ ] **Step 5: Update `generateIntervalPitchRound`**

Find:

```ts
export function generateIntervalPitchRound(activeIntervals: string[]): IntervalPitchRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);

  return {
    kind: 'intervalPitch',
    rootNote,
    correctSemitones: correctDef.semitones,
    correctLabel: correctDef.label,
    correctNote: addSemitones(rootNote, correctDef.semitones),
  };
}
```

Replace with:

```ts
export function generateIntervalPitchRound(
  activeIntervals: string[],
  directionSetting: 'asc' | 'desc' | 'both',
): IntervalPitchRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);
  const direction: 'asc' | 'desc' =
    directionSetting === 'both' ? (Math.random() < 0.5 ? 'asc' : 'desc') : directionSetting;

  return {
    kind: 'intervalPitch',
    rootNote,
    direction,
    correctSemitones: correctDef.semitones,
    correctLabel: correctDef.label,
  };
}
```

- [ ] **Step 6: Make `playOptionAudio`'s `intervalPitch` branch direction-aware**

Find:

```ts
  } else if (round.kind === 'intervalPitch') {
    const pr = round as IntervalPitchRound;
    playNote(addSemitones(pr.rootNote, index), '2n');
  } else {
```

Replace with:

```ts
  } else if (round.kind === 'intervalPitch') {
    const pr = round as IntervalPitchRound;
    const semitones = pr.direction === 'asc' ? index : -index;
    playNote(addSemitones(pr.rootNote, semitones), '2n');
  } else {
```

- [ ] **Step 7: Add the optional `skill` field to `IntervalHistoryEntry`**

Find (in `src/lib/intervalHistory.ts`):

```ts
export interface IntervalHistoryEntry {
  date: string;
  label: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
}
```

Replace with:

```ts
export interface IntervalHistoryEntry {
  date: string;
  label: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
  skill?: 'match' | 'name'; // Find the Tone only — which half of the round this entry scores
}
```

No other changes to `intervalHistory.ts`: `loadIntervalHistory`, `saveIntervalHistory`, `appendIntervalEntries`, `mergeIntervalEntries`, `exportIntervalToCsv`, and `parseIntervalFromCsv` all stay as-is — the CSV format stays fixed at 5 columns, and `skill` is never serialized to or parsed from CSV (it's only read in-memory by the stats views this task doesn't touch).

- [ ] **Step 8: Verify with the type checker**

Run: `npm run lint`
Expected: No new errors. The two pre-existing `TS2322` errors in untracked `src/pages/Caged 2.tsx` are unrelated and may still appear — that's fine. `generateIntervalPitchRound`'s call site in `EarTraining.tsx` will now show a missing-argument error until Task 2 updates the call — that is expected and resolved by Task 2.

- [ ] **Step 9: Manual trace verification**

Confirm by reading the diff that:
- `addSemitones(rootNote, -1)` for `rootNote = "C4"` returns `"B3"` (idx=0, semitones=-1 → newIdx=((0-1)%12+12)%12=11 → `ALL_NOTES[11]` + octaveShift `Math.floor(-1/12) = -1` → `B` + `(4-1)` = `"B3"`). Correct.
- `generateIntervalPitchRound` never returns a field that leaks the target note directly (no `correctNote` anymore) — only `correctSemitones`/`correctLabel`/`direction`, from which the caller must derive the note via `addSemitones`.
- `playOptionAudio`'s `intervalPitch` branch plays exactly one note derived from `index` and `pr.direction`, never from `pr.correctSemitones`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/earTraining.ts src/lib/intervalHistory.ts
git commit -m "feat: direction-aware Find the Tone data layer (v2 match-then-name)"
```

---

### Task 2: Wire the two-phase flow into `src/pages/EarTraining.tsx`

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `addSemitones`, `shuffle` (Task 1, now exported from `../lib/earTraining`); `IntervalPitchRound` with `direction` field and no `correctNote` (Task 1); `generateIntervalPitchRound(activeIntervals, directionSetting)` (Task 1); `EarTrainingSettings.intervalDirection` / `.intervalPlayHarmonic` (Task 1); `IntervalHistoryEntry.skill` (Task 1).
- Produces: local `phase: 'match' | 'name'` state, local `matchPick: number | null` state, `playMatchReveal(pr, alsoHarmonic)` helper, `findTonePhaseBOptions` (memoized `IntervalDef[]`), `handleIntervalPitchSelect(pr, index)`, `handleIntervalDirectionChange(direction)`, `handleToggleIntervalHarmonic()`. None of these are consumed outside this file.

- [ ] **Step 1: Import the newly-exported helpers**

Find:

```ts
import {
  EarTrainingSettings, ChordRound, IntervalRound, IntervalPitchRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateIntervalPitchRound, generateStudyDeck, generateFretboardRound,
  buildFretboardNotePool, makeFretboardRound, buildKeyboardNotePool,
  chordToNotes, playOptionAudio, playStudyCard,
  generateIntervalFretboardRound, IntervalFretboardRound,
} from '../lib/earTraining';
```

Replace with:

```ts
import {
  EarTrainingSettings, ChordRound, IntervalRound, IntervalPitchRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateIntervalPitchRound, generateStudyDeck, generateFretboardRound,
  buildFretboardNotePool, makeFretboardRound, buildKeyboardNotePool,
  chordToNotes, playOptionAudio, playStudyCard, addSemitones, shuffle,
  generateIntervalFretboardRound, IntervalFretboardRound,
} from '../lib/earTraining';
```

(`useMemo` is already imported from `'react'` at the top of the file — no change needed there.)

- [ ] **Step 2: Add `phase` and `matchPick` state**

Find:

```ts
  const [intervalSubMode, setIntervalSubMode] = useState<'choice' | 'findTone'>('choice');
```

Replace with:

```ts
  const [intervalSubMode, setIntervalSubMode] = useState<'choice' | 'findTone'>('choice');
  const [phase, setPhase] = useState<'match' | 'name'>('match');
  const [matchPick, setMatchPick] = useState<number | null>(null);
```

- [ ] **Step 3: Add the `playMatchReveal` helper**

Find:

```ts
  useEffect(() => {
    if (audioUnlocked.current) {
      playRoundAudio(round);
    }
  }, [round, playRoundAudio]);
```

Replace with:

```ts
  useEffect(() => {
    if (audioUnlocked.current) {
      playRoundAudio(round);
    }
  }, [round, playRoundAudio]);

  // Melodic root→target reveal after Phase A confirm, with an optional
  // simultaneous (harmonic) replay — always derived from the round's actual
  // correct semitones/direction, never from the user's tentative pick.
  function playMatchReveal(pr: IntervalPitchRound, alsoHarmonic: boolean) {
    const semitones = pr.direction === 'asc' ? pr.correctSemitones : -pr.correctSemitones;
    const targetNote = addSemitones(pr.rootNote, semitones);
    playNote(pr.rootNote, '2n');
    setTimeout(() => {
      playNote(targetNote, '2n');
      if (alsoHarmonic) {
        setTimeout(() => {
          playNote(pr.rootNote, '2n');
          playNote(targetNote, '2n');
        }, 500);
      }
    }, 400);
  }
```

- [ ] **Step 4: Thread direction into `advanceRound` and reset `phase`/`matchPick`**

Find (`src/pages/EarTraining.tsx:259-268`):

```ts
    } else if (s.mode === 'interval' && effectiveIntervalSubMode === 'findTone') {
      r = generateIntervalPitchRound(s.activeIntervals);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
    roundStartTimeRef.current = Date.now();
  }
```

Replace with:

```ts
    } else if (s.mode === 'interval' && effectiveIntervalSubMode === 'findTone') {
      r = generateIntervalPitchRound(s.activeIntervals, s.intervalDirection);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setPhase('match');
    setMatchPick(null);
    setRound(r);
    roundStartTimeRef.current = Date.now();
  }
```

- [ ] **Step 5: Skip Phase B's audio-on-tentative (naming options are text, not pitches)**

Find:

```ts
  function handleTentative(i: number) {
    if (selected !== null) return;
    setTentative(i);
    playOptionAudio(round, i).catch(() => {});
  }
```

Replace with:

```ts
  function handleTentative(i: number) {
    if (selected !== null) return;
    setTentative(i);
    // Phase B (naming) options are interval-name buttons, not pitches — the
    // sound was already established in Phase A, so no audio plays on click.
    if (round.kind === 'intervalPitch' && phase === 'name') return;
    playOptionAudio(round, i).catch(() => {});
  }
```

- [ ] **Step 6: Add direction/harmonic setting handlers and the Phase B options memo**

Find:

```ts
  function handleToggleInterval(label: string) {
    setSettings(s => {
      if (s.activeIntervals.includes(label)) {
        if (s.activeIntervals.length <= 2) return s;
        return { ...s, activeIntervals: s.activeIntervals.filter(l => l !== label) };
      }
      return { ...s, activeIntervals: [...s.activeIntervals, label] };
    });
  }
```

Replace with:

```ts
  function handleToggleInterval(label: string) {
    setSettings(s => {
      if (s.activeIntervals.includes(label)) {
        if (s.activeIntervals.length <= 2) return s;
        return { ...s, activeIntervals: s.activeIntervals.filter(l => l !== label) };
      }
      return { ...s, activeIntervals: [...s.activeIntervals, label] };
    });
  }

  function handleIntervalDirectionChange(direction: 'asc' | 'desc' | 'both') {
    setSettings(s => ({ ...s, intervalDirection: direction }));
  }

  function handleToggleIntervalHarmonic() {
    setSettings(s => ({ ...s, intervalPlayHarmonic: !s.intervalPlayHarmonic }));
  }

  // Phase B (naming) option list — every active interval def, shuffled once
  // per round via useMemo so the order stays stable across re-renders within
  // the round (a plain recompute-on-render would reshuffle between the
  // user's click and the graded result, desyncing index-based grading).
  const findTonePhaseBOptions = useMemo(() => {
    if (round.kind !== 'intervalPitch') return [];
    return shuffle(INTERVAL_DEFS.filter(d => settings.activeIntervals.includes(d.label)));
  }, [round, settings.activeIntervals]);
```

- [ ] **Step 7: Split `handleSelect`'s `intervalPitch` grading into a dedicated phase-aware function**

Find:

```ts
  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = round.kind === 'chord'
      ? (round as ChordRound).options[index].displayLabel === (round as ChordRound).correct.displayLabel
      : round.kind === 'intervalPitch'
      ? index === (round as IntervalPitchRound).correctSemitones
      : (round as IntervalRound).options[index].label === (round as IntervalRound).correct.label;

    const typeKey = round.kind === 'chord'
      ? (round as ChordRound).correct.typeLabel
      : round.kind === 'intervalPitch'
      ? (round as IntervalPitchRound).correctLabel
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

    // Record to persistent history
    const responseTimeMs = Date.now() - roundStartTimeRef.current;
    if (round.kind === 'chord') {
      const cr = round as ChordRound;
      appendChordEntries([{
        date: new Date().toISOString().slice(0, 10),
        typeLabel: cr.correct.typeLabel,
        rootNote: cr.correct.root,
        correct: isCorrect,
        responseTimeMs,
      }]);
    } else if (round.kind === 'interval') {
      const ir = round as IntervalRound;
      appendIntervalEntries([{
        date: new Date().toISOString().slice(0, 10),
        label: ir.correct.label,
        rootNote: ir.correct.rootNote,
        correct: isCorrect,
        responseTimeMs,
      }]);
    } else if (round.kind === 'intervalPitch') {
      const pr = round as IntervalPitchRound;
      appendIntervalEntries([{
        date: new Date().toISOString().slice(0, 10),
        label: pr.correctLabel,
        rootNote: pr.rootNote,
        correct: isCorrect,
        responseTimeMs,
      }]);
    }

    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
      }
    }
  }
```

Replace with:

```ts
  function handleSelect(index: number) {
    if (selected !== null) return;

    if (round.kind === 'intervalPitch') {
      handleIntervalPitchSelect(round as IntervalPitchRound, index);
      return;
    }

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

    // Record to persistent history
    const responseTimeMs = Date.now() - roundStartTimeRef.current;
    if (round.kind === 'chord') {
      const cr = round as ChordRound;
      appendChordEntries([{
        date: new Date().toISOString().slice(0, 10),
        typeLabel: cr.correct.typeLabel,
        rootNote: cr.correct.root,
        correct: isCorrect,
        responseTimeMs,
      }]);
    } else if (round.kind === 'interval') {
      const ir = round as IntervalRound;
      appendIntervalEntries([{
        date: new Date().toISOString().slice(0, 10),
        label: ir.correct.label,
        rootNote: ir.correct.rootNote,
        correct: isCorrect,
        responseTimeMs,
      }]);
    }

    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
      }
    }
  }

  // Find the Tone grading — kept separate from the chord/interval branch
  // above because an intervalPitch round grades twice against the same
  // round object: once for the Phase A pitch match, once for Phase B naming.
  // (intervalPitch rounds never occur in Plan mode — see advanceRound — so
  // there is no SKILL_LADDERS advancement check here.)
  function handleIntervalPitchSelect(pr: IntervalPitchRound, index: number) {
    const responseTimeMs = Date.now() - roundStartTimeRef.current;

    if (phase === 'match') {
      const isCorrect = index === pr.correctSemitones;
      const typeKey = `${pr.correctLabel} (match)`;

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

      appendIntervalEntries([{
        date: new Date().toISOString().slice(0, 10),
        label: pr.correctLabel,
        rootNote: pr.rootNote,
        correct: isCorrect,
        responseTimeMs,
        skill: 'match',
      }]);

      playMatchReveal(pr, settings.intervalPlayHarmonic);
      setMatchPick(index);
      setPhase('name');
      setTentative(null);
      setSelected(null);
      roundStartTimeRef.current = Date.now();
      return;
    }

    // phase === 'name'
    setSelected(index);
    const isCorrect = findTonePhaseBOptions[index]?.label === pr.correctLabel;
    const typeKey = `${pr.correctLabel} (name)`;

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

    appendIntervalEntries([{
      date: new Date().toISOString().slice(0, 10),
      label: pr.correctLabel,
      rootNote: pr.rootNote,
      correct: isCorrect,
      responseTimeMs,
      skill: 'name',
    }]);
  }
```

- [ ] **Step 8: Make `getOptionLabel` / `getOptionCount` / `isOptionCorrect` phase-aware**

Find:

```ts
  function getOptionLabel(index: number): string {
    if (round.kind === 'chord') return (round as ChordRound).options[index].displayLabel;
    if (round.kind === 'intervalPitch') return '';
    return (round as IntervalRound).options[index].shortLabel;
  }

  function getOptionCount(): number {
    if (round.kind === 'chord') return (round as ChordRound).options.length;
    if (round.kind === 'interval') return (round as IntervalRound).options.length;
    if (round.kind === 'intervalPitch') return 13;
    return 4;
  }

  function isOptionCorrect(index: number): boolean {
    if (round.kind === 'chord') {
      const r = round as ChordRound;
      return r.options[index].displayLabel === r.correct.displayLabel;
    }
    if (round.kind === 'intervalPitch') {
      return index === (round as IntervalPitchRound).correctSemitones;
    }
    const r = round as IntervalRound;
    return r.options[index].label === r.correct.label;
  }
```

Replace with:

```ts
  function getOptionLabel(index: number): string {
    if (round.kind === 'chord') return (round as ChordRound).options[index].displayLabel;
    if (round.kind === 'intervalPitch') {
      return phase === 'name' ? (findTonePhaseBOptions[index]?.shortLabel ?? '') : '';
    }
    return (round as IntervalRound).options[index].shortLabel;
  }

  function getOptionCount(): number {
    if (round.kind === 'chord') return (round as ChordRound).options.length;
    if (round.kind === 'interval') return (round as IntervalRound).options.length;
    if (round.kind === 'intervalPitch') return phase === 'name' ? findTonePhaseBOptions.length : 13;
    return 4;
  }

  function isOptionCorrect(index: number): boolean {
    if (round.kind === 'chord') {
      const r = round as ChordRound;
      return r.options[index].displayLabel === r.correct.displayLabel;
    }
    if (round.kind === 'intervalPitch') {
      const pr = round as IntervalPitchRound;
      return phase === 'name'
        ? findTonePhaseBOptions[index]?.label === pr.correctLabel
        : index === pr.correctSemitones;
    }
    const r = round as IntervalRound;
    return r.options[index].label === r.correct.label;
  }
```

- [ ] **Step 9: Replace the prompt block with phase-aware copy**

Find:

```tsx
              {/* Target interval prompt — Find the Tone only */}
              {round.kind === 'intervalPitch' && (
                <p className="text-center text-sm font-medium text-brand-ink">
                  Find the {(round as IntervalPitchRound).correctLabel}
                </p>
              )}
```

Replace with:

```tsx
              {/* Phase A / Phase B prompt — Find the Tone only */}
              {round.kind === 'intervalPitch' && (
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-brand-ink">
                    {phase === 'match' ? 'Listen, then find the matching tone' : 'Now name it'}
                  </p>
                  {phase === 'match' && (
                    <p className="text-xs text-brand-secondary">Root: {(round as IntervalPitchRound).rootNote}</p>
                  )}
                </div>
              )}
```

- [ ] **Step 10: Make the options-grid layout and button-size classes phase-aware**

Find:

```tsx
                <div
                  className={cn(
                    'gap-2',
                    round.kind === 'intervalPitch' && 'flex flex-wrap justify-center',
                    round.kind === 'interval' && 'grid grid-cols-4 sm:grid-cols-5',
                    round.kind === 'chord' && 'grid grid-cols-2 gap-3',
                  )}
                >
```

Replace with:

```tsx
                <div
                  className={cn(
                    'gap-2',
                    round.kind === 'intervalPitch' && phase === 'match' && 'flex flex-wrap justify-center',
                    (round.kind === 'interval' || (round.kind === 'intervalPitch' && phase === 'name')) && 'grid grid-cols-4 sm:grid-cols-5',
                    round.kind === 'chord' && 'grid grid-cols-2 gap-3',
                  )}
                >
```

Find:

```tsx
                    className={cn(
                      'border-2 font-medium transition-colors text-center leading-snug',
                      round.kind === 'intervalPitch' ? 'w-9 h-9 rounded-full text-[10px]' : 'rounded-lg',
                      round.kind === 'interval' && 'p-2 text-xs',
                      round.kind === 'chord' && 'p-4 text-sm',
```

Replace with:

```tsx
                    className={cn(
                      'border-2 font-medium transition-colors text-center leading-snug',
                      round.kind === 'intervalPitch' && phase === 'match' ? 'w-9 h-9 rounded-full text-[10px]' : 'rounded-lg',
                      (round.kind === 'interval' || (round.kind === 'intervalPitch' && phase === 'name')) && 'p-2 text-xs',
                      round.kind === 'chord' && 'p-4 text-sm',
```

- [ ] **Step 11: Replace the old reveal caption with the Phase B recap-dots strip**

Find:

```tsx
              {/* Reveal caption — Find the Tone only, after grading */}
              {round.kind === 'intervalPitch' && selected !== null && (
                <p className="text-center text-xs text-brand-secondary">
                  Correct answer: {(round as IntervalPitchRound).correctNote}
                </p>
              )}
```

Replace with:

```tsx
              {/* Phase A recap — shown throughout Phase B: all 13 dots revealed
                  with note names, correct one green, the user's Phase A pick
                  (if wrong) red. Static, independent of the interactive
                  Phase B options grid above/below it. */}
              {round.kind === 'intervalPitch' && phase === 'name' && (
                <div className="flex flex-wrap justify-center gap-2">
                  {Array.from({ length: 13 }, (_, i) => {
                    const pr = round as IntervalPitchRound;
                    const semitones = pr.direction === 'asc' ? i : -i;
                    const noteLabel = addSemitones(pr.rootNote, semitones);
                    const isCorrectDot = i === pr.correctSemitones;
                    const wasPicked = matchPick === i;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'w-9 h-9 rounded-full border-2 flex items-center justify-center text-center leading-snug text-[10px] font-medium',
                          isCorrectDot && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                          !isCorrectDot && wasPicked && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                          !isCorrectDot && !wasPicked && 'border-brand-line text-brand-secondary opacity-50',
                        )}
                      >
                        {noteLabel}
                      </div>
                    );
                  })}
                </div>
              )}
```

- [ ] **Step 12: Add the Find the Tone settings panel (Direction + Harmonic toggle)**

Find the closing of the Type/interval checkboxes ternary (this `)}` immediately precedes the `{/* Rhythm settings — rhythm mode only */}` comment, at `src/pages/EarTraining.tsx:1093-1096`):

```tsx
            )}

            {/* Rhythm settings — rhythm mode only */}
```

Replace with:

```tsx
            )}

            {/* Find the Tone settings — Interval mode, Find the Tone sub-mode only */}
            {settings.mode === 'interval' && intervalSubMode === 'findTone' && (
              <div className="pt-3 space-y-3 border-t border-brand-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary">Find the Tone Settings</p>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">Direction</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { id: 'asc' as const, label: 'Ascending' },
                      { id: 'desc' as const, label: 'Descending' },
                      { id: 'both' as const, label: 'Both' },
                    ]).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => handleIntervalDirectionChange(id)}
                        className={cn(
                          'px-3 py-1 rounded text-xs font-medium border transition-colors',
                          settings.intervalDirection === id
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleToggleIntervalHarmonic}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium border transition-colors',
                    settings.intervalPlayHarmonic
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                  )}
                >
                  {settings.intervalPlayHarmonic ? 'Also play harmonically: On' : 'Also play harmonically: Off'}
                </button>
              </div>
            )}

            {/* Rhythm settings — rhythm mode only */}
```

- [ ] **Step 13: Verify with the type checker**

Run: `npm run lint`
Expected: No new errors (ignoring the two pre-existing `TS2322` errors in untracked `src/pages/Caged 2.tsx`).

- [ ] **Step 14: Manual trace verification**

Confirm by reading the diff that:
- `handleIntervalPitchSelect`'s `phase === 'match'` branch never calls `advanceRound()` — it only calls `setPhase('name')`, and grades/records using the `index` argument (the user's tentative pick) against `pr.correctSemitones`, never against `matchPick` (which is set *after* grading, purely for the recap UI).
- `playMatchReveal` always derives `targetNote` from `pr.correctSemitones`/`pr.direction`, never from `index` or `matchPick` — a wrong Phase A pick still reveals the true correct pitch, not the user's wrong one.
- `getOptionLabel` returns `''` for every index while `phase === 'match'`, regardless of `selected`/`tentative` — dots never leak note names before Phase A is confirmed.
- The Phase B naming grid (`getOptionCount`/`getOptionLabel`/`isOptionCorrect` under `phase === 'name'`) is driven entirely by `findTonePhaseBOptions`, which is memoized on `[round, settings.activeIntervals]` — it does not reshuffle between the user's Phase B click and the graded re-render for the same round.
- `advanceRound` resets `phase` to `'match'` and `matchPick` to `null` unconditionally at the bottom of the function, so no stale phase/recap state leaks into the next round, regardless of which mode is entered next.
- The `Confirm`/`Next` button block (unmodified by this task) still behaves correctly: after Phase A confirm, `selected` is reset to `null` within the same `handleIntervalPitchSelect` call (batched with `setPhase('name')`), so React never renders an intermediate "Phase A answered" state — the UI goes straight from the Phase A grid to the Phase B recap+grid, with no spurious "Next" button appearing mid-round. The "Next" button only appears once Phase B's own confirm sets `selected` (and stays set), matching the existing generic `selected !== null` → Next-button condition.

- [ ] **Step 15: Browser smoke test (if browser automation is available; otherwise report explicitly that this step was skipped and why)**

Steps:
1. Start dev server (`npm run dev`), navigate to `/#/ear-training`, switch to Interval mode → Find the Tone sub-mode.
2. Verify the new "Find the Tone Settings" panel appears (Direction segmented control defaulting to "Both" highlighted, harmonic toggle defaulting to "Off").
3. Play a round: confirm no note names or highlighting are visible before clicking a dot and confirming.
4. Click a dot, click Confirm: verify melodic root→target playback, verify all 13 dots become labeled with note names, verify the prompt changes to "Now name it", verify a shuffled interval-name grid appears.
5. Click a name, click Confirm: verify grading, verify the "Next" button now appears and advances to a fresh round with `phase` reset (unlabeled dots again, "Listen, then find the matching tone" prompt).
6. Set Direction to "Descending", reload the page, verify the setting persisted.
7. Toggle harmonic playback on, confirm a round, verify the additional simultaneous root+target sound plays ~500ms after the melodic reveal.
8. Export interval history to CSV (if a UI control exists for this) and confirm two distinct rows appear per completed round (one `(match)`-flavored, one `(name)`-flavored via the `label`/`skill` fields, still 5 CSV columns).

- [ ] **Step 16: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: two-phase match-then-name flow for Find the Tone"
```

---

## Self-Review

**Spec coverage:**
- Two-phase state machine (`phase: 'match' | 'name'`, Phase A confirm never advances the round, Phase B confirm does not either — only Phase B's Next does) — Task 2 Steps 2, 4, 6, 7.
- Direction setting (`asc`/`desc`/`both`, persisted, default `'both'`) — Task 1 Step 4; Task 2 Step 12; direction-aware candidate lookup — Task 1 Steps 3, 5, 6; Task 2 Step 11 (recap).
- `addSemitones` negative-semitone fix, verified — Task 1 Steps 1, 9.
- Melodic root+target playback on Phase A confirm, always the true correct note — Task 2 Step 3, verified in Step 14.
- Optional harmonic (simultaneous) playback toggle, default off, persisted — Task 1 Step 4; Task 2 Steps 3, 12.
- Note-name reveal on all 13 dots after Phase A confirm, before Phase B naming — Task 2 Step 11.
- Separate history/scoring for match vs. naming skills (`(match)`/`(name)` byType keys, `skill` history field), CSV format unchanged — Task 1 Step 7; Task 2 Step 7.
- Scope gate: only `intervalSubMode === 'findTone'` touched; Mixed mode / Plan-mode ladders untouched (`generateIntervalRound` call sites and `handleSelect`'s non-`intervalPitch` branch are unmodified, and `handleIntervalPitchSelect` has no Plan-mode advancement logic since intervalPitch rounds cannot occur there) — confirmed throughout Task 2.
- Answer-leak prevention pre- and post-confirm — Task 2 Steps 8, 9, 14.
- UI copy exactly as specified ("Listen, then find the matching tone", "Root: {rootNote}", "Now name it") — Task 2 Step 9.
- Phase B options grid visually matches the existing Multiple Choice grid styling (`grid grid-cols-4 sm:grid-cols-5`, `p-2 text-xs`) — Task 2 Step 10.

**Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" placeholders — every step shows exact Find/Replace code. No gap.

**Type consistency:** `IntervalPitchRound.direction` (Task 1 Step 3) is consumed identically in Task 1 Steps 5–6 and Task 2 Steps 3, 7, 11. `generateIntervalPitchRound(activeIntervals, directionSetting)` signature (Task 1 Step 5) matches its Task 2 Step 4 call site exactly. `addSemitones`/`shuffle` exports (Task 1 Steps 1–2) match their Task 2 Step 1 import and subsequent usages (Steps 3, 6, 11). `IntervalHistoryEntry.skill` (Task 1 Step 7) matches the `skill: 'match'` / `skill: 'name'` literals used in Task 2 Step 7. `findTonePhaseBOptions: IntervalDef[]` (Task 2 Step 6) is consumed consistently in Steps 7, 8 (`.label` for correctness, `.shortLabel` for display).
