import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export interface TensionDef {
  key: string;
  label: string;
  semitones: number;
}

export interface TensionQuality {
  key: string;
  label: string;
  thirdSt: number;
  seventhSt: number;
  tensions: TensionDef[];
}

export const TENSION_QUALITIES: TensionQuality[] = [
  {
    key: 'maj7', label: 'maj7', thirdSt: 4, seventhSt: 11,
    tensions: [
      { key: '9',   label: '9',   semitones: 2 },
      { key: '#11', label: '♯11', semitones: 6 },
      { key: '13',  label: '13',  semitones: 9 },
    ],
  },
  {
    key: 'm7', label: 'm7', thirdSt: 3, seventhSt: 10,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
  {
    key: 'dom7', label: '7', thirdSt: 4, seventhSt: 10,
    tensions: [
      { key: '9',   label: '9',   semitones: 2 },
      { key: 'b9',  label: '♭9',  semitones: 1 },
      { key: '#9',  label: '♯9',  semitones: 3 },
      { key: '#11', label: '♯11', semitones: 6 },
      { key: '13',  label: '13',  semitones: 9 },
      { key: 'b13', label: '♭13', semitones: 8 },
    ],
  },
  {
    key: 'm7b5', label: 'm7♭5', thirdSt: 3, seventhSt: 10,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
  {
    key: 'dim7', label: 'dim7', thirdSt: 3, seventhSt: 9,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
];

export interface TensionVoicing {
  frets: number[];
  strings: [number, number, number, number];
  setKey: string;
  notes: { role: string; name: string }[];
  rootFret: number;
}

// Shell (R-3-7) on 3 adjacent strings, tension added on the next higher string
const SHELL_WITH_TENSION = [
  { shell: [0, 1, 2] as [number, number, number], tension: 3, setKey: '6-3', setLabel: 'Str 6–3' },
  { shell: [1, 2, 3] as [number, number, number], tension: 4, setKey: '5-2', setLabel: 'Str 5–2' },
  { shell: [2, 3, 4] as [number, number, number], tension: 5, setKey: '4-1', setLabel: 'Str 4–1' },
];

export function computeTensionVoicings(
  root: string,
  thirdSt: number,
  seventhSt: number,
  tensionSt: number,
  tensionLabel: string,
): TensionVoicing[] {
  const results: TensionVoicing[] = [];

  for (const { shell: [s0, s1, s2], tension: s3, setKey } of SHELL_WITH_TENSION) {
    for (let rootFret = 0; rootFret <= 15; rootFret++) {
      const rootMidi = OPEN_MIDI[s0] + rootFret;
      if (noteNameFromMidi(rootMidi) !== root) continue;

      // Build shell: same logic as ShellVoicingsTab
      let thirdMidi = rootMidi + thirdSt;
      let thirdFret = thirdMidi - OPEN_MIDI[s1];
      if (thirdFret < 0) { thirdFret += 12; thirdMidi += 12; }

      let seventhMidi = rootMidi + seventhSt;
      while (seventhMidi <= thirdMidi) seventhMidi += 12;
      let seventhFret = seventhMidi - OPEN_MIDI[s2];
      while (seventhFret < 0) { seventhFret += 12; seventhMidi += 12; }

      if (seventhMidi - rootMidi > 12) continue;
      if (thirdFret > 15 || seventhFret > 15) continue;

      // Tension goes above the seventh
      let tensionMidi = rootMidi + tensionSt;
      while (tensionMidi <= seventhMidi) tensionMidi += 12;
      const tensionFret = tensionMidi - OPEN_MIDI[s3];
      if (tensionFret < 0 || tensionFret > 15) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      frets[s0] = rootFret;
      frets[s1] = thirdFret;
      frets[s2] = seventhFret;
      frets[s3] = tensionFret;

      results.push({
        frets,
        strings: [s0, s1, s2, s3],
        setKey,
        notes: [
          { role: 'R',          name: getFretNote(s0, rootFret)    },
          { role: '3',          name: getFretNote(s1, thirdFret)   },
          { role: '7',          name: getFretNote(s2, seventhFret) },
          { role: tensionLabel, name: getFretNote(s3, tensionFret) },
        ],
        rootFret,
      });
    }
  }

  return results;
}
