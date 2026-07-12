import { getIonianCagedPattern } from './ionianCagedPatterns';
import type { IonianCagedPattern } from './ionianCagedPatterns';

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;
const AEOLIAN_ROOT_FROM_PARENT = 9;
const AEOLIAN_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;
const TARGET_INTERVALS: Record<string, readonly number[]> = {
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
};

function mod12(value: number) { return (value % 12 + 12) % 12; }

function alterAeolianPattern(pattern: IonianCagedPattern, target: readonly number[]): IonianCagedPattern {
  return pattern.map((frets, stringIndex) => frets.map(fret => {
    const modalInterval = mod12(STRING_OFFSETS[stringIndex] + fret - AEOLIAN_ROOT_FROM_PARENT);
    const degreeIndex = AEOLIAN_INTERVALS.indexOf(modalInterval as typeof AEOLIAN_INTERVALS[number]);
    if (degreeIndex < 0) throw new Error(`Aeolian CAGED template contains interval ${modalInterval}`);
    return fret + target[degreeIndex] - AEOLIAN_INTERVALS[degreeIndex];
  }).sort((a, b) => a - b));
}

const PATTERNS: Record<string, readonly IonianCagedPattern[]> = Object.fromEntries(
  Object.entries(TARGET_INTERVALS).map(([name, intervals]) => [name,
    Array.from({ length: 5 }, (_, index) => {
      const template = getIonianCagedPattern('Natural Minor (Aeolian)', index);
      if (!template) throw new Error('Missing Aeolian CAGED template');
      return alterAeolianPattern(template, intervals);
    }),
  ]),
);

// Phrygian Dominant is mode V of Harmonic Minor and therefore shares its exact fret map.
PATTERNS['Phrygian Dominant'] = PATTERNS['Harmonic Minor'];

const SCALE_INTERVALS: Record<string, readonly number[]> = {
  ...TARGET_INTERVALS,
  'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
};

for (const [name, patterns] of Object.entries(PATTERNS)) {
  // Templates are stored relative to the natural-minor parent-major origin:
  // A harmonic minor is offset 9 from C; its mode V, E Phrygian Dominant, is offset 4 from C.
  const modalRootFromParent = name === 'Phrygian Dominant' ? 4 : 9;
  patterns.forEach((pattern, positionIndex) => pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const interval = mod12(STRING_OFFSETS[stringIndex] + fret - modalRootFromParent);
    if (!SCALE_INTERVALS[name].includes(interval)) {
      throw new Error(`${name} CAGED ${positionIndex + 1} contains invalid interval ${interval}`);
    }
  })));
  patterns.forEach((pattern, positionIndex) => {
    const current = new Set(pattern.flatMap((frets, stringIndex) => frets.map(fret => `${stringIndex}-${fret}`)));
    const nextIndex = (positionIndex + 1) % patterns.length;
    const octaveShift = nextIndex === 0 ? 12 : 0;
    const next = new Set(patterns[nextIndex].flatMap((frets, stringIndex) =>
      frets.map(fret => `${stringIndex}-${fret + octaveShift}`)));
    if (![...current].some(position => next.has(position))) {
      throw new Error(`${name} CAGED ${positionIndex + 1} must overlap the next position`);
    }
  });
}

export function getMinorFamilyCagedPattern(scaleName: string, positionIndex: number): IonianCagedPattern | null {
  return PATTERNS[scaleName]?.[positionIndex] ?? null;
}

export function getMinorFamilyParentRootFret(scaleName: string, modalRootFret: number) {
  if (scaleName === 'Harmonic Minor' || scaleName === 'Melodic Minor') return mod12(modalRootFret - 9);
  if (scaleName === 'Phrygian Dominant') return mod12(modalRootFret - 4);
  return modalRootFret;
}
