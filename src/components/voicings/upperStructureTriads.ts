import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export const INTERVAL_NAMES: Record<number, string> = {
  0: 'R', 1: 'b9', 2: '9', 3: '#9', 4: '3',
  5: '11', 6: '#11', 7: '5', 8: 'b13', 9: '13', 10: 'b7', 11: 'maj7',
};

export interface USTQuality {
  key: 'major' | 'minor';
  label: string;
  thirdSt: number;
  fifthSt: number;
  thirdRole: string;
}

export const UST_QUALITIES: USTQuality[] = [
  { key: 'major', label: 'Major', thirdSt: 4, fifthSt: 7, thirdRole: 'M3' },
  { key: 'minor', label: 'Minor', thirdSt: 3, fifthSt: 7, thirdRole: 'm3' },
];

export const UST_INVERSIONS = [
  { key: 'root', shortLabel: 'Root pos' },
  { key: 'inv1', shortLabel: '1st inv'  },
  { key: 'inv2', shortLabel: '2nd inv'  },
];

export const UST_BASS_STRINGS = [
  { stringIdx: 0, label: 'Str 6', setKey: 'bass6', openNote: 'E' },
  { stringIdx: 1, label: 'Str 5', setKey: 'bass5', openNote: 'A' },
];

export const UST_UPPER_SETS = [
  { strings: [2, 3, 4] as const, setKey: '432', setLabel: 'Str 4–3–2', openNames: 'D · G · B' },
  { strings: [3, 4, 5] as const, setKey: '321', setLabel: 'Str 3–2–1', openNames: 'G · B · E' },
];

export const CHORD_CONTEXTS = [
  { key: 'dom7',  label: 'Dominant 7', symbol: '7'    },
  { key: 'maj7',  label: 'Major 7',    symbol: 'maj7' },
  { key: 'min7',  label: 'Minor 7',    symbol: 'm7'   },
  { key: 'any',   label: 'Any',        symbol: ''     },
];

// Textbook implied chord suffixes for common UST combinations
// keyed by [chordContext][ustRootInterval][ustQuality]
const IMPLIED_SUFFIXES: Record<string, Record<number, Record<string, string>>> = {
  dom7: {
    1:  { major: '7b9b13',  minor: '7b9'    },
    2:  { major: '9#11',    minor: '13'     },
    3:  { major: '7#9',     minor: '7#9'    },
    5:  { major: '11sus',   minor: '11b13'  },
    6:  { major: '7b9#11',  minor: '7#9#11' },
    8:  { major: '7alt',    minor: '7b13'   },
    9:  { major: '7b9',     minor: '13'     },
    10: { major: '11',      minor: '7b13'   },
    11: { major: 'maj9#11', minor: 'maj13'  },
  },
  maj7: {
    2:  { major: 'maj9#11', minor: 'maj13'  },
    4:  { major: 'maj7#5',  minor: 'maj9'   },
    7:  { major: 'maj9',    minor: 'maj13'  },
    9:  { major: 'maj13',   minor: 'maj13'  },
    11: { major: 'maj#11',  minor: 'maj9'   },
  },
  min7: {
    3:  { major: 'min9',    minor: 'min7'   },
    5:  { major: 'min11',   minor: 'min9'   },
    7:  { major: 'min(maj9)', minor: 'min9' },
    9:  { major: 'min13',   minor: 'min11'  },
    10: { major: 'min11',   minor: 'min9'   },
  },
};

export function getImpliedSymbol(
  bassRoot: string,
  chordContextKey: string,
  ustRootInterval: number,
  ustQualityKey: string,
): string {
  if (chordContextKey === 'any') return '';
  const suffix = IMPLIED_SUFFIXES[chordContextKey]?.[ustRootInterval]?.[ustQualityKey];
  return suffix ? `${bassRoot}${suffix}` : '';
}

export interface USTVoicing {
  bassStringIdx: number;
  bassFret: number;
  bassNote: string;
  bassSetKey: string;
  upperStrings: [number, number, number];
  upperFrets: [number, number, number];
  upperNotes: [string, string, string];
  upperRoles: [string, string, string];
  extensions: [string, string, string];
  allFrets: number[];
  ustRootNote: string;
  ustRootInterval: number;
  ustRootIntervalName: string;
  ustQualityKey: 'major' | 'minor';
  ustQualityLabel: string;
  inversionKey: string;
  inversionShortLabel: string;
  upperSetKey: string;
  upperSetLabel: string;
  openNames: string;
}

export function computeUSTs(
  bassRoot: string,
  bassStringIdx: number,
  upperSet: typeof UST_UPPER_SETS[number],
  quality: USTQuality,
): USTVoicing[] {
  const bassRootClass = NOTE_NAMES.indexOf(bassRoot);
  const results: USTVoicing[] = [];
  const [s0, s1, s2] = upperSet.strings;
  const { thirdSt, fifthSt, thirdRole } = quality;

  const invIntervals = [
    [0, thirdSt, fifthSt],
    [thirdSt, fifthSt, 12],
    [fifthSt, 12, 12 + thirdSt],
  ];
  const invRoles: [string, string, string][] = [
    ['R', thirdRole, 'P5'],
    [thirdRole, 'P5', 'R'],
    ['P5', 'R', thirdRole],
  ];

  for (let triadRootMidi = 40; triadRootMidi <= 92; triadRootMidi++) {
    for (let invIdx = 0; invIdx < 3; invIdx++) {
      const [i0, i1, i2] = invIntervals[invIdx];

      const f0 = triadRootMidi + i0 - OPEN_MIDI[s0];
      const f1 = triadRootMidi + i1 - OPEN_MIDI[s1];
      const f2 = triadRootMidi + i2 - OPEN_MIDI[s2];

      if (f0 < 0 || f0 > 14) continue;
      if (f1 < 0 || f1 > 14) continue;
      if (f2 < 0 || f2 > 14) continue;
      if (Math.max(f0, f1, f2) - Math.min(f0, f1, f2) > 5) continue;

      const m0 = OPEN_MIDI[s0] + f0;
      const m1 = OPEN_MIDI[s1] + f1;
      const m2 = OPEN_MIDI[s2] + f2;
      const minUpperMidi = Math.min(m0, m1, m2);

      for (let bassFret = 0; bassFret <= 12; bassFret++) {
        const bassMidi = OPEN_MIDI[bassStringIdx] + bassFret;
        if (((bassMidi % 12) + 12) % 12 !== bassRootClass) continue;
        if (bassMidi >= minUpperMidi) continue;

        // Fretted-note span check (open strings excluded from span)
        const fretted = [bassFret, f0, f1, f2].filter(f => f > 0);
        if (fretted.length > 1 && Math.max(...fretted) - Math.min(...fretted) > 6) continue;

        const ext0 = ((m0 - bassMidi) % 12 + 12) % 12;
        const ext1 = ((m1 - bassMidi) % 12 + 12) % 12;
        const ext2 = ((m2 - bassMidi) % 12 + 12) % 12;

        const allFrets = [-1, -1, -1, -1, -1, -1];
        allFrets[bassStringIdx] = bassFret;
        allFrets[s0] = f0;
        allFrets[s1] = f1;
        allFrets[s2] = f2;

        const ustRootInterval = ((triadRootMidi - bassMidi) % 12 + 12) % 12;

        results.push({
          bassStringIdx,
          bassFret,
          bassNote: getFretNote(bassStringIdx, bassFret),
          bassSetKey: `bass${6 - bassStringIdx}`,
          upperStrings: [s0, s1, s2],
          upperFrets: [f0, f1, f2],
          upperNotes: [getFretNote(s0, f0), getFretNote(s1, f1), getFretNote(s2, f2)],
          upperRoles: invRoles[invIdx],
          extensions: [
            INTERVAL_NAMES[ext0] ?? `${ext0}st`,
            INTERVAL_NAMES[ext1] ?? `${ext1}st`,
            INTERVAL_NAMES[ext2] ?? `${ext2}st`,
          ],
          allFrets,
          ustRootNote: midiToNoteName(triadRootMidi),
          ustRootInterval,
          ustRootIntervalName: INTERVAL_NAMES[ustRootInterval] ?? `${ustRootInterval}st`,
          ustQualityKey: quality.key,
          ustQualityLabel: quality.label,
          inversionKey: UST_INVERSIONS[invIdx].key,
          inversionShortLabel: UST_INVERSIONS[invIdx].shortLabel,
          upperSetKey: upperSet.setKey,
          upperSetLabel: upperSet.setLabel,
          openNames: upperSet.openNames,
        });
      }
    }
  }

  const seen = new Set<string>();
  return results.filter(v => {
    const key = v.allFrets.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
