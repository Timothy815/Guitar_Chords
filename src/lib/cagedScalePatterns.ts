import { getBluesBoxPattern } from './bluesBoxPatterns';
import { getIonianCagedPattern, getIonianParentRootFret } from './ionianCagedPatterns';
import { getMinorFamilyCagedPattern, getMinorFamilyParentRootFret } from './minorFamilyCagedPatterns';

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;

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
