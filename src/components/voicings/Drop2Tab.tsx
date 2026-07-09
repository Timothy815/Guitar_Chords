import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { computeDrop2Voicings, DROP2_QUALITIES, Drop2Voicing } from './drop2';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  '6-3': { hex: '#f59e0b', label: 'Strings 6–3' }, // amber
  '5-2': { hex: '#14b8a6', label: 'Strings 5–2' }, // teal
  '4-1': { hex: '#8b5cf6', label: 'Strings 4–1' }, // violet
};

const INV_COLORS: Record<string, string> = {
  inv0: '#f59e0b', // amber
  inv1: '#14b8a6', // teal
  inv2: '#8b5cf6', // violet
  inv3: '#ec4899', // pink
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function Drop2Tab() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState('maj7');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [dotLabel, setDotLabel] = useState<'role' | 'note'>('role');
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(new Set(['6-3', '5-2', '4-1']));
  const [activeInversions, setActiveInversions] = useState<Set<string>>(new Set(['inv0', 'inv1', 'inv2', 'inv3']));
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [showTheory, setShowTheory] = useState(false);

  const quality = DROP2_QUALITIES.find(q => q.key === qualityKey)!;
  const allVoicings = useMemo(() => computeDrop2Voicings(root, quality), [root, quality]);

  const voicings = useMemo(() =>
    allVoicings.filter(v => activeStringSets.has(v.setKey) && activeInversions.has(v.inversionKey)),
    [allVoicings, activeStringSets, activeInversions]
  );

  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const toggleCard = (i: number) => setHiddenCards(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
  });
  useEffect(() => { setHiddenCards(new Set()); }, [voicings]);

  const drillDots = useMemo(() =>
    voicings
      .filter((_, i) => !hiddenCards.has(i))
      .flatMap(v =>
        v.strings.map((si, ni) => ({
          stringIdx: si,
          fret: v.frets[si],
          label: dotLabel === 'role' ? v.notes[ni].role : v.notes[ni].name.replace(/[0-9]/g, ''),
          color: SET_CONFIG[v.setKey].hex,
        }))
      ),
    [voicings, hiddenCards, dotLabel]
  );

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleInversion = (key: string) =>
    setActiveInversions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (v: Drop2Voicing) => {
    await initAudio();
    const notes = v.frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (v: Drop2Voicing, index: number) => {
    const chord: ChordShape = {
      name: `${root}${quality.label} drop2`,
      frets: v.frets,
      fingers: v.frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
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
        <h2 className="text-lg font-serif font-bold text-brand-ink">Drop 2 Voicings</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Four-note chord (R–3–5–7) with the 2nd-highest note dropped an octave — the workhorse of jazz guitar comping.
        </p>
      </div>

      {/* Root selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Root</p>
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

      {/* Quality selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Quality</p>
        <div className="flex flex-wrap gap-1.5">
          {DROP2_QUALITIES.map(q => (
            <button
              key={q.key}
              onClick={() => setQualityKey(q.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                qualityKey === q.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inversion filter */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Inversion</p>
        <div className="flex flex-wrap gap-1.5">
          {(['inv0', 'inv1', 'inv2', 'inv3'] as const).map((key, i) => {
            const labels = ['5th in bass', '7th in bass', 'Root in bass', '3rd in bass'];
            const isOn = activeInversions.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleInversion(key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border',
                  isOn
                    ? 'text-white border-transparent'
                    : 'bg-brand-bg border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                )}
                style={isOn ? { backgroundColor: INV_COLORS[key] } : undefined}
              >
                {labels[i]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formula row */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {(['R', '3', '5', '7'] as const).map((role, i) => {
          const intervals = [0, quality.thirdSt, quality.fifthSt, quality.seventhSt];
          const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
          return (
            <React.Fragment key={role}>
              {i > 0 && <span className="text-brand-line">·</span>}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                  style={{ backgroundColor: colors[i] }}
                >
                  {role}
                </span>
                <span className="text-brand-secondary">{intervals[i]} st</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Fretboard */}
      <div onMouseEnter={initAudio}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-2">
            {Object.entries(SET_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => toggleSet(key)}
                className={cn('flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
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
          fretsNum={15}
          chord={MUTED_CHORD}
          drillDots={drillDots}
          playingNotes={playingNotes}
          showNoteNames={false}
          showAllNotes={showAllNotes}
          compact
        />

        <div className="flex justify-end mt-1">
          <button
            onClick={() => setDotLabel(v => v === 'role' ? 'note' : 'role')}
            className={cn('text-xs px-2.5 py-0.5 rounded border transition-colors',
              dotLabel === 'note'
                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
            )}
          >
            {dotLabel === 'role' ? 'Labels: R / 3 / 5 / 7' : 'Labels: note names'}
          </button>
        </div>
      </div>

      {/* Voicing cards */}
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No Drop 2 voicings found for this selection.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const color = SET_CONFIG[v.setKey].hex;
            const invColor = INV_COLORS[v.inversionKey];
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
                      <h3 className="text-sm font-bold text-brand-ink">{v.setLabel}</h3>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">{v.openNames}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: invColor }}
                    >
                      {v.inversionLabel}
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

                {/* Note roles */}
                <div className="flex items-center gap-3">
                  {v.notes.map(({ role, name }, ni) => (
                    <div key={ni} className="flex items-center gap-1">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                        style={{ backgroundColor: color }}
                      >
                        {role}
                      </span>
                      <span className="text-sm font-semibold text-brand-ink">{name.replace(/[0-9]/g, '')}</span>
                    </div>
                  ))}
                </div>

                {/* Fret map — 4 columns for 4 strings */}
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-1.5 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - si}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {v.notes[ri].role}={v.frets[si] === 0 ? 'open' : v.frets[si]}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlay(v)}
                  onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                  style={{ backgroundColor: color }}
                >
                  ▶ Play
                </button>

                <button
                  onClick={() => sendToProgressions(v, i)}
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

      {/* Theory note */}
      <div className="border border-brand-line rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTheory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-secondary hover:text-brand-ink transition-colors"
        >
          <span>What makes Drop 2 special?</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p>Start with a close-position four-note chord stacked in thirds (R–3–5–7). The 2nd-highest note — the 5th in root position — gets dropped an octave. The result spreads the voicing across a wider range while keeping all four notes on adjacent strings.</p>
            <p>This is the bread-and-butter voicing for jazz guitar: it sits comfortably under the hand, moves smoothly between inversions, and leaves the top string free for a melody note above the chord.</p>
            <p>The four inversions cycle through which chord tone sits in the bass: 5th → 7th → Root → 3rd. Practice connecting them on a single string set by moving up the neck, then try the same progression across all three string sets to hear the same harmony in different registers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
