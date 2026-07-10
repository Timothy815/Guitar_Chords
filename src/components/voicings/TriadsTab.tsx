import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { computeTriads, TRIAD_QUALITIES, TRIAD_INVERSIONS, TRIAD_STRING_SETS } from './triads';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string }> = {
  '654': { hex: '#f59e0b' }, // amber
  '543': { hex: '#14b8a6' }, // teal
  '432': { hex: '#8b5cf6' }, // violet
  '321': { hex: '#ec4899' }, // pink
};

const INV_COLORS: Record<string, string> = {
  root: '#6366f1', // indigo
  inv1: '#10b981', // emerald
  inv2: '#f43f5e', // rose
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function TriadsTab() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState('major');
  const [activeInversions, setActiveInversions] = useState<Set<string>>(
    new Set(['root', 'inv1', 'inv2'])
  );
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(
    new Set(['654', '543', '432', '321'])
  );
  const [dotLabel, setDotLabel] = useState<'role' | 'note'>('note');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showTheory, setShowTheory] = useState(false);
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const quality = TRIAD_QUALITIES.find(q => q.key === qualityKey)!;

  const allVoicings = useMemo(
    () => computeTriads(root, quality),
    [root, quality]
  );

  const voicings = useMemo(
    () => allVoicings.filter(
      v => activeStringSets.has(v.setKey) && activeInversions.has(v.inversionKey)
    ),
    [allVoicings, activeStringSets, activeInversions]
  );

  useEffect(() => { setHiddenCards(new Set()); }, [voicings]);

  const toggleCard = (i: number) =>
    setHiddenCards(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const toggleInversion = (key: string) =>
    setActiveInversions(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const drillDots = useMemo(() =>
    voicings
      .filter((_, i) => !hiddenCards.has(i))
      .flatMap(v =>
        v.strings.map((si, idx) => ({
          stringIdx: si,
          fret: v.frets[idx],
          label: dotLabel === 'role' ? v.roles[idx] : v.notes[idx].replace(/[0-9]/g, ''),
          color: SET_CONFIG[v.setKey].hex,
        }))
      ),
    [voicings, hiddenCards, dotLabel]
  );

  const handlePlay = async (allFrets: number[]) => {
    await initAudio();
    const notes = allFrets
      .map((f, si) => f === -1 ? null : getFretNote(si, f))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'up');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (allFrets: number[], name: string, index: number) => {
    const chord: ChordShape = {
      name,
      frets: allFrets as any,
      fingers: allFrets.map(f => (f === -1 ? -1 : 0)) as Finger[],
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
    setTimeout(
      () => setAddedIndices(prev => { const n = new Set(prev); n.delete(index); return n; }),
      1500
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-serif font-bold text-brand-ink">Triads on String Sets</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Three-note chords across every adjacent string group — root position, 1st, and 2nd inversions. The most direct way to map chord tones up and down the neck.
        </p>
      </div>

      {/* Root */}
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

      {/* Quality */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Quality</p>
        <div className="flex flex-wrap gap-1.5">
          {TRIAD_QUALITIES.map(q => (
            <button
              key={q.key}
              onClick={() => setQualityKey(q.key)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-colors',
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

      {/* Fretboard + filters */}
      <div onMouseEnter={initAudio}>
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 mb-2">
          {/* Inversion toggles */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-brand-secondary mr-0.5">Inversion:</span>
            {TRIAD_INVERSIONS.map(inv => (
              <button
                key={inv.key}
                onClick={() => toggleInversion(inv.key)}
                className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  activeInversions.has(inv.key)
                    ? 'border-transparent text-white'
                    : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                )}
                style={activeInversions.has(inv.key) ? { backgroundColor: INV_COLORS[inv.key] } : undefined}
              >
                {activeInversions.has(inv.key) ? <Eye size={12} /> : <EyeOff size={12} />}
                {inv.shortLabel}
              </button>
            ))}
          </div>

          {/* String set toggles + label toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-brand-secondary mr-0.5">Strings:</span>
            {TRIAD_STRING_SETS.map(ss => (
              <button
                key={ss.setKey}
                onClick={() => toggleSet(ss.setKey)}
                className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  activeStringSets.has(ss.setKey)
                    ? 'border-transparent text-white'
                    : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                )}
                style={activeStringSets.has(ss.setKey) ? { backgroundColor: SET_CONFIG[ss.setKey].hex } : undefined}
              >
                {activeStringSets.has(ss.setKey) ? <Eye size={12} /> : <EyeOff size={12} />}
                {ss.setLabel}
              </button>
            ))}
            <button
              onClick={() => setDotLabel(v => v === 'role' ? 'note' : 'role')}
              className="text-xs px-2.5 py-0.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary transition-colors"
            >
              Dots: {dotLabel}
            </button>
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
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No voicings match the current filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const setColor = SET_CONFIG[v.setKey].hex;
            const invColor = INV_COLORS[v.inversionKey];
            const isActive = !hiddenCards.has(i);
            const minFret = Math.min(...v.frets);
            const posLabel = minFret === 0 ? 'Open pos' : `Pos ${minFret}`;
            return (
              <div
                key={i}
                className={cn('bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3 transition-opacity duration-200', !isActive && 'opacity-40')}
                style={{ borderLeft: `4px solid ${setColor}` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: setColor }} />
                      <h3 className="text-sm font-bold text-brand-ink">{v.setLabel}</h3>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white leading-none"
                        style={{ backgroundColor: invColor }}
                      >
                        {v.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">{v.openNames} · {posLabel}</p>
                  </div>
                  <button
                    onClick={() => toggleCard(i)}
                    className="p-0.5 mt-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors flex-shrink-0"
                    title={isActive ? 'Hide on fretboard' : 'Show on fretboard'}
                  >
                    {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>

                {/* Note boxes — one per string */}
                <div className="grid grid-cols-3 gap-1.5">
                  {v.strings.map((si, idx) => (
                    <div key={si} className="bg-brand-bg rounded-lg px-2 py-2 border border-brand-line text-center">
                      <div className="text-[10px] text-brand-secondary">str {6 - si}</div>
                      <div className="text-sm font-bold mt-0.5" style={{ color: setColor }}>
                        {v.notes[idx].replace(/[0-9]/g, '')}
                      </div>
                      <div className="text-[10px] font-semibold text-brand-secondary/80">{v.roles[idx]}</div>
                      <div className="text-[11px] font-semibold text-brand-ink tabular-nums">
                        {v.frets[idx] === 0 ? 'open' : `fret ${v.frets[idx]}`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Play */}
                <button
                  onClick={() => handlePlay(v.allFrets)}
                  onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: setColor }}
                >
                  ▶ Play
                </button>

                {/* Add to progression */}
                <button
                  onClick={() => sendToProgressions(v.allFrets, `${root} ${quality.label} (${v.shortLabel})`, i)}
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
          <span>How to use triad inversions</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p><strong className="text-brand-ink">Root position</strong> — root is the lowest note. Clear and grounded; the bass note announces the chord quality. This is the shape most guitarists learn first.</p>
            <p><strong className="text-brand-ink">1st inversion</strong> — 3rd in the bass. Softer and more ambiguous than root position. Great for smooth bass motion (e.g., I → I/3 → IV creates stepwise movement in the bass line).</p>
            <p><strong className="text-brand-ink">2nd inversion</strong> — 5th in the bass. Unstable — creates a sense of motion that wants to resolve. The classic cadential 6/4 uses a I chord in 2nd inversion just before the final dominant.</p>
            <p><strong className="text-brand-ink">Tiling the neck</strong> — each string group has exactly three shapes, one at each position on the neck. Together they cover the full range without position jumps. Practicing all three inversions on one string set is the most efficient way to learn every chord tone position in an area.</p>
            <p><strong className="text-brand-ink">Voice leading between string sets</strong> — the 2nd inversion on one string set shares notes with the root position on the adjacent string set above it. These overlaps create smooth voice leading when you move between string sets instead of jumping between positions.</p>
            <p><strong className="text-brand-ink">Chord melody and fills</strong> — triads on the top string sets (4–3–2, 3–2–1) sit directly under the melody. Playing triads in the right inversion to match where your melody note falls is the foundation of chord melody guitar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
