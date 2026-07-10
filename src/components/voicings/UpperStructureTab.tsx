import React, { useState, useMemo, useEffect } from 'react';
import { ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  computeUSTs,
  UST_QUALITIES,
  UST_INVERSIONS,
  UST_BASS_STRINGS,
  UST_UPPER_SETS,
  CHORD_CONTEXTS,
  getImpliedSymbol,
} from './upperStructureTriads';
import type { Note } from '../../types';

const QUALITY_COLORS: Record<'major' | 'minor', string> = {
  major: '#6366f1', // indigo
  minor: '#14b8a6', // teal
};

const BASS_COLOR = '#f97316'; // orange — always marks the chord root

const INV_COLORS: Record<string, string> = {
  root: '#64748b', // slate
  inv1: '#10b981', // emerald
  inv2: '#f43f5e', // rose
};

const UPPER_SET_HEX: Record<string, string> = {
  '432': '#8b5cf6', // violet
  '321': '#ec4899', // pink
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1, -1, -1, -1, -1, -1],
  fingers: [-1, -1, -1, -1, -1, -1] as Finger[],
};

export function UpperStructureTab() {
  const [root, setRoot] = useState<Note>('G');
  const [chordContextKey, setChordContextKey] = useState('dom7');
  const [activeQualities, setActiveQualities] = useState<Set<'major' | 'minor'>>(
    new Set(['major', 'minor'])
  );
  const [activeBassStrings, setActiveBassStrings] = useState<Set<string>>(
    new Set(['bass6', 'bass5'])
  );
  const [activeUpperSets, setActiveUpperSets] = useState<Set<string>>(
    new Set(['321'])
  );
  const [activeInversions, setActiveInversions] = useState<Set<string>>(
    new Set(['root', 'inv1', 'inv2'])
  );
  const [showTheory, setShowTheory] = useState(false);
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const allVoicings = useMemo(() => {
    const results = UST_BASS_STRINGS.flatMap(b =>
      UST_UPPER_SETS.flatMap(u =>
        UST_QUALITIES.flatMap(q => computeUSTs(root, b.stringIdx, u, q))
      )
    );
    // Global dedup across all combinations
    const seen = new Set<string>();
    return results.filter(v => {
      const key = v.allFrets.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [root]);

  const voicings = useMemo(
    () => allVoicings.filter(
      v =>
        activeQualities.has(v.ustQualityKey) &&
        activeBassStrings.has(v.bassSetKey) &&
        activeUpperSets.has(v.upperSetKey) &&
        activeInversions.has(v.inversionKey)
    ),
    [allVoicings, activeQualities, activeBassStrings, activeUpperSets, activeInversions]
  );

  useEffect(() => { setHiddenCards(new Set()); }, [voicings]);

  const toggleCard = (i: number) =>
    setHiddenCards(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const toggleQuality = (key: 'major' | 'minor') =>
    setActiveQualities(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleBassStr = (key: string) =>
    setActiveBassStrings(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleUpperSet = (key: string) =>
    setActiveUpperSets(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleInversion = (key: string) =>
    setActiveInversions(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const drillDots = useMemo(
    () => voicings.filter((_, i) => !hiddenCards.has(i)).flatMap(v => [
      // Bass note — always orange
      { stringIdx: v.bassStringIdx, fret: v.bassFret, label: 'R', color: BASS_COLOR },
      // Upper triad notes — quality color, label = extension from chord root
      ...v.upperStrings.map((si, idx) => ({
        stringIdx: si,
        fret: v.upperFrets[idx],
        label: v.extensions[idx],
        color: QUALITY_COLORS[v.ustQualityKey],
      })),
    ]),
    [voicings, hiddenCards]
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
        <h2 className="text-lg font-serif font-bold text-brand-ink">Upper Structure Triads</h2>
        <p className="text-sm text-brand-secondary mt-1">
          A triad on the upper strings over a bass note — one voicing, two harmonic layers. The triad's
          extensions color the underlying chord: D major over G creates G9#11; Ab major over G creates
          altered tension. This is how jazz pianists and guitarists unlock extended harmony.
        </p>
      </div>

      {/* Root (chord / bass note) */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Chord Root (bass note)</p>
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

      {/* Chord context */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Chord Context</p>
        <div className="flex flex-wrap gap-1.5">
          {CHORD_CONTEXTS.map(ctx => (
            <button
              key={ctx.key}
              onClick={() => setChordContextKey(ctx.key)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-colors',
                chordContextKey === ctx.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {root}{ctx.symbol ? ctx.symbol : ''} <span className="font-normal text-xs">({ctx.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fretboard + filter row */}
      <div onMouseEnter={initAudio}>
        <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mb-2">

          {/* UST quality */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary mr-0.5">Triad:</span>
            {UST_QUALITIES.map(q => (
              <button
                key={q.key}
                onClick={() => toggleQuality(q.key)}
                className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  activeQualities.has(q.key)
                    ? 'border-transparent text-white'
                    : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                )}
                style={activeQualities.has(q.key) ? { backgroundColor: QUALITY_COLORS[q.key] } : undefined}
              >
                {activeQualities.has(q.key) ? <Eye size={12} /> : <EyeOff size={12} />}
                {q.label}
              </button>
            ))}
          </div>

          {/* Bass string */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary mr-0.5">Bass:</span>
            {UST_BASS_STRINGS.map(b => (
              <button
                key={b.setKey}
                onClick={() => toggleBassStr(b.setKey)}
                className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  activeBassStrings.has(b.setKey)
                    ? 'border-transparent text-white bg-[#f97316]'
                    : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                )}
              >
                {activeBassStrings.has(b.setKey) ? <Eye size={12} /> : <EyeOff size={12} />}
                {b.label}
              </button>
            ))}
          </div>

          {/* Upper string set */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary mr-0.5">Upper:</span>
            {UST_UPPER_SETS.map(u => (
              <button
                key={u.setKey}
                onClick={() => toggleUpperSet(u.setKey)}
                className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded border text-xs font-medium transition-colors',
                  activeUpperSets.has(u.setKey)
                    ? 'border-transparent text-white'
                    : 'border-brand-line text-brand-secondary opacity-50 hover:opacity-75'
                )}
                style={activeUpperSets.has(u.setKey) ? { backgroundColor: UPPER_SET_HEX[u.setKey] } : undefined}
              >
                {activeUpperSets.has(u.setKey) ? <Eye size={12} /> : <EyeOff size={12} />}
                {u.setLabel}
              </button>
            ))}
          </div>

          {/* Inversion */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary mr-0.5">Inv:</span>
            {UST_INVERSIONS.map(inv => (
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
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mb-2 text-xs text-brand-secondary">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: BASS_COLOR }} />
            bass (R)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: QUALITY_COLORS.major }} />
            maj triad
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: QUALITY_COLORS.minor }} />
            min triad
          </span>
        </div>

        <Fretboard
          fretsNum={12}
          chord={MUTED_CHORD}
          drillDots={drillDots}
          playingNotes={playingNotes}
          showNoteNames={false}
          showAllNotes={false}
          compact
        />
      </div>

      {/* Cards */}
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No voicings match the current filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const qualityColor = QUALITY_COLORS[v.ustQualityKey];
            const invColor = INV_COLORS[v.inversionKey];
            const upperSetColor = UPPER_SET_HEX[v.upperSetKey];
            const isActive = !hiddenCards.has(i);
            const implied = getImpliedSymbol(root, chordContextKey, v.ustRootInterval, v.ustQualityKey);
            const bassStr = `Str ${6 - v.bassStringIdx}`;
            const extensionsStr = v.extensions.join(' · ');
            return (
              <div
                key={i}
                className={cn('bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3 transition-opacity duration-200', !isActive && 'opacity-40')}
                style={{ borderLeft: `4px solid ${qualityColor}` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: qualityColor }} />
                      <h3 className="text-sm font-bold text-brand-ink">
                        {v.ustRootNote} {v.ustQualityLabel}
                      </h3>
                      <span className="text-sm font-normal text-brand-secondary">/ {root} bass</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white leading-none"
                        style={{ backgroundColor: invColor }}
                      >
                        {v.inversionShortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">
                      {bassStr} → <span style={{ color: upperSetColor }}>{v.upperSetLabel}</span>
                      {' · '}adds: <span className="font-semibold text-brand-ink">{extensionsStr}</span>
                    </p>
                    {implied && (
                      <p className="text-xs mt-0.5 pl-4 font-semibold" style={{ color: qualityColor }}>
                        ≈ {implied}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCard(i)}
                    className="p-0.5 mt-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors flex-shrink-0"
                    title={isActive ? 'Hide on fretboard' : 'Show on fretboard'}
                  >
                    {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>

                {/* Note boxes — bass + upper triad */}
                <div className="grid grid-cols-4 gap-1">
                  {/* Bass note */}
                  <div className="bg-brand-bg rounded-lg px-1.5 py-2 border-2 border-brand-line text-center" style={{ borderColor: BASS_COLOR }}>
                    <div className="text-[10px] text-brand-secondary">str {6 - v.bassStringIdx}</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: BASS_COLOR }}>
                      {v.bassNote.replace(/[0-9]/g, '')}
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: BASS_COLOR }}>R</div>
                    <div className="text-[11px] font-semibold text-brand-ink tabular-nums">
                      {v.bassFret === 0 ? 'open' : `fret ${v.bassFret}`}
                    </div>
                  </div>
                  {/* Upper triad notes */}
                  {v.upperStrings.map((si, idx) => (
                    <div key={si} className="bg-brand-bg rounded-lg px-1.5 py-2 border border-brand-line text-center">
                      <div className="text-[10px] text-brand-secondary">str {6 - si}</div>
                      <div className="text-sm font-bold mt-0.5" style={{ color: qualityColor }}>
                        {v.upperNotes[idx].replace(/[0-9]/g, '')}
                      </div>
                      <div className="text-[10px] font-semibold" style={{ color: qualityColor }}>
                        {v.extensions[idx]}
                      </div>
                      <div className="text-[11px] font-semibold text-brand-ink tabular-nums">
                        {v.upperFrets[idx] === 0 ? 'open' : `fret ${v.upperFrets[idx]}`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Play */}
                <button
                  onClick={() => handlePlay(v.allFrets)}
                  onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: qualityColor }}
                >
                  ▶ Play
                </button>

                {/* Add to progression */}
                <button
                  onClick={() => sendToProgressions(
                    v.allFrets,
                    `${root} + ${v.ustRootNote}${v.ustQualityKey === 'major' ? 'maj' : 'm'} UST`,
                    i
                  )}
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
          <span>How upper structure triads work</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p><strong className="text-brand-ink">The concept</strong> — an upper structure triad (UST) splits a chord into two layers: a single bass note on a low string and a complete triad on the upper strings. The bass note anchors the harmony; the triad supplies the color extensions. Because the triad is a compact, familiar shape, your fingers find it instantly while the harmony sounds complex.</p>
            <p><strong className="text-brand-ink">Over dominant 7 chords</strong> — dominant chords accept the widest range of USTs. The most common ones are: <em>II major</em> (adds 9, #11, 13 — Lydian dominant sound), <em>bII major</em> (adds b9, 11, b13 — altered/symmetric diminished), <em>bVII major</em> (adds b7, 9, 11 — suspended sound), and <em>bVI major</em> (adds b13, R, b3 — altered tension). Each creates a distinctly different color over the same bass note.</p>
            <p><strong className="text-brand-ink">Over major 7 chords</strong> — <em>II major</em> gives the Lydian #11 sound. <em>III minor</em> stacks 3, 5, and 7 — the cleanest voicing of a major 9. <em>V major</em> adds 5, 7, and 9 — a warm, open sound.</p>
            <p><strong className="text-brand-ink">Over minor 7 chords</strong> — <em>bIII major</em> (adds b3, 5, b7) is the classic minor 9 sound. <em>IV major</em> adds 11 and the 6/13 — brighter and more open. <em>bVII major</em> gives the Dorian 9, 11 flavor.</p>
            <p><strong className="text-brand-ink">Inversion of the upper triad</strong> — which note of the triad sits on the lowest upper string matters for voice leading and register. Root position is most stable; 1st inversion moves the 3rd to the bottom, which creates smoother motion when connecting voicings; 2nd inversion puts the 5th at the bottom, which can feel more ambiguous and works well as a passing chord.</p>
            <p><strong className="text-brand-ink">Practical technique</strong> — play the bass note with your thumb (or a barre) and the upper triad with fingers 1, 2, and 3. When practicing, first play the bass note alone so you hear the root, then add the triad. Train your ear to hear what each UST root degree adds to the underlying chord quality.</p>
          </div>
        )}
      </div>
    </div>
  );
}
