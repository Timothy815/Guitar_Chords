import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface TriadQuality {
  key: string;
  label: string;
  thirdSt: number;
  fifthSt: number;
  thirdRole: string;
  fifthRole: string;
}

export const TRIAD_QUALITIES: TriadQuality[] = [
  { key: 'major', label: 'Major',      thirdSt: 4, fifthSt: 7, thirdRole: 'M3', fifthRole: 'P5' },
  { key: 'minor', label: 'Minor',      thirdSt: 3, fifthSt: 7, thirdRole: 'm3', fifthRole: 'P5' },
  { key: 'aug',   label: 'Aug',        thirdSt: 4, fifthSt: 8, thirdRole: 'M3', fifthRole: 'A5' },
  { key: 'dim',   label: 'Dim',        thirdSt: 3, fifthSt: 6, thirdRole: 'm3', fifthRole: 'd5' },
];

export const TRIAD_INVERSIONS = [
  { key: 'root', label: 'Root position', shortLabel: 'Root pos', bassRole: 'R'   },
  { key: 'inv1', label: '1st inversion', shortLabel: '1st inv',  bassRole: '3rd' },
  { key: 'inv2', label: '2nd inversion', shortLabel: '2nd inv',  bassRole: '5th' },
];

export const TRIAD_STRING_SETS = [
  { strings: [0, 1, 2] as [number, number, number], setKey: '654', setLabel: 'Str 6–5–4', openNames: 'E · A · D' },
  { strings: [1, 2, 3] as [number, number, number], setKey: '543', setLabel: 'Str 5–4–3', openNames: 'A · D · G' },
  { strings: [2, 3, 4] as [number, number, number], setKey: '432', setLabel: 'Str 4–3–2', openNames: 'D · G · B' },
  { strings: [3, 4, 5] as [number, number, number], setKey: '321', setLabel: 'Str 3–2–1', openNames: 'G · B · E' },
];

export interface TriadVoicing {
  strings: [number, number, number];
  frets: [number, number, number];
  allFrets: number[];
  notes: [string, string, string];
  roles: [string, string, string];
  setKey: string;
  setLabel: string;
  openNames: string;
  inversionKey: string;
  inversionLabel: string;
  shortLabel: string;
}

export function computeTriads(root: string, quality: TriadQuality): TriadVoicing[] {
  const rootClass = NOTE_NAMES.indexOf(root);
  const results: TriadVoicing[] = [];

  // Intervals from root for each string slot, per inversion.
  // Root pos: [R, 3, 5]. 1st inv: [3, 5, R+oct]. 2nd inv: [5, R+oct, 3+oct].
  const inversionIntervals = [
    [0,              quality.thirdSt,  quality.fifthSt        ],
    [quality.thirdSt, quality.fifthSt, 12                     ],
    [quality.fifthSt, 12,              12 + quality.thirdSt   ],
  ];

  const inversionRoles = (q: TriadQuality): [string, string, string][] => [
    ['R', q.thirdRole, q.fifthRole],
    [q.thirdRole, q.fifthRole, 'R'],
    [q.fifthRole, 'R', q.thirdRole],
  ];
  const roles = inversionRoles(quality);

  for (const { strings, setKey, setLabel, openNames } of TRIAD_STRING_SETS) {
    const [s0, s1, s2] = strings;

    for (let invIdx = 0; invIdx < 3; invIdx++) {
      const intervals = inversionIntervals[invIdx];
      const inv = TRIAD_INVERSIONS[invIdx];
      const roleSet = roles[invIdx];

      for (let rootMidi = 36; rootMidi <= 84; rootMidi++) {
        if (((rootMidi % 12) + 12) % 12 !== rootClass) continue;

        const f0 = rootMidi + intervals[0] - OPEN_MIDI[s0];
        const f1 = rootMidi + intervals[1] - OPEN_MIDI[s1];
        const f2 = rootMidi + intervals[2] - OPEN_MIDI[s2];

        if (f0 < 0 || f0 > 12) continue;
        if (f1 < 0 || f1 > 12) continue;
        if (f2 < 0 || f2 > 12) continue;
        if (Math.max(f0, f1, f2) - Math.min(f0, f1, f2) > 5) continue;

        const allFrets = [-1, -1, -1, -1, -1, -1];
        allFrets[s0] = f0;
        allFrets[s1] = f1;
        allFrets[s2] = f2;

        results.push({
          strings,
          frets: [f0, f1, f2],
          allFrets,
          notes: [getFretNote(s0, f0), getFretNote(s1, f1), getFretNote(s2, f2)],
          roles: roleSet,
          setKey, setLabel, openNames,
          inversionKey: inv.key,
          inversionLabel: inv.label,
          shortLabel: inv.shortLabel,
        });
      }
    }
  }

  const SET_ORDER = ['654', '543', '432', '321'];
  const INV_ORDER = ['root', 'inv1', 'inv2'];
  results.sort((a, b) => {
    const s = SET_ORDER.indexOf(a.setKey) - SET_ORDER.indexOf(b.setKey);
    if (s !== 0) return s;
    const iv = INV_ORDER.indexOf(a.inversionKey) - INV_ORDER.indexOf(b.inversionKey);
    if (iv !== 0) return iv;
    return Math.min(...a.frets) - Math.min(...b.frets);
  });

  return results;
}
