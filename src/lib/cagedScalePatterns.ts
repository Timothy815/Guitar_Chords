import { getBluesBoxPattern } from './bluesBoxPatterns';
import { getIonianCagedPattern, getIonianParentRootFret } from './ionianCagedPatterns';
import { getMinorFamilyCagedPattern, getMinorFamilyParentRootFret } from './minorFamilyCagedPatterns';
import { getSymmetricScalePattern, getSymmetricScaleRepeat } from './symmetricScalePatterns';

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;

export function findShapeAnchors(
  pattern: readonly (readonly number[])[],
  baseAnchor: number,
  repeatSemitones: number,
  bounds: { min: number; max: number } = { min: 0, max: 24 },
): number[] {
  const offsets = pattern.flat();
  const minOffset = offsets.length ? Math.min(...offsets) : 0;
  const maxOffset = offsets.length ? Math.max(...offsets) : 0;
  const fits = (anchor: number) => anchor + minOffset >= bounds.min && anchor + maxOffset <= bounds.max;
  const anchors = new Set<number>([baseAnchor]);
  for (let anchor = baseAnchor - repeatSemitones; fits(anchor); anchor -= repeatSemitones) anchors.add(anchor);
  for (let anchor = baseAnchor + repeatSemitones; fits(anchor); anchor += repeatSemitones) anchors.add(anchor);
  return [...anchors].sort((a, b) => a - b);
}

export function getCagedScaleRepeat(scaleName: string): number {
  return getSymmetricScaleRepeat(scaleName) ?? 12;
}

function getPentatonicPattern(scaleName: string, positionIndex: number) {
  const bluesName = scaleName === 'Minor Pentatonic' ? 'Minor Blues'
    : scaleName === 'Major Pentatonic' ? 'Major Blues'
    : null;
  if (!bluesName) return null;
  const blues = getBluesBoxPattern(bluesName, positionIndex);
  if (!blues) return null;
  const allowed = scaleName === 'Minor Pentatonic' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  return blues.map((frets, stringIndex) => frets.filter(fret =>
    allowed.includes((STRING_OFFSETS[stringIndex] + fret + 24) % 12)));
}

export function getCagedScalePattern(scaleName: string, positionIndex: number) {
  const symmetricPattern = getSymmetricScalePattern(scaleName);
  if (symmetricPattern) return positionIndex === 0 ? symmetricPattern : null;
  return getPentatonicPattern(scaleName, positionIndex)
    ?? getBluesBoxPattern(scaleName, positionIndex)
    ?? getIonianCagedPattern(scaleName, positionIndex)
    ?? getMinorFamilyCagedPattern(scaleName, positionIndex);
}

export function getCagedScaleAnchor(scaleName: string, rootFret: number) {
  const offsets = Array.from({ length: 5 }, (_, index) => getCagedScalePattern(scaleName, index)?.flat() ?? []).flat();
  if (offsets.length === 0) return rootFret;
  let anchorFret = getIonianParentRootFret(scaleName, getMinorFamilyParentRootFret(scaleName, rootFret));
  while (anchorFret + Math.min(...offsets) < 0) anchorFret += 12;
  return anchorFret;
}

export function supportsCagedScale(scaleName: string) {
  return getCagedScalePattern(scaleName, 0) !== null;
}
