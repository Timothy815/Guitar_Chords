import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { computeDyads, DYAD_INTERVALS } from './dyads';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  '6-5': { hex: '#f59e0b', label: 'Str 6–5' },
  '5-4': { hex: '#14b8a6', label: 'Str 5–4' },
  '4-3': { hex: '#8b5cf6', label: 'Str 4–3' },
  '3-2': { hex: '#ec4899', label: 'Str 3–2' },
  '2-1': { hex: '#10b981', label: 'Str 2–1' },
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function DyadsTab() {
  const [root, setRoot] = useState<Note>('G');
  const [intervalKey, setIntervalKey] = useState('M3');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(
    new Set(['6-5', '5-4', '4-3', '3-2', '2-1'])
  );
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [showTheory, setShowTheory] = useState(false);

  const interval = DYAD_INTERVALS.find(i => i.key === intervalKey)!;
  const allDyads = useMemo(() => computeDyads(root, interval.semitones), [root, interval.semitones]);
  const dyads = useMemo(() =>
    allDyads.filter(d => activeStringSets.has(d.setKey)),
    [allDyads, activeStringSets]
  );

  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const toggleCard = (i: number) => setHiddenCards(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
  });
  useEffect(() => { setHiddenCards(new Set()); }, [dyads]);

  const drillDots = useMemo(() =>
    dyads
      .filter((_, i) => !hiddenCards.has(i))
      .flatMap(d => [
        { stringIdx: d.strings[0], fret: d.bottomFret, label: d.bottomNote.replace(/[0-9]/g, ''), color: SET_CONFIG[d.setKey].hex },
        { stringIdx: d.strings[1], fret: d.topFret,    label: d.topNote.replace(/[0-9]/g, ''),    color: SET_CONFIG[d.setKey].hex },
      ]),
    [dyads, hiddenCards]
  );

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (d: ReturnType<typeof computeDyads>[0]) => {
    await initAudio();
    const notes = d.frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (d: ReturnType<typeof computeDyads>[0], index: number) => {
    const chord: ChordShape = {
      name: `${root} ${interval.label} dyad`,
      frets: d.frets,
      fingers: d.frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
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

      {/* Bottom note selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Bottom Note</p>
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

      {/* Interval selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Interval</p>
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
      </div>

      {/* Fretboard */}
      <div onMouseEnter={initAudio}>
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
      {dyads.length === 0 ? (
        <p className="text-brand-secondary text-sm">No dyads found for this combination.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dyads.map((d, i) => {
            const color = SET_CONFIG[d.setKey].hex;
            const isActive = !hiddenCards.has(i);
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

                {/* Notes */}
                <div className="flex items-center gap-6">
                  {[
                    { label: 'R', note: d.bottomNote },
                    { label: interval.key, note: d.topNote },
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

                {/* Fret map */}
                <div className="grid grid-cols-2 gap-1 text-xs text-center">
                  {([['R', d.strings[0], d.bottomFret], [interval.key, d.strings[1], d.topFret]] as const).map(([role, si, fret]) => (
                    <div key={String(si)} className="bg-brand-bg rounded px-2 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - Number(si)}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {role}={Number(fret) === 0 ? 'open' : fret}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlay(d)}
                  onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                  style={{ backgroundColor: color }}
                >
                  ▶ Play
                </button>

                <button
                  onClick={() => sendToProgressions(d, i)}
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
            <p><strong className="text-brand-ink">3rds and 6ths</strong> — the classic harmony dyad. When you double a melody in 3rds below (or 6ths above), the result sounds full without needing all four voices. Used everywhere from Bach to country to R&amp;B.</p>
            <p><strong className="text-brand-ink">Perfect 4ths and 5ths</strong> — power and ambiguity. Power chords are 5th dyads (root + P5, or root + P4 + P5). Perfect 4ths sound open and modern — the same interval quartal voicings are built from.</p>
            <p><strong className="text-brand-ink">7ths</strong> — tension without a full chord. A major 7th dyad sounds like the outside interval of a maj7 chord; a minor 7th like the span of a dom7. Good for creating colour with minimal notes.</p>
            <p><strong className="text-brand-ink">Tritones</strong> — maximum tension. A tritone dyad contains the 3rd and 7th of a dominant chord (e.g., B and F for G7). That's why it defines the dominant sound — the full chord is implied by just two notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
