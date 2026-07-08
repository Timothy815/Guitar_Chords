import { useState, useMemo, useRef } from 'react';
import { Note, ChordShape } from '../types';
import { ALL_NOTES, COMMON_SCALES, COMMON_CHORDS, generateScalePattern } from '../data/guitarData';
import {
  CHORD_TONE_QUALITIES, StringGroup, ChordToneDot,
  generateChordToneDots, generateScalePositions,
} from '../data/triadData';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playArpeggioSequence, getFretNote } from '../lib/audio';
import { FretboardFocus } from '../lib/earTraining';

// --- LocalStorage helpers ---
function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`triads_${key}`);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(`triads_${key}`, JSON.stringify(value)); } catch { /* quota */ }
}

// --- Constants ---
const STRING_GROUP_LABELS: { key: StringGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'EAD', label: 'E·A·D' },
  { key: 'ADG', label: 'A·D·G' },
  { key: 'DGB', label: 'D·G·B' },
  { key: 'GBE', label: 'G·B·E' },
];

const QUALITY_GROUPS = [
  { group: 'Triads', keys: ['major', 'minor', 'dim', 'aug'] },
  { group: '7ths',   keys: ['dom7', 'maj7', 'min7', 'minmaj7', 'm7b5', 'dim7', 'aug7', 'augmaj7'] },
  { group: 'Sus',    keys: ['sus2', 'sus4', 'sus4dom7'] },
];

const LEGEND = [
  { color: '#e74c3c', label: 'Root' },
  { color: '#2980b9', label: '3rd' },
  { color: '#27ae60', label: '5th' },
  { color: '#8e44ad', label: '7th' },
  { color: '#e67e22', label: 'Other' },
];

type PosMode = 'full' | 'caged' | 'diagonal';
type CagedShape = 'E' | 'D' | 'C' | 'A' | 'G';

const CAGED_POSITIONS: { key: CagedShape; label: string; startOff: number }[] = [
  { key: 'E', label: 'E', startOff: -1 },
  { key: 'D', label: 'D', startOff: 2 },
  { key: 'C', label: 'C', startOff: 4 },
  { key: 'A', label: 'A', startOff: 7 },
  { key: 'G', label: 'G', startOff: 9 },
];
const CAGED_SPAN = 4;

const INTERVAL_DEGREE_LABELS: Record<number, string> = {
  0: 'Root', 2: '2nd', 3: '♭3rd', 4: '3rd', 5: '4th',
  6: '♭5th', 7: '5th', 8: '♯5th', 9: '𝄫7th', 10: '♭7th', 11: 'Maj7',
};

const OPEN_PITCHES_TC = [40, 45, 50, 55, 59, 64]; // low E → high E

function buildChordToneDiagonal(root: Note, intervals: number[], startIntervalIdx: number): Set<string> {
  const rootMidi = ALL_NOTES.indexOf(root);
  const startPC = (rootMidi + intervals[startIntervalIdx]) % 12;
  let minPitch = OPEN_PITCHES_TC[0] + (startPC - OPEN_PITCHES_TC[0] % 12 + 12) % 12;
  const positions = new Set<string>();
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const candidates: { fret: number; pitch: number }[] = [];
    for (let fret = 0; fret <= 15; fret++) {
      const pitch = OPEN_PITCHES_TC[sIdx] + fret;
      if (pitch < minPitch) continue;
      if (intervals.includes((pitch - rootMidi + 120) % 12)) candidates.push({ fret, pitch });
    }
    if (!candidates.length) continue;
    const picked = [candidates[0]];
    const second = candidates.find(c => c.pitch > picked[0].pitch && c.fret - picked[0].fret <= 5);
    if (second) picked.push(second);
    picked.forEach(({ fret, pitch }) => { positions.add(`${sIdx}-${fret}`); minPitch = pitch + 1; });
  }
  return positions;
}


function clampCAGED(raw: number) {
  if (raw < 0) raw = 0;
  if (raw > 11) raw = raw % 12;
  return raw;
}

function computeFilteredDots(
  root: Note,
  qualityKey: string,
  sg: StringGroup,
  pm: PosMode,
  cs: CagedShape,
  ds: number,
): ChordToneDot[] {
  const all = generateChordToneDots(root, qualityKey, sg);
  const rootFret = (ALL_NOTES.indexOf(root) - ALL_NOTES.indexOf('E' as Note) + 12) % 12;

  if (pm === 'caged') {
    const pos = CAGED_POSITIONS.find(p => p.key === cs);
    if (pos) {
      const s = clampCAGED(rootFret + pos.startOff);
      return all.filter(d => d.fret >= s && d.fret <= s + CAGED_SPAN);
    }
  } else if (pm === 'diagonal') {
    const quality = CHORD_TONE_QUALITIES[qualityKey];
    if (quality) {
      const idx = Math.min(ds, quality.intervals.length - 1);
      const allowed = buildChordToneDiagonal(root, quality.intervals, idx);
      return all.filter(d => allowed.has(`${d.stringIdx}-${d.fret}`));
    }
  }
  return all;
}

// --- Module-level helpers for playback ---
function inferQuality(chordName: string): string {
  if (/m7b5/i.test(chordName))     return 'm7b5';
  if (/dim7/i.test(chordName))     return 'dim7';
  if (/aug7/i.test(chordName))     return 'aug7';
  if (/augmaj7/i.test(chordName))  return 'augmaj7';
  if (/minmaj7/i.test(chordName))  return 'minmaj7';
  if (/maj7/i.test(chordName))     return 'maj7';
  if (/ m7[\s(]/i.test(chordName)) return 'min7';
  if (/sus4dom7/i.test(chordName)) return 'sus4dom7';
  if (/sus4/i.test(chordName))     return 'sus4';
  if (/sus2/i.test(chordName))     return 'sus2';
  if (/ 7[\s(]/i.test(chordName))  return 'dom7';
  if (/\baug\b/i.test(chordName))  return 'aug';
  if (/dim/i.test(chordName))      return 'dim';
  if (/minor/i.test(chordName))    return 'minor';
  return 'major';
}

function findBestChordShape(root: Note, qualityKey: string): ChordShape | undefined {
  const shapes = COMMON_CHORDS[root] ?? [];
  if (!shapes.length) return undefined;
  const n = (s: ChordShape) => s.name.toLowerCase();
  const match = (() => {
    switch (qualityKey) {
      case 'major':   return shapes.find(s => n(s).includes('major'));
      case 'minor':   return shapes.find(s => n(s).includes('minor') && !n(s).includes('minmaj'));
      case 'dom7':    return shapes.find(s => / 7[\s(]/i.test(s.name) && !/(maj7|m7b5|dim7)/i.test(s.name));
      case 'maj7':    return shapes.find(s => /maj7/i.test(s.name));
      case 'min7':    return shapes.find(s => / m7[\s(]/i.test(s.name) && !/m7b5/i.test(s.name));
      case 'm7b5':    return shapes.find(s => /m7b5/i.test(s.name));
      case 'dim7':    return shapes.find(s => /dim7/i.test(s.name));
      case 'dim':     return shapes.find(s => /dim/i.test(s.name) && !/dim7/i.test(s.name));
      case 'aug':     return shapes.find(s => /\baug\b/i.test(s.name) && !/aug7|augmaj7/i.test(s.name));
      case 'sus2':    return shapes.find(s => /sus2/i.test(s.name));
      case 'sus4':    return shapes.find(s => /sus4/i.test(s.name) && !/sus4dom7/i.test(s.name));
      default:        return undefined;
    }
  })();
  return match ?? shapes[0];
}

// --- Component ---
type ProgChord = { root: Note; qualityKey: string };

export default function Triads() {
  const [selectedKey, setSelectedKey]         = useState<Note>(() => lsGet('key', 'C'));
  const [selectedQuality, setSelectedQuality] = useState<string>(() => lsGet('quality', 'major'));
  const [stringGroup, setStringGroup]         = useState<StringGroup>(() => lsGet('stringGroup', 'all'));
  const [scaleOn, setScaleOn]                 = useState<boolean>(() => lsGet('scaleOn', false));
  const [scaleRoot, setScaleRoot]             = useState<Note>(() => lsGet('scaleRoot', 'C'));
  const [scaleType, setScaleType]             = useState<string>(() => lsGet('scaleType', 'Major (Ionian)'));

  const [posMode, setPosModeState]             = useState<PosMode>(() => {
    const v = lsGet<string>('posMode', 'full');
    return (v === 'box' ? 'full' : v) as PosMode;
  });
  const [cagedShape, setCagedShapeState]       = useState<CagedShape>(() => lsGet('cagedShape', 'E'));
  const [diagonalStart, setDiagStartState]     = useState<number>(() => lsGet('diagonalStart', 0));
  const setPosMode      = (v: PosMode)    => { setPosModeState(v);      lsSet('posMode', v); };
  const setCagedShape   = (v: CagedShape) => { setCagedShapeState(v);   lsSet('cagedShape', v); };
  const setDiagStart    = (v: number)     => { setDiagStartState(v);    lsSet('diagonalStart', v); };

  const [progression, setProgression]         = useState<ProgChord[]>(() => lsGet('progression', []));
  const [bpm, setBpmState]                    = useState<number>(() => lsGet('bpm', 80));
  const [beatsPerChord, setBpcState]          = useState<1|2|4|8>(() => lsGet('beatsPerChord', 4));
  const [loop, setLoopState]                  = useState<boolean>(() => lsGet('loop', true));
  const [isPlaying, setIsPlaying]             = useState(false);
  const [activeChordIdx, setActiveChordIdx]   = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeDotKey, setActiveDotKey] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [savedProgressions, setSavedProgressions] = useState<
    Array<{ name: string; slots: Array<{ chord: { name: string } }> }>
  >([]);
  const stopRef = useRef<(() => void) | null>(null);

  // Persisting setters
  const setKey     = (v: Note)       => { setSelectedKey(v);    lsSet('key', v); };
  const setQuality = (v: string)     => { setSelectedQuality(v); lsSet('quality', v); };
  const setGroup   = (v: StringGroup)=> { setStringGroup(v);    lsSet('stringGroup', v); };
  const setScale   = (v: boolean)    => { setScaleOn(v);        lsSet('scaleOn', v); };
  const setSRoot   = (v: Note)       => { setScaleRoot(v);      lsSet('scaleRoot', v); };
  const setSType   = (v: string)     => { setScaleType(v);      lsSet('scaleType', v); };
  const setBpm     = (v: number)     => { setBpmState(v);       lsSet('bpm', v); };
  const setBpc     = (v: 1|2|4|8)   => { setBpcState(v);       lsSet('beatsPerChord', v); };
  const setLoop    = (v: boolean)    => { setLoopState(v);      lsSet('loop', v); };
  const setProg    = (v: ProgChord[])=> { setProgression(v);    lsSet('progression', v); };

  // During playback, fretboard shows the active progression chord's tones
  const displayKey = (isPlaying && activeChordIdx !== null && progression[activeChordIdx])
    ? progression[activeChordIdx].root
    : selectedKey;
  const displayQuality = (isPlaying && activeChordIdx !== null && progression[activeChordIdx])
    ? progression[activeChordIdx].qualityKey
    : selectedQuality;

  const positionView = useMemo(() => {
    const lowEIdx = ALL_NOTES.indexOf('E' as Note);
    const rootIdx = ALL_NOTES.indexOf(displayKey);
    const rootFret = (rootIdx - lowEIdx + 12) % 12;
    const quality = CHORD_TONE_QUALITIES[displayQuality];

    const cagedOptions = CAGED_POSITIONS.map(pos => {
      const s = clampCAGED(rootFret + pos.startOff);
      return { ...pos, fretRange: [s, s + CAGED_SPAN] as [number, number], range: `${s}–${s + CAGED_SPAN}` };
    });

    const pathwayOptions = quality
      ? quality.intervals.map((iv, i) => ({ label: INTERVAL_DEGREE_LABELS[iv] ?? `${iv}`, index: i }))
      : [];

    let fretRange: [number, number] | undefined;
    let allowedPositions: Set<string> | undefined;
    let focusZone: FretboardFocus | undefined;

    if (posMode === 'caged') {
      fretRange = cagedOptions.find(o => o.key === cagedShape)?.fretRange;
    } else if (posMode === 'diagonal' && quality) {
      const idx = Math.min(diagonalStart, quality.intervals.length - 1);
      allowedPositions = buildChordToneDiagonal(displayKey, quality.intervals, idx);
    }

    if (fretRange) {
      focusZone = { fretMin: fretRange[0], fretMax: fretRange[1] };
    } else if (allowedPositions && allowedPositions.size > 0) {
      const frets = [...allowedPositions].map(k => Number(k.split('-')[1]));
      focusZone = { fretMin: Math.min(...frets), fretMax: Math.max(...frets) };
    }

    return { fretRange, allowedPositions, focusZone, cagedOptions, pathwayOptions };
  }, [posMode, cagedShape, diagonalStart, displayKey, displayQuality]);

  const chordToneDots: ChordToneDot[] = useMemo(() => {
    const all = generateChordToneDots(displayKey, displayQuality, stringGroup);
    const { fretRange, allowedPositions } = positionView;
    if (fretRange) { const [lo, hi] = fretRange; return all.filter(d => d.fret >= lo && d.fret <= hi); }
    if (allowedPositions) return all.filter(d => allowedPositions.has(`${d.stringIdx}-${d.fret}`));
    return all;
  }, [displayKey, displayQuality, stringGroup, positionView]);

  const { activeScalePattern, scaleOnlyPositions } = useMemo(() => {
    if (!scaleOn) return { activeScalePattern: undefined, scaleOnlyPositions: undefined };
    const scaleDef = COMMON_SCALES.find(s => s.name === scaleType);
    if (!scaleDef) return { activeScalePattern: undefined, scaleOnlyPositions: undefined };
    const pattern = generateScalePattern(scaleRoot, scaleDef);
    const allPos = generateScalePositions(scaleRoot, scaleDef);
    const ctKeys = new Set(chordToneDots.map(d => `${d.stringIdx}-${d.fret}`));
    const onlyPos = new Set([...allPos].filter(k => !ctKeys.has(k)));
    return { activeScalePattern: pattern, scaleOnlyPositions: onlyPos };
  }, [scaleOn, scaleRoot, scaleType, chordToneDots]);

  // Arpeggio playback — sequences chord tone dots for each progression chord
  async function handlePlay() {
    if (progression.length === 0) return;
    await initAudio();

    let stopped = false;
    stopRef.current?.();
    stopRef.current = () => { stopped = true; };
    setIsPlaying(true);
    setActiveDotKey(null);

    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    // Capture position settings at play time to avoid stale closure issues
    const pm = posMode, cs = cagedShape, ds = diagonalStart, sg = stringGroup;

    let chordIdx = 0;
    outer: while (true) {
      if (stopped) break;
      const chord = progression[chordIdx];
      setActiveChordIdx(chordIdx);

      const dots = computeFilteredDots(chord.root, chord.qualityKey, sg, pm, cs, ds);
      const sorted = [...dots].sort(
        (a, b) => (OPEN_PITCHES_TC[a.stringIdx] + a.fret) - (OPEN_PITCHES_TC[b.stringIdx] + b.fret)
      );

      const chordDuration = (beatsPerChord * 60) / bpm; // seconds

      if (sorted.length > 0) {
        // One note per string: lowest-pitch dot on each active string,
        // ordered string 0→5 (low E → high E) to mirror a real ascending arpeggio.
        // This caps at 6 notes so each note has enough time to sound like guitar.
        const byString = new Map<number, typeof sorted[0]>();
        for (const dot of sorted) {
          if (!byString.has(dot.stringIdx)) byString.set(dot.stringIdx, dot);
        }
        const arpDots = [...byString.values()].sort((a, b) => a.stringIdx - b.stringIdx);

        const noteInterval = Math.max(chordDuration / arpDots.length, 0.18);
        const noteStrings = arpDots.map(d => getFretNote(d.stringIdx, d.fret));
        const dotKeys = arpDots.map(d => `${d.stringIdx}-${d.fret}`);

        if (!stopped) {
          playArpeggioSequence(noteStrings, noteInterval, 2.0, i => {
            setActiveDotKey(dotKeys[i]);
          });
          await sleep(arpDots.length * noteInterval * 1000);
        }
      } else {
        await sleep(chordDuration * 1000);
      }

      setActiveDotKey(null);
      chordIdx++;
      if (chordIdx >= progression.length) {
        if (!loop) break;
        chordIdx = 0;
      }
    }

    setIsPlaying(false);
    setActiveChordIdx(null);
    setActiveDotKey(null);
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setIsPlaying(false);
    setActiveChordIdx(null);
    setActiveDotKey(null);
  }

  // Import from Progressions page
  function openImportModal() {
    try {
      const raw = localStorage.getItem('guitar_progressions');
      const progs = raw
        ? (JSON.parse(raw) as Array<{ name: string; slots: Array<{ chord: { name: string } }> }>)
        : [];
      setSavedProgressions(progs);
    } catch {
      setSavedProgressions([]);
    }
    setShowImportModal(true);
  }

  function applyImport(prog: { slots: Array<{ chord: { name: string } }> }) {
    const chords: ProgChord[] = prog.slots.map(slot => ({
      root: slot.chord.name.split(' ')[0] as Note,
      qualityKey: inferQuality(slot.chord.name),
    }));
    setProg(chords);
    setShowImportModal(false);
  }

  // Export to Progressions page
  const [exportToast, setExportToast] = useState('');

  function handleExport() {
    if (progression.length === 0) return;
    const slots = progression.map(({ root, qualityKey }) => {
      const shape = findBestChordShape(root, qualityKey);
      return shape ? { chord: shape } : null;
    }).filter((s): s is { chord: ChordShape } => s !== null);
    if (slots.length === 0) return;

    const name = progression
      .map(c => `${c.root} ${CHORD_TONE_QUALITIES[c.qualityKey]?.label ?? c.qualityKey}`)
      .join(' – ');
    const newProg = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: `Triad Explorer: ${name}`,
      bpm,
      key: progression[0].root,
      slots,
    };

    try {
      const raw = localStorage.getItem('guitar_progressions');
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem('guitar_progressions', JSON.stringify([...existing, newProg]));
      window.dispatchEvent(new Event('guitar_progressions_updated'));
      setExportToast('Saved to Progressions!');
      setTimeout(() => setExportToast(''), 2500);
    } catch { /* quota */ }
  }

  // Highlight the currently playing dot amber; all others keep their interval color
  const displayedDots = chordToneDots.map(d =>
    activeDotKey === `${d.stringIdx}-${d.fret}`
      ? { ...d, color: undefined, highlight: true }
      : d
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-serif font-bold text-brand-ink">Triad Explorer</h1>

      {/* Info accordion */}
      <div className="rounded-xl border border-brand-line bg-brand-surface overflow-hidden">
        <button
          onClick={() => setShowInfo(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-brand-sidebar/40 transition-colors"
        >
          <span className="text-sm text-brand-secondary">
            Triads are the foundation of arpeggios, chord substitutions, and melodic soloing.
          </span>
          <span className="text-brand-secondary ml-3 shrink-0 text-xs">{showInfo ? '▲' : '▼'}</span>
        </button>
        {showInfo && (
          <div className="px-4 pb-4 pt-1 border-t border-brand-line">
            <ul className="space-y-2 text-sm text-brand-secondary">
              <li>
                <span className="font-medium text-brand-ink">Chord skeleton.</span>{' '}
                Every chord voicing you know is built from a triad (root, 3rd, 5th) with optional extensions added. Seeing all chord tones across the neck reveals the full shape of a chord beyond a single open or CAGED voicing.
              </li>
              <li>
                <span className="font-medium text-brand-ink">Arpeggios.</span>{' '}
                An arpeggio is simply a triad (or 7th chord) played one note at a time. Use <strong>CAGED</strong> mode to isolate chord tones within a single position — the dots you see are exactly the notes of that arpeggio shape in that region of the neck.
              </li>
              <li>
                <span className="font-medium text-brand-ink">Target notes in solos.</span>{' '}
                In improvisation, landing on a chord tone (especially the 3rd or 7th) on a strong beat makes a phrase sound intentional rather than accidental. The full-neck view lets you see every safe landing spot at a glance.
              </li>
              <li>
                <span className="font-medium text-brand-ink">Diagonal pathways.</span>{' '}
                Use <strong>Pathway</strong> mode to practice connecting positions across the neck in one linear run — great for building fluid arpeggio lines that move up or down the fretboard rather than staying locked in one box.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 bg-brand-surface rounded-xl p-3 border border-brand-line">
      <div className="flex flex-wrap items-center gap-3">
        {/* Key selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-brand-secondary">Key</span>
          <select
            value={selectedKey}
            onChange={e => setKey(e.target.value as Note)}
            className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
          >
            {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-brand-secondary">Quality</span>
          <select
            value={selectedQuality}
            onChange={e => setQuality(e.target.value)}
            className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
          >
            {QUALITY_GROUPS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.keys.map(k => (
                  <option key={k} value={k}>{CHORD_TONE_QUALITIES[k]?.label ?? k}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* String group filter */}
        <div className="flex items-center gap-1">
          {STRING_GROUP_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGroup(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                stringGroup === key
                  ? 'bg-brand-active text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scale toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setScale(!scaleOn)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              scaleOn
                ? 'bg-brand-primary text-white'
                : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
            }`}
          >
            Scale {scaleOn ? 'ON' : 'OFF'}
          </button>
          {scaleOn && (
            <>
              <select
                value={scaleRoot}
                onChange={e => setSRoot(e.target.value as Note)}
                className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
              >
                {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select
                value={scaleType}
                onChange={e => setSType(e.target.value)}
                className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
              >
                {COMMON_SCALES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Position mode row */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-brand-secondary w-16 shrink-0">Position</span>
          {(['full', 'caged', 'diagonal'] as PosMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setPosMode(mode)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                posMode === mode
                  ? 'bg-brand-active text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
              }`}
            >
              {mode === 'full' ? 'Full neck' : mode === 'caged' ? 'CAGED' : 'Pathway'}
            </button>
          ))}
        </div>

        {posMode === 'caged' && (
          <div className="flex flex-wrap items-center gap-1 pl-[4.5rem]">
            {positionView.cagedOptions.map(pos => (
              <button
                key={pos.key}
                onClick={() => setCagedShape(pos.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  cagedShape === pos.key
                    ? 'bg-brand-active text-white'
                    : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
                }`}
              >
                {pos.label} shape <span className="opacity-70">({pos.range})</span>
              </button>
            ))}
          </div>
        )}

        {posMode === 'diagonal' && (
          <div className="flex flex-wrap items-center gap-1 pl-[4.5rem]">
            {positionView.pathwayOptions.map(opt => (
              <button
                key={opt.index}
                onClick={() => setDiagStart(opt.index)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  diagonalStart === opt.index
                    ? 'bg-brand-active text-white'
                    : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
                }`}
              >
                From {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap px-1">
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            <span className="text-xs text-brand-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Fretboard */}
      <Fretboard
        fretsNum={15}
        drillDots={displayedDots}
        scale={activeScalePattern}
        scalePositions={scaleOnlyPositions}
        fretRange={positionView.fretRange}
        focusZone={positionView.focusZone}
        showNoteNames={false}
      />

      {/* Progression strip */}
      <div className="bg-brand-surface rounded-xl p-3 border border-brand-line">
        {/* Play controls row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            onClick={isPlaying ? handleStop : handlePlay}
            disabled={progression.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium disabled:opacity-40"
          >
            {isPlaying ? '⏹ Stop' : '▶ Play'}
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary">BPM</span>
            <input
              type="number"
              min={40} max={240}
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              className="w-16 bg-brand-bg border border-brand-line rounded px-2 py-1 text-sm text-brand-ink text-center"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary">Beats</span>
            {([1, 2, 4, 8] as const).map(b => (
              <button
                key={b}
                onClick={() => setBpc(b)}
                className={`w-8 h-7 rounded text-xs font-medium transition-colors ${
                  beatsPerChord === b
                    ? 'bg-brand-active text-white'
                    : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLoop(!loop)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              loop
                ? 'bg-brand-active text-white'
                : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
            }`}
          >
            Loop {loop ? 'ON' : 'OFF'}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {exportToast && (
              <span className="text-xs text-green-600 font-medium">{exportToast}</span>
            )}
            <button
              onClick={openImportModal}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink"
              title="Load a progression from the Progressions page"
            >
              Import
            </button>
            <button
              onClick={handleExport}
              disabled={progression.length === 0}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink disabled:opacity-40"
              title="Send this progression to the Progressions page"
            >
              Export
            </button>
            <button
              onClick={() => setProg([...progression, { root: selectedKey, qualityKey: selectedQuality }])}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Chord cards */}
        <div className="flex gap-2 flex-wrap">
          {progression.length === 0 && (
            <p className="text-xs text-brand-secondary italic">
              Add chords or import from Progressions
            </p>
          )}
          {progression.map((chord, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1 p-2 rounded-lg border transition-colors ${
                isPlaying && activeChordIdx === idx
                  ? 'border-brand-active bg-brand-active/10 shadow-sm'
                  : 'border-brand-line bg-brand-bg'
              }`}
            >
              <select
                value={chord.root}
                onChange={e => {
                  const next = [...progression];
                  next[idx] = { ...chord, root: e.target.value as Note };
                  setProg(next);
                }}
                className="bg-transparent text-sm text-brand-ink border-none outline-none"
              >
                {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select
                value={chord.qualityKey}
                onChange={e => {
                  const next = [...progression];
                  next[idx] = { ...chord, qualityKey: e.target.value };
                  setProg(next);
                }}
                className="bg-transparent text-xs text-brand-secondary border-none outline-none"
              >
                {QUALITY_GROUPS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.keys.map(k => (
                      <option key={k} value={k}>{CHORD_TONE_QUALITIES[k]?.label ?? k}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => setProg(progression.filter((_, i) => i !== idx))}
                className="text-brand-secondary hover:text-red-500 text-xs ml-1 leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-brand-surface rounded-xl p-6 max-w-sm w-full mx-4 border border-brand-line shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-brand-ink mb-1">Import from Progressions</h3>
            <p className="text-xs text-brand-secondary mb-3">
              Loads a progression you've saved on the Progressions page into the strip below.
            </p>
            {savedProgressions.length === 0 ? (
              <p className="text-sm text-brand-secondary">
                No saved progressions found. Go to the Progressions page and save one first.
              </p>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {savedProgressions.map((prog, i) => (
                  <li key={i}>
                    <button
                      onClick={() => applyImport(prog)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-ink hover:bg-brand-bg border border-transparent hover:border-brand-line"
                    >
                      <span className="font-medium">{prog.name || `Progression ${i + 1}`}</span>
                      <span className="text-brand-secondary ml-2">
                        ({prog.slots?.length ?? 0} chords)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowImportModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-brand-bg border border-brand-line text-sm text-brand-secondary hover:text-brand-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
