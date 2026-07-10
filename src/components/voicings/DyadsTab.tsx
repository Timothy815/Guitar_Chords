import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { computeDyads, DYAD_INTERVALS } from './dyads';
import {
  computeHarmonizedDyads,
  HARMONIZABLE_SCALES,
  H_INTERVAL_TYPES,
  DEGREE_COLORS,
} from './harmonizedDyads';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  '6-5': { hex: '#f59e0b', label: 'Str 6–5' },
  '5-4': { hex: '#14b8a6', label: 'Str 5–4' },
  '4-3': { hex: '#8b5cf6', label: 'Str 4–3' },
  '3-2': { hex: '#ec4899', label: 'Str 3–2' },
  '2-1': { hex: '#10b981', label: 'Str 2–1' },
  '6-4': { hex: '#ef4444', label: 'Str 6–4' },
  '5-3': { hex: '#3b82f6', label: 'Str 5–3' },
  '4-2': { hex: '#d97706', label: 'Str 4–2' },
  '3-1': { hex: '#6366f1', label: 'Str 3–1' },
};

const H_STRING_PAIRS = [
  { key: '6-5', label: 'Str 6–5 (E·A)' },
  { key: '5-4', label: 'Str 5–4 (A·D)' },
  { key: '4-3', label: 'Str 4–3 (D·G)' },
  { key: '3-2', label: 'Str 3–2 (G·B)' },
  { key: '2-1', label: 'Str 2–1 (B·E)' },
  { key: '6-4', label: 'Str 6–4 (E·D)' },
  { key: '5-3', label: 'Str 5–3 (A·G)' },
  { key: '4-2', label: 'Str 4–2 (D·B)' },
  { key: '3-1', label: 'Str 3–1 (G·E)' },
];

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

type Mode = 'single' | 'harmonized';

export function DyadsTab() {
  // ── shared
  const [mode, setMode] = useState<Mode>('single');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showTheory, setShowTheory] = useState(false);
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());

  // ── single mode
  const [root, setRoot] = useState<Note>('G');
  const [intervalKey, setIntervalKey] = useState('M3');
  const [inverted, setInverted] = useState(false);
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(
    new Set(['6-5', '5-4', '4-3', '3-2', '2-1', '6-4', '5-3', '4-2', '3-1'])
  );
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  // ── harmonized mode
  const [hKey, setHKey] = useState<Note>('G');
  const [hScaleKey, setHScaleKey] = useState('major');
  const [hIntervalKey, setHIntervalKey] = useState('3rds');
  const [hSetKey, setHSetKey] = useState('3-2');

  // ── single mode computation
  const interval = DYAD_INTERVALS.find(i => i.key === intervalKey)!;
  const allDyads = useMemo(
    () => computeDyads(root, interval.semitones, inverted),
    [root, interval.semitones, inverted]
  );
  const dyads = useMemo(
    () => allDyads.filter(d => activeStringSets.has(d.setKey)),
    [allDyads, activeStringSets]
  );

  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const toggleCard = (i: number) => setHiddenCards(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
  });
  useEffect(() => { setHiddenCards(new Set()); }, [dyads]);

  const singleDrillDots = useMemo(() =>
    dyads
      .filter((_, i) => !hiddenCards.has(i))
      .flatMap(d => [
        { stringIdx: d.strings[0], fret: d.bottomFret, label: d.bottomNote.replace(/[0-9]/g, ''), color: SET_CONFIG[d.setKey].hex },
        { stringIdx: d.strings[1], fret: d.topFret,    label: d.topNote.replace(/[0-9]/g, ''),    color: SET_CONFIG[d.setKey].hex },
      ]),
    [dyads, hiddenCards]
  );

  // ── harmonized mode computation
  const hScale = HARMONIZABLE_SCALES.find(s => s.key === hScaleKey)!;
  const hIntervalType = H_INTERVAL_TYPES.find(t => t.key === hIntervalKey)!;
  const hDyads = useMemo(
    () => computeHarmonizedDyads(hKey, hScale, hIntervalType, hSetKey),
    [hKey, hScale, hIntervalType, hSetKey]
  );

  const harmonizedDrillDots = useMemo(() =>
    hDyads.flatMap(d => [
      { stringIdx: d.strings[0], fret: d.bottomFret, label: d.degreeLabel, color: DEGREE_COLORS[d.degreeIdx] },
      { stringIdx: d.strings[1], fret: d.topFret,    label: d.degreeLabel, color: DEGREE_COLORS[d.degreeIdx] },
    ]),
    [hDyads]
  );

  const drillDots = mode === 'single' ? singleDrillDots : harmonizedDrillDots;

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (frets: number[]) => {
    await initAudio();
    const notes = frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (frets: number[], name: string, index: number) => {
    const chord: ChordShape = {
      name,
      frets,
      fingers: frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
    };
    try {
      const raw = localStorage.getItem('guitar_progressions');
      const activeId = localStorage.getItem('guitar_active_prog_id');
      if (raw && activeId) {
        const progs = JSON.parse(raw);
        const updated = progs.map((p: any) =>
          p.id === activeId ? { ...p, slots: [...p.slots, { chord }] } : p
        );
        localStorage.setItem('guitar_progressions', JSON.stringify(updated));
        window.dispatchEvent(new Event('guitar_progressions_updated'));
      }
    } catch { /* ignore */ }
    setAddedIndices(prev => new Set(prev).add(index));
    setTimeout(() => setAddedIndices(prev => { const next = new Set(prev); next.delete(index); return next; }), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-serif font-bold text-brand-ink">Dyads</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Two-note intervals — the simplest way to add harmony. 3rds and 6ths harmonize melodies; 4ths and 5ths add power; 7ths create tension.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-brand-bg rounded-lg border border-brand-line w-fit">
        {(['single', 'harmonized'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === m
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-secondary hover:text-brand-ink'
            )}
          >
            {m === 'single' ? 'Single Interval' : 'Harmonized Scale'}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <>
          {/* Root selector */}
          <div>
            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">
              {inverted ? 'Top Note (Root)' : 'Bottom Note (Root)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_NOTES.map(note => (
                <button
                  key={note}
                  onClick={() => setRoot(note as Note)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    root === note
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          {/* Interval selector + invert toggle */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider">Interval</p>
              <button
                onClick={() => setInverted(v => !v)}
                className={cn('flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  inverted
                    ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                    : 'border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                )}
                title="Root on top string — interval note on bottom"
              >
                <ArrowUpDown size={11} />
                Root on top
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DYAD_INTERVALS.map(iv => (
                <button
                  key={iv.key}
                  onClick={() => setIntervalKey(iv.key)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    intervalKey === iv.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {iv.label}
                </button>
              ))}
            </div>
            {inverted && (
              <p className="text-xs text-brand-secondary/70 mt-1.5">
                Root ({root}) is on the higher string — interval note below it.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Harmonized: Key root */}
          <div>
            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Key</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_NOTES.map(note => (
                <button
                  key={note}
                  onClick={() => setHKey(note as Note)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    hKey === note
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          {/* Harmonized: Scale */}
          <div>
            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Scale</p>
            <div className="flex flex-wrap gap-1.5">
              {HARMONIZABLE_SCALES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setHScaleKey(s.key)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    hScaleKey === s.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harmonized: Interval type */}
          <div>
            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Harmonize In</p>
            <div className="flex flex-wrap gap-1.5">
              {H_INTERVAL_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setHIntervalKey(t.key)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    hIntervalKey === t.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harmonized: String pair */}
          <div>
            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">String Pair</p>
            <div className="flex flex-wrap gap-1.5">
              {H_STRING_PAIRS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setHSetKey(p.key)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                    hSetKey === p.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Degree legend */}
          <div className="flex flex-wrap gap-2">
            {hScale.degreeLabels.map((label, i) => (
              <span key={i} className="flex items-center gap-1 text-xs font-semibold">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: DEGREE_COLORS[i] }}
                >
                  {label}
                </span>
                <span className="text-brand-secondary">{label}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* Fretboard — shared */}
      <div onMouseEnter={initAudio}>
        {mode === 'single' && (
          <div className="flex items-center justify-between mb-1">
            <div className="flex flex-wrap gap-2">
              {Object.entries(SET_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => toggleSet(key)}
                  className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                    activeStringSets.has(key)
                      ? 'border-transparent text-white'
                      : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                  )}
                  style={activeStringSets.has(key) ? { backgroundColor: cfg.hex } : undefined}
                >
                  {activeStringSets.has(key) ? <Eye size={12} /> : <EyeOff size={12} />}
                  {cfg.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAllNotes(v => !v)}
              className={cn('text-xs px-2.5 py-0.5 rounded border transition-colors',
                showAllNotes
                  ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                  : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
              )}
            >
              {showAllNotes ? 'All notes: on' : 'All notes: off'}
            </button>
          </div>
        )}
        {mode === 'harmonized' && (
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setShowAllNotes(v => !v)}
              className={cn('text-xs px-2.5 py-0.5 rounded border transition-colors',
                showAllNotes
                  ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                  : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
              )}
            >
              {showAllNotes ? 'All notes: on' : 'All notes: off'}
            </button>
          </div>
        )}

        <Fretboard
          fretsNum={12}
          chord={MUTED_CHORD}
          drillDots={drillDots}
          playingNotes={playingNotes}
          showNoteNames={false}
          showAllNotes={showAllNotes}
          compact
        />
      </div>

      {/* Cards */}
      {mode === 'single' ? (
        dyads.length === 0 ? (
          <p className="text-brand-secondary text-sm">No dyads found for this combination.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dyads.map((d, i) => {
              const color = SET_CONFIG[d.setKey].hex;
              const isActive = !hiddenCards.has(i);
              const bottomRole = inverted ? interval.key : 'R';
              const topRole    = inverted ? 'R' : interval.key;
              return (
                <div
                  key={i}
                  className={cn('bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3 transition-opacity duration-200', !isActive && 'opacity-40')}
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <h3 className="text-sm font-bold text-brand-ink">{d.setLabel}</h3>
                      </div>
                      <p className="text-xs text-brand-secondary mt-0.5 pl-4">{d.openNames}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium text-brand-secondary tabular-nums">
                        fret {d.bottomFret === 0 ? 'open' : d.bottomFret}
                      </span>
                      <button
                        onClick={() => toggleCard(i)}
                        className="p-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors"
                        title={isActive ? 'Hide on fretboard' : 'Show on fretboard'}
                      >
                        {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {[
                      { label: bottomRole, note: d.bottomNote },
                      { label: topRole,    note: d.topNote },
                    ].map(({ label, note }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {label}
                        </span>
                        <span className="text-sm font-semibold text-brand-ink">{note.replace(/[0-9]/g, '')}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs text-center">
                    {([
                      [bottomRole, d.strings[0], d.bottomFret],
                      [topRole,    d.strings[1], d.topFret],
                    ] as const).map(([role, si, fret]) => (
                      <div key={String(si)} className="bg-brand-bg rounded px-2 py-1.5 border border-brand-line">
                        <div className="text-brand-secondary">str {6 - Number(si)}</div>
                        <div className="font-bold text-brand-ink tabular-nums">
                          {role}={Number(fret) === 0 ? 'open' : fret}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePlay(d.frets)}
                    onMouseEnter={initAudio}
                    className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                    style={{ backgroundColor: color }}
                  >
                    ▶ Play
                  </button>

                  <button
                    onClick={() => sendToProgressions(d.frets, `${root} ${interval.label} dyad`, i)}
                    className={cn('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      addedIndices.has(i)
                        ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                    )}
                  >
                    <Plus size={12} /> {addedIndices.has(i) ? 'Added ✓' : 'Add to Progression'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        hDyads.length === 0 ? (
          <p className="text-brand-secondary text-sm">No harmonized dyads found for this combination.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hDyads.map((d, i) => {
              const color = DEGREE_COLORS[d.degreeIdx];
              return (
                <div
                  key={i}
                  className="bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {d.degreeLabel}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-brand-ink">
                          {d.bottomNote.replace(/[0-9]/g, '')} – {d.topNote.replace(/[0-9]/g, '')}
                        </h3>
                        <p className="text-xs text-brand-secondary">{d.intervalSt === 3 ? 'm3' : d.intervalSt === 4 ? 'M3' : d.intervalSt === 5 ? 'P4' : d.intervalSt === 7 ? 'P5' : d.intervalSt === 8 ? 'm6' : d.intervalSt === 9 ? 'M6' : `${d.intervalSt} st`} · fret {d.bottomFret === 0 ? 'open' : d.bottomFret}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs text-center">
                    {([
                      [d.strings[0], d.bottomFret, d.bottomNote],
                      [d.strings[1], d.topFret,    d.topNote],
                    ] as const).map(([si, fret, note]) => (
                      <div key={String(si)} className="bg-brand-bg rounded px-2 py-1.5 border border-brand-line">
                        <div className="text-brand-secondary">str {6 - Number(si)}</div>
                        <div className="font-bold text-brand-ink tabular-nums">
                          {String(note).replace(/[0-9]/g, '')}={Number(fret) === 0 ? 'open' : fret}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePlay(d.frets)}
                    onMouseEnter={initAudio}
                    className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                    style={{ backgroundColor: color }}
                  >
                    ▶ Play
                  </button>

                  <button
                    onClick={() => sendToProgressions(d.frets, `${hKey} ${hScale.label.split(' ')[0]} ${hIntervalKey} – ${d.degreeLabel}`, 1000 + i)}
                    className={cn('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      addedIndices.has(1000 + i)
                        ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                    )}
                  >
                    <Plus size={12} /> {addedIndices.has(1000 + i) ? 'Added ✓' : 'Add to Progression'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Theory */}
      <div className="border border-brand-line rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTheory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-secondary hover:text-brand-ink transition-colors"
        >
          <span>When to use dyads</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p><strong className="text-brand-ink">3rds and 6ths</strong> — the classic harmony dyad. Doubling a melody in 3rds below (or 6ths above) creates full, rich harmony with just two notes. These intervals are the backbone of country, gospel, and R&amp;B guitar. Use the <em>Harmonized Scale</em> mode to see all diatonic 3rds or 6ths for a key laid out on the neck.</p>
            <p><strong className="text-brand-ink">Root on top (inverted)</strong> — the same two notes, but the interval note sits below the root. Inverting a 3rd gives a 6th on the string pair; the physical shape is different and often easier to incorporate in scalar runs where the melody is on the top string.</p>
            <p><strong className="text-brand-ink">Perfect 4ths and 5ths</strong> — power and ambiguity. Power chords are 5th dyads. Perfect 4ths have a modern, open quality — the same interval quartal voicings are built from.</p>
            <p><strong className="text-brand-ink">7ths</strong> — tension without a full chord. A major 7th dyad sounds like the outer interval of a maj7 chord; a minor 7th like the span of a dom7.</p>
            <p><strong className="text-brand-ink">Tritones</strong> — maximum tension. A tritone contains the 3rd and 7th of a dominant chord, implying the full harmony with just two notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
