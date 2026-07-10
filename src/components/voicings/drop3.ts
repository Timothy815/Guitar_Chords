import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export interface Drop3Quality {
  key: string;
  label: string;
  thirdSt: number;
  fifthSt: number;
  seventhSt: number;
}

export const DROP3_QUALITIES: Drop3Quality[] = [
  { key: 'maj7',  label: 'maj7',  thirdSt: 4, fifthSt: 7, seventhSt: 11 },
  { key: 'm7',    label: 'm7',    thirdSt: 3, fifthSt: 7, seventhSt: 10 },
  { key: 'dom7',  label: '7',     thirdSt: 4, fifthSt: 7, seventhSt: 10 },
  { key: 'm7b5',  label: 'm7♭5', thirdSt: 3, fifthSt: 6, seventhSt: 10 },
  { key: 'dim7',  label: 'dim7',  thirdSt: 3, fifthSt: 6, seventhSt:  9 },
];

export interface Drop3Voicing {
  frets: number[];
  strings: readonly [number, number, number, number];
  setKey: string;
  setLabel: string;
  openNames: string;
  inversionKey: string;
  inversionLabel: string;
  bassRole: string;
  notes: { role: string; name: string }[];
}

// Drop 3 skips one string, producing a wider spread than Drop 2:
//   {0, 2, 3, 4} = strings 6, 4, 3, 2  (skip string 5/A)
//   {1, 3, 4, 5} = strings 5, 3, 2, 1  (skip string 4/D)
const STRING_SETS = [
  { strings: [0, 2, 3, 4] as const, setKey: '6-4', setLabel: 'Strings 6–4–3–2', openNames: 'E · D · G · B' },
  { strings: [1, 3, 4, 5] as const, setKey: '5-3', setLabel: 'Strings 5–3–2–1', openNames: 'A · G · B · E' },
];

interface InversionDef {
  key: string;
  label: string;
  bassRole: string;
  // Returns offsets from rootMidi for [s_low, s2, s3, s4]
  offsets: (q: Drop3Quality) => [number, number, number, number];
}

// Drop 3: take close-position R-3-5-7 and drop the 3rd-highest note an octave.
// For each inversion the voice assignment (low→high) is:
//   inv0: [3rd-12, R,    5th,    7th   ]  → 3rd in bass
//   inv1: [5th-12, 3rd,  7th,    R+12  ]  → 5th in bass
//   inv2: [7th-12, 5th,  R+12,   3rd+12]  → 7th in bass
//   inv3: [R,      7th,  3rd+12, 5th+12]  → Root in bass
const INVERSIONS: InversionDef[] = [
  { key: 'inv0', label: '3rd in bass',  bassRole: '3', offsets: q => [q.thirdSt - 12, 0,            q.fifthSt,      q.seventhSt       ] },
  { key: 'inv1', label: '5th in bass',  bassRole: '5', offsets: q => [q.fifthSt - 12, q.thirdSt,    q.seventhSt,    12                ] },
  { key: 'inv2', label: '7th in bass',  bassRole: '7', offsets: q => [q.seventhSt - 12, q.fifthSt,  12,             q.thirdSt + 12    ] },
  { key: 'inv3', label: 'Root in bass', bassRole: 'R', offsets: q => [0,              q.seventhSt,  q.thirdSt + 12, q.fifthSt + 12    ] },
];

export function computeDrop3Voicings(root: string, quality: Drop3Quality): Drop3Voicing[] {
  const results: Drop3Voicing[] = [];
  const roleIntervals = [0, quality.thirdSt, quality.fifthSt, quality.seventhSt];
  const roleNames = ['R', '3', '5', '7'];

  for (const { strings, setKey, setLabel, openNames } of STRING_SETS) {
    for (const inv of INVERSIONS) {
      for (let rootMidi = 36; rootMidi <= 80; rootMidi++) {
        if (noteNameFromMidi(rootMidi) !== root) continue;

        const offsets = inv.offsets(quality);
        const noteMidis = offsets.map(o => rootMidi + o);
        const fretValues = strings.map((si, i) => noteMidis[i] - OPEN_MIDI[si]);

        if (fretValues.some(f => f < 0 || f > 15)) continue;

        const frets: number[] = [-1, -1, -1, -1, -1, -1];
        strings.forEach((si, i) => { frets[si] = fretValues[i]; });

        const notes = strings.map((si, i) => {
          const interval = ((noteMidis[i] - rootMidi) % 12 + 12) % 12;
          const roleIdx = roleIntervals.indexOf(interval);
          return {
            role: roleIdx >= 0 ? roleNames[roleIdx] : '?',
            name: getFretNote(si, fretValues[i]),
          };
        });

        results.push({ frets, strings, setKey, setLabel, openNames, inversionKey: inv.key, inversionLabel: inv.label, bassRole: inv.bassRole, notes });
      }
    }
  }

  return results;
}
