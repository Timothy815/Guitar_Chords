import { Note } from '../types';
import { ALL_NOTES, generateScalePattern } from './guitarData';

export type StringGroup = 'all' | 'EAD' | 'ADG' | 'DGB' | 'GBE';

export interface ChordToneDot {
  stringIdx: number;
  fret: number;
  label: string;
  color: string;
}

export const CHORD_TONE_QUALITIES: Record<string, { label: string; intervals: number[] }> = {
  major:    { label: 'Major',    intervals: [0, 4, 7] },
  minor:    { label: 'Minor',    intervals: [0, 3, 7] },
  dim:      { label: 'Dim',      intervals: [0, 3, 6] },
  aug:      { label: 'Aug',      intervals: [0, 4, 8] },
  dom7:     { label: 'Dom 7',    intervals: [0, 4, 7, 10] },
  maj7:     { label: 'Maj 7',    intervals: [0, 4, 7, 11] },
  min7:     { label: 'Min 7',    intervals: [0, 3, 7, 10] },
  minmaj7:  { label: 'Min Maj7', intervals: [0, 3, 7, 11] },
  m7b5:     { label: 'm7b5',     intervals: [0, 3, 6, 10] },
  dim7:     { label: 'Dim 7',    intervals: [0, 3, 6, 9] },
  aug7:     { label: 'Aug 7',    intervals: [0, 4, 8, 10] },
  augmaj7:  { label: 'Aug Maj7', intervals: [0, 4, 8, 11] },
  sus2:     { label: 'Sus 2',    intervals: [0, 2, 7] },
  sus4:     { label: 'Sus 4',    intervals: [0, 5, 7] },
  sus4dom7: { label: '7sus4',    intervals: [0, 5, 7, 10] },
};

const INTERVAL_LABELS: Record<number, string> = {
  0: 'R', 2: '2', 3: 'b3', 4: '3', 5: '4',
  6: 'b5', 7: '5', 8: '#5', 9: 'bb7', 10: 'b7', 11: 'maj7',
};

function intervalColor(interval: number): string {
  if (interval === 0) return '#e74c3c';
  if (interval === 3 || interval === 4) return '#2980b9';
  if (interval >= 6 && interval <= 8) return '#27ae60';
  if (interval >= 9 && interval <= 11) return '#8e44ad';
  return '#e67e22';
}

const OPEN_PITCHES = [40, 45, 50, 55, 59, 64];

const STRING_GROUP_STRINGS: Record<StringGroup, number[]> = {
  all: [0, 1, 2, 3, 4, 5],
  EAD: [0, 1, 2],
  ADG: [1, 2, 3],
  DGB: [2, 3, 4],
  GBE: [3, 4, 5],
};

export function generateChordToneDots(
  root: Note,
  qualityKey: string,
  stringGroup: StringGroup,
): ChordToneDot[] {
  const quality = CHORD_TONE_QUALITIES[qualityKey];
  if (!quality) return [];
  const rootMidi = ALL_NOTES.indexOf(root);
  const allowed = new Set(STRING_GROUP_STRINGS[stringGroup] ?? STRING_GROUP_STRINGS.all);
  const dots: ChordToneDot[] = [];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    if (!allowed.has(sIdx)) continue;
    for (let fret = 0; fret <= 15; fret++) {
      const interval = (OPEN_PITCHES[sIdx] + fret - rootMidi + 120) % 12;
      if (quality.intervals.includes(interval)) {
        dots.push({
          stringIdx: sIdx,
          fret,
          label: INTERVAL_LABELS[interval] ?? String(interval),
          color: intervalColor(interval),
        });
      }
    }
  }
  return dots;
}

export function generateScalePositions(
  root: Note,
  scaleDef: { name: string; intervals: number[] },
): Set<string> {
  const pattern = generateScalePattern(root, scaleDef);
  const scaleIndices = new Set(pattern.notes.map(n => ALL_NOTES.indexOf(n as Note)));
  const positions = new Set<string>();
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    for (let fret = 0; fret <= 15; fret++) {
      if (scaleIndices.has((OPEN_PITCHES[sIdx] + fret) % 12)) {
        positions.add(`${sIdx}-${fret}`);
      }
    }
  }
  return positions;
}
