import { Note, ChordShape } from '../types';
import { ALL_NOTES, COMMON_CHORDS } from './guitarData';

// Compute the note N semitones above `root` in the chromatic scale.
export function noteAt(root: Note, semitones: number): Note {
  return ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12];
}

export function relativeMinorOf(major: Note): Note {
  return noteAt(major, 9);
}

export function relativeMajorOf(minor: Note): Note {
  return noteAt(minor, 3);
}

// Conventional display spelling — flats for the flat side of the circle.
export const DISPLAY_NAMES: Partial<Record<Note, string>> = {
  'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb', 'F#': 'F#/Gb',
};
export function displayNote(n: Note): string {
  return DISPLAY_NAMES[n] ?? n;
}

export type DiatonicQuality = 'Major' | 'Minor' | 'dim';
export type SeventhQuality = 'Maj7' | 'dom7' | 'm7' | 'm7b5';
export type WedgeQuality = 'major' | 'minor';

export interface DiatonicDegree {
  roman: string;
  interval: number;
  quality: DiatonicQuality;
  seventh: SeventhQuality;
}

export const DIATONIC_MAJOR: DiatonicDegree[] = [
  { roman: 'I',    interval: 0,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'ii',   interval: 2,  quality: 'Minor', seventh: 'm7' },
  { roman: 'iii',  interval: 4,  quality: 'Minor', seventh: 'm7' },
  { roman: 'IV',   interval: 5,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'V',    interval: 7,  quality: 'Major', seventh: 'dom7' },
  { roman: 'vi',   interval: 9,  quality: 'Minor', seventh: 'm7' },
  { roman: 'vii°', interval: 11, quality: 'dim',   seventh: 'm7b5' },
];

export const DIATONIC_MINOR: DiatonicDegree[] = [
  { roman: 'i',    interval: 0,  quality: 'Minor', seventh: 'm7' },
  { roman: 'ii°',  interval: 2,  quality: 'dim',   seventh: 'm7b5' },
  { roman: 'III',  interval: 3,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'iv',   interval: 5,  quality: 'Minor', seventh: 'm7' },
  { roman: 'v',    interval: 7,  quality: 'Minor', seventh: 'm7' },
  { roman: 'VI',   interval: 8,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'VII',  interval: 10, quality: 'Major', seventh: 'dom7' },
];

export function diatonicDegrees(mode: 'major' | 'minor'): DiatonicDegree[] {
  return mode === 'major' ? DIATONIC_MAJOR : DIATONIC_MINOR;
}

function toWedgeQuality(q: DiatonicQuality): WedgeQuality | null {
  if (q === 'Major') return 'major';
  if (q === 'Minor') return 'minor';
  return null;
}

// Maps any resolved chord quality back to which ring (major/minor) it
// visually belongs to on the wheel. Diminished chords have no ring.
export function wedgeQualityFor(quality: DiatonicQuality | SeventhQuality): WedgeQuality | null {
  if (quality === 'Major' || quality === 'Maj7' || quality === 'dom7') return 'major';
  if (quality === 'Minor' || quality === 'm7' || quality === 'm7b5') return 'minor';
  return null;
}

export interface WedgeInfo {
  isTonic: boolean;
  isDiatonic: boolean;
  numeral: string | null;
}

// Diatonic/tonic/numeral status of a single wheel wedge (root+quality)
// relative to the given tonic/mode. Only major/minor triads get a wedge —
// the diminished diatonic degree (vii° in major, ii° in minor) has no
// wedge, matching the wheel's fixed 12-major/12-minor layout.
export function wedgeInfo(tonic: Note | null, mode: 'major' | 'minor', root: Note, quality: WedgeQuality): WedgeInfo {
  if (!tonic) return { isTonic: false, isDiatonic: false, numeral: null };
  const isTonic = root === tonic && quality === mode;
  const match = diatonicDegrees(mode).find(
    d => toWedgeQuality(d.quality) === quality && noteAt(tonic, d.interval) === root,
  );
  return { isTonic, isDiatonic: !!match, numeral: match ? match.roman : null };
}

export interface BorrowedChordDef {
  interval: number;
  quality: DiatonicQuality | 'dom7';
  label: string;
  why: string;
}

export const BORROWED_MAJOR: BorrowedChordDef[] = [
  { interval: 2,  quality: 'dom7',  label: 'V7/V',  why: 'Dominant of the V chord — strong pull toward V.' },
  { interval: 9,  quality: 'dom7',  label: 'V7/ii', why: 'Secondary dominant leading into ii.' },
  { interval: 4,  quality: 'dom7',  label: 'V7/vi', why: 'Secondary dominant leading into vi, the relative minor.' },
  { interval: 0,  quality: 'dom7',  label: 'V7/IV', why: 'Turns the I chord into a dominant 7 to pull into IV.' },
  { interval: 5,  quality: 'Minor', label: 'iv',    why: 'Minor iv borrowed from the parallel minor key — a common darker turn before resolving home.' },
  { interval: 10, quality: 'Major', label: '♭VII',  why: 'Borrowed from the parallel minor — classic rock ♭VII–I cadence.' },
  { interval: 3,  quality: 'Major', label: '♭III',  why: "Borrowed from the parallel minor's relative major — a moody, modal color." },
];

export const BORROWED_MINOR: BorrowedChordDef[] = [
  { interval: 7, quality: 'dom7',  label: 'V7',  why: "Harmonic-minor dominant — raises the natural minor's 7th for a stronger pull home." },
  { interval: 5, quality: 'Major', label: 'IV',  why: 'Major IV borrowed from the parallel major — brightens the usual minor iv.' },
  { interval: 1, quality: 'Major', label: '♭II', why: "The 'Neapolitan' chord — a dramatic half-step move toward i." },
];

export function borrowedChords(mode: 'major' | 'minor'): BorrowedChordDef[] {
  return mode === 'major' ? BORROWED_MAJOR : BORROWED_MINOR;
}

// A borrowed chord's displayed quality respects the triads/7ths toggle,
// except secondary dominants (quality: 'dom7'), which always stay dominant
// 7th regardless of the toggle — that's what makes them "secondary dominants".
export function effectiveBorrowedQuality(b: BorrowedChordDef, sevenths: boolean): DiatonicQuality | SeventhQuality {
  if (b.quality === 'dom7') return 'dom7';
  if (!sevenths) return b.quality;
  return b.quality === 'Major' ? 'Maj7' : b.quality === 'Minor' ? 'm7' : b.quality;
}

const QUALITY_SUFFIX: Record<DiatonicQuality | SeventhQuality, string> = {
  Major: '', Minor: 'm', dim: 'dim', Maj7: 'maj7', dom7: '7', m7: 'm7', m7b5: 'm7♭5',
};
export function chordLabel(root: Note, quality: DiatonicQuality | SeventhQuality): string {
  return `${root}${QUALITY_SUFFIX[quality]}`;
}

// Matches this project's ChordShape.name convention, e.g. "C Major (E Shape)",
// "C 7 (E7 Shape)", "C m7b5 (A Shape)" — see src/data/guitarData.ts.
export function chordsForQuality(root: Note, quality: DiatonicQuality | SeventhQuality): ChordShape[] {
  const chords = COMMON_CHORDS[root] ?? [];
  switch (quality) {
    case 'Major': return chords.filter(c => c.name.includes('Major'));
    case 'Minor': return chords.filter(c => c.name.includes('Minor'));
    case 'dim':   return chords.filter(c => c.name.includes('dim ('));
    case 'Maj7':  return chords.filter(c => c.name.includes('Maj7'));
    case 'dom7':  return chords.filter(c => c.name.includes(' 7 ('));
    case 'm7':    return chords.filter(c => c.name.includes('m7 ('));
    case 'm7b5':  return chords.filter(c => c.name.includes('m7b5'));
    default:      return [];
  }
}
