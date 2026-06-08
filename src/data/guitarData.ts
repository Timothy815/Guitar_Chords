import { ChordShape, Note, ScalePattern } from '../types';

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
  { baseRoot: 'E', nameStr: 'sus4 (E Shape)', relFrets: [0, 2, 2, 2, 0, 0], fingers: [1, 3, 4, 4, 1, 1], rootString: 0 }
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
      fingers: shape.fingers,
      baseFret: baseFret,
      barre: baseFret > 0 ? [{ stringStart: shape.rootString, stringEnd: 5, fret: baseFret, finger: 1 }] : undefined
    });
  }
}

export const COMMON_SCALES = [
  {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10], // Root, m3, P4, P5, m7
  },
  {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9], // Root, M2, M3, P5, M6
  },
  {
    name: 'Major Scale (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11]
  },
  {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10]
  },
  {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10]
  }
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
