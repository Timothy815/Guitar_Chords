import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { computeTensionVoicings, TENSION_QUALITIES } from './tensions';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  '6-3': { hex: '#f59e0b', label: 'Str 6–3' },
  '5-2': { hex: '#14b8a6', label: 'Str 5–2' },
  '4-1': { hex: '#8b5cf6', label: 'Str 4–1' },
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function TensionsTab() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState('maj7');
  const [tensionKey, setTensionKey] = useState('9');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(new Set(['6-3', '5-2', '4-1']));
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [showTheory, setShowTheory] = useState(false);

  const quality = TENSION_QUALITIES.find(q => q.key === qualityKey)!;

  // Reset tension key when quality changes if current tension isn't available
  useEffect(() => {
    const keys = quality.tensions.map(t => t.key);
    if (!keys.includes(tensionKey)) setTensionKey(keys[0]);
  }, [qualityKey, tensionKey, quality.tensions]);

  const tension = quality.tensions.find(t => t.key === tensionKey) ?? quality.tensions[0];

  const allVoicings = useMemo(
    () => computeTensionVoicings(root, quality.thirdSt, quality.seventhSt, tension.semitones, tension.label),
    [root, quality, tension]
  );

  const voicings = useMemo(() =>
    allVoicings.filter(v => activeStringSets.has(v.setKey)),
    [allVoicings, activeStringSets]
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
          label: v.notes[ni].role,
          color: SET_CONFIG[v.setKey].hex,
        }))
      ),
    [voicings, hiddenCards]
  );

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (v: ReturnType<typeof computeTensionVoicings>[0]) => {
    await initAudio();
    const notes = v.frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (v: ReturnType<typeof computeTensionVoicings>[0], index: number) => {
    const chord: ChordShape = {
      name: `${root}${quality.label}(${tension.label})`,
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
        <h2 className="text-lg font-serif font-bold text-brand-ink">Tension Add-ons</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Shell voicing (R–3–7) plus one extension on the adjacent higher string — add color without losing the chord's core.
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
          {TENSION_QUALITIES.map(q => (
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

      {/* Tension selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Tension</p>
        <div className="flex flex-wrap gap-1.5">
          {quality.tensions.map(t => (
            <button
              key={t.key}
              onClick={() => setTensionKey(t.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                tensionKey === t.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formula row */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {['R', '3', '7', tension.label].map((role, i) => {
          const colors = ['#f59e0b', '#22c55e', '#a855f7', '#3b82f6'];
          const descs = [
            `root (${root})`,
            `3rd (${quality.thirdSt} st)`,
            `7th (${quality.seventhSt} st)`,
            `tension (${tension.semitones} st)`,
          ];
          return (
            <React.Fragment key={role}>
              {i > 0 && <span className="text-brand-line">+</span>}
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: colors[i] }}>
                  {role}
                </span>
                <span className="text-brand-secondary text-xs">{descs[i]}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Fretboard */}
      <div onMouseEnter={initAudio}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-2">
            {Object.entries(SET_CONFIG).map(([key, cfg]) => {
              const isOn = activeStringSets.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleSet(key)}
                  className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                    isOn
                      ? 'border-transparent text-white'
                      : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                  )}
                  style={isOn ? { backgroundColor: cfg.hex } : undefined}
                >
                  {isOn ? <Eye size={12} /> : <EyeOff size={12} />}
                  {cfg.label}
                </button>
              );
            })}
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
      </div>

      {/* Cards */}
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No tension voicings found for this selection.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const color = SET_CONFIG[v.setKey].hex;
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
                      <h3 className="text-sm font-bold text-brand-ink">{SET_CONFIG[v.setKey].label}</h3>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">
                      {root}{quality.label}({tension.label})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-brand-secondary tabular-nums">
                      fret {v.rootFret === 0 ? 'open' : v.rootFret}
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
                <div className="flex items-center flex-wrap gap-3">
                  {v.notes.map(({ role, name }, ni) => (
                    <div key={ni} className="flex items-center gap-1">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {role}
                      </span>
                      <span className="text-sm font-semibold text-brand-ink">{name.replace(/[0-9]/g, '')}</span>
                    </div>
                  ))}
                </div>

                {/* Fret map — 4 columns */}
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-1 py-1.5 border border-brand-line">
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

      {/* Theory */}
      <div className="border border-brand-line rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTheory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-secondary hover:text-brand-ink transition-colors"
        >
          <span>How to use tensions</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p>A tension is an extension above the basic 7th chord: 9th, 11th, or 13th. Adding one to a shell voicing (R–3–7) gives the chord color and sophistication without losing its harmonic function.</p>
            <p>The tension goes on the string <em>above</em> the 7th, so it's always the highest-sounding note — which means it sits on top of the chord and is easily heard as the "color" note, especially when you're comping under a soloist.</p>
            <p><strong className="text-brand-ink">Available tensions by quality:</strong></p>
            <ul className="space-y-1 pl-2">
              <li><strong className="text-brand-ink">maj7</strong> — 9, ♯11, 13 (avoid the 11th — it clashes with the major 3rd)</li>
              <li><strong className="text-brand-ink">m7</strong> — 9, 11</li>
              <li><strong className="text-brand-ink">dom7</strong> — all 6 tensions; choice depends on the scale context (♭9 and ♯9 for altered dominant; ♯11 for Lydian dominant; 13 or ♭13 for Mixolydian)</li>
              <li><strong className="text-brand-ink">m7♭5</strong> — 9, 11</li>
              <li><strong className="text-brand-ink">dim7</strong> — 9, 11</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
