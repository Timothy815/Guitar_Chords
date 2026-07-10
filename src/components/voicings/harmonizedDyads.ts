import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

function noteToMidiClass(note: string): number {
  return NOTE_NAMES.indexOf(note);
}

export interface HScale {
  key: string;
  label: string;
  intervals: number[]; // 7 values, semitones from root
  degreeLabels: string[]; // e.g. ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
}

export const HARMONIZABLE_SCALES: HScale[] = [
  {
    key: 'major',
    label: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degreeLabels: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  },
  {
    key: 'natural_minor',
    label: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degreeLabels: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
  },
  {
    key: 'dorian',
    label: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degreeLabels: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
  },
  {
    key: 'mixolydian',
    label: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degreeLabels: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
  },
];

export interface HIntervalType {
  key: string;
  label: string;
  span: number; // how many scale degrees up (0-indexed)
}

export const H_INTERVAL_TYPES: HIntervalType[] = [
  { key: '3rds', label: '3rds',   span: 2 },
  { key: '6ths', label: '6ths',   span: 5 },
  { key: '4ths', label: '4ths',   span: 3 },
  { key: '5ths', label: '5ths',   span: 4 },
];

export interface HarmonizedDyad {
  degreeIdx: number;   // 0–6
  degreeLabel: string;
  bottomNote: string;
  topNote: string;
  bottomFret: number;
  topFret: number;
  intervalSt: number;
  strings: [number, number];
  setKey: string;
  frets: number[];
}

// Degree colors — stable across all keys/scales
export const DEGREE_COLORS = [
  '#ef4444', // I   — red
  '#f97316', // ii  — orange
  '#eab308', // iii — yellow
  '#22c55e', // IV  — green
  '#3b82f6', // V   — blue
  '#8b5cf6', // vi  — violet
  '#ec4899', // vii — pink
];

const STRING_PAIRS = [
  { strings: [0, 1] as [number, number], setKey: '6-5', setLabel: 'Str 6–5' },
  { strings: [1, 2] as [number, number], setKey: '5-4', setLabel: 'Str 5–4' },
  { strings: [2, 3] as [number, number], setKey: '4-3', setLabel: 'Str 4–3' },
  { strings: [3, 4] as [number, number], setKey: '3-2', setLabel: 'Str 3–2' },
  { strings: [4, 5] as [number, number], setKey: '2-1', setLabel: 'Str 2–1' },
  { strings: [0, 2] as [number, number], setKey: '6-4', setLabel: 'Str 6–4' },
  { strings: [1, 3] as [number, number], setKey: '5-3', setLabel: 'Str 5–3' },
  { strings: [2, 4] as [number, number], setKey: '4-2', setLabel: 'Str 4–2' },
  { strings: [3, 5] as [number, number], setKey: '3-1', setLabel: 'Str 3–1' },
];

export function computeHarmonizedDyads(
  keyRoot: string,
  scale: HScale,
  intervalType: HIntervalType,
  setKey: string
): HarmonizedDyad[] {
  const pair = STRING_PAIRS.find(p => p.setKey === setKey);
  if (!pair) return [];

  const [s0, s1] = pair.strings;
  const rootMidiClass = noteToMidiClass(keyRoot);
  const results: HarmonizedDyad[] = [];

  for (let degreeIdx = 0; degreeIdx < 7; degreeIdx++) {
    const bottomSt = scale.intervals[degreeIdx];
    const topDegreeIdx = (degreeIdx + intervalType.span) % 7;
    const topSt = scale.intervals[topDegreeIdx];
    const intervalSt = (topSt - bottomSt + 12) % 12;

    // Find all occurrences on this string pair across frets 0–12
    for (let rootFret = 0; rootFret <= 12; rootFret++) {
      const bottomMidi = OPEN_MIDI[s0] + rootFret;
      const bottomClass = ((bottomMidi % 12) + 12) % 12;
      const expectedClass = ((rootMidiClass + bottomSt) % 12 + 12) % 12;
      if (bottomClass !== expectedClass) continue;

      const topMidi = bottomMidi + intervalSt;
      const topFret = topMidi - OPEN_MIDI[s1];
      if (topFret < 0 || topFret > 12) continue;
      if (topFret - rootFret > 5) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      frets[s0] = rootFret;
      frets[s1] = topFret;

      results.push({
        degreeIdx,
        degreeLabel: scale.degreeLabels[degreeIdx],
        bottomNote: getFretNote(s0, rootFret),
        topNote: getFretNote(s1, topFret),
        bottomFret: rootFret,
        topFret,
        intervalSt,
        strings: [s0, s1],
        setKey,
        frets,
      });
    }
  }

  // Sort by bottom fret ascending
  results.sort((a, b) => a.bottomFret - b.bottomFret || a.degreeIdx - b.degreeIdx);
  return results;
}
