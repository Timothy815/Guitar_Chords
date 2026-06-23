export type Note = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type StringIndex = 0 | 1 | 2 | 3 | 4 | 5; // 0 is lowest string (E2), 5 is highest (E4)

// Fingering: 1, 2, 3, 4 (fingers). 0 is open, -1 is muted (X), T is thumb.
export type Finger = -1 | 0 | 1 | 2 | 3 | 4 | 'T';

export interface ChordShape {
  name: string;
  frets: number[]; // Length 6: e.g., [-1, 3, 2, 0, 1, 0] for C major (lowest to highest)
  fingers: Finger[]; // Elements correspond to frets
  baseFret?: number; // Defaults to 1 (meaning the lowest drawn fret). If barre chord at 5th, this might be 5.
  barre?: {
    stringStart: number; // 0-5
    stringEnd: number; // 0-5
    fret: number;
    finger: Finger;
  }[];
}

export interface ScalePattern {
  name: string;
  root: Note;
  notes: Note[];
  intervals: number[]; // Distance from root in semitones
}

export interface PracticeItem {
  id: string;
  type: 'chord' | 'scale' | 'custom_progression';
  name: string;
  status: 'new' | 'learning' | 'mastered';
  lastPracticed?: number;
  durationCompleted: number; // in seconds
}

export interface ArpeggioStep {
  strings: number[];  // active string indices: 0 = low E, 5 = high e
  duration: '16n' | '8n' | '4n' | '2n' | '1n';
}

export interface ArpeggioPattern {
  steps: ArpeggioStep[];
}

export interface ChordSlot {
  chord: ChordShape;
  pattern?: ArpeggioPattern;  // absent = strum (legacy behaviour)
}

export interface Progression {
  id: string;
  name: string;
  bpm: number;    // default 80, range 40–200
  key: string;   // root note, e.g. "C", "G", "F#" — defaults to "C"
  slots: ChordSlot[];  // replaces chords: ChordShape[]
}

export type Tuning = {
  name: string;
  notes: Note[];
  octaves: number[]; // e.g. [2, 2, 3, 3, 3, 4] for Standard E E2 A2 D3 G3 B3 E4
};

export const TUNINGS: Record<string, Tuning> = {
  'Standard': {
    name: 'Standard',
    notes: ['E', 'A', 'D', 'G', 'B', 'E'],
    octaves: [2, 2, 3, 3, 3, 4],
  },
  'Drop D': {
    name: 'Drop D',
    notes: ['D', 'A', 'D', 'G', 'B', 'E'],
    octaves: [2, 2, 3, 3, 3, 4],
  },
  'Open G': {
    name: 'Open G',
    notes: ['D', 'G', 'D', 'G', 'B', 'D'],
    octaves: [2, 2, 3, 3, 3, 4],
  },
  'Open D': {
    name: 'Open D',
    notes: ['D', 'A', 'D', 'F#', 'A', 'D'],
    octaves: [2, 2, 3, 3, 3, 4],
  },
  'Half Step Down': {
    name: 'Half Step Down',
    notes: ['D#', 'G#', 'C#', 'F#', 'A#', 'D#'],
    octaves: [2, 2, 3, 3, 3, 4],
  },
};

export const STANDARD_TUNING: Tuning = TUNINGS['Standard'];
