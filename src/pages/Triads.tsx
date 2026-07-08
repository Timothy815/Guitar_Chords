import { useState, useMemo, useRef } from 'react';
import { Note, ChordShape } from '../types';
import { ALL_NOTES, COMMON_SCALES, COMMON_CHORDS, generateScalePattern } from '../data/guitarData';
import {
  CHORD_TONE_QUALITIES, StringGroup, ChordToneDot,
  generateChordToneDots, generateScalePositions,
} from '../data/triadData';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playProgressionWithPatterns, getFretNote } from '../lib/audio';

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
  { color: '#e67e22', label: 'Sus' },
];

type CagedShape = 'full' | 'E' | 'D' | 'C' | 'A' | 'G';
const CAGED_POSITIONS: { key: CagedShape; label: string; startOff: number }[] = [
  { key: 'E', label: 'E shape', startOff: -1 },
  { key: 'D', label: 'D shape', startOff: 2 },
  { key: 'C', label: 'C shape', startOff: 4 },
  { key: 'A', label: 'A shape', startOff: 7 },
  { key: 'G', label: 'G shape', startOff: 9 },
];
const CAGED_SPAN = 4;

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

  const [cagedPosition, setCagedPositionState] = useState<CagedShape>(() => lsGet('cagedPosition', 'full'));
  const setCagedPosition = (v: CagedShape) => { setCagedPositionState(v); lsSet('cagedPosition', v); };

  const [progression, setProgression]         = useState<ProgChord[]>(() => lsGet('progression', []));
  const [bpm, setBpmState]                    = useState<number>(() => lsGet('bpm', 80));
  const [beatsPerChord, setBpcState]          = useState<1|2|4|8>(() => lsGet('beatsPerChord', 4));
  const [loop, setLoopState]                  = useState<boolean>(() => lsGet('loop', true));
  const [isPlaying, setIsPlaying]             = useState(false);
  const [activeChordIdx, setActiveChordIdx]   = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
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

  const fretRange = useMemo((): [number, number] | undefined => {
    if (cagedPosition === 'full') return undefined;
    const pos = CAGED_POSITIONS.find(p => p.key === cagedPosition);
    if (!pos) return undefined;
    const lowEIdx = ALL_NOTES.indexOf('E' as Note);
    const rootIdx = ALL_NOTES.indexOf(displayKey);
    let startFret = (rootIdx - lowEIdx + 12) % 12 + pos.startOff;
    if (startFret < 0) startFret += 12;
    if (startFret > 11) startFret = startFret % 12;
    return [startFret, startFret + CAGED_SPAN];
  }, [cagedPosition, displayKey]);

  // Compute per-position fret ranges for button labels
  const cagedPositionOptions = useMemo(() => {
    const lowEIdx = ALL_NOTES.indexOf('E' as Note);
    const rootIdx = ALL_NOTES.indexOf(displayKey);
    return CAGED_POSITIONS.map(pos => {
      let startFret = (rootIdx - lowEIdx + 12) % 12 + pos.startOff;
      if (startFret < 0) startFret += 12;
      if (startFret > 11) startFret = startFret % 12;
      return { ...pos, range: `${startFret}–${startFret + CAGED_SPAN}` };
    });
  }, [displayKey]);

  const chordToneDots: ChordToneDot[] = useMemo(() => {
    const all = generateChordToneDots(displayKey, displayQuality, stringGroup);
    if (!fretRange) return all;
    const [lo, hi] = fretRange;
    return all.filter(d => d.fret >= lo && d.fret <= hi);
  }, [displayKey, displayQuality, stringGroup, fretRange]);

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

  // Playback
  async function handlePlay() {
    if (progression.length === 0) return;
    await initAudio();
    const adjustedBpm = bpm * 4 / beatsPerChord;
    const slots = progression.map(({ root, qualityKey }) => {
      const shape = findBestChordShape(root, qualityKey);
      if (!shape) return { notesByString: Array<string | null>(6).fill(null) };
      return {
        notesByString: shape.frets.map((f, sIdx) =>
          f === -1 ? null : getFretNote(sIdx, f)
        ),
      };
    });
    stopRef.current?.();
    setActiveChordIdx(0);
    setIsPlaying(true);
    stopRef.current = playProgressionWithPatterns(
      slots, adjustedBpm, loop,
      idx => setActiveChordIdx(idx),
    );
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setIsPlaying(false);
    setActiveChordIdx(null);
  }

  // Import modal
  function openImportModal() {
    try {
      const raw = localStorage.getItem('guitar_progressions');
      if (!raw) return;
      const progs = JSON.parse(raw) as Array<{
        name: string;
        slots: Array<{ chord: { name: string } }>;
      }>;
      setSavedProgressions(progs);
      setShowImportModal(true);
    } catch { /* ignore */ }
  }

  function applyImport(prog: { slots: Array<{ chord: { name: string } }> }) {
    const chords: ProgChord[] = prog.slots.map(slot => ({
      root: slot.chord.name.split(' ')[0] as Note,
      qualityKey: inferQuality(slot.chord.name),
    }));
    setProg(chords);
    setShowImportModal(false);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
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

      {/* CAGED position row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-brand-secondary">Position</span>
        <button
          onClick={() => setCagedPosition('full')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            cagedPosition === 'full'
              ? 'bg-brand-active text-white'
              : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
          }`}
        >
          Full neck
        </button>
        {cagedPositionOptions.map(pos => (
          <button
            key={pos.key}
            onClick={() => setCagedPosition(pos.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              cagedPosition === pos.key
                ? 'bg-brand-active text-white'
                : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
            }`}
          >
            {pos.label}
            <span className="ml-1 opacity-70">({pos.range})</span>
          </button>
        ))}
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
        drillDots={chordToneDots}
        scale={activeScalePattern}
        scalePositions={scaleOnlyPositions}
        fretRange={fretRange}
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

          <div className="ml-auto flex gap-2">
            <button
              onClick={openImportModal}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink"
            >
              Import
            </button>
            <button
              onClick={() => setProg([...progression, { root: 'C', qualityKey: 'major' }])}
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
            <h3 className="text-base font-semibold text-brand-ink mb-3">Import from Progressions</h3>
            {savedProgressions.length === 0 ? (
              <p className="text-sm text-brand-secondary">No saved progressions found.</p>
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
