import { ChordShape, Note } from '../types';
import { ALL_NOTES, COMMON_CHORDS, COMMON_SCALES, generateScalePattern, getNoteFromFret } from '../data/guitarData';
import { STANDARD_TUNING } from '../types';
import { getFretNote, initAudio, playStrum, playNote } from './audio';
import type { RhythmRound } from './rhythmTraining';
import type { MelodyRound, MelodySettings } from './melodyTraining';

export interface ChordTypeDef {
  id: string;
  label: string;
}

export interface IntervalDef {
  semitones: number;
  label: string;
}

export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count' | 'scaleDrill' | 'intervalFretboard';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
  melodySettings: MelodySettings;
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

export type StudyCard =
  | {
      kind: 'chord';
      displayLabel: string;
      chord: ChordShape;
    }
  | {
      kind: 'interval';
      label: string;
      rootNote: string;
      topNote: string;
    };

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

export interface FretboardRound {
  kind: 'fretboard';
  targetNote: string;
  fretsNum: number;
}

export interface ScaleDrillRound {
  kind: 'scaleDrill';
  scaleName: string;
  root: Note;
  targetStringIdx: number;   // 0 = low E
  targetFret: number;
  targetNote: Note;
  options: Note[];           // 4 choices including correct answer
  anchorStringIdx: number;
  anchorFret: number;
}

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

export interface ScaleIntervalRound {
  kind: 'scaleInterval';
  scaleName: string;
  root: Note;
  anchorStringIdx: number;
  anchorFret: number;
  anchorNote: Note;
  targetStringIdx: number;
  targetFret: number;
  targetNote: Note;
  intervalSemitones: number;   // 1–11, always ascending mod 12
  intervalLabel: string;       // e.g. "Perfect 5th"
  options: string[];           // 4 interval label strings, includes correct answer
  validPositions: { stringIdx: number; fret: number }[];
}

export type Round = ChordRound | IntervalRound | FretboardRound | RhythmRound | MelodyRound | IntervalFretboardRound | ScaleIntervalRound;

export interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
  totalStars?: number;
  huntAttempts?: number[];
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
    Beginner: ['Unison', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th', 'Octave'],
    Intermediate: [
      'Unison', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th', 'Octave',
      'Major 2nd', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th',
    ],
    Advanced: INTERVAL_DEFS.map(d => d.label),
  },
};

export const DEFAULT_SETTINGS: EarTrainingSettings = {
  mode: 'chord',
  activeChordTypes: ['major', 'minor'],
  activeIntervals: ['Unison', 'Perfect 4th', 'Perfect 5th', 'Octave'],
  settingsPanelOpen: true,
  melodySettings: { rootKey: 'random', bpm: 80, showFirstNote: true },
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

  // Every active interval becomes an option, not just a random subset — with
  // more intervals enabled, the round gets harder instead of staying at 4 choices.
  const options: IntervalAnswer[] = activeDefs.map(def => ({
    semitones: def.semitones,
    label: def.label,
    rootNote,
    topNote: addSemitones(rootNote, def.semitones),
  }));

  return { kind: 'interval', correct, options: shuffle(options) };
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

export function generateStudyDeck(activeChordTypes: string[], activeIntervals: string[]): StudyCard[] {
  // One randomly-picked shape per root+type combo across all 12 roots.
  const chordCards: StudyCard[] = [];
  const seen = new Set<string>();
  for (const entry of shuffle(buildChordPool(activeChordTypes))) {
    const key = `${entry.root}-${entry.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      chordCards.push({ kind: 'chord', displayLabel: `${entry.root} ${entry.typeLabel}`, chord: entry.chord });
    }
  }

  // One card per active interval, random root note each time.
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const intervalCards: StudyCard[] = activeDefs.map(def => {
    const rootNote = pickRandom(INTERVAL_ROOTS);
    return { kind: 'interval', label: def.label, rootNote, topNote: addSemitones(rootNote, def.semitones) };
  });

  return shuffle([...chordCards, ...intervalCards]);
}

export async function playStudyCard(card: StudyCard): Promise<void> {
  await initAudio();
  if (card.kind === 'chord') {
    playStrum(chordToNotes(card.chord), '2n');
  } else {
    playNote(card.rootNote, '2n');
    setTimeout(() => playNote(card.topNote, '2n'), 400);
  }
}

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

export function makeFretboardRound(targetNote: string, fretsNum: number): FretboardRound {
  return { kind: 'fretboard', targetNote, fretsNum };
}

export function generateFretboardRound(
  difficulty: DifficultyLevel,
  focus: FretboardFocus = {},
): FretboardRound {
  const fretsMap: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };
  const fretsNum = fretsMap[difficulty];
  const pool = buildFretboardNotePool(difficulty, focus);
  const targetNote = pickRandom(pool);
  return { kind: 'fretboard', targetNote, fretsNum };
}

export function getCorrectPositions(targetNote: string, fretsNum: number): Set<string> {
  const positions = new Set<string>();
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= fretsNum; f++) {
      if (getFretNote(s, f) === targetNote) positions.add(`${s}-${f}`);
    }
  }
  return positions;
}

export async function playFretboardRound(round: FretboardRound): Promise<void> {
  await initAudio();
  playNote(round.targetNote, '2n');
}

export interface HuntResult {
  stars: number;
  attempts: number;           // confirm presses before success
  selectionCount: number;     // total fret taps before confirm
  direction: 'sharp' | 'flat' | 'correct';
  firstSelectionSemitones: number;  // absolute semitones, first tap to target
}

export interface FretboardFocus {
  stringIdxs?: number[];  // [0..5]; empty or undefined = all strings
  fretMin?: number;       // inclusive; undefined = 0
  fretMax?: number;       // inclusive; undefined = fretsNum
  octaveMin?: number;     // inclusive; undefined = no restriction
  octaveMax?: number;     // inclusive; undefined = no restriction
}

function noteToMidi(noteStr: string): number {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return 0;
  const pitchClass = ALL_NOTES.indexOf(match[1] as Note);
  const octave = parseInt(match[2], 10);
  return octave * 12 + pitchClass;
}

export function getAbsoluteSemitoneDistance(a: string, b: string): number {
  return Math.abs(noteToMidi(a) - noteToMidi(b));
}

export function getAbsoluteDirection(
  played: string,
  target: string,
): 'sharp' | 'flat' | 'correct' {
  const diff = noteToMidi(played) - noteToMidi(target);
  if (diff === 0) return 'correct';
  return diff > 0 ? 'sharp' : 'flat';
}

export function getSemitoneDistance(played: string, target: string): number {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const diff = Math.abs(idx(played) - idx(target));
  return Math.min(diff, 12 - diff);
}

export function getSemitoneDirection(
  played: string,
  target: string,
): 'sharp' | 'flat' | 'correct' {
  const idx = (note: string) => ALL_NOTES.indexOf(note as Note);
  const raw = idx(played) - idx(target);
  const wrapped = ((raw % 12) + 12) % 12;
  if (wrapped === 0) return 'correct';
  return wrapped <= 6 ? 'sharp' : 'flat';
}

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

  // Find all target positions on the neck (frets 0–12)
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

export const SCALE_DRILL_POSITIONS: Record<string, [number, number]> = {
  full:  [0, 12],
  open:  [0, 4],
  mid:   [5, 9],
  upper: [9, 12],
};

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

export function generateScaleIntervalRound(opts: {
  scaleName: string;
  root: Note;
  fretRange: [number, number];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}): ScaleIntervalRound {
  const scaleDef = COMMON_SCALES.find(s => s.name === opts.scaleName) ?? COMMON_SCALES[0];
  const pattern = generateScalePattern(opts.root, scaleDef);
  const [minFret, maxFret] = opts.fretRange;

  // Build position pool: all scale-note fret positions within the fret window.
  let positions: { stringIdx: number; fret: number; note: Note }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
    for (let fret = minFret; fret <= maxFret; fret++) {
      const note = getNoteFromFret(openNote, fret);
      if (pattern.notes.includes(note)) {
        positions.push({ stringIdx, fret, note });
      }
    }
  });

  // Fall back to full neck if position pool is too small.
  if (positions.length < 2) {
    positions = [];
    STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
      for (let fret = 0; fret <= 12; fret++) {
        const note = getNoteFromFret(openNote, fret);
        if (pattern.notes.includes(note)) {
          positions.push({ stringIdx, fret, note });
        }
      }
    });
  }

  // Pick anchor and target, retrying until they are different pitch classes.
  let anchor: { stringIdx: number; fret: number; note: Note };
  let target: { stringIdx: number; fret: number; note: Note };
  let intervalSemitones = 0;
  let attempts = 0;

  do {
    if (opts.difficulty === 'Beginner') {
      const rootPositions = positions.filter(p => p.note === opts.root);
      anchor = rootPositions.length > 0
        ? rootPositions[Math.floor(Math.random() * rootPositions.length)]
        : positions[Math.floor(Math.random() * positions.length)];
    } else {
      anchor = positions[Math.floor(Math.random() * positions.length)];
    }

    const others = positions.filter(
      p => !(p.stringIdx === anchor.stringIdx && p.fret === anchor.fret)
    );
    target = others.length > 0
      ? others[Math.floor(Math.random() * others.length)]
      : positions[Math.floor(Math.random() * positions.length)];

    intervalSemitones =
      (ALL_NOTES.indexOf(target.note) - ALL_NOTES.indexOf(anchor.note) + 12) % 12;
    attempts++;
  } while (intervalSemitones === 0 && attempts < 20);

  // Hard fallback: force a different pitch class if still unison after retries.
  if (intervalSemitones === 0) {
    const diffNote = positions.find(p => p.note !== anchor.note);
    if (diffNote) {
      target = diffNote;
      intervalSemitones =
        (ALL_NOTES.indexOf(target.note) - ALL_NOTES.indexOf(anchor.note) + 12) % 12;
    }
  }

  const intervalLabel =
    INTERVAL_DEFS.find(d => d.semitones === intervalSemitones)?.label ?? INTERVAL_DEFS[1].label;

  // Build options pool: all unique intervals (1–11 semitones) present between scale notes.
  const scaleNotes = pattern.notes;
  const scaleIntervalSet = new Set<number>();
  for (const noteA of scaleNotes) {
    for (const noteB of scaleNotes) {
      if (noteA === noteB) continue;
      const semi = (ALL_NOTES.indexOf(noteB) - ALL_NOTES.indexOf(noteA) + 12) % 12;
      if (semi > 0) scaleIntervalSet.add(semi);
    }
  }
  let distractorLabels = shuffle(
    [...scaleIntervalSet]
      .filter(s => s !== intervalSemitones)
      .map(s => INTERVAL_DEFS.find(d => d.semitones === s)?.label)
      .filter((l): l is string => l !== undefined)
  ).slice(0, 3);
  // Pad from full chromatic set if scale doesn't yield enough distractors.
  if (distractorLabels.length < 3) {
    const fallbackLabels = INTERVAL_DEFS
      .filter(d => d.semitones > 0 && d.semitones !== intervalSemitones && !distractorLabels.includes(d.label))
      .map(d => d.label);
    distractorLabels = [...distractorLabels, ...fallbackLabels].slice(0, 3);
  }
  const options = shuffle([intervalLabel, ...distractorLabels]);

  // Valid positions: all positions of targetNote within the fret window.
  const validPositions: { stringIdx: number; fret: number }[] = [];
  STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
    for (let fret = minFret; fret <= maxFret; fret++) {
      if (getNoteFromFret(openNote, fret) === target.note) {
        validPositions.push({ stringIdx, fret });
      }
    }
  });

  return {
    kind: 'scaleInterval',
    scaleName: scaleDef.name,
    root: opts.root,
    anchorStringIdx: anchor.stringIdx,
    anchorFret: anchor.fret,
    anchorNote: anchor.note,
    targetStringIdx: target.stringIdx,
    targetFret: target.fret,
    targetNote: target.note,
    intervalSemitones,
    intervalLabel,
    options,
    validPositions,
  };
}
