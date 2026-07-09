import React, { useState, useMemo } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { computeQuartalVoicings, QUARTAL_STACKS } from './quartal';
import type { Note } from '../../types';

const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  // 3-string
  '6-4': { hex: '#f59e0b', label: 'Str 6–4' },
  '5-3': { hex: '#14b8a6', label: 'Str 5–3' },
  '4-2': { hex: '#8b5cf6', label: 'Str 4–2' },
  '3-1': { hex: '#ec4899', label: 'Str 3–1' },
  // 4-string
  '6-3': { hex: '#f59e0b', label: 'Str 6–3' },
  '5-2': { hex: '#14b8a6', label: 'Str 5–2' },
  '4-1': { hex: '#8b5cf6', label: 'Str 4–1' },
};

const THREE_SET_KEYS = ['6-4', '5-3', '4-2', '3-1'];
const FOUR_SET_KEYS  = ['6-3', '5-2', '4-1'];

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function QuartalTab() {
  const [bottomNote, setBottomNote] = useState<Note>('G');
  const [stackKey, setStackKey] = useState('3pure');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(new Set(THREE_SET_KEYS));
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [showTheory, setShowTheory] = useState(false);

  const stack = QUARTAL_STACKS.find(s => s.key === stackKey)!;
  const is4note = stack.intervals.length === 4;
  const relevantSetKeys = is4note ? FOUR_SET_KEYS : THREE_SET_KEYS;

  const handleStackChange = (key: string) => {
    setStackKey(key);
    const newStack = QUARTAL_STACKS.find(s => s.key === key)!;
    setActiveStringSets(new Set(newStack.intervals.length === 4 ? FOUR_SET_KEYS : THREE_SET_KEYS));
  };

  const allVoicings = useMemo(() => computeQuartalVoicings(bottomNote, stack), [bottomNote, stack]);
  const voicings = allVoicings.filter(v => activeStringSets.has(v.setKey));

  const drillDots = useMemo(() =>
    allVoicings
      .filter(v => activeStringSets.has(v.setKey))
      .flatMap(v =>
        v.strings.map((si, i) => ({
          stringIdx: si,
          fret: v.fretValues[i],
          label: v.notes[i].replace(/[0-9]/g, ''),
          color: SET_CONFIG[v.setKey].hex,
        }))
      ),
    [allVoicings, activeStringSets]
  );

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (v: ReturnType<typeof computeQuartalVoicings>[0]) => {
    await initAudio();
    const notes = v.frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (v: ReturnType<typeof computeQuartalVoicings>[0], index: number) => {
    const chord: ChordShape = {
      name: `${bottomNote} quartal`,
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
        <h2 className="text-lg font-serif font-bold text-brand-ink">Quartal Voicings</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Chords built by stacking perfect 4ths — open, ambiguous, and unmistakably modern. The sound of Miles Davis, Herbie Hancock, and McCoy Tyner.
        </p>
      </div>

      {/* Bottom note selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Bottom Note</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_NOTES.map(note => (
            <button
              key={note}
              onClick={() => setBottomNote(note as Note)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                bottomNote === note
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Stack type selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Stack</p>
        <div className="flex flex-wrap gap-1.5">
          {QUARTAL_STACKS.map(s => (
            <button
              key={s.key}
              onClick={() => handleStackChange(s.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                stackKey === s.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {s.shortLabel}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-secondary/70 mt-2">{stack.label}</p>
      </div>

      {/* Fretboard */}
      <div onMouseEnter={initAudio}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex flex-wrap gap-2">
            {relevantSetKeys.map(key => {
              const cfg = SET_CONFIG[key];
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
        <p className="text-brand-secondary text-sm">No quartal voicings found for this selection in frets 0–12.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const color = SET_CONFIG[v.setKey].hex;
            const cols = is4note ? 4 : 3;
            const isActive = activeStringSets.has(v.setKey);
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
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">{stack.shortLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-brand-secondary tabular-nums">
                      fret {v.fretValues[0] === 0 ? 'open' : v.fretValues[0]}
                    </span>
                    <button
                      onClick={() => toggleSet(v.setKey)}
                      className="p-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors"
                      title={isActive ? 'Hide on fretboard' : 'Show on fretboard'}
                    >
                      {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-center flex-wrap gap-3">
                  {v.notes.map((note, ni) => (
                    <div key={ni} className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}>
                        {ni + 1}
                      </span>
                      <span className="text-sm font-semibold text-brand-ink">{note.replace(/[0-9]/g, '')}</span>
                    </div>
                  ))}
                </div>

                {/* Fret map */}
                <div className={`grid gap-1 text-xs text-center`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-1 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - si}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {v.fretValues[ri] === 0 ? 'open' : v.fretValues[ri]}
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
          <span>Why do quartal voicings sound so open?</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p>Traditional tertian harmony (major/minor chords) stacks major and minor 3rds. Those intervals define the chord's quality immediately — you hear "major" or "minor" right away. Quartal voicings stack 4ths instead, and 4ths don't declare a major or minor quality. The sound is harmonically ambiguous — it fits over many different chord symbols.</p>
            <p>That ambiguity is the point. A Gmaj7, Am7, or D7sus4 can all be comped with the same quartal stack at the right moment. Jazz pianists use this to "float" above the bass player's root note without locking in a single chord quality.</p>
            <p>The <strong className="text-brand-ink">"So What" voicing</strong> (P4–P4–M3) is Bill Evans' adaptation for piano, from the Miles Davis track "So What." The final M3 closes the stack and grounds it slightly — it implies a Dorian minor sound without stating a triad.</p>
            <p>On guitar: the pure P4–P4 stack sits perfectly in standard tuning because strings are tuned a 4th apart. Many shapes are moveable barre-style positions with just 1–2 fingers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
