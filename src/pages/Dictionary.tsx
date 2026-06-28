import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chord as TonalChord } from '@tonaljs/tonal';
import { Fretboard } from '../components/Fretboard';
import { IntervalFretboard } from '../components/IntervalFretboard';
import { PianoKeyboard } from '../components/PianoKeyboard';
import { COMMON_CHORDS, COMMON_SCALES, generateScalePattern, ALL_NOTES, ScaleCategory } from '../data/guitarData';
import { playStrum, playArpeggio, getFretNote, initAudio, playNote, setEffects } from '../lib/audio';
import { Volume2, ListMusic, Printer } from 'lucide-react';
import { ChordShape, Note, TUNINGS, Tuning, Finger } from '../types';
import { handlePrint, cn, avgChordPitch, chordPositionBucket, PositionBucket, POSITION_LABELS } from '../lib/utils';
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';

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

export function Dictionary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'chords' | 'scales' | 'identify' | 'intervals'>('chords');
  const [currentTuning, setCurrentTuning] = useState<Tuning>(TUNINGS['Standard']);
  const [selectedKey, setSelectedKey] = useState<Note>('C');
  const [selectedChordIdx, setSelectedChordIdx] = useState<number>(0);
  const [selectedScaleIdx, setSelectedScaleIdx] = useState<number>(0);
  const [scaleFretRange, setScaleFretRange] = useState<number[]>([]);
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [identifiedFrets, setIdentifiedFrets] = useState<number[]>([-1,-1,-1,-1,-1,-1]);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Seed the Identify tab from URL params when navigating here from another page (e.g. Circle → Explore →).
  useEffect(() => {
    const fretsParam = searchParams.get('frets');
    if (searchParams.get('mode') === 'identify' && fretsParam) {
      const parsed = fretsParam.split(',').map(Number);
      if (parsed.length === 6 && parsed.every(f => Number.isFinite(f))) {
        setMode('identify');
        setIdentifiedFrets(parsed);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [scaffoldLevel, setScaffoldLevel] = useState<0 | 1 | 2>(0);
  const [chordSortOrder, setChordSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionBucket>('all');
  const [scaleCategory, setScaleCategory] = useState<ScaleCategory | 'All'>('All');
  const [selectedInterval, setSelectedInterval] = useState<number>(7); // Perfect 5th

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
             onClick={() => setMode('chords')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'chords' ? 'bg-brand-surface text-brand-ink shadow-sm' : 'text-brand-secondary hover:text-brand-ink'}`}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
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
              {currentTuning.name !== 'Standard' && mode === 'chords' && (
                <p className="text-[10px] text-orange-500 font-bold">Standard chord shapes may not sound correct in this tuning!</p>
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
                    <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider pt-4">Isolate Position</h3>
                    <div className="space-y-2">
                       <select
                         value={scaleFretRange.join(',')}
                         onChange={(e) => {
                            if (e.target.value === 'all') {
                               setScaleFretRange([]);
                            } else {
                               const [s, t] = e.target.value.split(',').map(Number);
                               setScaleFretRange([s, t]);
                            }
                         }}
                         className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                       >
                         <option value="all">Full Fretboard</option>
                         <option value="0,3">Position 1 (Frets 0-3)</option>
                         <option value="2,5">Position 2 (Frets 2-5)</option>
                         <option value="4,7">Position 3 (Frets 4-7)</option>
                         <option value="7,10">Position 4 (Frets 7-10)</option>
                         <option value="9,12">Position 5 (Frets 9-12)</option>
                         <option value="12,15">Position 6 (Frets 12-15)</option>
                       </select>
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
                        {short}
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
                       )}
                    </div>
                 )}
                 {mode === 'scales' && activeScale && (
                    <div className="flex gap-3 print:hidden">
                       <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <Printer size={16} /> Print Diagram
                       </button>
                    </div>
                 )}
              </div>

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
                />
              ) : ((mode === 'chords' && activeChord) || (mode === 'scales' && activeScale) || mode === 'identify') ? (
                <>
                  <div className="w-full" onMouseEnter={initAudio}>
                     <Fretboard
                        fretsNum={15}
                        chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: [-1,-1,-1,-1,-1,-1] } : undefined)}
                        showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
                        scale={mode === 'scales' ? activeScale : undefined}
                        playingNotes={playingNotes}
                        fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
                        onNoteClick={(str) => {
                          // Handled by onFretClick if possible, fallback
                          import('../lib/audio').then(m => m.playNote(str, sustain));
                        }}
                        onFretClick={handleFretClick}
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
                  {mode === 'scales' && diatonicChords.length > 0 && (
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

      </div>
    </div>
  );
}
