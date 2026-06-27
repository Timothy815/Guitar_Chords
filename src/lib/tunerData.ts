export type TuningName =
  | 'Standard'
  | 'Drop D'
  | 'Open G'
  | 'Open D'
  | 'DADGAD'
  | 'Half Step Down'
  | 'Full Step Down';

export interface TuningDef {
  name: TuningName;
  labels: [string, string, string, string, string, string];
  hz: [number, number, number, number, number, number];
}

export interface StringState {
  targetNote: string;
  targetHz: number;
  centsOffset: number;
}

export interface TunerSettings {
  tuning: TuningName;
  detuneWindowCents: number;
  audioMode: 'simultaneous' | 'sequential';
}

// Hz values pre-calculated at A4 = 440 Hz to avoid enharmonic note-name issues
export const TUNING_DEFS: TuningDef[] = [
  {
    name: 'Standard',
    labels: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    hz: [82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
  },
  {
    name: 'Drop D',
    labels: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    hz: [73.42, 110.00, 146.83, 196.00, 246.94, 329.63],
  },
  {
    name: 'Open G',
    labels: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
    hz: [73.42, 98.00, 146.83, 196.00, 246.94, 293.66],
  },
  {
    name: 'Open D',
    labels: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
    hz: [73.42, 110.00, 146.83, 185.00, 220.00, 293.66],
  },
  {
    name: 'DADGAD',
    labels: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
    hz: [73.42, 110.00, 146.83, 196.00, 220.00, 293.66],
  },
  {
    name: 'Half Step Down',
    labels: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
    hz: [77.78, 103.83, 138.59, 185.00, 233.08, 311.13],
  },
  {
    name: 'Full Step Down',
    labels: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
    hz: [73.42, 98.00, 130.81, 174.61, 220.00, 293.66],
  },
];

export const DETUNE_WINDOWS = { Subtle: 15, Moderate: 30, Wild: 50 } as const;
export type DetuneName = keyof typeof DETUNE_WINDOWS;

export const CENT_STEPS = [0.5, 2, 5, 10, 20] as const;

export const DEFAULT_SETTINGS: TunerSettings = {
  tuning: 'Standard',
  detuneWindowCents: 30,
  audioMode: 'simultaneous',
};

export const IN_TUNE_THRESHOLD = 1.5;

export function isInTune(centsOffset: number): boolean {
  return Math.abs(centsOffset) <= IN_TUNE_THRESHOLD;
}

export function displayHz(targetHz: number, centsOffset: number): string {
  return (targetHz * Math.pow(2, centsOffset / 1200)).toFixed(1);
}

export function randomizeOffsets(tuning: TuningDef, windowCents: number): StringState[] {
  return tuning.hz.map((hz, i) => {
    let offset: number;
    do {
      offset = (Math.random() * 2 - 1) * windowCents;
    } while (Math.abs(offset) < 2);
    return { targetNote: tuning.labels[i], targetHz: hz, centsOffset: offset };
  });
}

export function getDetuneColors(centsOffset: number): { bar: string; text: string; row: string } {
  const abs = Math.abs(centsOffset);
  if (abs <= IN_TUNE_THRESHOLD) {
    return {
      bar: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400',
      row: 'border-green-400 bg-green-50 dark:bg-green-950/30',
    };
  }
  if (abs <= 6) {
    return {
      bar: 'bg-yellow-400',
      text: 'text-yellow-600 dark:text-yellow-400',
      row: 'border-brand-line',
    };
  }
  return {
    bar: 'bg-red-500',
    text: 'text-red-500 dark:text-red-400',
    row: 'border-brand-line',
  };
}
