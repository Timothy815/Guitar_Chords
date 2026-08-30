const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

// Octave-qualified label (e.g. "G3"), computed from raw MIDI math so this
// module never depends on the live audio tuning state -- OPEN_MIDI always
// represents standard tuning, so the label must too.
function noteLabelFromMidi(midi: number): string {
  const name = noteNameFromMidi(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
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

// Shell (R-3-7) on 3 adjacent strings; tension goes on one of the strings above it.
const SHELL_SETS: { shell: [number, number, number]; setKey: string }[] = [
  { shell: [0, 1, 2], setKey: '6-3' },
  { shell: [1, 2, 3], setKey: '5-2' },
  { shell: [2, 3, 4], setKey: '4-1' },
];

export function computeTensionVoicings(
  root: string,
  thirdSt: number,
  seventhSt: number,
  tensionSt: number,
  tensionLabel: string,
): TensionVoicing[] {
  const results: TensionVoicing[] = [];

  for (const { shell: [s0, s1, s2], setKey } of SHELL_SETS) {
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

      // Try the string immediately above the shell first, then each string
      // further up the neck. OPEN_MIDI is monotonically increasing, so for
      // a fixed target pitch, higher-index strings always yield a lower
      // (or equal) fret -- trying only the first candidate (the old
      // behavior) silently dropped the whole voicing whenever that one
      // string couldn't hold the pitch within fret 0-15, even when a
      // higher string could hold it comfortably.
      let s3 = -1;
      let tensionFret = -1;
      for (let candidate = s2 + 1; candidate <= 5; candidate++) {
        const fret = tensionMidi - OPEN_MIDI[candidate];
        if (fret >= 0 && fret <= 15) {
          s3 = candidate;
          tensionFret = fret;
          break;
        }
      }
      if (s3 === -1) continue;

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
          { role: 'R',          name: noteLabelFromMidi(rootMidi)    },
          { role: '3',          name: noteLabelFromMidi(thirdMidi)   },
          { role: '7',          name: noteLabelFromMidi(seventhMidi) },
          { role: tensionLabel, name: noteLabelFromMidi(tensionMidi) },
        ],
        rootFret,
      });
    }
  }

  return results;
}

// Picks a single representative voicing for contexts that need only one
// (e.g. the chord browser) -- the most compact voicing (smallest fret span
// among fretted notes), tie-broken by lowest neck position.
export function bestTensionVoicing(
  root: string,
  thirdSt: number,
  seventhSt: number,
  tensionSt: number,
  tensionLabel: string,
): TensionVoicing | null {
  const all = computeTensionVoicings(root, thirdSt, seventhSt, tensionSt, tensionLabel);
  if (all.length === 0) return null;

  const span = (v: TensionVoicing) => {
    const fretted = v.frets.filter(f => f > 0);
    return fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  };

  return all.reduce((best, v) => {
    const bestSpan = span(best);
    const vSpan = span(v);
    if (vSpan !== bestSpan) return vSpan < bestSpan ? v : best;
    return v.rootFret < best.rootFret ? v : best;
  });
}
