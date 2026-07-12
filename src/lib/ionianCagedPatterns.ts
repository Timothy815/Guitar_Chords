export type IonianCagedPattern = readonly (readonly number[])[];

// Fret offsets relative to the Ionian root on the low E string.
// Stored low E to high E, in the Dictionary's E-D-C-A-G selector order.
const IONIAN_CAGED: readonly IonianCagedPattern[] = [
  [[-1, 0, 2], [-1, 0, 2], [-1, 1, 2], [-1, 1, 2], [0, 2], [-1, 0, 2]],
  [[2, 4, 5], [2, 4], [1, 2, 4], [1, 2, 4], [2, 4, 5], [2, 4, 5]],
  [[4, 5, 7], [4, 6, 7], [4, 6, 7], [4, 6], [4, 5, 7], [4, 5, 7]],
  [[7, 9], [6, 7, 9], [6, 7, 9], [6, 8, 9], [7, 9, 10], [7, 9]],
  [[9, 11, 12], [9, 11, 12], [9, 11], [8, 9, 11], [9, 10, 12], [9, 11, 12]],
];

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;
const IONIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

IONIAN_CAGED.forEach((pattern, positionIndex) => {
  if (pattern.length !== 6) throw new Error(`Ionian CAGED ${positionIndex + 1} must define six strings`);
  pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const interval = (STRING_OFFSETS[stringIndex] + fret + 24) % 12;
    if (!(IONIAN_INTERVALS as readonly number[]).includes(interval)) {
      throw new Error(`Ionian CAGED ${positionIndex + 1} contains an invalid note on string ${stringIndex}`);
    }
  }));
});

for (let positionIndex = 0; positionIndex < IONIAN_CAGED.length; positionIndex++) {
  const current = new Set(IONIAN_CAGED[positionIndex].flatMap((frets, stringIndex) =>
    frets.map(fret => `${stringIndex}-${fret}`)));
  const nextIndex = (positionIndex + 1) % IONIAN_CAGED.length;
  const octaveShift = nextIndex === 0 ? 12 : 0;
  const next = new Set(IONIAN_CAGED[nextIndex].flatMap((frets, stringIndex) =>
    frets.map(fret => `${stringIndex}-${fret + octaveShift}`)));
  if (![...current].some(position => next.has(position))) {
    throw new Error(`Ionian CAGED ${positionIndex + 1} must overlap the next position`);
  }
}

const MODE_PARENT_DEGREES: Record<string, number> = {
  'Major (Ionian)': 0,
  Dorian: 2,
  Phrygian: 4,
  Lydian: 5,
  Mixolydian: 7,
  'Natural Minor (Aeolian)': 9,
  Locrian: 11,
};

export function getIonianCagedPattern(scaleName: string, positionIndex: number): IonianCagedPattern | null {
  if (!(scaleName in MODE_PARENT_DEGREES)) return null;
  return IONIAN_CAGED[positionIndex] ?? null;
}

export function getIonianParentRootFret(scaleName: string, modalRootFret: number) {
  const degree = MODE_PARENT_DEGREES[scaleName];
  return degree === undefined ? modalRootFret : (modalRootFret - degree + 12) % 12;
}
