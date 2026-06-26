import type { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import type { DifficultyLevel } from './earTraining';

export interface MelodyRound {
  kind: 'melody';
  notes: string[];   // pitch classes, e.g. ['C', 'E', 'G']
  rootKey: string;   // root used to build the pool
  bpm: number;
}

export interface MelodySettings {
  rootKey: string;   // 'random' or specific root like 'C'
  bpm: number;
  showFirstNote: boolean;
}

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const CHROMATIC_INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function buildAllowedPitches(rootKey: string, difficulty: DifficultyLevel): string[] {
  const rootIdx = ALL_NOTES.indexOf(rootKey as Note);
  if (rootIdx === -1) return ALL_NOTES.slice();
  let intervals: number[];
  if (difficulty === 'Beginner') {
    intervals = MAJOR_INTERVALS;
  } else if (difficulty === 'Intermediate') {
    intervals = [...new Set([...MAJOR_INTERVALS, ...MINOR_INTERVALS])].sort((a, b) => a - b);
  } else {
    intervals = CHROMATIC_INTERVALS;
  }
  return intervals.map(i => ALL_NOTES[(rootIdx + i) % 12]);
}

export function generateMelodyRound(
  difficulty: DifficultyLevel,
  settings: MelodySettings,
): MelodyRound {
  const rootKey = settings.rootKey === 'random'
    ? ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)]
    : settings.rootKey;

  const pool = buildAllowedPitches(rootKey, difficulty);

  const [minLen, maxLen] =
    difficulty === 'Beginner' ? [3, 3] :
    difficulty === 'Intermediate' ? [4, 5] :
    [5, 7];

  const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;

  const notes: string[] = [];
  for (let i = 0; i < length; i++) {
    const last = notes[notes.length - 1];
    const candidates = pool.filter(p => p !== last);
    const source = candidates.length > 0 ? candidates : pool;
    notes.push(source[Math.floor(Math.random() * source.length)]);
  }

  return { kind: 'melody', notes, rootKey, bpm: settings.bpm };
}
