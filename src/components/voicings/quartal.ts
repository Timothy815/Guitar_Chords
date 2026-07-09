import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export interface QuartalStack {
  key: string;
  label: string;
  shortLabel: string;
  intervals: number[];
}

export const QUARTAL_STACKS: QuartalStack[] = [
  { key: '3pure',    label: 'P4 – P4 (3 notes)',          shortLabel: 'P4·P4',       intervals: [0, 5, 10]     },
  { key: '4pure',    label: 'P4 – P4 – P4 (4 notes)',     shortLabel: 'P4·P4·P4',    intervals: [0, 5, 10, 15] },
  { key: '3sowhat',  label: 'P4 – M3 "So What" (3 notes)',shortLabel: 'P4·M3',       intervals: [0, 5, 9]      },
  { key: '4sowhat',  label: 'P4 – P4 – M3 "So What" (4 notes)', shortLabel: 'P4·P4·M3', intervals: [0, 5, 10, 14] },
];

const THREE_STRING_SETS: Array<{ strings: number[]; setKey: string; setLabel: string }> = [
  { strings: [0, 1, 2], setKey: '6-4', setLabel: 'Str 6–4' },
  { strings: [1, 2, 3], setKey: '5-3', setLabel: 'Str 5–3' },
  { strings: [2, 3, 4], setKey: '4-2', setLabel: 'Str 4–2' },
  { strings: [3, 4, 5], setKey: '3-1', setLabel: 'Str 3–1' },
];

const FOUR_STRING_SETS: Array<{ strings: number[]; setKey: string; setLabel: string }> = [
  { strings: [0, 1, 2, 3], setKey: '6-3', setLabel: 'Str 6–3' },
  { strings: [1, 2, 3, 4], setKey: '5-2', setLabel: 'Str 5–2' },
  { strings: [2, 3, 4, 5], setKey: '4-1', setLabel: 'Str 4–1' },
];

export interface QuartalVoicing {
  strings: number[];
  frets: number[];
  fretValues: number[];
  notes: string[];
  setKey: string;
  setLabel: string;
}

export function computeQuartalVoicings(bottomNote: string, stack: QuartalStack): QuartalVoicing[] {
  const results: QuartalVoicing[] = [];
  const stringSets = stack.intervals.length === 3 ? THREE_STRING_SETS : FOUR_STRING_SETS;

  for (const { strings, setKey, setLabel } of stringSets) {
    for (let bottomFret = 0; bottomFret <= 12; bottomFret++) {
      const bottomMidi = OPEN_MIDI[strings[0]] + bottomFret;
      if (noteNameFromMidi(bottomMidi) !== bottomNote) continue;

      const noteMidis = stack.intervals.map(st => bottomMidi + st);
      const fretValues = strings.map((si, i) => noteMidis[i] - OPEN_MIDI[si]);

      if (fretValues.some(f => f < 0 || f > 12)) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      strings.forEach((si, i) => { frets[si] = fretValues[i]; });

      const notes = strings.map((si, i) => getFretNote(si, fretValues[i]));

      results.push({ strings, frets, fretValues, notes, setKey, setLabel });
    }
  }

  return results;
}
