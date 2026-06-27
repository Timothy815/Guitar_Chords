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

export const COMMON_SCALES = [
  // ── Pentatonic ──────────────────────────────────────────────────────────────
  { name: 'Minor Pentatonic',   intervals: [0, 3, 5, 7, 10] },
  { name: 'Major Pentatonic',   intervals: [0, 2, 4, 7, 9] },
  // ── Blues ───────────────────────────────────────────────────────────────────
  { name: 'Minor Blues',        intervals: [0, 3, 5, 6, 7, 10] },
  { name: 'Major Blues',        intervals: [0, 2, 3, 4, 7, 9] },
  // ── Diatonic modes ──────────────────────────────────────────────────────────
  { name: 'Major (Ionian)',     intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Dorian',             intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Phrygian',           intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Lydian',             intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'Mixolydian',         intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Locrian',            intervals: [0, 1, 3, 5, 6, 8, 10] },
  // ── Minor variants ──────────────────────────────────────────────────────────
  { name: 'Harmonic Minor',     intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'Melodic Minor',      intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: 'Phrygian Dominant',  intervals: [0, 1, 4, 5, 7, 8, 10] },
  // ── Symmetric ───────────────────────────────────────────────────────────────
  { name: 'Whole Tone',         intervals: [0, 2, 4, 6, 8, 10] },
  { name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  { name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
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
