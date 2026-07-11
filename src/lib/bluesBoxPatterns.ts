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

export function getBluesBoxPattern(scaleName: string, positionIndex: number): BluesBoxPattern | null {
  const id = `box${positionIndex + 1}`;
  if (scaleName === 'Minor Blues') return MINOR_BLUES[id] ?? null;
  if (scaleName === 'Major Blues') return MAJOR_BLUES[id] ?? null;
  return null;
}
