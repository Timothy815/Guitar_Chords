import { ALL_NOTES } from '../data/guitarData';
import type { Note, ChordShape } from '../types';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

const MAJOR_DEGREE_QUALITIES: Record<number, string[]> = {
  0:  ['Major', 'Maj7'],
  2:  ['Minor', 'm7'],
  4:  ['Minor', 'm7'],
  5:  ['Major', 'Maj7'],
  7:  ['Major', '7'],
  9:  ['Minor', 'm7'],
  11: ['dim', 'dim7', 'm7b5'],
};

const MAJOR_ROMAN: Record<number, string> = {
  0: 'I', 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi', 11: 'vii°',
};

const MINOR_DEGREE_QUALITIES: Record<number, string[]> = {
  0:  ['Minor', 'm7'],
  2:  ['dim', 'm7b5', 'dim7'],
  3:  ['Major', 'Maj7'],
  5:  ['Minor', 'm7'],
  7:  ['Minor', 'm7', 'Major', '7'],
  8:  ['Major', 'Maj7'],
  10: ['Major', '7'],
};

const MINOR_ROMAN: Record<number, string> = {
  0: 'i', 2: 'ii°', 3: 'III', 5: 'iv', 7: 'v', 8: 'VI', 10: 'VII',
};

const MODES = [
  { mode: 'major' as const, scale: MAJOR_SCALE, qualities: MAJOR_DEGREE_QUALITIES, romans: MAJOR_ROMAN },
  { mode: 'minor' as const, scale: MINOR_SCALE, qualities: MINOR_DEGREE_QUALITIES, romans: MINOR_ROMAN },
];

export interface ChordRomanLabel {
  roman: string;
  isBorrowed: boolean;
}

export interface KeyMatch {
  key: Note;
  mode: 'major' | 'minor';
  label: string;
  score: number;
  diatonicCount: number;
  totalChords: number;
  chordLabels: ChordRomanLabel[];
}

function parseChord(chord: ChordShape): [string, string] {
  const parts = chord.name.split(' ');
  return [parts[0], parts[1] ?? 'Major'];
}

export function analyzeKey(chords: ChordShape[]): KeyMatch[] {
  if (chords.length < 2) return [];

  // Require at least 2 distinct roots before offering analysis
  const uniqueRoots = new Set(chords.map(c => c.name.split(' ')[0]));
  if (uniqueRoots.size < 2) return [];

  const results: KeyMatch[] = [];

  for (const keyNote of ALL_NOTES) {
    const keyRootIdx = ALL_NOTES.indexOf(keyNote);

    for (const { mode, scale, qualities, romans } of MODES) {
      let totalScore = 0;
      let diatonicCount = 0;
      const chordLabels: ChordRomanLabel[] = [];

      for (const chord of chords) {
        const [rootStr, quality] = parseChord(chord);
        const rootIdx = ALL_NOTES.indexOf(rootStr as Note);

        if (rootIdx === -1) {
          chordLabels.push({ roman: '?', isBorrowed: true });
          continue;
        }

        const interval = (rootIdx - keyRootIdx + 12) % 12;

        if (!scale.includes(interval)) {
          chordLabels.push({ roman: rootStr, isBorrowed: true });
          continue;
        }

        const expectedQualities = qualities[interval] ?? [];
        const qualityOk = expectedQualities.includes(quality);
        const roman = romans[interval] ?? '?';

        totalScore += qualityOk ? 1 : 0.35;
        if (qualityOk) diatonicCount++;
        chordLabels.push({ roman, isBorrowed: !qualityOk });
      }

      results.push({
        key: keyNote,
        mode,
        label: `${keyNote} ${mode === 'major' ? 'Major' : 'Minor'}`,
        score: totalScore / chords.length,
        diatonicCount,
        totalChords: chords.length,
        chordLabels,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || b.diatonicCount - a.diatonicCount);
  return results.slice(0, 4);
}
