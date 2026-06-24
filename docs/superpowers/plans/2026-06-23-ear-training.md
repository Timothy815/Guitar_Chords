# Ear Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/ear-training` page that teaches users to recognize chords and intervals by ear through multiple-choice quiz rounds with score tracking.

**Architecture:** Two tasks: (1) a pure-logic module `src/lib/earTraining.ts` with types, pools, and round generators; (2) the full page `src/pages/EarTraining.tsx` with mode tabs, collapsible settings, answer UI, score bar, and session summary modal, wired into the router and nav.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tone.js (via `src/lib/audio.ts`), React Router v7, `localStorage` for settings persistence, `lucide-react` for icons.

## Global Constraints

- No test framework — verify with `npm run lint` (TypeScript type-check only) plus manual dev server check
- Route: `/ear-training` — `BrowserRouter basename="/Guitar_Chords"` in `src/App.tsx` already applies, no config change needed
- Settings key: `ear-training-settings` in `localStorage`
- Minimum 2 active chord types or intervals must remain checked at all times — disable the toggle when only 2 remain
- `initAudio()` from `src/lib/audio.ts` must be `await`ed before every audio call (it is idempotent — safe to call on every play)
- `playStrum(notes: string[], duration, direction)` takes note strings — convert `ChordShape` via `chordToNotes` before calling
- `getFretNote(stringIndex, fret)` returns `''` for fret `-1` — filter these out in `chordToNotes`
- Score bar uses `position: fixed` bottom with `z-10 print:hidden`; page content needs `pb-24` so it is never hidden behind the bar
- All page content is constrained to `max-w-2xl mx-auto`

---

### Task 1: Pure Logic Module

**Files:**
- Create: `src/lib/earTraining.ts`

**Interfaces:**
- Consumes: `ChordShape`, `Note` from `../types`; `ALL_NOTES`, `COMMON_CHORDS` from `../data/guitarData`; `getFretNote` from `./audio`
- Produces (all exported):
  - Types: `EarTrainingSettings`, `ChordAnswer`, `IntervalAnswer`, `ChordRound`, `IntervalRound`, `Round`, `SessionScore`, `DifficultyLevel`
  - Constants: `CHORD_TYPE_DEFS`, `INTERVAL_DEFS`, `DIFFICULTY_PRESETS`, `DEFAULT_SETTINGS`
  - Functions: `getChordType`, `chordToNotes`, `generateChordRound`, `generateIntervalRound`, `loadSettings`, `saveSettings`, `initialScore`

- [ ] **Step 1: Create `src/lib/earTraining.ts`**

```typescript
import { ChordShape, Note } from '../types';
import { ALL_NOTES, COMMON_CHORDS } from '../data/guitarData';
import { getFretNote } from './audio';

export interface ChordTypeDef {
  id: string;
  label: string;
}

export interface IntervalDef {
  semitones: number;
  label: string;
}

export interface EarTrainingSettings {
  mode: 'chord' | 'interval';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
}

export interface ChordAnswer {
  root: Note;
  type: string;
  typeLabel: string;
  displayLabel: string;
  chord: ChordShape;
}

export interface IntervalAnswer {
  semitones: number;
  label: string;
  rootNote: string;
  topNote: string;
}

export interface ChordRound {
  kind: 'chord';
  correct: ChordAnswer;
  options: ChordAnswer[];
}

export interface IntervalRound {
  kind: 'interval';
  correct: IntervalAnswer;
  options: IntervalAnswer[];
}

export type Round = ChordRound | IntervalRound;

export interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
}

export const CHORD_TYPE_DEFS: ChordTypeDef[] = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'dom7', label: 'Dom 7' },
  { id: 'Maj7', label: 'Maj 7' },
  { id: 'm7', label: 'Min 7' },
  { id: 'dim', label: 'Diminished' },
  { id: 'aug', label: 'Augmented' },
  { id: 'dim7', label: 'Dim 7' },
  { id: 'm7b5', label: 'm7♭5' },
];

export const INTERVAL_DEFS: IntervalDef[] = [
  { semitones: 0, label: 'Unison' },
  { semitones: 1, label: 'Minor 2nd' },
  { semitones: 2, label: 'Major 2nd' },
  { semitones: 3, label: 'Minor 3rd' },
  { semitones: 4, label: 'Major 3rd' },
  { semitones: 5, label: 'Perfect 4th' },
  { semitones: 6, label: 'Tritone' },
  { semitones: 7, label: 'Perfect 5th' },
  { semitones: 8, label: 'Minor 6th' },
  { semitones: 9, label: 'Major 6th' },
  { semitones: 10, label: 'Minor 7th' },
  { semitones: 11, label: 'Major 7th' },
  { semitones: 12, label: 'Octave' },
];

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export const DIFFICULTY_PRESETS: {
  chord: Record<DifficultyLevel, string[]>;
  interval: Record<DifficultyLevel, string[]>;
} = {
  chord: {
    Beginner: ['major', 'minor'],
    Intermediate: ['major', 'minor', 'dom7', 'Maj7', 'm7'],
    Advanced: ['major', 'minor', 'dom7', 'Maj7', 'm7', 'dim', 'aug', 'dim7', 'm7b5'],
  },
  interval: {
    Beginner: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
    Intermediate: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Major 6th'],
    Advanced: INTERVAL_DEFS.map(d => d.label),
  },
};

export const DEFAULT_SETTINGS: EarTrainingSettings = {
  mode: 'chord',
  activeChordTypes: ['major', 'minor'],
  activeIntervals: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
  settingsPanelOpen: true,
};

// Chord type classification — order matters: most specific patterns first.
// Names are formatted as "${root} ${shapeNameStr}", e.g. "C m7b5 (A Shape)".
export function getChordType(chord: ChordShape): string {
  const name = chord.name;
  if (name.includes('m7b5')) return 'm7b5';
  if (name.includes('dim7')) return 'dim7';
  if (name.includes('Maj7')) return 'Maj7';
  if (name.includes('m7')) return 'm7';
  if (/ 7 /.test(name) || / 7\(/.test(name)) return 'dom7';
  if (name.includes('dim')) return 'dim';
  if (name.includes('aug')) return 'aug';
  if (name.includes('Minor')) return 'minor';
  if (name.includes('Major')) return 'major';
  if (name.includes('sus2')) return 'sus2';
  if (name.includes('sus4')) return 'sus4';
  return 'other';
}

// Convert ChordShape frets to playable note strings for playStrum.
// Skips muted (-1) and open-but-unplayed strings.
export function chordToNotes(chord: ChordShape): string[] {
  return chord.frets
    .map((fret, stringIdx) => {
      if (fret < 0) return null;
      const note = getFretNote(stringIdx, fret);
      return note || null;
    })
    .filter((n): n is string => n !== null);
}

interface PoolEntry {
  root: Note;
  type: string;
  typeLabel: string;
  chord: ChordShape;
}

function buildChordPool(activeTypes: string[]): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const root of ALL_NOTES) {
    for (const chord of COMMON_CHORDS[root] ?? []) {
      const type = getChordType(chord);
      if (activeTypes.includes(type)) {
        const typeDef = CHORD_TYPE_DEFS.find(d => d.id === type);
        pool.push({ root, type, typeLabel: typeDef?.label ?? type, chord });
      }
    }
  }
  return pool;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateChordRound(activeTypes: string[]): ChordRound {
  const pool = buildChordPool(activeTypes);
  const correctEntry = pickRandom(pool);

  const correct: ChordAnswer = {
    root: correctEntry.root,
    type: correctEntry.type,
    typeLabel: correctEntry.typeLabel,
    displayLabel: `${correctEntry.root} ${correctEntry.typeLabel}`,
    chord: correctEntry.chord,
  };

  // Pick 3 distractors: unique root+type combos not matching the correct answer.
  const distractors: ChordAnswer[] = [];
  const seen = new Set<string>([`${correctEntry.root}-${correctEntry.type}`]);

  for (const entry of shuffle(pool)) {
    const key = `${entry.root}-${entry.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      distractors.push({
        root: entry.root,
        type: entry.type,
        typeLabel: entry.typeLabel,
        displayLabel: `${entry.root} ${entry.typeLabel}`,
        chord: entry.chord,
      });
      if (distractors.length === 3) break;
    }
  }

  return { kind: 'chord', correct, options: shuffle([correct, ...distractors]) };
}

// Root notes drawn from guitar range: all 12 notes at octaves 2 and 3.
const INTERVAL_ROOTS: string[] = [
  ...ALL_NOTES.map(n => `${n}2`),
  ...ALL_NOTES.map(n => `${n}3`),
];

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

export function generateIntervalRound(activeIntervals: string[]): IntervalRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);

  const correct: IntervalAnswer = {
    semitones: correctDef.semitones,
    label: correctDef.label,
    rootNote,
    topNote: addSemitones(rootNote, correctDef.semitones),
  };

  // Distractors drawn from full INTERVAL_DEFS (minus correct) to always have 3.
  const distractorPool = shuffle(
    INTERVAL_DEFS.filter(d => d.semitones !== correctDef.semitones)
  );
  const distractors: IntervalAnswer[] = distractorPool.slice(0, 3).map(def => ({
    semitones: def.semitones,
    label: def.label,
    rootNote,
    topNote: addSemitones(rootNote, def.semitones),
  }));

  return { kind: 'interval', correct, options: shuffle([correct, ...distractors]) };
}

export function loadSettings(): EarTrainingSettings {
  try {
    const raw = localStorage.getItem('ear-training-settings');
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<EarTrainingSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: EarTrainingSettings): void {
  localStorage.setItem('ear-training-settings', JSON.stringify(settings));
}

export function initialScore(): SessionScore {
  return { correct: 0, total: 0, streak: 0, byType: {} };
}
```

- [ ] **Step 2: Run lint to verify**

```bash
npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add ear training logic module"
```

---

### Task 2: EarTraining Page + Route + Nav

**Files:**
- Create: `src/pages/EarTraining.tsx`
- Modify: `src/App.tsx` — add import, route (`/ear-training`), nav link, and `Headphones` icon import

**Interfaces:**
- Consumes from Task 1: `EarTrainingSettings`, `ChordRound`, `IntervalRound`, `Round`, `SessionScore`, `DifficultyLevel`, `CHORD_TYPE_DEFS`, `INTERVAL_DEFS`, `DIFFICULTY_PRESETS`, `DEFAULT_SETTINGS`, `loadSettings`, `saveSettings`, `initialScore`, `generateChordRound`, `generateIntervalRound`, `chordToNotes`
- Consumes from audio: `initAudio`, `playStrum`, `playNote`
- Consumes from lucide-react: `Volume2`, `ChevronDown`, `ChevronUp`, `Headphones`
- Consumes from utils: `cn`

- [ ] **Step 1: Create `src/pages/EarTraining.tsx`**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronDown, ChevronUp, Headphones } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, chordToNotes,
} from '../lib/earTraining';
import { initAudio, playStrum, playNote } from '../lib/audio';

function makeRound(s: EarTrainingSettings): Round {
  return s.mode === 'chord'
    ? generateChordRound(s.activeChordTypes)
    : generateIntervalRound(s.activeIntervals);
}

export function EarTraining() {
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState<SessionScore>(initialScore);
  const [showSummary, setShowSummary] = useState(false);
  const audioUnlocked = useRef(false);

  useEffect(() => { saveSettings(settings); }, [settings]);

  const playRoundAudio = useCallback(async (r: Round) => {
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

  // Auto-play when round changes — only works once audio is unlocked by a user gesture.
  useEffect(() => {
    if (audioUnlocked.current) {
      playRoundAudio(round);
    }
  }, [round, playRoundAudio]);

  function advanceRound(s: EarTrainingSettings = settings) {
    const r = makeRound(s);
    setSelected(null);
    setRound(r);
  }

  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }

  function handleDifficulty(level: DifficultyLevel) {
    setSettings(s => ({
      ...s,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    }));
  }

  function handleToggleChordType(id: string) {
    setSettings(s => {
      if (s.activeChordTypes.includes(id)) {
        if (s.activeChordTypes.length <= 2) return s;
        return { ...s, activeChordTypes: s.activeChordTypes.filter(t => t !== id) };
      }
      return { ...s, activeChordTypes: [...s.activeChordTypes, id] };
    });
  }

  function handleToggleInterval(label: string) {
    setSettings(s => {
      if (s.activeIntervals.includes(label)) {
        if (s.activeIntervals.length <= 2) return s;
        return { ...s, activeIntervals: s.activeIntervals.filter(l => l !== label) };
      }
      return { ...s, activeIntervals: [...s.activeIntervals, label] };
    });
  }

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = round.kind === 'chord'
      ? (round as ChordRound).options[index].displayLabel === (round as ChordRound).correct.displayLabel
      : (round as IntervalRound).options[index].label === (round as IntervalRound).correct.label;

    // Track score keyed by the correct answer's display label.
    const typeKey = round.kind === 'chord'
      ? (round as ChordRound).correct.typeLabel
      : (round as IntervalRound).correct.label;

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
  }

  function handleStartOver() {
    setScore(initialScore());
    setShowSummary(false);
    advanceRound();
  }

  function getOptionLabel(index: number): string {
    if (round.kind === 'chord') return (round as ChordRound).options[index].displayLabel;
    return (round as IntervalRound).options[index].label;
  }

  function isOptionCorrect(index: number): boolean {
    if (round.kind === 'chord') {
      const r = round as ChordRound;
      return r.options[index].displayLabel === r.correct.displayLabel;
    }
    const r = round as IntervalRound;
    return r.options[index].label === r.correct.label;
  }

  const accuracy = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto pb-24 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
          <Headphones size={18} className="text-white" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Ear Training</h1>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-lg border border-brand-line overflow-hidden">
        {(['chord', 'interval'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              settings.mode === mode
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar'
            )}
          >
            {mode === 'chord' ? 'Chord Recognition' : 'Interval Recognition'}
          </button>
        ))}
      </div>

      {/* Settings panel */}
      <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
        <button
          onClick={() => setSettings(s => ({ ...s, settingsPanelOpen: !s.settingsPanelOpen }))}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-ink hover:bg-brand-sidebar transition-colors"
        >
          <span>Settings</span>
          {settings.settingsPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {settings.settingsPanelOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-brand-line">
            {/* Difficulty presets */}
            <div className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
              <div className="flex gap-2">
                {(['Beginner', 'Intermediate', 'Advanced'] as DifficultyLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => handleDifficulty(level)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Type / interval checkboxes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">
                {settings.mode === 'chord' ? 'Chord Types' : 'Intervals'}
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.mode === 'chord'
                  ? CHORD_TYPE_DEFS.map(def => {
                      const checked = settings.activeChordTypes.includes(def.id);
                      const disabled = checked && settings.activeChordTypes.length <= 2;
                      return (
                        <label
                          key={def.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleChordType(def.id)}
                          />
                          {def.label}
                        </label>
                      );
                    })
                  : INTERVAL_DEFS.map(def => {
                      const checked = settings.activeIntervals.includes(def.label);
                      const disabled = checked && settings.activeIntervals.length <= 2;
                      return (
                        <label
                          key={def.label}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleInterval(def.label)}
                          />
                          {def.label}
                        </label>
                      );
                    })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Round area */}
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

        {/* Answer options — 2×2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => {
            const answered = selected !== null;
            const correct = isOptionCorrect(i);
            const isSelected = selected === i;
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={answered}
                className={cn(
                  'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                  !answered && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
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

      {/* Fixed score bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-line px-6 py-3 flex items-center justify-between z-10 print:hidden">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-brand-ink">
            {score.correct}
            <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
          </span>
          {score.streak >= 2 && (
            <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
          )}
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Session summary modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface rounded-xl border border-brand-line p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-serif font-bold text-brand-ink">Session Complete</h2>
            <p className="text-brand-ink">
              <span className="text-2xl font-bold">{score.correct}</span>
              <span className="text-brand-secondary"> / {score.total} correct</span>
              <span className="ml-2 text-sm text-brand-secondary">({accuracy}%)</span>
            </p>

            {Object.keys(score.byType).length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brand-line text-left">
                    <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                    <th className="pb-1.5 font-medium text-brand-secondary text-right">Correct</th>
                    <th className="pb-1.5 font-medium text-brand-secondary text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(score.byType).map(([type, data]) => (
                    <tr key={type} className="border-b border-brand-line/40">
                      <td className="py-1.5 text-brand-ink">{type}</td>
                      <td className="py-1.5 text-right text-green-600 font-medium">{data.correct}</td>
                      <td className="py-1.5 text-right text-brand-secondary">{data.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleStartOver}
                className="flex-1 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 py-2 rounded-lg border border-brand-line text-brand-secondary text-sm font-medium hover:border-brand-primary hover:text-brand-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add import, route, and nav link to `src/App.tsx`**

The current file has these imports (lines 1–6):
```tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Dictionary } from './pages/Dictionary';
import { Progressions } from './pages/Progressions';
import { Music, Calendar, BookOpen, Sun, Moon, Disc } from 'lucide-react';
```

**a) Add `EarTraining` import** — after line 4:
```tsx
import { EarTraining } from './pages/EarTraining';
```

**b) Add `Headphones` to the lucide-react import** — change line 5 to:
```tsx
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones } from 'lucide-react';
```

**c) Add nav link** — insert after the existing Practice `<NavLink>` block (around line 54), before the closing `</nav>`:
```tsx
<NavLink
  to="/ear-training"
  className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
>
  <Headphones size={16} /> Ear Training
</NavLink>
```

**d) Add route** — insert after the `<Route path="/circle" ... />` line (around line 89):
```tsx
<Route path="/ear-training" element={<EarTraining />} />
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 errors

- [ ] **Step 4: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/Guitar_Chords/ear-training` and confirm:

1. "Ear Training" nav link appears in the header
2. Page shows "Ear Training" heading with headphones icon
3. Mode tabs: "Chord Recognition" (active/blue) and "Interval Recognition"
4. Settings panel is open by default; shows Beginner/Intermediate/Advanced buttons and "Major" + "Minor" checked
5. Round area shows a blue "Replay" button and 4 unlabelled-until-rendered answer buttons (e.g. "C Major", "G Minor", "F Dom 7", "A Maj 7")
6. Clicking "Replay" plays a strummed chord sound
7. Clicking any answer button: correct turns green; if wrong, selection turns red and correct turns green
8. "Next →" button appears after answering; clicking it starts a new round
9. Score bar at the bottom updates ("1 / 1 correct")
10. After 2+ correct in a row: "🔥 N streak" appears
11. "End Session" opens the summary modal with total score, accuracy %, and per-type breakdown
12. "Start Over" resets score; "Close" dismisses the modal
13. Switching to "Interval Recognition" tab and clicking Replay plays two notes 400ms apart
14. Clicking "Intermediate" preset checks 5 chord types; "Advanced" checks all 9
15. Manually unchecking chord types works; the last 2 cannot be unchecked (checkbox is disabled)

- [ ] **Step 5: Commit**

```bash
git add src/pages/EarTraining.tsx src/App.tsx
git commit -m "feat: add ear training page with chord and interval recognition modes"
```
