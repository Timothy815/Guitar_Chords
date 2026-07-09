import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export interface DyadInterval {
  key: string;
  label: string;
  semitones: number;
}

export const DYAD_INTERVALS: DyadInterval[] = [
  { key: 'm3', label: 'Minor 3rd',   semitones: 3  },
  { key: 'M3', label: 'Major 3rd',   semitones: 4  },
  { key: 'P4', label: 'Perfect 4th', semitones: 5  },
  { key: 'TT', label: 'Tritone',     semitones: 6  },
  { key: 'P5', label: 'Perfect 5th', semitones: 7  },
  { key: 'm6', label: 'Minor 6th',   semitones: 8  },
  { key: 'M6', label: 'Major 6th',   semitones: 9  },
  { key: 'm7', label: 'Minor 7th',   semitones: 10 },
  { key: 'M7', label: 'Major 7th',   semitones: 11 },
];

const STRING_PAIRS = [
  { strings: [0, 1] as [number, number], setKey: '6-5', setLabel: 'Str 6–5', openNames: 'E · A' },
  { strings: [1, 2] as [number, number], setKey: '5-4', setLabel: 'Str 5–4', openNames: 'A · D' },
  { strings: [2, 3] as [number, number], setKey: '4-3', setLabel: 'Str 4–3', openNames: 'D · G' },
  { strings: [3, 4] as [number, number], setKey: '3-2', setLabel: 'Str 3–2', openNames: 'G · B' },
  { strings: [4, 5] as [number, number], setKey: '2-1', setLabel: 'Str 2–1', openNames: 'B · E' },
];

export interface Dyad {
  strings: [number, number];
  bottomFret: number;
  topFret: number;
  bottomNote: string;
  topNote: string;
  setKey: string;
  setLabel: string;
  openNames: string;
  frets: number[];
}

export function computeDyads(root: string, intervalSt: number): Dyad[] {
  const results: Dyad[] = [];

  for (const { strings: [s0, s1], setKey, setLabel, openNames } of STRING_PAIRS) {
    for (let rootFret = 0; rootFret <= 12; rootFret++) {
      const bottomMidi = OPEN_MIDI[s0] + rootFret;
      if (noteNameFromMidi(bottomMidi) !== root) continue;

      const topMidi = bottomMidi + intervalSt;
      const topFret = topMidi - OPEN_MIDI[s1];
      if (topFret < 0 || topFret > 12) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      frets[s0] = rootFret;
      frets[s1] = topFret;

      results.push({
        strings: [s0, s1],
        bottomFret: rootFret,
        topFret,
        bottomNote: getFretNote(s0, rootFret),
        topNote: getFretNote(s1, topFret),
        setKey,
        setLabel,
        openNames,
        frets,
      });
    }
  }

  return results;
}
