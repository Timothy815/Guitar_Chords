import { ChordShape, Finger, Note, ScalePattern } from '../types';

export const ALL_NOTES: Note[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNoteFromFret(stringNote: Note, fret: number): Note {
  if (fret === -1) return stringNote; // Open string logic? No, -1 is muted.
  const stringNoteIndex = ALL_NOTES.indexOf(stringNote);
  return ALL_NOTES[(stringNoteIndex + fret) % 12];
}

function getDistance(from: Note, to: Note) {
  const fromIdx = ALL_NOTES.indexOf(from);
  const toIdx = ALL_NOTES.indexOf(to);
  if (toIdx >= fromIdx) return toIdx - fromIdx;
  return toIdx + 12 - fromIdx;
}

const shapes = [
  // Major
  { baseRoot: 'E', nameStr: 'Major (E Shape)', relFrets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], rootString: 0 },
  { baseRoot: 'A', nameStr: 'Major (A Shape)', relFrets: [-1, 0, 2, 2, 2, 0], fingers: [-1, 1, 2, 3, 4, 1], rootString: 1 },
  { baseRoot: 'C', nameStr: 'Major (C Shape)', relFrets: [-1, 3, 2, 0, 1, 0], fingers: [-1, 4, 3, 1, 2, 1], rootString: 1 },
  // Minor
  { baseRoot: 'E', nameStr: 'Minor (Em Shape)', relFrets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], rootString: 0 },
  { baseRoot: 'A', nameStr: 'Minor (Am Shape)', relFrets: [-1, 0, 2, 2, 1, 0], fingers: [-1, 1, 3, 4, 2, 1], rootString: 1 },
  // 7th
  { baseRoot: 'E', nameStr: '7 (E7 Shape)', relFrets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], rootString: 0 },
  { baseRoot: 'A', nameStr: '7 (A7 Shape)', relFrets: [-1, 0, 2, 0, 2, 0], fingers: [-1, 1, 3, 1, 4, 1], rootString: 1 },
  // Maj7
  { baseRoot: 'E', nameStr: 'Maj7 (E Shape)', relFrets: [0, 2, 1, 1, 0, 0], fingers: [1, 4, 2, 3, 1, 1], rootString: 0 },
  { baseRoot: 'A', nameStr: 'Maj7 (A Shape)', relFrets: [-1, 0, 2, 1, 2, 0], fingers: [-1, 1, 3, 2, 4, 1], rootString: 1 },
  // Min7
  { baseRoot: 'E', nameStr: 'm7 (Em7 Shape)', relFrets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], rootString: 0 },
  { baseRoot: 'A', nameStr: 'm7 (Am7 Shape)', relFrets: [-1, 0, 2, 0, 1, 0], fingers: [-1, 1, 3, 1, 2, 1], rootString: 1 },
  // Sus2
  { baseRoot: 'A', nameStr: 'sus2 (A Shape)', relFrets: [-1, 0, 2, 2, 0, 0], fingers: [-1, 1, 3, 4, 1, 1], rootString: 1 },
  // Sus4
  { baseRoot: 'A', nameStr: 'sus4 (A Shape)', relFrets: [-1, 0, 2, 2, 3, 0], fingers: [-1, 1, 2, 3, 4, 1], rootString: 1 },
  { baseRoot: 'E', nameStr: 'sus4 (E Shape)', relFrets: [0, 2, 2, 2, 0, 0], fingers: [1, 3, 4, 4, 1, 1], rootString: 0 },
  // Diminished triad: root, b3, b5 — verified: A,C,Eb
  { baseRoot: 'A', nameStr: 'dim (A Shape)', relFrets: [-1, 0, 1, 2, 1, -1], fingers: [-1, 1, 2, 4, 3, -1], rootString: 1 },
  // Augmented triad: root, 3, #5 — verified: A,C#,F
  { baseRoot: 'A', nameStr: 'aug (A Shape)', relFrets: [-1, 0, 3, 2, 2, 1], fingers: [-1, 1, 4, 3, 2, 1], rootString: 1 },
  // Diminished 7th: root, b3, b5, bb7 — verified: A,C,Eb,Gb
  { baseRoot: 'A', nameStr: 'dim7 (A Shape)', relFrets: [-1, 0, 1, 2, 1, 2], fingers: [-1, 1, 2, 4, 3, 4], rootString: 1 },
  // Half-diminished (m7b5): root, b3, b5, b7 — verified: A,C,Eb,G
  { baseRoot: 'A', nameStr: 'm7b5 (A Shape)', relFrets: [-1, 0, 1, 0, 1, -1], fingers: [-1, 1, 2, 1, 3, -1], rootString: 1 },
];

const openChords: Record<string, ChordShape[]> = {
  'C': [{name: 'C Major (Open)', frets: [-1, 3, 2, 0, 1, 0], fingers: [-1, 3, 2, 0, 1, 0]}],
  'A': [{name: 'A Major (Open)', frets: [-1, 0, 2, 2, 2, 0], fingers: [-1, 0, 1, 2, 3, 0]}, {name: 'A Minor (Open)', frets: [-1, 0, 2, 2, 1, 0], fingers: [-1, 0, 2, 3, 1, 0]}],
  'G': [{name: 'G Major (Open)', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3]}],
  'E': [{name: 'E Major (Open)', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0]}, {name: 'E Minor (Open)', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0]}],
  'D': [{name: 'D Major (Open)', frets: [-1, -1, 0, 2, 3, 2], fingers: [-1, -1, 0, 1, 3, 2]}, {name: 'D Minor (Open)', frets: [-1, -1, 0, 2, 3, 1], fingers: [-1, -1, 0, 2, 3, 1]}]
};

export const COMMON_CHORDS: Record<string, ChordShape[]> = {};

for (const note of ALL_NOTES) {
  COMMON_CHORDS[note] = [];
  
  if (openChords[note]) {
     COMMON_CHORDS[note].push(...openChords[note]);
  }
  
  for (const shape of shapes) {
    const shift = getDistance(shape.baseRoot as Note, note as Note);
    if (shift === 0 && openChords[note] && openChords[note].some(c => c.name.includes(shape.nameStr.split('(')[0].trim()))) continue; 

    const finalFrets = shape.relFrets.map(f => f === -1 ? -1 : f === 0 && shift === 0 ? 0 : f + shift);
    
    if (Math.max(...finalFrets) > 14) continue;
    
    const baseFret = shift === 0 ? 0 : shift;
    
    COMMON_CHORDS[note].push({
      name: `${note} ${shape.nameStr}`,
      frets: finalFrets,
      fingers: shape.fingers as Finger[],
      baseFret: baseFret,
      barre: baseFret > 0 ? [{ stringStart: shape.rootString, stringEnd: 5, fret: baseFret, finger: 1 }] : undefined
    });
  }
}

export type ScaleCategory = 'Pentatonic' | 'Blues' | 'Modes' | 'Minor' | 'Symmetric';

export const COMMON_SCALES: { name: string; intervals: number[]; category: ScaleCategory }[] = [
  // ── Pentatonic ──────────────────────────────────────────────────────────────
  { name: 'Minor Pentatonic',        intervals: [0, 3, 5, 7, 10],          category: 'Pentatonic' },
  { name: 'Major Pentatonic',        intervals: [0, 2, 4, 7, 9],           category: 'Pentatonic' },
  // ── Blues ───────────────────────────────────────────────────────────────────
  { name: 'Minor Blues',             intervals: [0, 3, 5, 6, 7, 10],       category: 'Blues' },
  { name: 'Major Blues',             intervals: [0, 2, 3, 4, 7, 9],        category: 'Blues' },
  // ── Diatonic modes ──────────────────────────────────────────────────────────
  { name: 'Major (Ionian)',          intervals: [0, 2, 4, 5, 7, 9, 11],    category: 'Modes' },
  { name: 'Dorian',                  intervals: [0, 2, 3, 5, 7, 9, 10],    category: 'Modes' },
  { name: 'Phrygian',                intervals: [0, 1, 3, 5, 7, 8, 10],    category: 'Modes' },
  { name: 'Lydian',                  intervals: [0, 2, 4, 6, 7, 9, 11],    category: 'Modes' },
  { name: 'Mixolydian',              intervals: [0, 2, 4, 5, 7, 9, 10],    category: 'Modes' },
  { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10],    category: 'Modes' },
  { name: 'Locrian',                 intervals: [0, 1, 3, 5, 6, 8, 10],    category: 'Modes' },
  // ── Minor variants ──────────────────────────────────────────────────────────
  { name: 'Harmonic Minor',          intervals: [0, 2, 3, 5, 7, 8, 11],    category: 'Minor' },
  { name: 'Melodic Minor',           intervals: [0, 2, 3, 5, 7, 9, 11],    category: 'Minor' },
  { name: 'Phrygian Dominant',       intervals: [0, 1, 4, 5, 7, 8, 10],    category: 'Minor' },
  // ── Symmetric ───────────────────────────────────────────────────────────────
  { name: 'Whole Tone',              intervals: [0, 2, 4, 6, 8, 10],       category: 'Symmetric' },
  { name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10], category: 'Symmetric' },
  { name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11], category: 'Symmetric' },
];

export function generateScalePattern(rootNote: Note, scaleDef: {name: string, intervals: number[]}): ScalePattern {
  const rootIdx = ALL_NOTES.indexOf(rootNote);
  const notes = scaleDef.intervals.map(int => ALL_NOTES[(rootIdx + int) % 12]);
  return {
    name: `${rootNote} ${scaleDef.name}`,
    root: rootNote,
    notes,
    intervals: scaleDef.intervals
  };
}

// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4 (stringIdx 0 = low E)
export const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

export interface DiagonalCell {
  label: string;
  lowerString: number;
  upperString: number;
  positions: { stringIdx: number; fret: number; note: Note }[];
}

// Diagonal two-string-pair pentatonic pattern: 3 cells (E-A, D-G, B-E), each one
// full octave of a 5-note scale (3 notes on the lower string, 2 on the upper).
// Only valid for exactly-5-note scales; returns [] otherwise.
// The 3-notes-then-string-change shape only frets evenly when the starting
// note begins two consecutive whole-tone steps (true for Major Pentatonic's
// root, false for Minor Pentatonic's, whose root starts with a minor-third
// jump). Every pentatonic scale has exactly one scale tone where a
// whole-tone/whole-tone run begins — find it and anchor the pitch-walk there
// instead of at the user-facing root, so the fingering stays ergonomic for
// any 5-note scale without special-casing by name.
function findDiagonalAnchorOffset(intervals: number[]): number {
  const n = intervals.length;
  for (let i = 0; i < n; i++) {
    const gap1 = (intervals[(i + 1) % n] - intervals[i] + 12) % 12;
    const gap2 = (intervals[(i + 2) % n] - intervals[(i + 1) % n] + 12) % 12;
    if (gap1 === 2 && gap2 === 2) return intervals[i];
  }
  return 0;
}

export function generateDiagonalPentatonic(
  root: Note,
  scaleDef: { intervals: number[] },
): DiagonalCell[] {
  if (scaleDef.intervals.length !== 5) return [];

  const rootIdx = ALL_NOTES.indexOf(root);
  const lowEIdx = ALL_NOTES.indexOf('E');
  const rootFret = (rootIdx - lowEIdx + 12) % 12;

  const anchorOffset = findDiagonalAnchorOffset(scaleDef.intervals);
  const anchorIntervals = scaleDef.intervals
    .map(interval => (interval - anchorOffset + 12) % 12)
    .sort((a, b) => a - b);
  const startMidi = OPEN_STRING_MIDI[0] + rootFret + anchorOffset;

  const pitches: number[] = [];
  for (let octave = 0; octave < 3; octave++) {
    for (const interval of anchorIntervals) {
      pitches.push(startMidi + interval + 12 * octave);
    }
  }

  const pairLabels = ['E–A', 'D–G', 'B–E'];
  const cells: DiagonalCell[] = [];
  for (let n = 0; n < 3; n++) {
    const chunk = pitches.slice(n * 5, n * 5 + 5);
    const lowerString = n * 2;
    const upperString = n * 2 + 1;
    const positions = chunk.map((pitch, i) => {
      const stringIdx = i < 3 ? lowerString : upperString;
      const fret = pitch - OPEN_STRING_MIDI[stringIdx];
      const note = ALL_NOTES[pitch % 12];
      return { stringIdx, fret, note };
    });
    cells.push({ label: `Cell ${n + 1} (${pairLabels[n]})`, lowerString, upperString, positions });
  }
  return cells;
}
