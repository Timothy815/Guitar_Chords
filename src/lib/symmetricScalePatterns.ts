export type SymmetricScalePattern = readonly (readonly number[])[];

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;

// Whole Tone: derived mathematically (Recommended, per design discussion) — every
// scale tone is a whole step apart, so a 2-notes-per-string shape a whole step wide
// on each string, staggered by a semitone between string pairs, covers the scale
// with no repeated pitch classes.
const WHOLE_TONE: SymmetricScalePattern = [[0, 2], [1, 3], [0, 2], [1, 3], [1, 3], [0, 2]];

// Diminished shapes: 3-notes-per-string, alternating 1-2-4 / 1-3-4 finger pattern,
// sourced from jazzguitar.be/blog/diminished-scale/, jazz-guitar-licks.com, and
// unlocktheguitar.net's 3NPS diminished-scale fingering articles.
const DIM_WHOLE_HALF: SymmetricScalePattern = [[0, 2, 3], [0, 1, 3], [-1, 1, 2], [-1, 0, 2], [-1, 1, 2], [-1, 0, 2]];
const DIM_HALF_WHOLE: SymmetricScalePattern = [[1, 3, 4], [1, 2, 4], [0, 2, 3], [0, 1, 3], [0, 2, 3], [0, 1, 3]];

const PATTERNS: Record<string, SymmetricScalePattern> = {
  'Whole Tone': WHOLE_TONE,
  'Diminished (Half-Whole)': DIM_HALF_WHOLE,
  'Diminished (Whole-Half)': DIM_WHOLE_HALF,
};

const REPEAT_SEMITONES: Record<string, number> = {
  'Whole Tone': 2,
  'Diminished (Half-Whole)': 3,
  'Diminished (Whole-Half)': 3,
};

// Must match src/data/guitarData.ts COMMON_SCALES exactly.
const SCALE_INTERVALS: Record<string, readonly number[]> = {
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished (Half-Whole)': [0, 1, 3, 4, 6, 7, 9, 10],
  'Diminished (Whole-Half)': [0, 2, 3, 5, 6, 8, 9, 11],
};

function mod12(value: number) { return ((value % 12) + 12) % 12; }

for (const [name, pattern] of Object.entries(PATTERNS)) {
  const allowed = SCALE_INTERVALS[name];
  const repeatSemitones = REPEAT_SEMITONES[name];

  if (pattern.length !== 6) throw new Error(`${name} symmetric shape must define six strings`);

  // Interval-membership: every stored fret is a valid scale degree, root on fret 0 of low E.
  pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const interval = mod12(STRING_OFFSETS[stringIndex] + fret);
    if (!allowed.includes(interval)) {
      throw new Error(`${name} symmetric shape contains invalid interval ${interval} on string ${stringIndex}`);
    }
  }));

  // Periodicity: the same literal shape, re-anchored repeatSemitones higher, must still land
  // entirely on scale tones — this is what lets findShapeAnchors tile the neck with one shape.
  pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const shiftedInterval = mod12(STRING_OFFSETS[stringIndex] + fret + repeatSemitones);
    if (!allowed.includes(shiftedInterval)) {
      throw new Error(`${name} symmetric shape is not periodic at ${repeatSemitones} semitones`);
    }
  }));
}

export function getSymmetricScalePattern(scaleName: string): SymmetricScalePattern | null {
  return PATTERNS[scaleName] ?? null;
}

export function getSymmetricScaleRepeat(scaleName: string): number | null {
  return REPEAT_SEMITONES[scaleName] ?? null;
}
