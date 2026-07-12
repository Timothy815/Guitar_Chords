export type BluesBoxPattern = readonly (readonly number[])[];

const MINOR_BLUES: Record<string, BluesBoxPattern> = {
  box1: [[0, 3], [0, 1, 2], [0, 2], [0, 2, 3], [0, 3], [0, 3]],
  box2: [[3, 5], [2, 5], [2, 5], [2, 3, 4], [3, 5], [3, 5]],
  box3: [[5, 6, 7], [5, 7], [5, 7, 8], [4, 7], [5, 8], [5, 6, 7]],
  box4: [[7, 10], [7, 10], [7, 8, 9], [7, 9], [8, 10], [7, 10]],
  box5: [[10, 12], [10, 12], [9, 12], [9, 12], [10, 11, 12], [10, 12]],
};

const MAJOR_BLUES: Record<string, BluesBoxPattern> = {
  box1: [[0, 2], [-1, 2], [-1, 2], [-1, 0, 1], [0, 2], [0, 2]],
  box2: [[2, 3, 4], [2, 4], [2, 4, 5], [1, 4], [2, 5], [2, 3, 4]],
  box3: [[4, 7], [4, 7], [4, 5, 6], [4, 6], [5, 7], [4, 7]],
  box4: [[7, 9], [7, 9], [6, 9], [6, 9], [7, 8, 9], [7, 9]],
  box5: [[9, 12], [9, 10, 11], [9, 11], [9, 11, 12], [9, 12], [9, 12]],
};

// Guard the hand-authored shapes against wrong-string or wrong-interval regressions.
// String offsets are measured from the low E root anchor in standard tuning.
const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;
const SCALE_INTERVALS: Record<string, readonly number[]> = {
  'Minor Blues': [0, 3, 5, 6, 7, 10],
  'Major Blues': [0, 2, 3, 4, 7, 9],
};

function validatePatterns(name: string, patterns: Record<string, BluesBoxPattern>) {
  const allowed = SCALE_INTERVALS[name];
  for (let boxIndex = 1; boxIndex <= 5; boxIndex++) {
    const pattern = patterns[`box${boxIndex}`];
    if (!pattern || pattern.length !== 6) throw new Error(`${name} box ${boxIndex} must define six strings`);
    pattern.forEach((frets, stringIndex) => {
      frets.forEach(fret => {
        const interval = (STRING_OFFSETS[stringIndex] + fret + 24) % 12;
        if (!allowed.includes(interval)) {
          throw new Error(`${name} box ${boxIndex} contains an invalid note on string ${stringIndex}, fret offset ${fret}`);
        }
      });
    });
  }
}

validatePatterns('Minor Blues', MINOR_BLUES);
validatePatterns('Major Blues', MAJOR_BLUES);

export function getBluesBoxPattern(scaleName: string, positionIndex: number): BluesBoxPattern | null {
  const id = `box${positionIndex + 1}`;
  if (scaleName === 'Minor Blues') return MINOR_BLUES[id] ?? null;
  if (scaleName === 'Major Blues') return MAJOR_BLUES[id] ?? null;
  return null;
}
