import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chord as TonalChord } from '@tonaljs/tonal';
import { Fretboard } from '../components/Fretboard';
import { IntervalFretboard } from '../components/IntervalFretboard';
import { PianoKeyboard } from '../components/PianoKeyboard';
import { COMMON_CHORDS, COMMON_SCALES, generateScalePattern, ALL_NOTES, ScaleCategory } from '../data/guitarData';
import { playStrum, playArpeggio, getFretNote, initAudio, playNote, setEffects } from '../lib/audio';
import { Volume2, ListMusic, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { ChordShape, Note, TUNINGS, Tuning, Finger } from '../types';
import { handlePrint, cn, avgChordPitch, chordPositionBucket, PositionBucket, POSITION_LABELS } from '../lib/utils';
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';
import { TheoryReference } from '../components/TheoryReference';
import { STANDARD_TUNING } from '../types';

function getNavigationChords(tonalName: string): ChordShape[] {
  const base = tonalName.split('/')[0];
  const m = base.match(/^([A-G][#b])(.*)/) ?? base.match(/^([A-G])(.*)/);
  if (!m) return [];
  const flatToSharp: Record<string, string> = {
    Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B',
  };
  const root = (flatToSharp[m[1]] ?? m[1]) as Note;
  const qual = m[2];
  const pool = COMMON_CHORDS[root] ?? [];
  const q = (c: ChordShape) => c.name.slice(root.length + 1);
  let shapes: ChordShape[];
  switch (qual) {
    case 'M': case '': case 'maj': case 'major':
      shapes = pool.filter(c => q(c).startsWith('Major')); break;
    case 'm': case 'min': case 'minor':
      shapes = pool.filter(c => q(c).startsWith('Minor')); break;
    case '7':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('7 ') || s === '7' || s.startsWith('7('); }); break;
    case 'M7': case 'maj7': case 'Maj7':
      shapes = pool.filter(c => q(c).startsWith('Maj7')); break;
    case 'm7': case 'min7':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('m7') && !s.startsWith('m7b5'); }); break;
    case 'dim7': case 'o7':
      shapes = pool.filter(c => q(c).startsWith('dim7')); break;
    case 'dim': case 'o':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('dim ') && !s.startsWith('dim7'); }); break;
    case 'm7b5': case 'ø': case 'ø7': case 'half-dim':
      shapes = pool.filter(c => q(c).startsWith('m7b5')); break;
    case 'sus2':
      shapes = pool.filter(c => q(c).startsWith('sus2')); break;
    case 'sus4': case 'sus':
      shapes = pool.filter(c => q(c).startsWith('sus4')); break;
    case 'aug': case '+':
      shapes = pool.filter(c => q(c).startsWith('aug')); break;
    default: return [];
  }
  return shapes.sort((a, b) => {
    const lo = (frets: number[]) => Math.min(...frets.filter(f => f > 0).concat([999]));
    return lo(a.frets) - lo(b.frets);
  });
}

const INTERVALS = [
  { name: 'Unison',      short: 'P1',  semitones: 0 },
  { name: 'Minor 2nd',   short: 'm2',  semitones: 1 },
  { name: 'Major 2nd',   short: 'M2',  semitones: 2 },
  { name: 'Minor 3rd',   short: 'm3',  semitones: 3 },
  { name: 'Major 3rd',   short: 'M3',  semitones: 4 },
  { name: 'Perfect 4th', short: 'P4',  semitones: 5 },
  { name: 'Tritone',     short: 'TT',  semitones: 6 },
  { name: 'Perfect 5th', short: 'P5',  semitones: 7 },
  { name: 'Minor 6th',   short: 'm6',  semitones: 8 },
  { name: 'Major 6th',   short: 'M6',  semitones: 9 },
  { name: 'Minor 7th',   short: 'm7',  semitones: 10 },
  { name: 'Major 7th',   short: 'M7',  semitones: 11 },
  { name: 'Octave',      short: '8ve', semitones: 12 },
];

function formatSemitoneLabel(semitones: number) {
  return `${semitones} semitone${semitones === 1 ? '' : 's'}`;
}

const SCALE_POSITION_BOXES = [
  { id: 'pos1', label: 'CAGED 1 (E-shape)', startOff: -1 },
  { id: 'pos2', label: 'CAGED 2 (D-shape)', startOff: 2 },
  { id: 'pos3', label: 'CAGED 3 (C-shape)', startOff: 4 },
  { id: 'pos4', label: 'CAGED 4 (A-shape)', startOff: 7 },
  { id: 'pos5', label: 'CAGED 5 (G-shape)', startOff: 9 },
] as const;
const SCALE_BOX_SPAN = 4;
const MINOR_FAMILY_BOXES = [
  { id: 'box1', label: 'Box 1', startOff: 0, span: 3 },
  { id: 'box2', label: 'Box 2', startOff: 3, span: 2 },
  { id: 'box3', label: 'Box 3', startOff: 5, span: 2 },
  { id: 'box4', label: 'Box 4', startOff: 7, span: 3 },
  { id: 'box5', label: 'Box 5', startOff: 10, span: 2 },
] as const;
const MAJOR_FAMILY_BOXES = [
  { id: 'box1', label: 'Box 1', startOff: -3, span: 3 },
  { id: 'box2', label: 'Box 2', startOff: 0, span: 2 },
  { id: 'box3', label: 'Box 3', startOff: 2, span: 2 },
  { id: 'box4', label: 'Box 4', startOff: 4, span: 3 },
  { id: 'box5', label: 'Box 5', startOff: 7, span: 2 },
] as const;
type RelativeBoxPattern = readonly (readonly number[])[];
const MINOR_PENTATONIC_BOX_PATTERNS: Record<string, RelativeBoxPattern> = {
  box1: [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  box2: [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  box3: [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  box4: [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  box5: [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
};
const MINOR_BLUES_BOX_PATTERNS: Record<string, RelativeBoxPattern> = {
  box1: [[0, 3], [0, 1, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  box2: [[3, 5], [2, 5], [2, 3, 5], [2, 4], [3, 5], [3, 5]],
  box3: [[5, 6, 7], [5, 7], [5, 7], [4, 5, 7], [5, 8], [5, 7]],
  box4: [[7, 10], [7, 8, 10], [7, 9], [7, 8, 9], [8, 10], [7, 10]],
  box5: [[10, 12], [10, 12], [9, 10, 12], [9, 12], [10, 11, 12], [10, 12]],
};
const MAJOR_PENTATONIC_BOX_PATTERNS: Record<string, RelativeBoxPattern> = {
  box1: [[0, 2], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 2]],
  box2: [[2, 4], [2, 4], [2, 4], [1, 4], [2, 5], [2, 4]],
  box3: [[4, 7], [4, 7], [4, 6], [4, 6], [5, 7], [4, 7]],
  box4: [[7, 9], [7, 9], [6, 9], [6, 9], [7, 9], [7, 9]],
  box5: [[9, 12], [9, 11], [9, 11], [9, 11], [9, 12], [9, 12]],
};
const MAJOR_BLUES_BOX_PATTERNS: Record<string, RelativeBoxPattern> = {
  box1: [[0, 2], [-1, 2], [-1, 2], [-1, 0, 1], [0, 2], [0, 2]],
  box2: [[2, 4], [2, 4], [2, 3, 4], [1, 4], [2, 5], [2, 4]],
  box3: [[4, 7], [4, 7], [4, 6], [4, 5, 6], [5, 7], [4, 7]],
  box4: [[7, 9], [7, 9], [6, 9], [6, 7, 9], [7, 9], [7, 9]],
  box5: [[9, 12], [9, 10, 11], [9, 11], [9, 11], [9, 12], [9, 12]],
};
type ScaleViewMode = 'full' | 'position' | 'box' | 'threeNps' | 'diagonal';
type ScaleOverlayMode = 'all' | 'roots' | 'chordTones' | 'arpeggio';

function getStrictBoxPattern(scaleName: string, boxId: string): RelativeBoxPattern | null {
  switch (scaleName) {
    case 'Minor Pentatonic':
      return MINOR_PENTATONIC_BOX_PATTERNS[boxId] ?? null;
    case 'Minor Blues':
      return MINOR_BLUES_BOX_PATTERNS[boxId] ?? null;
    case 'Major Pentatonic':
      return MAJOR_PENTATONIC_BOX_PATTERNS[boxId] ?? null;
    case 'Major Blues':
      return MAJOR_BLUES_BOX_PATTERNS[boxId] ?? null;
    default:
      return null;
  }
}

function getAbsolutePitch(note: Note, octave: number) {
  return octave * 12 + ALL_NOTES.indexOf(note);
}

function buildThreeNpsPattern(intervals: number[], patternIndex: number) {
  if (intervals.length !== 7) return null;

  const openPitches = STANDARD_TUNING.notes.map((note, idx) =>
    getAbsolutePitch(note as Note, STANDARD_TUNING.octaves[idx])
  );
  const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);

  return (root: Note) => {
    const rootNoteIdx = ALL_NOTES.indexOf(root);
    let startFret = (rootNoteIdx - lowENoteIdx + 12) % 12 + intervals[patternIndex];
    const absoluteSteps: number[] = [];
    const basePitch = openPitches[0] + startFret;
    absoluteSteps.push(basePitch);

    for (let i = 1; i < 18; i += 1) {
      const prevDegree = intervals[(patternIndex + i - 1) % 7];
      const nextDegree = intervals[(patternIndex + i) % 7];
      const step = nextDegree > prevDegree ? nextDegree - prevDegree : nextDegree + 12 - prevDegree;
      absoluteSteps.push(absoluteSteps[i - 1] + step);
    }

    let frets = absoluteSteps.map((pitch, idx) => pitch - openPitches[Math.floor(idx / 3)]);
    let minFret = Math.min(...frets);
    let maxFret = Math.max(...frets);

    while (minFret < 0) {
      startFret += 12;
      frets = frets.map(fret => fret + 12);
      minFret += 12;
      maxFret += 12;
    }
    while (maxFret > 15 && minFret - 12 >= 0) {
      startFret -= 12;
      frets = frets.map(fret => fret - 12);
      minFret -= 12;
      maxFret -= 12;
    }

    const positions = new Set<string>();
    frets.forEach((fret, idx) => {
      const stringIdx = Math.floor(idx / 3);
      if (fret >= 0 && fret <= 15) positions.add(`${stringIdx}-${fret}`);
    });

    return {
      id: `p${patternIndex + 1}`,
      label: `Pattern ${patternIndex + 1} (${minFret}-${maxFret})`,
      range: [minFret, maxFret] as [number, number],
      positions,
    };
  };
}

function buildDiagonalPattern(intervals: number[], startDegreeIndex: number) {
  if (intervals.length !== 7) return null;

  const openPitches = STANDARD_TUNING.notes.map((note, idx) =>
    getAbsolutePitch(note as Note, STANDARD_TUNING.octaves[idx])
  );

  return (root: Note) => {
    const rootPitchClass = ALL_NOTES.indexOf(root);
    let minPitch = openPitches[0] + ((rootPitchClass - ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note) + 12) % 12) + intervals[startDegreeIndex];
    const positions = new Set<string>();
    let minFret = Infinity;
    let maxFret = -Infinity;

    for (let stringIdx = 0; stringIdx < 6; stringIdx += 1) {
      const candidates = Array.from({ length: 16 }, (_, fret) => {
        const pitch = openPitches[stringIdx] + fret;
        const pitchClass = ((pitch % 12) + 12) % 12;
        const rel = (pitchClass - rootPitchClass + 12) % 12;
        return { fret, pitch, inScale: intervals.includes(rel) };
      }).filter(candidate => candidate.inScale && candidate.pitch >= minPitch);

      if (candidates.length === 0) continue;

      const picked = [candidates[0]];
      const second = candidates.find(candidate => candidate.pitch > picked[0].pitch && candidate.fret - picked[0].fret <= 5);
      if (second) picked.push(second);

      picked.forEach(({ fret, pitch }) => {
        positions.add(`${stringIdx}-${fret}`);
        minFret = Math.min(minFret, fret);
        maxFret = Math.max(maxFret, fret);
        minPitch = pitch + 1;
      });
    }

    if (positions.size === 0) return null;

    return {
      id: `d${startDegreeIndex + 1}`,
      label: `Route from ${formatOverlayDegree(intervals[startDegreeIndex])} (${minFret}-${maxFret})`,
      range: [minFret, maxFret] as [number, number],
      positions,
    };
  };
}

function describeOverlayQuality(intervals: number[]) {
  const has = (interval: number) => intervals.includes(interval);
  const hasMinor3 = has(3);
  const hasMajor3 = has(4);
  const hasFlat5 = has(6);
  const hasPerfect5 = has(7);
  const hasSharp5 = has(8);
  const hasMajor6 = has(9);
  const hasMinor7 = has(10);
  const hasMajor7 = has(11);

  if (hasMinor3 && hasFlat5 && hasMinor7) return 'half-diminished 7th';
  if (hasMinor3 && hasFlat5) return 'diminished triad';
  if (hasMajor3 && hasSharp5) return 'augmented triad';
  if (hasMajor3 && hasPerfect5 && hasMinor7) return 'dominant 7th';
  if (hasMajor3 && hasPerfect5 && hasMajor7) return 'major 7th';
  if (hasMinor3 && hasPerfect5 && hasMinor7) return 'minor 7th';
  if (hasMinor3 && hasPerfect5 && hasMajor6) return 'minor 6';
  if (hasMajor3 && hasPerfect5) return 'major triad';
  if (hasMinor3 && hasPerfect5) return 'minor triad';
  if (hasPerfect5) return 'power chord shell';
  return 'scale-tone collection';
}

function formatOverlayDegree(interval: number) {
  switch (interval) {
    case 0: return '1';
    case 3: return 'b3';
    case 4: return '3';
    case 6: return 'b5';
    case 7: return '5';
    case 8: return '#5';
    case 9: return '6';
    case 10: return 'b7';
    case 11: return '7';
    default: return `${interval}`;
  }
}

export function Dictionary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'chords' | 'scales' | 'identify' | 'intervals' | 'theory'>('chords');
  const [currentTuning, setCurrentTuning] = useState<Tuning>(TUNINGS['Standard']);
  const isStandardTuning = currentTuning.name === 'Standard';
  const [selectedKey, setSelectedKey] = useState<Note>('C');
  const [selectedChordIdx, setSelectedChordIdx] = useState<number>(0);
  const [selectedScaleIdx, setSelectedScaleIdx] = useState<number>(0);
  const [scaleViewMode, setScaleViewMode] = useState<ScaleViewMode>('full');
  const [scaleOverlayMode, setScaleOverlayMode] = useState<ScaleOverlayMode>('all');
  const [scalePositionSelection, setScalePositionSelection] = useState<string>('pos1');
  const [scaleBoxSelection, setScaleBoxSelection] = useState<string>('box1');
  const [scaleThreeNpsSelection, setScaleThreeNpsSelection] = useState<string>('p1');
  const [scaleDiagonalSelection, setScaleDiagonalSelection] = useState<string>('d1');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [identifiedFrets, setIdentifiedFrets] = useState<number[]>([-1,-1,-1,-1,-1,-1]);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Seed the Identify tab on mount: URL params take priority, then localStorage.
  useEffect(() => {
    const fretsParam = searchParams.get('frets');
    if (searchParams.get('mode') === 'identify' && fretsParam) {
      const parsed = fretsParam.split(',').map(Number);
      if (parsed.length === 6 && parsed.every(f => Number.isFinite(f))) {
        setMode('identify');
        setIdentifiedFrets(parsed);
        return;
      }
    }
    const rootParam = searchParams.get('root');
    const qualityParam = searchParams.get('quality');
    if (searchParams.get('mode') === 'chords' && rootParam && qualityParam) {
      const normalizedRoot = rootParam.toUpperCase();
      if (ALL_NOTES.includes(normalizedRoot as Note)) {
        const root = normalizedRoot as Note;
        const pool = COMMON_CHORDS[root] ?? [];
        const idx = pool.findIndex(c => {
          const q = c.name.slice(root.length + 1);
          return q.startsWith(qualityParam);
        });
        setSelectedKey(root);
        setSelectedChordIdx(idx >= 0 ? idx : 0);
        setMode('chords');
        return;
      }
    }
    const saved = localStorage.getItem('guitarmaster_identifiedFrets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6 && parsed.every((f: unknown) => typeof f === 'number')) {
          setIdentifiedFrets(parsed as number[]);
        }
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist identified frets so they survive navigation away and back.
  useEffect(() => {
    localStorage.setItem('guitarmaster_identifiedFrets', JSON.stringify(identifiedFrets));
  }, [identifiedFrets]);
  const [scaffoldLevel, setScaffoldLevel] = useState<0 | 1 | 2>(0);
  const [chordSortOrder, setChordSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionBucket>('all');
  const [scaleCategory, setScaleCategory] = useState<ScaleCategory | 'All'>('All');
  const [selectedInterval, setSelectedInterval] = useState<number>(7); // Perfect 5th
  const [showIntervalInfo, setShowIntervalInfo] = useState(false);

  function handleOpenInChords(root: Note, qualityPrefix: string) {
    if (!isStandardTuning) return;
    setSelectedKey(root);
    const pool = COMMON_CHORDS[root] ?? [];
    const idx = pool.findIndex(c => {
      const q = c.name.slice(root.length + 1);
      return q.startsWith(qualityPrefix);
    });
    setSelectedChordIdx(idx >= 0 ? idx : 0);
    setMode('chords');
  }

  function handleExploreFromTheory(root: Note, qualityPrefix: string) {
    const pool = COMMON_CHORDS[root] ?? [];
    const shape = pool.find(c => c.name.slice(root.length + 1).startsWith(qualityPrefix));
    if (!shape) return;
    setIdentifiedFrets([...shape.frets]);
    setMode('identify');
  }

  function handleAddToProgressionFromTheory(root: Note, qualityPrefix: string, octave: number, intervals: number[]) {
    const pool = COMMON_CHORDS[root] ?? [];
    const matches = pool.filter(c => c.name.slice(root.length + 1).startsWith(qualityPrefix));
    const targetAvgPitch = intervals.reduce(
      (sum, interval) => sum + (12 * (octave + 1) + ALL_NOTES.indexOf(root) + interval),
      0
    ) / Math.max(intervals.length, 1);
    const shape = matches.sort((a, b) =>
      Math.abs(avgChordPitch(a) - targetAvgPitch) - Math.abs(avgChordPitch(b) - targetAvgPitch)
    )[0];
    if (shape) handleAddToProgression(shape);
  }

  function handleAddToProgression(chord: ChordShape) {
    const ok = addChordToActiveProgression(chord);
    setAddedToast(ok ? `Added ${chord.name}` : 'No progression saved yet — create one first');
    setTimeout(() => setAddedToast(null), 2000);
  }

  useEffect(() => {
    import('../lib/audio').then(m => {
      m.setOnNotePlayCallback((note) => {
        setPlayingNotes(prev => {
          const next = new Set(prev);
          next.add(note);
          return next;
        });
        setTimeout(() => {
          setPlayingNotes(prev => {
            const next = new Set(prev);
            next.delete(note);
            return next;
          });
        }, 300); // Highlight duration
      });
    });
  }, []);

  // Audio settings
  const [sustain, setSustain] = useState<number>(2);
  const [arpeggioTempo, setArpeggioTempo] = useState<number>(120);
  const [strumDirection, setStrumDirection] = useState<'down' | 'up' | 'up-down' | 'down-up'>('down');
  const [fx, setFx] = useState({ reverb: 0.2, delay: 0.0, delayTime: '4n', chorus: 0.0, flanger: 0.0, overdrive: 0.0, fuzz: 0.0, tone: 1.0 });

  // Sequencer state
  const [seqSteps, setSeqSteps] = useState<boolean[][]>(Array.from({ length: 6 }, () => Array(16).fill(false)));
  const [seqScaleFrets, setSeqScaleFrets] = useState<number[][]>(Array.from({ length: 6 }, () => Array(16).fill(-1)));
  const [seqStepDurations, setSeqStepDurations] = useState<string[]>(Array(16).fill('16n'));
  const [seqNumSteps, setSeqNumSteps] = useState(16);
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [drumsEnabled, setDrumsEnabled] = useState(false);
  const seqTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqStepIdxRef = React.useRef(0);

  // Arpeggiator state
  const [arpPlaying, setArpPlaying] = useState(false);
  const [currentArpIdx, setCurrentArpIdx] = useState(-1);
  const [arpDirection, setArpDirection] = useState<'up' | 'down' | 'up-down'>('up-down');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  const currentChords = COMMON_CHORDS[selectedKey] || [];
  const activeChord = currentChords[selectedChordIdx] || null;

  const sortedChordEntries = useMemo(() => {
    let entries = currentChords.map((chord, origIdx) => ({ chord, origIdx }));
    if (positionFilter !== 'all') entries = entries.filter(e => chordPositionBucket(e.chord) === positionFilter);
    if (chordSortOrder === 'asc') return [...entries].sort((a, b) => avgChordPitch(a.chord) - avgChordPitch(b.chord));
    if (chordSortOrder === 'desc') return [...entries].sort((a, b) => avgChordPitch(b.chord) - avgChordPitch(a.chord));
    return entries;
  }, [currentChords, chordSortOrder, positionFilter]);

  // When filter changes, ensure the selected chord is still visible
  useEffect(() => {
    if (sortedChordEntries.length > 0 && !sortedChordEntries.some(e => e.origIdx === selectedChordIdx)) {
      setSelectedChordIdx(sortedChordEntries[0].origIdx);
    }
  }, [sortedChordEntries]);
  
  const activeScaleBase = COMMON_SCALES[selectedScaleIdx];
  const activeScale = useMemo(
    () => activeScaleBase ? generateScalePattern(selectedKey, activeScaleBase) : null,
    [selectedKey, selectedScaleIdx] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const boxFamily = useMemo<'minorFamily' | 'majorFamily' | null>(() => {
    switch (activeScaleBase?.name) {
      case 'Minor Pentatonic':
      case 'Minor Blues':
        return 'minorFamily';
      case 'Major Pentatonic':
      case 'Major Blues':
        return 'majorFamily';
      default:
        return null;
    }
  }, [activeScaleBase]);
  const boxViewSupported = boxFamily !== null;
  const threeNpsSupported = (activeScaleBase?.intervals.length ?? 0) === 7;
  const diagonalSupported = (activeScaleBase?.intervals.length ?? 0) === 7;
  const scaleOverlayIntervals = useMemo<number[]>(() => {
    const intervals = activeScaleBase?.intervals ?? [];
    if (scaleOverlayMode === 'all') return intervals;
    if (scaleOverlayMode === 'roots') return intervals.includes(0) ? [0] : [];

    const chooseFirstPresent = (candidates: number[]) => candidates.find(interval => intervals.includes(interval));
    const third = chooseFirstPresent([3, 4]);
    const fifth = chooseFirstPresent([7, 6, 8]);
    const seventh = chooseFirstPresent([10, 11, 9]);

    const core = [0, third, fifth].filter((interval): interval is number => interval !== undefined);
    if (scaleOverlayMode === 'chordTones') return core;
    return [...core, seventh].filter((interval, idx, arr): interval is number => interval !== undefined && arr.indexOf(interval) === idx);
  }, [activeScaleBase, scaleOverlayMode]);
  const displayedScale = useMemo(() => {
    if (!activeScale || !activeScaleBase) return activeScale;
    if (scaleOverlayMode === 'all') return activeScale;
    const allowed = new Set(scaleOverlayIntervals);
    return {
      ...activeScale,
      notes: activeScale.notes.filter((_, idx) => allowed.has(activeScaleBase.intervals[idx])),
      intervals: activeScaleBase.intervals.filter(interval => allowed.has(interval)),
    };
  }, [activeScale, activeScaleBase, scaleOverlayIntervals, scaleOverlayMode]);
  const scaleOverlaySummary = useMemo(() => {
    if (!activeScale || !displayedScale) return null;
    if (scaleOverlayMode === 'all') {
      return {
        title: `${selectedKey} ${activeScaleBase?.name ?? 'Scale'}`,
        detail: 'Showing the full scale note set.',
        degrees: activeScale.intervals.map(formatOverlayDegree).join(' - '),
        notes: activeScale.notes.join(' - '),
      };
    }
    if (scaleOverlayMode === 'roots') {
      return {
        title: `${selectedKey} root map`,
        detail: 'Use this to anchor your ear and locate every tonic on the neck.',
        degrees: '1',
        notes: selectedKey,
      };
    }

    const quality = describeOverlayQuality(displayedScale.intervals);
    const title = scaleOverlayMode === 'chordTones'
      ? `${selectedKey} ${quality}`
      : `${selectedKey} ${quality} arpeggio`;
    const detail = scaleOverlayMode === 'chordTones'
      ? 'This isolates the core harmony implied by the selected scale at its root.'
      : 'This highlights the 7th-chord arpeggio tones implied by the selected scale at its root.';

    return {
      title,
      detail,
      degrees: displayedScale.intervals.map(formatOverlayDegree).join(' - '),
      notes: displayedScale.notes.join(' - '),
    };
  }, [activeScale, activeScaleBase, displayedScale, scaleOverlayMode, selectedKey]);

  const scalePositionOptions = useMemo(() => {
    const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
    const rootNoteIdx = ALL_NOTES.indexOf(selectedKey);
    const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;
    return SCALE_POSITION_BOXES.map(box => {
      let startFret = rootFret + box.startOff;
      if (startFret < 0) startFret = 0;
      if (startFret > 11) startFret = startFret % 12;
      const endFret = startFret + SCALE_BOX_SPAN;
      return {
        id: box.id,
        label: `${box.label} (${startFret}-${endFret})`,
        range: [startFret, endFret] as [number, number],
      };
    });
  }, [selectedKey]);

  const scaleBoxOptions = useMemo(() => {
    if (!boxViewSupported) return [];
    const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
    const rootNoteIdx = ALL_NOTES.indexOf(selectedKey);
    const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;
    const familyBoxes = boxFamily === 'majorFamily' ? MAJOR_FAMILY_BOXES : MINOR_FAMILY_BOXES;
    return familyBoxes.map(box => {
      const strictPattern = activeScaleBase ? getStrictBoxPattern(activeScaleBase.name, box.id) : null;
      if (strictPattern) {
        let anchorFret = rootFret;
        const allOffsets = strictPattern.flat();
        let minFret = Math.min(...allOffsets.map(o => anchorFret + o));
        let maxFret = Math.max(...allOffsets.map(o => anchorFret + o));
        while (minFret < 0) { anchorFret += 12; minFret += 12; maxFret += 12; }
        while (maxFret > 15 && minFret - 12 >= 0) { anchorFret -= 12; minFret -= 12; maxFret -= 12; }
        return {
          id: box.id,
          label: `${box.label} (${minFret}-${maxFret})`,
          range: [minFret, maxFret] as [number, number],
        };
      }
      let startFret = rootFret + box.startOff;
      if (startFret < 0) startFret += 12;
      if (startFret > 14) startFret -= 12;
      const endFret = startFret + box.span;
      return {
        id: box.id,
        label: `${box.label} (${startFret}-${endFret})`,
        range: [startFret, endFret] as [number, number],
      };
    });
  }, [activeScaleBase, boxFamily, boxViewSupported, selectedKey]);
  const strictScaleBoxPositions = useMemo(() => {
    if (scaleViewMode !== 'box' || !activeScaleBase) return undefined;
    const pattern = getStrictBoxPattern(activeScaleBase.name, scaleBoxSelection);
    if (!pattern) return undefined;

    const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
    const rootNoteIdx = ALL_NOTES.indexOf(selectedKey);
    let anchorFret = (rootNoteIdx - lowENoteIdx + 12) % 12;
    const allOffsets = pattern.flat();
    let minFret = Math.min(...allOffsets.map(offset => anchorFret + offset));
    let maxFret = Math.max(...allOffsets.map(offset => anchorFret + offset));

    while (minFret < 0) {
      anchorFret += 12;
      minFret += 12;
      maxFret += 12;
    }
    while (maxFret > 15 && minFret - 12 >= 0) {
      anchorFret -= 12;
      minFret -= 12;
      maxFret -= 12;
    }

    const positions = new Set<string>();
    pattern.forEach((stringOffsets, stringIdx) => {
      stringOffsets.forEach(offset => {
        const fret = anchorFret + offset;
        if (fret >= 0 && fret <= 15) positions.add(`${stringIdx}-${fret}`);
      });
    });
    return positions;
  }, [activeScaleBase, scaleBoxSelection, scaleViewMode, selectedKey]);
  const scaleThreeNpsOptions = useMemo(() => {
    if (!threeNpsSupported || !activeScaleBase) return [];
    return activeScaleBase.intervals
      .map((_, idx) => buildThreeNpsPattern(activeScaleBase.intervals, idx)?.(selectedKey) ?? null)
      .filter((pattern): pattern is { id: string; label: string; range: [number, number]; positions: Set<string> } => pattern !== null);
  }, [activeScaleBase, selectedKey, threeNpsSupported]);
  const strictScaleThreeNpsPositions = useMemo(() => {
    if (scaleViewMode !== 'threeNps') return undefined;
    return scaleThreeNpsOptions.find(option => option.id === scaleThreeNpsSelection)?.positions;
  }, [scaleThreeNpsOptions, scaleThreeNpsSelection, scaleViewMode]);
  const scaleDiagonalOptions = useMemo(() => {
    if (!diagonalSupported || !activeScaleBase) return [];
    return [0, 2, 4]
      .map((startIdx) => buildDiagonalPattern(activeScaleBase.intervals, startIdx)?.(selectedKey) ?? null)
      .filter((pattern): pattern is { id: string; label: string; range: [number, number]; positions: Set<string> } => pattern !== null);
  }, [activeScaleBase, diagonalSupported, selectedKey]);
  const strictScaleDiagonalPositions = useMemo(() => {
    if (scaleViewMode !== 'diagonal') return undefined;
    return scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection)?.positions;
  }, [scaleDiagonalOptions, scaleDiagonalSelection, scaleViewMode]);
  const activeStrictScalePositions = useMemo(() => {
    if (scaleViewMode === 'box') return strictScaleBoxPositions;
    if (scaleViewMode === 'threeNps') return strictScaleThreeNpsPositions;
    if (scaleViewMode === 'diagonal') return strictScaleDiagonalPositions;
    return undefined;
  }, [scaleViewMode, strictScaleBoxPositions, strictScaleThreeNpsPositions, strictScaleDiagonalPositions]);

  const scaleFretRange = useMemo<number[]>(() => {
    if (scaleViewMode === 'full') return [];
    if (scaleViewMode === 'position') {
      const match = scalePositionOptions.find(option => option.id === scalePositionSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'box') {
      if (strictScaleBoxPositions) return [];
      const match = scaleBoxOptions.find(option => option.id === scaleBoxSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'threeNps') {
      if (strictScaleThreeNpsPositions) return [];
      const match = scaleThreeNpsOptions.find(option => option.id === scaleThreeNpsSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'diagonal') {
      if (strictScaleDiagonalPositions) return [];
      const match = scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    return [];
  }, [scaleBoxOptions, scaleBoxSelection, scaleDiagonalOptions, scaleDiagonalSelection, scalePositionOptions, scalePositionSelection, scaleThreeNpsOptions, scaleThreeNpsSelection, scaleViewMode, strictScaleBoxPositions, strictScaleDiagonalPositions, strictScaleThreeNpsPositions]);

  // When viewing a box/position with only a fretRange (no explicit strict positions), deduplicate
  // notes by MIDI pitch so the same pitch never appears twice in one box (G string fret+4 = B string open).
  const dedupedScalePositions = useMemo(() => {
    if (!displayedScale || scaleFretRange.length !== 2 || activeStrictScalePositions) return undefined;
    const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
    const [startFret, endFret] = scaleFretRange;
    const candidates: { s: number; f: number; midi: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const openMidi = OPEN_STRING_MIDI[s];
      const openNoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = startFret; f <= endFret; f++) {
        const name = ALL_NOTES[(openNoteIdx + f) % 12];
        if (displayedScale.notes.includes(name as Note)) {
          candidates.push({ s, f, midi: openMidi + f });
        }
      }
    }
    candidates.sort((a, b) => a.f - b.f);
    const seen = new Set<number>();
    const positions = new Set<string>();
    for (const { s, f, midi } of candidates) {
      if (!seen.has(midi)) { seen.add(midi); positions.add(`${s}-${f}`); }
    }
    return positions;
  }, [displayedScale, scaleFretRange, activeStrictScalePositions]);

  useEffect(() => {
    if (scaleViewMode === 'box' && !boxViewSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'threeNps' && !threeNpsSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'diagonal' && !diagonalSupported) {
      setScaleViewMode('full');
    }
  }, [boxViewSupported, diagonalSupported, scaleViewMode, threeNpsSupported]);

  useEffect(() => {
    if (!isStandardTuning && mode === 'chords') {
      if (activeChord) setIdentifiedFrets([...activeChord.frets]);
      setMode('identify');
    }
  }, [activeChord, isStandardTuning, mode]);

  useEffect(() => { setScaffoldLevel(0); }, [selectedKey, selectedChordIdx]);

  // Which scales (rooted on selectedKey) contain all notes of the active chord
  const relatedScales = useMemo(() => {
    if (mode !== 'chords' || !activeChord) return [];
    const chordNoteNames = new Set(
      activeChord.frets
        .map((f, s) => f !== -1 ? getFretNote(s, f).replace(/[0-9]/g, '') : null)
        .filter((n): n is string => n !== null)
    );
    const rootIdx = ALL_NOTES.indexOf(selectedKey);
    return COMMON_SCALES.filter(scaleDef => {
      const scaleNotes = new Set<string>(scaleDef.intervals.map(i => ALL_NOTES[(rootIdx + i) % 12]));
      return [...chordNoteNames].every(n => scaleNotes.has(n));
    });
  }, [mode, activeChord, selectedKey]);

  // Diatonic triads for 7-note scales
  const diatonicChords = useMemo(() => {
    if (mode !== 'scales' || !activeScaleBase || activeScaleBase.intervals.length < 7) return [];
    const rootIdx = ALL_NOTES.indexOf(selectedKey);
    const scaleNotes = activeScaleBase.intervals.map(i => ALL_NOTES[(rootIdx + i) % 12]);
    return scaleNotes.map((degRoot, deg) => {
      const third = scaleNotes[(deg + 2) % 7];
      const fifth  = scaleNotes[(deg + 4) % 7];
      const ri = ALL_NOTES.indexOf(degRoot);
      const thirdInt = (ALL_NOTES.indexOf(third) - ri + 12) % 12;
      const fifthInt  = (ALL_NOTES.indexOf(fifth)  - ri + 12) % 12;
      let quality: 'Major' | 'Minor' | 'dim' | null = null;
      if (thirdInt === 4 && fifthInt === 7) quality = 'Major';
      else if (thirdInt === 3 && fifthInt === 7) quality = 'Minor';
      else if (thirdInt === 3 && fifthInt === 6) quality = 'dim';
      if (!quality) return null;
      const pool = COMMON_CHORDS[degRoot] ?? [];
      const chord = quality === 'Major' ? pool.find(c => c.name.includes('Major'))
        : quality === 'Minor' ? pool.find(c => c.name.includes('Minor'))
        : pool.find(c => c.name.includes('dim ('));
      return chord ?? null;
    }).filter((c): c is ChordShape => c !== null);
  }, [mode, activeScaleBase, selectedKey]);

  const scaffoldedChord = (() => {
    if (mode !== 'chords' || !activeChord) return activeChord;
    if (scaffoldLevel === 1) return { ...activeChord, fingers: Array(6).fill(0) as Finger[] };
    if (scaffoldLevel === 2) return undefined;
    return activeChord;
  })();

  const identifiedNotesRaw = identifiedFrets.map((f, strIdx) => f !== -1 ? getFretNote(strIdx, f).replace(/[0-9]/g, '') : null).filter((n): n is string => n !== null);
  const uniqueNotes: string[] = Array.from(new Set(identifiedNotesRaw));
  const identifiedChordNames = uniqueNotes.length > 0 ? TonalChord.detect(uniqueNotes) as string[] : [];

  const navChords: ChordShape[] =
    mode === 'identify' && identifiedChordNames.length > 0
      ? getNavigationChords(identifiedChordNames[0])
      : [];
  const navIdx = navChords.findIndex(c =>
    c.frets.every((f, i) => f === identifiedFrets[i])
  );

  const frettedNotes = identifiedFrets.filter(f => f !== -1);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : -1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : -1;
  const canShiftDown = minFret > 0;
  const canShiftUp   = maxFret >= 0 && maxFret < 15;

  function shiftFrets(delta: number) {
    setIdentifiedFrets(prev => prev.map(f => f === -1 ? -1 : Math.max(0, f + delta)));
  }

  const activeChordNotes: string[] = mode === 'chords' && activeChord
    ? activeChord.frets
        .map((fret, strIdx) => fret !== -1 ? getFretNote(strIdx, fret) : null)
        .filter((n): n is string => n !== null)
    : [];

  const identifiedNotesWithOctaves: string[] = identifiedFrets
    .map((f, strIdx) => f !== -1 ? getFretNote(strIdx, f) : null)
    .filter((n): n is string => n !== null);

  const pianoNotes = mode === 'chords' ? activeChordNotes : identifiedNotesWithOctaves;

  const handleFretClick = (str: number, fret: number) => {
     if (mode === 'identify') {
        setIdentifiedFrets(prev => {
           const next = [...prev];
           if (next[str] === fret) {
              next[str] = -1; // toggle off
           } else {
              next[str] = fret;
           }
           return next;
        });
        import('../lib/audio').then(m => m.playNote(getFretNote(str, fret), sustain));
     } else {
        import('../lib/audio').then(m => m.playNote(getFretNote(str, fret), sustain));
     }
  };

  useEffect(() => {
    import('../lib/audio').then(m => m.setAudioTuning(currentTuning));
  }, [currentTuning]);

  useEffect(() => {
    setEffects(fx);
  }, [fx]);

  // Refs — written every render so effects always read the latest value without being in dep arrays
  const modeRef = React.useRef(mode); modeRef.current = mode;
  const activeChordRef = React.useRef(activeChord); activeChordRef.current = activeChord;
  const activeScaleRef = React.useRef(activeScale); activeScaleRef.current = activeScale;
  const scaleFretRangeRef = React.useRef(scaleFretRange); scaleFretRangeRef.current = scaleFretRange;
  const identifiedFretsRef = React.useRef(identifiedFrets); identifiedFretsRef.current = identifiedFrets;
  const seqStepsRef = React.useRef(seqSteps); seqStepsRef.current = seqSteps;
  const seqScaleFretsRef = React.useRef(seqScaleFrets); seqScaleFretsRef.current = seqScaleFrets;
  const seqStepDurationsRef = React.useRef(seqStepDurations); seqStepDurationsRef.current = seqStepDurations;
  const seqNumStepsRef = React.useRef(seqNumSteps); seqNumStepsRef.current = seqNumSteps;
  const arpeggioTempoRef = React.useRef(arpeggioTempo); arpeggioTempoRef.current = arpeggioTempo;
  const sustainRef = React.useRef(sustain); sustainRef.current = sustain;
  const drumsEnabledRef = React.useRef(drumsEnabled); drumsEnabledRef.current = drumsEnabled;
  const arpDirectionRef = React.useRef(arpDirection); arpDirectionRef.current = arpDirection;
  const metronomeEnabledRef = React.useRef(metronomeEnabled); metronomeEnabledRef.current = metronomeEnabled;

  const getScaleNotesForString = (strIdx: number) => {
      const notes: { fret: number, note: string }[] = [];
      if (!activeScale) return notes;
      
      let minFret = scaleFretRange.length === 2 ? scaleFretRange[0] : 0;
      let maxFret = scaleFretRange.length === 2 ? scaleFretRange[1] : 15;
      
      for (let f = minFret; f <= maxFret; f++) {
         const noteStr = getFretNote(strIdx, f);
         const noteJustName = noteStr.replace(/[0-9]/g, '');
         if (activeScale.notes.includes(noteJustName as any)) {
            notes.push({ fret: f, note: noteStr });
         }
      }
      return notes;
  };

  const getScaleNotesInRange = () => {
      const notes: { stringIdx: number, fretIdx: number, note: string }[] = [];
      let minFret = scaleFretRange.length === 2 ? scaleFretRange[0] : 0;
      let maxFret = scaleFretRange.length === 2 ? scaleFretRange[1] : 15;
      
      if (!activeScale) return notes;
      
      for (let s = 0; s < 6; s++) {
         for (let f = minFret; f <= maxFret; f++) {
            const noteStr = getFretNote(s, f);
            const noteJustName = noteStr.replace(/[0-9]/g, '');
            if (activeScale.notes.includes(noteJustName as any)) {
               notes.push({ stringIdx: s, fretIdx: f, note: noteStr });
            }
         }
      }
      return notes;
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (arpPlaying && modeRef.current === 'scales' && activeScaleRef.current) {
      const currentScale = activeScaleRef.current;
      const range = scaleFretRangeRef.current;
      const dir = arpDirectionRef.current;
      const tempo = arpeggioTempoRef.current;
      const minFret = range.length === 2 ? range[0] : 0;
      const maxFret = range.length === 2 ? range[1] : 15;
      const scaleNotes: { stringIdx: number; fretIdx: number; note: string }[] = [];
      for (let s = 0; s < 6; s++) {
        for (let f = minFret; f <= maxFret; f++) {
          const noteStr = getFretNote(s, f);
          if (currentScale.notes.includes(noteStr.replace(/[0-9]/g, '') as any)) {
            scaleNotes.push({ stringIdx: s, fretIdx: f, note: noteStr });
          }
        }
      }
      if (scaleNotes.length === 0) { setCurrentArpIdx(-1); return; }
      let orderedNotes = [...scaleNotes];
      if (dir === 'down') orderedNotes.reverse();
      else if (dir === 'up-down') orderedNotes = [...scaleNotes, ...[...scaleNotes].reverse().slice(1, -1)];
      const msPerBeat = (60 / tempo) * 500;
      interval = setInterval(() => {
        setCurrentArpIdx(prev => {
          const nextIdx = (prev + 1) % orderedNotes.length;
          const noteToPlay = orderedNotes[nextIdx].note;
          import('../lib/audio').then(m => {
            m.playNote(noteToPlay, sustainRef.current);
            if (drumsEnabledRef.current) {
              const beatId = nextIdx % 8;
              if (beatId === 0 || beatId === 4) m.playKick();
              if (beatId === 2 || beatId === 6) m.playSnare();
            }
            if (metronomeEnabledRef.current) {
              if (nextIdx % 2 === 0) m.playClick(nextIdx % 8 === 0);
            }
          });
          return nextIdx;
        });
      }, msPerBeat);
    } else {
      setCurrentArpIdx(-1);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [arpPlaying]);

  useEffect(() => {
    if (seqTimerRef.current) { clearTimeout(seqTimerRef.current); seqTimerRef.current = null; }

    if (!seqPlaying) {
      setCurrentStep(-1);
      seqStepIdxRef.current = 0;
      return;
    }

    const SEQ_DUR_MULT: Record<string, number> = { '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4 };

    seqStepIdxRef.current = 0;
    const scheduleNext = () => {
      const step = seqStepIdxRef.current;
      const m_mode = modeRef.current;
      const m_activeChord = activeChordRef.current;
      const m_identifiedFrets = identifiedFretsRef.current;
      const m_seqSteps = seqStepsRef.current;
      const m_activeScale = activeScaleRef.current;
      const m_scaleFretRange = scaleFretRangeRef.current;
      const m_seqScaleFrets = seqScaleFretsRef.current;
      const m_sustain = sustainRef.current;
      const m_seqStepDurations = seqStepDurationsRef.current;
      const m_seqNumSteps = seqNumStepsRef.current;
      const m_arpeggioTempo = arpeggioTempoRef.current;
      const m_drumsEnabled = drumsEnabledRef.current;

      setCurrentStep(step);

      const notesToPlay: string[] = [];
      if (m_mode === 'chords' && m_activeChord) {
        for (let s = 0; s < 6; s++) {
          if (m_seqSteps[s][step]) {
            const fret = m_activeChord.frets[s];
            notesToPlay.push(fret !== -1 ? getFretNote(s, fret) : getFretNote(s, 0));
          }
        }
      } else if (m_mode === 'identify') {
        for (let s = 0; s < 6; s++) {
          if (m_seqSteps[s][step]) {
            const fret = m_identifiedFrets[s];
            notesToPlay.push(fret !== -1 ? getFretNote(s, fret) : getFretNote(s, 0));
          }
        }
      } else if (m_mode === 'scales' && m_activeScale) {
        for (let s = 0; s < 6; s++) {
          if (m_seqSteps[s][step]) {
            const overrideFret = m_seqScaleFrets[s][step];
            if (overrideFret !== -1) {
              notesToPlay.push(getFretNote(s, overrideFret));
            } else {
              const minFret = m_scaleFretRange.length === 2 ? m_scaleFretRange[0] : 0;
              const maxFret = m_scaleFretRange.length === 2 ? m_scaleFretRange[1] : 15;
              for (let f = minFret; f <= maxFret; f++) {
                const noteStr = getFretNote(s, f);
                if (m_activeScale.notes.includes(noteStr.replace(/[0-9]/g, '') as any)) {
                  notesToPlay.push(getFretNote(s, f));
                  break;
                }
              }
            }
          }
        }
      }

      if (notesToPlay.length > 0) {
        import('../lib/audio').then(m => m.playStrum(notesToPlay, m_sustain, 'down'));
      }
      if (m_drumsEnabled) {
        import('../lib/audio').then(m => {
          if (step === 0 || step === 8) m.playKick();
          if (step === 4 || step === 12) m.playSnare();
        });
      }

      const dur = m_seqStepDurations[step] ?? '16n';
      const delayMs = (60 / m_arpeggioTempo) * (SEQ_DUR_MULT[dur] ?? 0.25) * 1000;
      seqStepIdxRef.current = (step + 1) % m_seqNumSteps;
      seqTimerRef.current = setTimeout(scheduleNext, delayMs);
    };

    scheduleNext();
    return () => { if (seqTimerRef.current) clearTimeout(seqTimerRef.current); };
  }, [seqPlaying]);

  const toggleStep = (stringIdx: number, stepIdx: number) => {
    const newSteps = [...seqSteps];
    newSteps[stringIdx] = [...newSteps[stringIdx]];
    newSteps[stringIdx][stepIdx] = !newSteps[stringIdx][stepIdx];
    setSeqSteps(newSteps);
    if (newSteps[stringIdx][stepIdx]) {
        if (mode === 'chords' && activeChord) {
           const fret = activeChord.frets[stringIdx];
           if (fret !== -1) import('../lib/audio').then(m => m.playNote(getFretNote(stringIdx, fret), sustain));
           else import('../lib/audio').then(m => m.playNote(getFretNote(stringIdx, 0), sustain));
        } else if (mode === 'scales' && activeScale) {
           let minFret = scaleFretRange.length === 2 ? scaleFretRange[0] : 0;
           let maxFret = scaleFretRange.length === 2 ? scaleFretRange[1] : 15;
           let foundFret = -1;
           for (let f = minFret; f <= maxFret; f++) {
              const noteStr = getFretNote(stringIdx, f);
              const noteJustName = noteStr.replace(/[0-9]/g, '');
              if (activeScale.notes.includes(noteJustName as any)) {
                 foundFret = f;
                 break;
              }
           }
           if (foundFret !== -1) import('../lib/audio').then(m => m.playNote(getFretNote(stringIdx, foundFret), sustain));
           else import('../lib/audio').then(m => m.playNote(getFretNote(stringIdx, 0), sustain));
        }
    }
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        await initAudio();
        const stringMap: Record<string, number> = {
          '1': 5, // high E
          '2': 4, // B
          '3': 3, // G
          '4': 2, // D
          '5': 1, // A
          '6': 0  // low E
        };
        const stringIdx = stringMap[e.key];
        let noteToPlay = "";
        
        if (mode === 'chords' && activeChord) {
           const fret = activeChord.frets[stringIdx];
           if (fret !== -1) noteToPlay = getFretNote(stringIdx, fret);
        } else {
           noteToPlay = getFretNote(stringIdx, 0); // open string
        }
        
        if (noteToPlay) {
           playNote(noteToPlay, sustain);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, activeChord, sustain]);

  const handleStrum = async () => {
    await initAudio();
    if (mode === 'chords' && activeChord) {
       const notesToPlay = activeChord.frets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
       playStrum(notesToPlay, sustain, strumDirection);
    } else if (mode === 'identify') {
       const notesToPlay = identifiedFrets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
       playStrum(notesToPlay, sustain, strumDirection);
    }
  };

  const handleArpeggio = async () => {
    await initAudio();
    if (mode === 'chords' && activeChord) {
       const notesToPlay = activeChord.frets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
       playArpeggio(notesToPlay, arpeggioTempo, sustain);
    } else if (mode === 'identify') {
       const notesToPlay = identifiedFrets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
       playArpeggio(notesToPlay, arpeggioTempo, sustain);
    } else if (mode === 'scales' && activeScale) {
        playStrum([getFretNote(0, 0)]); // Placeholder
    }
  };

  const applySeqPreset = (name: string) => {
    const grid = Array.from({ length: 6 }, () => Array(16).fill(false)) as boolean[][];
    let durs = Array(16).fill('16n') as string[];
    let num = 8;
    const mark = (stringOrder: number[], stepDur: string) => {
      stringOrder.forEach((s, step) => { grid[s][step] = true; });
      durs = Array(16).fill(stepDur);
      num = stringOrder.length;
    };
    if (name === 'Ascending')         mark([0,1,2,3,4,5,4,3], '8n');
    else if (name === 'Descending')   mark([5,4,3,2,1,0,1,2], '8n');
    else if (name === 'Travis Pick')  mark([0,3,1,4,0,3,1,4], '8n');
    else if (name === 'Banjo Roll')   mark([3,4,5,3,4,5,3,4], '16n');
    else if (name === 'P-i-m-a')      mark([0,2,3,5,0,2,3,5], '8n');
    else if (name === 'Full Strum') {
      num = 4; durs = Array(16).fill('4n');
      for (let step = 0; step < 4; step++) for (let s = 0; s < 6; s++) grid[s][step] = true;
    } else if (name === 'Bass + Chord') {
      // step 0: bass (string 0); steps 1-3: upper strings (2,3,4,5)
      num = 4; durs = Array(16).fill('4n');
      grid[0][0] = true;
      [2,3,4,5].forEach(s => { grid[s][1] = true; grid[s][3] = true; });
      grid[0][2] = true;
    }
    setSeqSteps(grid);
    setSeqStepDurations(durs);
    setSeqNumSteps(num);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {addedToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-brand-ink text-brand-bg text-sm px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity">
          {addedToast}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-surface p-6 rounded-xl border border-brand-line">
        <div>
           <h1 className="text-2xl font-sans font-bold tracking-tight text-brand-ink">Reference Dictionary</h1>
           <p className="text-brand-secondary mt-1">Explore and master chords, scales, and the CAGED framework.</p>
        </div>
        
        <div className="flex bg-brand-sidebar p-1 rounded-lg">
           <button 
             onClick={() => {
               if (isStandardTuning) setMode('chords');
             }}
             disabled={!isStandardTuning}
             title={isStandardTuning ? 'Browse standard-tuning chord shapes' : 'Chord browsing is available only in Standard tuning'}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${!isStandardTuning ? 'text-brand-secondary/40 cursor-not-allowed' : mode === 'chords' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
           >
             Chords (CAGED)
           </button>
           <button 
             onClick={() => setMode('scales')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'scales' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
           >
             Scales
           </button>
           <button
             onClick={() => setMode('identify')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'identify' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
           >
             Identify
           </button>
           <button
             onClick={() => setMode('intervals')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'intervals' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
           >
             Intervals
           </button>
           <button
             onClick={() => setMode('theory')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'theory' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
           >
             Theory
           </button>
        </div>
      </div>

      {mode === 'theory' && (
        <TheoryReference
          onOpenInChords={handleOpenInChords}
          onExploreInIdentify={handleExploreFromTheory}
          onAddToProgression={handleAddToProgressionFromTheory}
        />
      )}

      {mode !== 'theory' && <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Controls Sidebar */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-brand-sidebar p-6 rounded-xl border border-brand-line space-y-4">
              <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Tone & Instrument</h3>
              <select 
                onChange={(e) => {
                  import('../lib/audio').then(m => m.setInstrument(e.target.value));
                }}
                className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
              >
                <option value="acoustic_guitar_steel">Acoustic Steel</option>
                <option value="acoustic_guitar_nylon">Acoustic Nylon</option>
                <option value="electric_guitar_clean">Electric Clean</option>
                <option value="overdriven_guitar">Overdriven (Lead)</option>
                <option value="distortion_guitar">Distortion</option>
              </select>

              <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-2">Tuning</h3>
              <select 
                value={currentTuning.name}
                onChange={(e) => setCurrentTuning(TUNINGS[e.target.value])}
                className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
              >
                {Object.keys(TUNINGS).map(tuningName => (
                  <option key={tuningName} value={tuningName}>{tuningName}</option>
                ))}
              </select>
              {!isStandardTuning && (
                <p className="text-[10px] text-orange-600 font-bold leading-tight">
                  Chord browsing is available only in Standard tuning. Scales and Identify stay tuning-aware in {currentTuning.name}.
                </p>
              )}
           </div>
           
           <div className="bg-brand-sidebar p-6 rounded-xl border border-brand-line space-y-4">
              <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Root Note</h3>
              <div className="flex flex-wrap gap-2">
                 {['C', 'A', 'G', 'E', 'D', 'F', 'B'].map((note) => (
                    <button
                      key={note}
                      onClick={() => { setSelectedKey(note as Note); setSelectedChordIdx(0); }}
                      className={`w-10 h-10 rounded-full font-mono flex items-center justify-center transition-all ${selectedKey === note ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-secondary hover:bg-brand-bg hover:text-brand-ink border border-brand-line'}`}
                    >
                      {note}
                    </button>
                 ))}
                 <div className="w-full h-px bg-brand-line my-2" />
                 {/* Accidental Roots could be added here */}
              </div>

              {mode === 'chords' && (
                 <>
                    <div className="flex items-center justify-between pt-4">
                      <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Variations</h3>
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => setChordSortOrder(chordSortOrder === 'asc' ? null : 'asc')}
                          title="Sort low to high"
                          className={cn('px-2 py-0.5 rounded text-xs font-bold transition-colors', chordSortOrder === 'asc' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:text-brand-ink border border-transparent hover:border-brand-line')}
                        >↑ Low</button>
                        <button
                          onClick={() => setChordSortOrder(chordSortOrder === 'desc' ? null : 'desc')}
                          title="Sort high to low"
                          className={cn('px-2 py-0.5 rounded text-xs font-bold transition-colors', chordSortOrder === 'desc' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:text-brand-ink border border-transparent hover:border-brand-line')}
                        >↓ High</button>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(['all', 'open', 'low', 'high'] as PositionBucket[]).map(bucket => (
                        <button
                          key={bucket}
                          onClick={() => setPositionFilter(bucket)}
                          className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', positionFilter === bucket ? 'bg-brand-active text-white' : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink')}
                        >{POSITION_LABELS[bucket]}</button>
                      ))}
                    </div>
                    <div className="space-y-2">
                       {sortedChordEntries.length > 0 ? sortedChordEntries.map(({ chord, origIdx }) => (
                          <button
                            key={origIdx}
                            onClick={() => setSelectedChordIdx(origIdx)}
                            className={`block w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${selectedChordIdx === origIdx ? 'bg-[#F2F5F3] text-brand-primary font-medium border border-brand-primary' : 'text-brand-ink bg-brand-surface hover:bg-brand-bg border border-brand-line'}`}
                          >
                             {chord.name}
                          </button>
                       )) : (
                          <p className="text-sm text-brand-secondary italic">No basic dictionary entries yet for this root.</p>
                       )}
                    </div>
                 </>
              )}

              {mode === 'scales' && (
                  <>
                    <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-4">Scale View</h3>
                    <div className="space-y-2">
                      <div className="flex gap-1 flex-wrap">
                        {([
                          { id: 'full', label: 'Full Neck', disabled: false },
                          { id: 'position', label: 'CAGED', disabled: false },
                          { id: 'box', label: 'Box', disabled: !boxViewSupported },
                          { id: 'threeNps', label: '3NPS', disabled: !threeNpsSupported },
                          { id: 'diagonal', label: 'Pathway', disabled: !diagonalSupported },
                        ] as { id: ScaleViewMode; label: string; disabled: boolean }[]).map(view => (
                          <button
                            key={view.id}
                            onClick={() => { if (!view.disabled) setScaleViewMode(view.id); }}
                            disabled={view.disabled}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium transition-colors border',
                              scaleViewMode === view.id
                                ? 'bg-brand-active text-white border-brand-active'
                                : 'bg-brand-bg border-brand-line text-brand-secondary hover:text-brand-ink',
                              view.disabled && 'opacity-40 cursor-not-allowed hover:text-brand-secondary'
                            )}
                          >
                            {view.label}
                          </button>
                        ))}
                      </div>

                      {scaleViewMode === 'position' && (
                        <>
                          <select
                            value={scalePositionSelection}
                            onChange={(e) => {
                              setScalePositionSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scalePositionOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            CAGED view: root-relative neck regions organized by connected chord-shape positions.
                          </p>
                        </>
                      )}

                      {scaleViewMode === 'box' && boxViewSupported && (
                        <>
                          <select
                            value={scaleBoxSelection}
                            onChange={(e) => {
                              setScaleBoxSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scaleBoxOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            Box view: strict per-string pentatonic and blues box shapes, using the matching major- or minor-family layout.
                          </p>
                        </>
                      )}

                      {scaleViewMode === 'threeNps' && threeNpsSupported && (
                        <>
                          <select
                            value={scaleThreeNpsSelection}
                            onChange={(e) => {
                              setScaleThreeNpsSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scaleThreeNpsOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            3NPS view: strict three-notes-per-string patterns for supported 7-note scales, useful for more linear neck movement.
                          </p>
                        </>
                      )}

                      {scaleViewMode === 'diagonal' && diagonalSupported && (
                        <>
                          <select
                            value={scaleDiagonalSelection}
                            onChange={(e) => {
                              setScaleDiagonalSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scaleDiagonalOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            Pathway view: ascending cross-neck routes for supported 7-note scales. These are movement maps for escaping box-shaped playing, not strict note-by-note scale exercises.
                          </p>
                          <div className="rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[11px] leading-relaxed">
                            <p className="font-semibold text-brand-ink">How to use it</p>
                            <p className="text-brand-secondary/80">Start on the lowest highlighted note and move upward in pitch through the shown route. Treat it as a suggested pathway across the neck, not a fixed published fingering.</p>
                          </div>
                        </>
                      )}

                      {scaleViewMode === 'full' && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Full Neck view: shows all note locations for the selected scale across the visible fretboard.
                        </p>
                      )}

                      {!boxViewSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Box view currently supports Minor Pentatonic, Major Pentatonic, Minor Blues, and Major Blues.
                        </p>
                      )}

                      {!threeNpsSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          3NPS view is currently available for 7-note scales such as major, natural minor, modes, harmonic minor, melodic minor, and phrygian dominant.
                        </p>
                      )}

                      {!diagonalSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Pathway view is currently available for 7-note scales such as major, natural minor, modes, harmonic minor, melodic minor, and phrygian dominant.
                        </p>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-4">Tone Overlay</h3>
                    <div className="space-y-2">
                      <select
                        value={scaleOverlayMode}
                        onChange={(e) => setScaleOverlayMode(e.target.value as ScaleOverlayMode)}
                        className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                      >
                        <option value="all">All Scale Tones</option>
                        <option value="roots">Roots Only</option>
                        <option value="chordTones">Chord Tones (1, 3/b3, 5)</option>
                        <option value="arpeggio">Arpeggio Focus (1, 3/b3, 5, 7/b7)</option>
                      </select>
                      <p className="text-[10px] text-brand-secondary/70 leading-tight">
                        Tone Overlay narrows the visible notes to the root, implied chord tones, or arpeggio tones built from the selected scale root.
                      </p>
                      {scaleOverlaySummary && (
                        <div className="rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[11px] leading-relaxed">
                          <p className="font-semibold text-brand-ink">{scaleOverlaySummary.title}</p>
                          <p className="text-brand-secondary/80">{scaleOverlaySummary.detail}</p>
                          <p className="text-brand-secondary/80"><span className="font-medium text-brand-ink">Degrees:</span> {scaleOverlaySummary.degrees}</p>
                          <p className="text-brand-secondary/80"><span className="font-medium text-brand-ink">Notes:</span> {scaleOverlaySummary.notes}</p>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-4">Pattern Types</h3>
                    {/* Category tabs */}
                    <div className="flex gap-1 flex-wrap">
                      {(['All', 'Pentatonic', 'Blues', 'Modes', 'Minor', 'Symmetric'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setScaleCategory(cat)}
                          className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', scaleCategory === cat ? 'bg-brand-active text-white' : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink')}
                        >{cat}</button>
                      ))}
                    </div>
                    <div className="space-y-2">
                       {COMMON_SCALES
                         .map((scaleDef, idx) => ({ scaleDef, idx }))
                         .filter(({ scaleDef }) => scaleCategory === 'All' || scaleDef.category === scaleCategory)
                         .map(({ scaleDef, idx }) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedScaleIdx(idx)}
                            className={`block w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${selectedScaleIdx === idx ? 'bg-[#F2F5F3] text-brand-active font-medium border border-brand-primary border-l-4' : 'text-brand-ink bg-brand-surface hover:bg-brand-bg border border-brand-line'}`}
                          >
                             {scaleDef.name}
                          </button>
                       ))}
                    </div>
                 </>
              )}

              {mode === 'identify' && (
                 <>
                    <div>
                       <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-2">Chord Identifier</h3>
                       <p className="text-xs text-brand-secondary mb-4">Click on the fretboard dots to select notes. We will identify the chord being formed.</p>
                       <button
                         onClick={() => setIdentifiedFrets([-1,-1,-1,-1,-1,-1])}
                         className="w-full py-2 bg-brand-surface border border-brand-line text-brand-ink rounded-md hover:border-brand-primary text-sm font-medium transition-colors"
                       >
                         Clear Fretboard
                       </button>
                       {navChords.length > 1 && (
                         <div className="mt-3 space-y-1">
                           <p className="text-xs font-medium text-brand-secondary">Other positions</p>
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => {
                                 const prev = navIdx <= 0 ? navChords.length - 1 : navIdx - 1;
                                 setIdentifiedFrets([...navChords[prev].frets]);
                               }}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors"
                             >
                               ◀ Prev
                             </button>
                             <span className="text-xs tabular-nums text-brand-secondary min-w-[36px] text-center">
                               {navIdx >= 0 ? `${navIdx + 1}/${navChords.length}` : `—/${navChords.length}`}
                             </span>
                             <button
                               onClick={() => {
                                 const next = navIdx < 0 || navIdx >= navChords.length - 1 ? 0 : navIdx + 1;
                                 setIdentifiedFrets([...navChords[next].frets]);
                               }}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors"
                             >
                               Next ▶
                             </button>
                           </div>
                         </div>
                       )}

                       {/* Shape shift — slide every fretted note up/down by one fret */}
                       {frettedNotes.length > 0 && (
                         <div className="mt-3 space-y-1">
                           <p className="text-xs font-medium text-brand-secondary">Slide shape</p>
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => shiftFrets(-1)}
                               disabled={!canShiftDown}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                               title="Shift shape one fret toward the nut"
                             >
                               ◀ Down
                             </button>
                             <span className="text-xs tabular-nums text-brand-secondary min-w-[36px] text-center">
                               {minFret > 0 ? `fret ${minFret}` : 'open'}
                             </span>
                             <button
                               onClick={() => shiftFrets(1)}
                               disabled={!canShiftUp}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                               title="Shift shape one fret toward the body"
                             >
                               Up ▶
                             </button>
                           </div>
                           <p className="text-[10px] text-brand-secondary/60 leading-tight">
                             Moves all fretted notes together — same shape, new chord
                           </p>
                         </div>
                       )}
                    </div>
                 </>
              )}

              {mode === 'intervals' && (
                <>
                  <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-4">Interval</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERVALS.map(({ name, short, semitones }) => (
                      <button
                        key={semitones}
                        onClick={() => setSelectedInterval(semitones)}
                        title={name}
                        className={cn('px-2.5 py-1 rounded text-xs font-bold transition-colors',
                          selectedInterval === semitones
                            ? 'bg-brand-primary text-white'
                            : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
                        )}
                      >
                        <span>{short}</span>
                        <span className="ml-1 opacity-75">· {semitones}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="w-full h-px bg-brand-line my-4" />
              
              <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Audio Engine</h3>
              
              <div className="bg-brand-bg rounded-lg p-3 border border-brand-line space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Tone</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.tone} onChange={(e) => setFx({...fx, tone: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Reverb</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.reverb} onChange={(e) => setFx({...fx, reverb: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Chorus</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.chorus || 0} onChange={(e) => setFx({...fx, chorus: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Flanger</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.flanger || 0} onChange={(e) => setFx({...fx, flanger: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Delay Lvl</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.delay} onChange={(e) => setFx({...fx, delay: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Delay Sync</label>
                     <select 
                       value={fx.delayTime} 
                       onChange={(e) => setFx({...fx, delayTime: e.target.value})}
                       className="w-full p-1 text-[10px] border border-brand-line rounded bg-brand-surface text-brand-ink outline-none"
                     >
                       <option value="4n">Quarter Note</option>
                       <option value="8n">8th Note</option>
                       <option value="8n.">Dotted 8th</option>
                       <option value="16n">16th Note</option>
                       <option value="2n">Half Note</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Overdrive</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.overdrive} onChange={(e) => setFx({...fx, overdrive: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Fuzz</label>
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={fx.fuzz} onChange={(e) => setFx({...fx, fuzz: parseFloat(e.target.value)})}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Sustain ({sustain}s)</label>
                     <input 
                       type="range" min="0.5" max="4" step="0.5" 
                       value={sustain} onChange={(e) => setSustain(parseFloat(e.target.value))}
                       className="w-full accent-brand-primary h-1"
                     />
                   </div>
                 </div>

                 {mode === 'chords' && (
                    <div className="pt-2 border-t border-brand-line">
                       <label className="text-[10px] font-semibold text-brand-secondary uppercase block mb-1">Strum / Arp Style</label>
                       <div className="flex flex-col gap-2">
                         <select 
                           value={strumDirection} 
                           onChange={(e) => setStrumDirection(e.target.value as any)}
                           className="w-full p-1.5 text-xs border border-brand-line rounded bg-brand-surface text-brand-ink outline-none"
                         >
                           <option value="down">Downward Strum ↓</option>
                           <option value="up">Upward Strum ↑</option>
                           <option value="down-up">Down then Up ↓↑</option>
                           <option value="up-down">Up then Down ↑↓</option>
                         </select>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] text-brand-secondary font-mono w-14">BPM:{arpeggioTempo}</span>
                           <input 
                             type="range" min="60" max="240" step="10" 
                             value={arpeggioTempo} onChange={(e) => setArpeggioTempo(parseInt(e.target.value))}
                             className="flex-1 accent-brand-primary h-1"
                           />
                         </div>
                         <label className="flex items-center gap-2 mt-2 text-xs font-bold text-brand-secondary cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={drumsEnabled}
                             onChange={(e) => setDrumsEnabled(e.target.checked)}
                             className="accent-brand-primary"
                           />
                           Enable Drum Track (for sequencer)
                         </label>
                       </div>
                    </div>
                 )}
              </div>

           </div>
        </div>

        {/* Fretboard Display */}
        <div className="lg:col-span-3">
           <div id="print-area" className="bg-brand-surface p-6 md:p-10 print:p-0 print:border-none rounded-xl border border-brand-line flex flex-col items-center">
              
              <div className="w-full flex justify-between items-center mb-10 print:mb-4">
                 <h2 className="text-3xl font-serif text-brand-ink">
                    {mode === 'chords' ? activeChord?.name
                      : mode === 'scales' ? activeScale?.name
                      : mode === 'intervals' ? `${selectedKey} — ${INTERVALS.find(i => i.semitones === selectedInterval)?.name ?? ''}`
                      : identifiedChordNames.length > 0 ? identifiedChordNames.join(' or ') : 'Select notes to identify chord'}
                 </h2>
                 
                 {((mode === 'chords' && activeChord) || mode === 'identify') && (
                    <div className="flex gap-3 print:hidden flex-wrap">
                       <button onClick={handleStrum} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <Volume2 size={16} /> Strum
                       </button>
                       <button onClick={handleArpeggio} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <ListMusic size={16} /> Arpeggiate
                       </button>
                       <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <Printer size={16} /> Print Diagram
                       </button>
                       {mode === 'chords' && activeChord && (
                         <>
                           <button
                             onClick={() => handleAddToProgression(activeChord)}
                             className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                             title="Add to first progression"
                           >
                             + Progression
                           </button>
                           <button
                             onClick={() => navigate('/ear-training')}
                             className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                             title="Practice chord identification in Ear Training"
                           >
                             Ear Train →
                           </button>
                           <button
                             onClick={() => {
                               setMode('identify');
                               setIdentifiedFrets([...activeChord.frets]);
                             }}
                             className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                             title="Load into Identifier to experiment"
                           >
                             Explore →
                           </button>
                         </>
                       )}
                       {mode === 'identify' && identifiedChordNames.length > 0 && (
                         <>
                           <button
                             onClick={() => handleAddToProgression({
                               name: identifiedChordNames[0],
                               frets: identifiedFrets,
                               fingers: identifiedFrets.map(f => (f === -1 ? -1 : 0)) as Finger[],
                             })}
                             className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                             title="Add identified chord to progression"
                           >
                             + Progression
                           </button>
                           {isStandardTuning && navChords.length > 0 && (() => {
                             const target = navIdx >= 0 ? navChords[navIdx] : navChords[0];
                             const base = identifiedChordNames[0].split('/')[0];
                             const m = base.match(/^([A-G][#b])(.*)/) ?? base.match(/^([A-G])(.*)/);
                             if (!m) return null;
                             const flatToSharp: Record<string, string> = { Db:'C#', Eb:'D#', Fb:'E', Gb:'F#', Ab:'G#', Bb:'A#', Cb:'B' };
                             const root = (flatToSharp[m[1]] ?? m[1]) as Note;
                             const origIdx = (COMMON_CHORDS[root] ?? []).findIndex(c => c.name === target.name);
                             if (origIdx < 0) return null;
                             return (
                               <button
                                 onClick={() => { setSelectedKey(root); setSelectedChordIdx(origIdx); setMode('chords'); }}
                                 className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                                 title="Find this chord in the Dictionary"
                               >
                                 View in Chords →
                               </button>
                             );
                           })()}
                         </>
                       )}
                    </div>
                 )}
                 {mode === 'scales' && activeScale && (
                    <div className="flex gap-3 print:hidden">
                       <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <Printer size={16} /> Print Diagram
                       </button>
                       <button
                         onClick={() => navigate(`/ear-training?mode=scaleDrill&root=${encodeURIComponent(selectedKey)}&scale=${encodeURIComponent(activeScaleBase.name)}&position=full&tab=noteName`)}
                         className="px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm"
                         title="Open Ear Training with this scale ready to drill"
                       >
                         Drill This in Ear Training
                       </button>
                    </div>
                 )}
              </div>
              {mode === 'intervals' && (() => {
                const activeInterval = INTERVALS.find(i => i.semitones === selectedInterval);
                if (!activeInterval) return null;
                return (
                  <>
                    <p className="w-full text-center text-sm text-brand-secondary -mt-6 mb-4 print:hidden">
                      {activeInterval.short} = {formatSemitoneLabel(activeInterval.semitones)} from the root note
                    </p>

                    {/* Collapsible theory explainer */}
                    <div className="w-full mb-6 print:hidden">
                      <button
                        onClick={() => setShowIntervalInfo(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-secondary hover:text-brand-ink transition-colors mx-auto"
                      >
                        {showIntervalInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        Why don't interval names match semitone counts?
                      </button>

                      {showIntervalInfo && (
                        <div className="mt-3 p-4 rounded-lg bg-brand-surface border border-brand-line text-sm space-y-4 max-w-2xl mx-auto">
                          <p className="text-brand-secondary leading-relaxed">
                            Interval names count <strong className="text-brand-ink">letter steps</strong> in the major scale (C→D→E…), not semitones.
                            The major scale is <em>unevenly spaced</em> — mostly whole steps (2 semitones) but with half steps at E→F and B→C — so the name number and the semitone count don't line up simply.
                          </p>

                          {/* Major scale step diagram */}
                          <div>
                            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">C Major scale — gaps in semitones</p>
                            <div className="flex items-end gap-0 font-mono text-xs select-none overflow-x-auto">
                              {['C','D','E','F','G','A','B','C'].map((note, i) => (
                                <div key={i} className="flex flex-col items-center">
                                  <span className={`px-2.5 py-1 rounded font-bold ${note === 'C' ? 'text-brand-primary' : 'text-brand-ink'}`}>{note}</span>
                                  {i < 7 && (
                                    <span className={`text-[10px] px-2 ${[2,6].includes(i) ? 'text-amber-500 font-bold' : 'text-brand-secondary'}`}>
                                      {[0,1,3,4,5].includes(i) ? '2' : '1'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-brand-secondary mt-1">Amber = half step (1 semitone). All others = whole step (2 semitones).</p>
                          </div>

                          {/* Interval + inversion table */}
                          <div>
                            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Intervals &amp; inversions — pairs always add to 12</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs font-mono">
                              {[
                                ['m2', 1, 'M7', 11],
                                ['M2', 2, 'm7', 10],
                                ['m3', 3, 'M6',  9],
                                ['M3', 4, 'm6',  8],
                                ['P4', 5, 'P5',  7],
                                ['TT', 6, 'TT',  6],
                              ].map(([a, as_, b, bs]) => (
                                <div key={String(a)} className="col-span-2 grid grid-cols-[2rem_1.5rem_0.5rem_2rem_1.5rem] items-center gap-x-2 py-0.5 border-b border-brand-line/40 last:border-0">
                                  <span className="font-bold text-brand-primary">{a}</span>
                                  <span className="text-brand-secondary">{as_} st</span>
                                  <span className="text-brand-line text-center">↔</span>
                                  <span className="font-bold text-brand-primary">{b}</span>
                                  <span className="text-brand-secondary">{bs} st</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-brand-secondary mt-2">
                              Know your 3rds (3 &amp; 4 st) → you know your 6ths (9 &amp; 8 st) for free. Major inverts to minor and vice versa; Perfect stays Perfect.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {mode === 'scales' && activeScaleBase && (() => {
                const gaps = activeScaleBase.intervals.map((v, i, arr) =>
                  (i === arr.length - 1 ? 12 : arr[i + 1]) - v
                );
                const wh = (n: number) => n === 1 ? 'H' : n === 2 ? 'W' : `${n}`;
                return (
                  <div className="flex items-center gap-1 mb-6 font-mono text-xs select-none flex-wrap print:hidden">
                    {gaps.map((gap, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-brand-line mx-0.5">—</span>}
                        <span className="inline-flex flex-col items-center w-5">
                          <span className="font-bold text-brand-primary">{wh(gap)}</span>
                          <span className="text-brand-secondary">{gap}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}

              {mode === 'chords' && activeChord && (
                <div className="w-full flex items-center gap-2 mb-4 print:hidden">
                  <span className="text-xs text-brand-secondary font-medium mr-1">Practice:</span>
                  {(['Finger', 'Dots', 'Recall'] as const).map((label, idx) => (
                    <button
                      key={label}
                      onClick={() => setScaffoldLevel(idx as 0 | 1 | 2)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded border transition-colors',
                        scaffoldLevel === idx
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="text-xs text-brand-secondary/50 ml-2">
                    {scaffoldLevel === 0 ? 'finger numbers shown' : scaffoldLevel === 1 ? 'positions only' : 'from memory'}
                  </span>
                </div>
              )}

              {mode === 'intervals' ? (
                <IntervalFretboard
                  rootNote={selectedKey}
                  intervalSemitones={selectedInterval}
                  fretsNum={15}
                  onSendToIdentify={(frets) => {
                    setIdentifiedFrets(frets);
                    setMode('identify');
                  }}
                />
              ) : ((mode === 'chords' && activeChord) || (mode === 'scales' && activeScale) || mode === 'identify') ? (
                <>
                  <div className="w-full" onMouseEnter={initAudio}>
                     <Fretboard
                        fretsNum={15}
                        chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: [-1,-1,-1,-1,-1,-1] } : undefined)}
                        showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
                        scale={mode === 'scales' ? displayedScale ?? undefined : undefined}
                        playingNotes={playingNotes}
                        fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
                        scalePositions={mode === 'scales' ? (activeStrictScalePositions ?? dedupedScalePositions) : undefined}
                        onNoteClick={(str) => {
                          // Handled by onFretClick if possible, fallback
                          import('../lib/audio').then(m => m.playNote(str, sustain));
                        }}
                        onFretClick={handleFretClick}
                        tuning={currentTuning}
                     />
                  </div>
                  <p className="text-brand-secondary/70 text-sm mt-8 pb-4 print:hidden text-center">
                     Click any dot to hear the note{mode === 'identify' ? ' and set the fret' : ''}, or use keyboard numbers <strong>1-6</strong> to play individual strings.
                  </p>
                  {(mode === 'chords' || mode === 'identify') && (
                    <div className="w-full mt-2 print:hidden">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary mb-2 text-center">Piano</p>
                      <PianoKeyboard
                        octaveMin={2}
                        octaveMax={5}
                        correctKeys={new Set(pianoNotes)}
                        wrongKey={null}
                        previewKey={null}
                        onKeyClick={() => {}}
                      />
                    </div>
                  )}

                  {/* Related scales (chord mode) */}
                  {mode === 'chords' && relatedScales.length > 0 && (
                    <div className="w-full mt-4 print:hidden">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary mb-2 text-center">Works over these scales</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {relatedScales.map(scaleDef => (
                          <button
                            key={scaleDef.name}
                            onClick={() => { setMode('scales'); setSelectedScaleIdx(COMMON_SCALES.indexOf(scaleDef)); }}
                            className="text-xs px-3 py-1.5 rounded-full border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                          >
                            {selectedKey} {scaleDef.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diatonic chords (scale mode) */}
                  {isStandardTuning && mode === 'scales' && diatonicChords.length > 0 && (
                    <div className="w-full mt-4 print:hidden">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary mb-2 text-center">Diatonic chords</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {diatonicChords.map(chord => {
                          const chordRoot = chord.name.match(/^([A-G][#b]?)/)?.[1] as Note | undefined;
                          return (
                            <button
                              key={chord.name}
                              onClick={() => {
                                if (!chordRoot) return;
                                const idx = (COMMON_CHORDS[chordRoot] ?? []).findIndex(c => c.name === chord.name);
                                setMode('chords');
                                setSelectedKey(chordRoot);
                                if (idx >= 0) setSelectedChordIdx(idx);
                              }}
                              className="text-xs px-3 py-1.5 rounded-full border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                            >
                              {chord.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Arpeggiator for Scales */}
                  {mode === 'scales' && activeScale && (
                     <div className="w-full mt-4 p-6 border border-brand-line rounded-xl bg-brand-bg opacity-100 print:hidden">
                        <div className="flex justify-between items-center">
                           <div>
                              <h3 className="font-bold text-brand-ink">Scale Arpeggiator</h3>
                              <p className="text-xs text-brand-secondary">Play through the scale notes in the selected position.</p>
                           </div>
                           <div className="flex items-center gap-4">
                             <div className="flex flex-col gap-1 items-end">
                               <div className="flex items-center gap-2">
                                  <label className="text-xs font-bold text-brand-secondary">Tempo</label>
                                  <input 
                                     type="range" 
                                     min="60" max="240" 
                                     value={arpeggioTempo} 
                                     onChange={(e) => setArpeggioTempo(Number(e.target.value))}
                                     className="w-24 accent-brand-primary"
                                  />
                                  <span className="text-xs font-mono font-bold text-brand-ink w-8">{arpeggioTempo}</span>
                               </div>
                               <label className="flex items-center gap-2 text-xs font-bold text-brand-secondary cursor-pointer">
                                  <input 
                                     type="checkbox" 
                                     checked={metronomeEnabled}
                                     onChange={(e) => setMetronomeEnabled(e.target.checked)}
                                     className="accent-brand-primary"
                                  />
                                  Metronome
                               </label>
                             </div>
                             
                             <select
                               value={arpDirection}
                               onChange={(e) => setArpDirection(e.target.value as any)}
                               className="p-1.5 text-xs border border-brand-line rounded bg-brand-surface text-brand-ink outline-none"
                             >
                                <option value="up">Sweep Up</option>
                                <option value="down">Sweep Down</option>
                                <option value="up-down">Sweep Up & Down</option>
                             </select>
                             <button 
                               onClick={async () => {
                                  await initAudio();
                                  setArpPlaying(!arpPlaying);
                                  setSeqPlaying(false);
                               }}
                               className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${arpPlaying ? 'bg-brand-active/10 text-brand-active border border-brand-active/30' : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
                             >
                               {arpPlaying ? 'Stop Arp' : 'Play Arp'}
                             </button>
                           </div>
                        </div>
                     </div>
                  )}
                  
                  {/* Sequencer */}
                  {((mode === 'chords' && activeChord) || (mode === 'scales' && activeScale) || mode === 'identify') && (
                     <div className="w-full mt-4 p-6 border border-brand-line rounded-xl bg-brand-bg opacity-100 print:hidden">
                        <div className="flex justify-between items-center mb-4">
                           <div>
                              <h3 className="font-bold text-brand-ink">Arp Sequencer</h3>
                              <p className="text-xs text-brand-secondary">Create picking patterns. Click a duration to cycle it.</p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setSeqNumSteps(n => Math.max(1, n - 1))}
                                    className="w-5 h-5 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-xs"
                                  >−</button>
                                  <span className="text-[10px] font-mono text-brand-secondary w-14 text-center">{seqNumSteps} steps</span>
                                  <button
                                    onClick={() => setSeqNumSteps(n => Math.min(16, n + 1))}
                                    className="w-5 h-5 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-xs"
                                  >+</button>
                                </div>
                                <select
                                  onChange={(e) => { if (e.target.value) { applySeqPreset(e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
                                  className="text-[10px] border border-brand-line rounded px-1 py-0.5 bg-brand-surface text-brand-secondary outline-none"
                                >
                                  <option value="">Preset…</option>
                                  <option>Ascending</option>
                                  <option>Descending</option>
                                  <option>Travis Pick</option>
                                  <option>Banjo Roll</option>
                                  <option>P-i-m-a</option>
                                  <option>Full Strum</option>
                                  <option>Bass + Chord</option>
                                </select>
                                <button className="text-[10px] uppercase font-bold text-brand-primary" onClick={() => {
                                  localStorage.setItem('savedSeq', JSON.stringify({ steps: seqSteps, durations: seqStepDurations, numSteps: seqNumSteps }));
                                }}>Save</button>
                                <button className="text-[10px] uppercase font-bold text-brand-secondary" onClick={() => {
                                   const saved = localStorage.getItem('savedSeq');
                                   if (saved) {
                                     const parsed = JSON.parse(saved);
                                     if (Array.isArray(parsed)) { setSeqSteps(parsed); } // legacy
                                     else { setSeqSteps(parsed.steps); setSeqStepDurations(parsed.durations ?? Array(16).fill('16n')); setSeqNumSteps(parsed.numSteps ?? 16); }
                                   }
                                }}>Load</button>
                                <button className="text-[10px] uppercase font-bold text-red-500" onClick={() => {
                                   setSeqSteps(Array.from({ length: 6 }, () => Array(16).fill(false)));
                                   setSeqStepDurations(Array(16).fill('16n'));
                                }}>Clear</button>
                              </div>
                           </div>
                           <button 
                             onClick={async () => {
                                await initAudio();
                                setSeqPlaying(!seqPlaying);
                                setArpPlaying(false);
                             }}
                             className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${seqPlaying ? 'bg-brand-active/10 text-brand-active border border-brand-active/30' : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
                           >
                             {seqPlaying ? 'Stop Pattern' : 'Play Pattern'}
                           </button>
                        </div>
                        
                        <div className="overflow-x-auto pb-2">
                           <div className="flex flex-col gap-1 min-w-[400px]">
                              {[...seqSteps].reverse().map((row, reversedIdx) => {
                                 const stringIdx = 5 - reversedIdx;
                                 return (
                                 <div key={`string-${stringIdx}`} className="flex items-center gap-1">
                                    <div className="w-10 text-[10px] font-mono text-brand-secondary font-bold text-right pr-2 uppercase">
                                       {['low_e','A','D','G','B','high_e'][stringIdx]}
                                    </div>
                                    {row.slice(0, seqNumSteps).map((active, stepIdx) => {
                                       if (mode === 'scales') {
                                          const available = Array.from(new Set(getScaleNotesForString(stringIdx).map(n => n.fret)))
                                                               .map(f => getScaleNotesForString(stringIdx).find(n => n.fret === f)!);
                                          const val = seqScaleFrets[stringIdx][stepIdx];
                                          return (
                                             <select
                                                key={`step-${stringIdx}-${stepIdx}`}
                                                value={active ? (val === -1 ? (available.length > 0 ? available[0].fret : -1) : val) : -1}
                                                onChange={(e) => {
                                                   const newVal = Number(e.target.value);
                                                   const nextSteps = [...seqSteps];
                                                   nextSteps[stringIdx] = [...nextSteps[stringIdx]];
                                                   nextSteps[stringIdx][stepIdx] = newVal !== -1;
                                                   setSeqSteps(nextSteps);
                                                   const nextFrets = [...seqScaleFrets];
                                                   nextFrets[stringIdx] = [...nextFrets[stringIdx]];
                                                   nextFrets[stringIdx][stepIdx] = newVal;
                                                   setSeqScaleFrets(nextFrets);
                                                   if (newVal !== -1) {
                                                      import('../lib/audio').then(m => m.playNote(getFretNote(stringIdx, newVal), sustain));
                                                   }
                                                }}
                                                className={`flex-1 min-w-0 px-0 h-8 rounded-sm border transition-colors outline-none text-[10px] sm:text-xs font-bold text-center appearance-none ${
                                                   currentStep === stepIdx ? 'border-brand-primary' : 'border-brand-line'
                                                } ${
                                                   active
                                                      ? 'bg-brand-primary text-white shadow-[inset_0_0_8px_rgba(0,0,0,0.2)]'
                                                      : 'bg-brand-surface text-brand-secondary hover:bg-brand-line hover:text-brand-ink/50'
                                                }`}
                                             >
                                                <option value="-1">-</option>
                                                {available.map(n => (
                                                   <option key={n.fret} value={n.fret}>{n.note.replace(/[0-9]/g, '')}</option>
                                                ))}
                                             </select>
                                          );
                                       }
                                       return (
                                          <button
                                             key={`step-${stringIdx}-${stepIdx}`}
                                             onClick={() => toggleStep(stringIdx, stepIdx)}
                                             className={`flex-1 h-8 rounded-sm border transition-colors ${
                                                currentStep === stepIdx ? 'border-brand-primary cursor-default' : 'border-brand-line cursor-pointer'
                                             } ${
                                                active
                                                   ? 'bg-brand-primary shadow-[inset_0_0_8px_rgba(0,0,0,0.2)]'
                                                   : 'bg-brand-surface hover:bg-brand-line/50'
                                             }`}
                                          />
                                       );
                                    })}
                                 </div>
                                 );
                              })}
                              {/* Duration row */}
                              <div className="flex items-center gap-1 mt-1">
                                 <div className="w-10 text-[10px] font-mono text-brand-secondary font-bold text-right pr-2">dur</div>
                                 {Array.from({ length: seqNumSteps }, (_, stepIdx) => {
                                    const dur = seqStepDurations[stepIdx] ?? '16n';
                                    return (
                                       <select
                                          key={stepIdx}
                                          value={dur}
                                          onChange={(e) => {
                                             const d = [...seqStepDurations];
                                             d[stepIdx] = e.target.value;
                                             setSeqStepDurations(d);
                                          }}
                                          className={`flex-1 h-6 rounded-sm border text-[10px] bg-brand-surface cursor-pointer ${
                                             currentStep === stepIdx ? 'border-brand-primary text-brand-primary' : 'border-brand-line text-brand-secondary'
                                          }`}
                                       >
                                          <option value="16n">16</option>
                                          <option value="8n">8</option>
                                          <option value="4n">4</option>
                                          <option value="2n">2</option>
                                          <option value="1n">1</option>
                                       </select>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>
                     </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-brand-secondary flex flex-col items-center gap-4">
                   <p>Select an option from the sidebar</p>
                </div>
              )}

           </div>
        </div>

      </div>}

    </div>
  );
}
