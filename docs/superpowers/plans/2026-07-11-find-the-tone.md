# Find the Tone (Interval Ear Training) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Find the Tone" sub-mode to the existing standalone Interval ear-training mode, where the learner hears a root note, is told a target interval by name, and must identify the matching tone among 13 unlabeled, ascending-pitch candidates — additive to (never replacing) the existing multiple-choice interval quiz.

**Architecture:** A new discriminated-union round type `IntervalPitchRound` and generator `generateIntervalPitchRound` in `src/lib/earTraining.ts` (Task 1), consumed by a new local `intervalSubMode` toggle and dedicated render/grading branches in `src/pages/EarTraining.tsx` (Task 2). The two sub-modes share Settings (active intervals), score (`byType` keyed by interval label), and history (`interval_history` via the existing `appendIntervalEntries`).

**Tech Stack:** No new dependencies. React 19 + TypeScript, existing `playNote`/`initAudio` from `src/lib/audio.ts`.

## Global Constraints

- Find-the-Tone applies **only to standalone Interval mode** (`settings.mode === 'interval'`). Mixed mode and Plan-mode skill-ladder interval practice must keep using the existing multiple-choice `generateIntervalRound` exclusively — do not touch the Plan-mode practice block (`src/pages/EarTraining.tsx` lines ~1457-1557) or the Mixed-mode branch in `advanceRound`/`makeRound`.
- `intervalSubMode` is local `useState<'choice' | 'findTone'>('choice')` — not persisted to `localStorage`/`EarTrainingSettings`, matching the existing `fretboardSubMode` convention (`src/pages/EarTraining.tsx:77`).
- The candidate window is always the full chromatic octave: semitones 0–12 above the root (13 candidates), independent of difficulty.
- `playRoundAudio` and `playOptionAudio` must never play the answer tone (`addSemitones(rootNote, correctSemitones)`) before the user confirms — only the root note plays automatically/on Replay.
- `npm run lint` (`tsc --noEmit`) must pass with zero new errors. Ignore the two pre-existing, unrelated `TS2322` errors in untracked `src/pages/Caged 2.tsx`.
- No test framework exists in this repo (per `CLAUDE.md`) — verification is `npm run lint` plus the manual checks specified in each task.

---

### Task 1: `IntervalPitchRound` type and generator in `src/lib/earTraining.ts`

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Produces: `IntervalPitchRound` interface (`kind: 'intervalPitch'`, `rootNote: string`, `correctSemitones: number`, `correctLabel: string`, `correctNote: string`), added to the `Round` union. `generateIntervalPitchRound(activeIntervals: string[]): IntervalPitchRound`. `playOptionAudio` gains an `intervalPitch` branch that plays a single tone at `addSemitones(round.rootNote, index)`.
- Consumes: existing private helpers `pickRandom<T>(arr: T[]): T` (line 235), `addSemitones(noteStr: string, semitones: number): string` (line 289), `INTERVAL_DEFS: IntervalDef[]` (line 139), `INTERVAL_ROOTS: string[]` (line 283) — all already defined in this file, none need new exports.

- [ ] **Step 1: Add the `IntervalPitchRound` interface**

In `src/lib/earTraining.ts`, find this block (lines 62-66):

```ts
export interface IntervalRound {
  kind: 'interval';
  correct: IntervalAnswer;
  options: IntervalAnswer[];
}
```

Replace it with:

```ts
export interface IntervalRound {
  kind: 'interval';
  correct: IntervalAnswer;
  options: IntervalAnswer[];
}

export interface IntervalPitchRound {
  kind: 'intervalPitch';
  rootNote: string;
  correctSemitones: number; // 0-12, index into the 13 ascending candidate buttons
  correctLabel: string;     // e.g. "Perfect 5th" — target prompt and score/history key
  correctNote: string;      // e.g. "D3" — actual note name, shown in the post-grading reveal caption
}
```

- [ ] **Step 2: Add `IntervalPitchRound` to the `Round` union**

Find (line 116):

```ts
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound | ScaleIntervalRound;
```

Replace with:

```ts
export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound | ScaleIntervalRound | IntervalPitchRound;
```

- [ ] **Step 3: Add `generateIntervalPitchRound`**

Find this block (lines 300-324):

```ts
export function generateIntervalRound(activeIntervals: string[]): IntervalRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);

  const correct: IntervalAnswer = {
    semitones: correctDef.semitones,
    label: correctDef.label,
    shortLabel: correctDef.shortLabel,
    rootNote,
    topNote: addSemitones(rootNote, correctDef.semitones),
  };

  // Every active interval becomes an option, not just a random subset — with
  // more intervals enabled, the round gets harder instead of staying at 4 choices.
  const options: IntervalAnswer[] = activeDefs.map(def => ({
    semitones: def.semitones,
    label: def.label,
    shortLabel: def.shortLabel,
    rootNote,
    topNote: addSemitones(rootNote, def.semitones),
  }));

  return { kind: 'interval', correct, options: shuffle(options) };
}
```

Replace with (adds `generateIntervalPitchRound` immediately after, unchanged existing function above it):

```ts
export function generateIntervalRound(activeIntervals: string[]): IntervalRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);

  const correct: IntervalAnswer = {
    semitones: correctDef.semitones,
    label: correctDef.label,
    shortLabel: correctDef.shortLabel,
    rootNote,
    topNote: addSemitones(rootNote, correctDef.semitones),
  };

  // Every active interval becomes an option, not just a random subset — with
  // more intervals enabled, the round gets harder instead of staying at 4 choices.
  const options: IntervalAnswer[] = activeDefs.map(def => ({
    semitones: def.semitones,
    label: def.label,
    shortLabel: def.shortLabel,
    rootNote,
    topNote: addSemitones(rootNote, def.semitones),
  }));

  return { kind: 'interval', correct, options: shuffle(options) };
}

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

- [ ] **Step 4: Add the `intervalPitch` branch to `playOptionAudio`**

Find (lines 344-355):

```ts
export async function playOptionAudio(round: Round, index: number): Promise<void> {
  await initAudio();
  if (round.kind === 'chord') {
    const cr = round as ChordRound;
    playStrum(chordToNotes(cr.options[index].chord), '2n');
  } else {
    const ir = round as IntervalRound;
    const opt = ir.options[index];
    playNote(opt.rootNote, '2n');
    setTimeout(() => playNote(opt.topNote, '2n'), 400);
  }
}
```

Replace with:

```ts
export async function playOptionAudio(round: Round, index: number): Promise<void> {
  await initAudio();
  if (round.kind === 'chord') {
    const cr = round as ChordRound;
    playStrum(chordToNotes(cr.options[index].chord), '2n');
  } else if (round.kind === 'intervalPitch') {
    const pr = round as IntervalPitchRound;
    playNote(addSemitones(pr.rootNote, index), '2n');
  } else {
    const ir = round as IntervalRound;
    const opt = ir.options[index];
    playNote(opt.rootNote, '2n');
    setTimeout(() => playNote(opt.topNote, '2n'), 400);
  }
}
```

- [ ] **Step 5: Verify with the type checker**

Run: `npm run lint`
Expected: No new errors from `src/lib/earTraining.ts`. The two pre-existing `TS2322` errors in untracked `src/pages/Caged 2.tsx` are unrelated and may still appear — that's fine.

- [ ] **Step 6: Manual trace verification**

Confirm by reading the diff that:
- `generateIntervalPitchRound` never reads or returns anything that reveals `correctSemitones`/`correctNote` through a side channel other than the returned object (i.e., no `console.log`, no premature audio call).
- `playOptionAudio`'s new branch plays exactly one note (`addSemitones(pr.rootNote, index)`), never `pr.correctNote`, regardless of `index`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add IntervalPitchRound and generator for Find the Tone mode"
```

---

### Task 2: Wire the Find-the-Tone sub-mode into `src/pages/EarTraining.tsx`

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1: `IntervalPitchRound` (fields `kind`, `rootNote`, `correctSemitones`, `correctLabel`, `correctNote`), `generateIntervalPitchRound(activeIntervals: string[]): IntervalPitchRound`.
- Produces: local state `intervalSubMode: 'choice' | 'findTone'` (default `'choice'`), handler `handleIntervalSubModeChange(mode: 'choice' | 'findTone')`, and an `advanceRound` fourth parameter `intervalSubModeOverride?: 'choice' | 'findTone'` used to avoid a stale-closure bug when switching sub-modes and modes in the same tick.

- [ ] **Step 1: Import the new type and generator**

Find (lines 6-14):

```ts
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
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
  chordToNotes, playOptionAudio, playStudyCard,
  generateIntervalFretboardRound, IntervalFretboardRound,
} from '../lib/earTraining';
```

- [ ] **Step 2: Add `intervalSubMode` local state**

Find (line 77):

```ts
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt' | 'sing' | 'singhunt'>('guess');
```

Replace with:

```ts
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt' | 'sing' | 'singhunt'>('guess');
  const [intervalSubMode, setIntervalSubMode] = useState<'choice' | 'findTone'>('choice');
```

- [ ] **Step 3: Add root-only audio branch to `playRoundAudio`**

Find (lines 192-204):

```ts
  const playRoundAudio = useCallback(async (r: Round) => {
    if (r.kind === 'fretboard') return;
    if (r.kind === 'rhythm') return;
    await initAudio();
    audioUnlocked.current = true;
    if (r.kind === 'chord') {
      playStrum(chordToNotes((r as ChordRound).correct.chord), '2n');
    } else {
      const ir = r as IntervalRound;
      playNote(ir.correct.rootNote, '2n');
      setTimeout(() => playNote(ir.correct.topNote, '2n'), 400);
    }
  }, []);
```

Replace with:

```ts
  const playRoundAudio = useCallback(async (r: Round) => {
    if (r.kind === 'fretboard') return;
    if (r.kind === 'rhythm') return;
    await initAudio();
    audioUnlocked.current = true;
    if (r.kind === 'chord') {
      playStrum(chordToNotes((r as ChordRound).correct.chord), '2n');
    } else if (r.kind === 'intervalPitch') {
      playNote((r as IntervalPitchRound).rootNote, '2n');
    } else {
      const ir = r as IntervalRound;
      playNote(ir.correct.rootNote, '2n');
      setTimeout(() => playNote(ir.correct.topNote, '2n'), 400);
    }
  }, []);
```

This is the answer-leak-prevention branch: it plays only the root, never `correctNote`.

- [ ] **Step 4: Route round generation through `advanceRound`, with an explicit override param to avoid a stale-closure bug**

Find (lines 213-262):

```ts
  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus, pianoViewOverride?: boolean) {
    const activeFocus = focusOverride ?? fretboardFocus;
    const effectiveMode = s.mode === 'plan' && activeLadder
      ? SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!.mode
      : s.mode;
    let r: Round;
    if (effectiveMode === 'fretboard') {
      const activePianoView = pianoViewOverride !== undefined ? pianoViewOverride : pianoView;
      let note: string;
      if (activePianoView) {
        const kbPool = buildKeyboardNotePool(activeFocus.octaveMin ?? 2, activeFocus.octaveMax ?? 4);
        note = kbPool[Math.floor(Math.random() * kbPool.length)];
        r = makeFretboardRound(note, 13);
      } else {
        note = nextFretboardNote(difficulty, activeFocus);
        r = makeFretboardRound(note, FRETS_FOR[difficulty]);
      }
    } else if (effectiveMode === 'rhythm') {
      const rr = generateRhythmRound(difficulty, rhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'melody') {
      const mr = generateMelodyRound(difficulty, settings.melodySettings);
      setSelected(null);
      setTentative(null);
      setRound(mr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'count') {
      const rr = generateRhythmRound(difficulty, rhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'mixed') {
      r = Math.random() < 0.5
        ? generateChordRound(s.activeChordTypes)
        : generateIntervalRound(s.activeIntervals);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
    roundStartTimeRef.current = Date.now();
  }
```

Replace with (only the signature line and the final `else` branch change; every other branch is untouched, preserving Fretboard/Rhythm/Melody/Count/Mixed/Plan-mode behavior exactly):

```ts
  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus, pianoViewOverride?: boolean, intervalSubModeOverride?: 'choice' | 'findTone') {
    const activeFocus = focusOverride ?? fretboardFocus;
    const effectiveMode = s.mode === 'plan' && activeLadder
      ? SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!.mode
      : s.mode;
    const effectiveIntervalSubMode = intervalSubModeOverride ?? intervalSubMode;
    let r: Round;
    if (effectiveMode === 'fretboard') {
      const activePianoView = pianoViewOverride !== undefined ? pianoViewOverride : pianoView;
      let note: string;
      if (activePianoView) {
        const kbPool = buildKeyboardNotePool(activeFocus.octaveMin ?? 2, activeFocus.octaveMax ?? 4);
        note = kbPool[Math.floor(Math.random() * kbPool.length)];
        r = makeFretboardRound(note, 13);
      } else {
        note = nextFretboardNote(difficulty, activeFocus);
        r = makeFretboardRound(note, FRETS_FOR[difficulty]);
      }
    } else if (effectiveMode === 'rhythm') {
      const rr = generateRhythmRound(difficulty, rhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'melody') {
      const mr = generateMelodyRound(difficulty, settings.melodySettings);
      setSelected(null);
      setTentative(null);
      setRound(mr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'count') {
      const rr = generateRhythmRound(difficulty, rhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'mixed') {
      r = Math.random() < 0.5
        ? generateChordRound(s.activeChordTypes)
        : generateIntervalRound(s.activeIntervals);
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

The new branch is gated on `s.mode === 'interval'` (the raw top-level mode), not `effectiveMode`, so Plan-mode ladders that resolve to interval practice can never be routed to Find-the-Tone even if `intervalSubMode` happens to be `'findTone'` from a prior standalone-Interval-mode session.

- [ ] **Step 5: Reset to Multiple Choice on mode switch, and add the sub-mode change handler**

Find (lines 264-268):

```ts
  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }
```

Replace with:

```ts
  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    if (mode === 'interval') {
      setIntervalSubMode('choice');
      advanceRound(next, undefined, undefined, 'choice');
    } else {
      advanceRound(next);
    }
  }

  function handleIntervalSubModeChange(mode: 'choice' | 'findTone') {
    setIntervalSubMode(mode);
    advanceRound(settings, undefined, undefined, mode);
  }
```

`setIntervalSubMode` is asynchronous, so `advanceRound`'s explicit override parameter (Step 4) is what makes the very next round match the just-clicked sub-mode — relying on the `intervalSubMode` closure alone would generate one round of the previous sub-mode before state caught up.

- [ ] **Step 6: Add `intervalPitch` branches to `getOptionLabel`, `getOptionCount`, `isOptionCorrect`**

Find (lines 681-699):

```ts
  function getOptionLabel(index: number): string {
    if (round.kind === 'chord') return (round as ChordRound).options[index].displayLabel;
    return (round as IntervalRound).options[index].shortLabel;
  }

  function getOptionCount(): number {
    if (round.kind === 'chord') return (round as ChordRound).options.length;
    if (round.kind === 'interval') return (round as IntervalRound).options.length;
    return 4;
  }

  function isOptionCorrect(index: number): boolean {
    if (round.kind === 'chord') {
      const r = round as ChordRound;
      return r.options[index].displayLabel === r.correct.displayLabel;
    }
    const r = round as IntervalRound;
    return r.options[index].label === r.correct.label;
  }
```

Replace with:

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

`getOptionLabel` returns `''` for `intervalPitch` — the 13 candidate buttons render whatever `getOptionLabel(i)` returns, so an empty string keeps them visually unlabeled without a separate render path.

- [ ] **Step 7: Add `intervalPitch` branch to `handleSelect`'s grading and history logic**

Find (lines 574-622):

```ts
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
```

Replace with:

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
```

`typeKey` reuses the interval's label (e.g. `"Perfect 5th"`) as the `byType` score bucket — the same key the multiple-choice quiz already uses for that interval — so accuracy stats blend across both sub-modes. History reuses `appendIntervalEntries` with the same `interval_history` store, giving genuinely shared history between the two sub-modes.

- [ ] **Step 8: Add the sub-mode toggle, prompt text, dot grid, and reveal caption to the standalone Interval quiz screen**

Find (lines 1804-1870):

```tsx
          ) : (
            <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
              {/* Replay button — also serves as the first user gesture to unlock audio */}
              <div className="flex justify-center">
                <button
                  onClick={() => playRoundAudio(round)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                >
                  <Volume2 size={18} /> Replay
                </button>
              </div>

              {/* Answer options */}
              <div className={cn('grid gap-2', round.kind === 'interval' ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-2 gap-3')}>
                {Array.from({ length: getOptionCount() }, (_, i) => {
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
                        'rounded-lg border-2 font-medium transition-colors text-center leading-snug',
                        round.kind === 'interval' ? 'p-2 text-xs' : 'p-4 text-sm',
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

              {/* Confirm button — appears after tentative pick */}
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

              {/* Next button — appears after answering */}
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
          )}
```

Replace with:

```tsx
          ) : (
            <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
              {/* Replay button — also serves as the first user gesture to unlock audio */}
              <div className="flex justify-center">
                <button
                  onClick={() => playRoundAudio(round)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                >
                  <Volume2 size={18} /> Replay
                </button>
              </div>

              {/* Multiple Choice | Find the Tone sub-mode toggle — Interval mode only */}
              {settings.mode === 'interval' && (
                <div className="flex justify-center">
                  <div className="flex rounded-lg border border-brand-line overflow-hidden text-xs">
                    <button
                      onClick={() => handleIntervalSubModeChange('choice')}
                      className={cn(
                        'px-3 py-1.5 font-medium transition-colors',
                        intervalSubMode === 'choice' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:bg-brand-sidebar',
                      )}
                    >
                      Multiple Choice
                    </button>
                    <button
                      onClick={() => handleIntervalSubModeChange('findTone')}
                      className={cn(
                        'px-3 py-1.5 font-medium transition-colors',
                        intervalSubMode === 'findTone' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:bg-brand-sidebar',
                      )}
                    >
                      Find the Tone
                    </button>
                  </div>
                </div>
              )}

              {/* Target interval prompt — Find the Tone only */}
              {round.kind === 'intervalPitch' && (
                <p className="text-center text-sm font-medium text-brand-ink">
                  Find the {(round as IntervalPitchRound).correctLabel}
                </p>
              )}

              {/* Answer options */}
              <div
                className={cn(
                  'gap-2',
                  round.kind === 'intervalPitch' && 'flex flex-wrap justify-center',
                  round.kind === 'interval' && 'grid grid-cols-4 sm:grid-cols-5',
                  round.kind === 'chord' && 'grid grid-cols-2 gap-3',
                )}
              >
                {Array.from({ length: getOptionCount() }, (_, i) => {
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
                        'border-2 font-medium transition-colors text-center leading-snug',
                        round.kind === 'intervalPitch' ? 'w-9 h-9 rounded-full text-[10px]' : 'rounded-lg',
                        round.kind === 'interval' && 'p-2 text-xs',
                        round.kind === 'chord' && 'p-4 text-sm',
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

              {/* Reveal caption — Find the Tone only, after grading */}
              {round.kind === 'intervalPitch' && selected !== null && (
                <p className="text-center text-xs text-brand-secondary">
                  Correct answer: {(round as IntervalPitchRound).correctNote}
                </p>
              )}

              {/* Confirm button — appears after tentative pick */}
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

              {/* Next button — appears after answering */}
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
          )}
```

**Do not** modify the Plan-mode practice block (the near-identical grid at lines ~1497-1556, inside `{planPracticing && activeLadder && (() => { ... })()}`) — Find-the-Tone is out of scope there per Global Constraints.

- [ ] **Step 9: Verify with the type checker**

Run: `npm run lint`
Expected: No new errors from `src/pages/EarTraining.tsx`. The two pre-existing `TS2322` errors in untracked `src/pages/Caged 2.tsx` are unrelated and may still appear — that's fine.

- [ ] **Step 10: Manual verification**

Attempt a live browser smoke test first:
1. Run `npm run dev`, open `/Guitar_Chords/ear-training`.
2. Click the **Interval** mode tab, then click **Find the Tone**.
3. Confirm: the Replay button plays only a single root tone (not two notes); a prompt reads "Find the ___"; 13 unlabeled circular buttons render in a row/wrap, left-to-right ascending; clicking one plays a single tone and highlights it; Confirm grades it; the correct dot turns green (and the wrong one red if applicable); a "Correct answer: ___" caption appears; score/streak in the fixed bottom bar updates.
4. Click **Multiple Choice** — confirm the original labeled-button quiz still works unchanged, and switching back to **Find the Tone** starts a fresh dot-grid round.
5. Switch to Chord mode and back to Interval mode — confirm it resets to Multiple Choice (per Global Constraints).
6. Open browser console — confirm no new errors.

If browser automation is unavailable in the environment (as has been the case in prior sessions of this project), report that explicitly and substitute a written code-path trace confirming the same 6 checks against the diff, rather than claiming they were visually verified.

- [ ] **Step 11: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add Find the Tone sub-mode to Interval ear training"
```

---

## Self-Review

**Spec coverage:** Data model (Task 1 Steps 1-3), audio answer-leak prevention (Task 1 Step 4, Task 2 Step 3 — root-only playback; Task 2 Step 6 option-click playback via existing `playOptionAudio` route), sub-mode toggle placement and scope (Task 2 Steps 5, 8), 13-dot ascending unlabeled grid (Task 2 Step 8), Confirm/tentative reuse (unchanged, verified in Step 8 diff), scoring/history reuse via `appendIntervalEntries` (Task 2 Step 7), routing scoped to standalone Interval mode only (Task 2 Step 4) — every section of the spec maps to a step above.

**Placeholder scan:** No TBD/TODO; every step has complete code.

**Type consistency:** `IntervalPitchRound` fields (`kind`, `rootNote`, `correctSemitones`, `correctLabel`, `correctNote`) are used identically across Task 1 (definition) and Task 2 (consumption) — checked field-by-field against each usage site above.
