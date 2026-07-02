import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Dumbbell } from 'lucide-react';
import { cn } from '../lib/utils';
import { DRILLS, getDrillBest, saveDrillBest } from '../data/drillData';
import type { Drill } from '../data/drillData';
import { COMMON_CHORDS } from '../data/guitarData';
import type { Note, ChordShape } from '../types';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playClick, playNote, getFretNote } from '../lib/audio';

type FrettingCategory = 'chromatic' | 'spider' | 'legato' | 'stretch';
type PickingCategory  = 'alternate' | 'economy' | 'pima' | 'travis';
type Category = FrettingCategory | PickingCategory;

const FRETTING_CATEGORIES: FrettingCategory[] = ['chromatic', 'spider', 'legato', 'stretch'];
const PICKING_CATEGORIES:  PickingCategory[]  = ['alternate', 'economy', 'pima', 'travis'];

const NOTES: Note[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CATEGORY_LABELS: Record<Category, string> = {
  chromatic: 'Chromatic',
  spider: 'Spider',
  legato: 'Legato',
  stretch: 'Stretch',
  alternate: 'Alternate',
  economy: 'Economy',
  pima: 'PIMA',
  travis: 'Travis',
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  chromatic: 'Finger independence across all strings',
  spider: 'Cross-string coordination and string crossing',
  legato: 'Hammer-on and pull-off strength',
  stretch: 'Reach and fret-span conditioning',
  alternate: 'Strict down-up pick alternation',
  economy: 'Sweep through string changes — no wasted motion',
  pima: 'Classical right-hand fingerpicking patterns',
  travis: 'Alternating thumb bass with melody fingers',
};

export function Technique() {
  const [activeTab, setActiveTab] = useState<Category>('chromatic');
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null);
  const [bpm, setBpm] = useState(60);
  const [bpmDraft, setBpmDraft] = useState('60');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playNotes, setPlayNotes] = useState(true);
  const [bestFlash, setBestFlash] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [chordRoot, setChordRoot] = useState<Note | null>(null);
  const [selectedChord, setSelectedChord] = useState<ChordShape | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep playNotes readable inside the interval without restarting it on toggle
  const playNotesRef = useRef(playNotes);
  useEffect(() => { playNotesRef.current = playNotes; }, [playNotes]);

  const showChordPicker = activeTab === 'pima' || activeTab === 'travis';

  const tabDrills = DRILLS.filter(d => d.category === activeTab);
  const selectedDrill: Drill | null = selectedDrillId
    ? (DRILLS.find(d => d.id === selectedDrillId) ?? null)
    : null;

  // Effective steps — frets overridden by selected chord where the string isn't muted.
  // chord.frets stores absolute fret positions, so we use the value directly.
  const effectiveSteps = selectedDrill
    ? selectedDrill.steps.map(s => {
        if (selectedChord) {
          const f = selectedChord.frets[s.stringIdx];
          if (f !== -1) return { ...s, fret: f };
        }
        return s;
      })
    : [];

  const fretRange: [number, number] | undefined = selectedChord
    ? undefined
    : selectedDrill
      ? [selectedDrill.startFret, selectedDrill.startFret + 4]
      : undefined;

  const drillDots = effectiveSteps.map((s, i) => ({
    stringIdx: s.stringIdx,
    fret: s.fret,
    label: s.finger ? String(s.finger) : '',
    highlight: activeStep === i,
  }));

  // Keep draft in sync when bpm changes programmatically (drill reset, +/- buttons)
  useEffect(() => { setBpmDraft(String(bpm)); }, [bpm]);

  // Load personal best and reset BPM when selected drill changes
  useEffect(() => {
    if (selectedDrill) {
      setPersonalBest(getDrillBest(selectedDrill.id));
      setBpm(selectedDrill.bpmStart);
    }
  }, [selectedDrill ? selectedDrill.id : null]);

  // Unified playback: click fires every beat; notes fire too when playNotes is enabled.
  // playNotesRef lets the toggle take effect immediately without restarting the interval.
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setActiveStep(null);
    if (!isPlaying) return;

    const beatMs = Math.floor(60000 / bpm);
    const steps = selectedDrill
      ? selectedDrill.steps.map(s => {
          if (selectedChord) {
            const f = selectedChord.frets[s.stringIdx];
            if (f !== -1) return { ...s, fret: f };
          }
          return s;
        })
      : [];
    let idx = 0;

    const fire = () => {
      initAudio().then(() => playClick());
      if (steps.length > 0) {
        setActiveStep(idx);
        if (playNotesRef.current) {
          const s = steps[idx];
          const note = getFretNote(s.stringIdx, s.fret);
          if (note) initAudio().then(() => playNote(note, beatMs / 1000 * 0.85));
        }
        idx = (idx + 1) % steps.length;
      }
    };

    fire();
    intervalRef.current = setInterval(fire, beatMs);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isPlaying, bpm, selectedDrill?.id, selectedChord]);

  function stopPlayback() { setIsPlaying(false); }

  function handleTabChange(tab: Category) {
    setActiveTab(tab);
    setSelectedDrillId(null);
    stopPlayback();
    if (tab !== 'pima' && tab !== 'travis') {
      setChordRoot(null);
      setSelectedChord(null);
    }
  }

  function handleSelectDrill(drillId: string) {
    stopPlayback();
    setSelectedDrillId(prev => (prev === drillId ? null : drillId));
    setBestFlash(false);
  }

  function handleChordRootSelect(note: Note) {
    setChordRoot(note);
    setSelectedChord(null);
    stopPlayback();
  }

  function handleChordSelect(chord: ChordShape) {
    setSelectedChord(prev => (prev === chord ? null : chord));
    stopPlayback();
  }

  function handleBpmChange(delta: number) {
    setBpm(prev => Math.min(200, Math.max(40, prev + delta)));
  }

  async function handleTogglePlay() {
    await initAudio();
    setIsPlaying(prev => !prev);
  }

  function handleGotItClean() {
    if (!selectedDrill) return;
    saveDrillBest(selectedDrill.id, bpm);
    const newBest = getDrillBest(selectedDrill.id);
    setPersonalBest(newBest);
    if (newBest !== null && (personalBest === null || bpm >= personalBest)) {
      setBestFlash(true);
      setTimeout(() => setBestFlash(false), 1000);
    }
    setBpm(prev => Math.min(200, prev + selectedDrill.bpmStep));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
          <Dumbbell size={18} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Technique</h1>
          <p className="text-sm text-brand-secondary">Fretting and picking technique drills. Slow and accurate builds speed.</p>
        </div>
      </div>

      {/* Warm-up banner */}
      {showBanner && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-brand-line bg-brand-surface px-4 py-3">
          <p className="text-sm text-brand-ink">
            <span className="font-semibold">Warm up first.</span>{' '}
            Spend 2–3 minutes playing open strings or easy chord changes before drilling.
            Stop immediately if you feel pain or tension anywhere in your hand or forearm.
          </p>
          <button
            onClick={() => setShowBanner(false)}
            className="text-brand-secondary hover:text-brand-ink flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tab rows */}
      <div>
        <div className="flex items-center border-b border-brand-line">
          <span className="text-xs font-medium text-brand-secondary w-28 shrink-0 pl-1 pb-1">Fretting Hand</span>
          <div className="flex">
            {FRETTING_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleTabChange(cat)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === cat
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-brand-secondary hover:text-brand-ink hover:border-brand-line',
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center border-b border-brand-line">
          <span className="text-xs font-medium text-brand-secondary w-28 shrink-0 pl-1 pb-1">Picking Hand</span>
          <div className="flex">
            {PICKING_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleTabChange(cat)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === cat
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-brand-secondary hover:text-brand-ink hover:border-brand-line',
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category description */}
      <p className="text-xs text-brand-secondary -mt-3">{CATEGORY_DESCRIPTIONS[activeTab]}</p>

      {/* Chord picker — PIMA and Travis only */}
      {showChordPicker && (
        <div className="rounded-lg border border-brand-line bg-brand-surface px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-brand-ink">Chord <span className="font-normal text-brand-secondary">(optional — defaults to open strings or G)</span></p>
          <div className="flex flex-wrap gap-1">
            {NOTES.map(note => (
              <button
                key={note}
                onClick={() => handleChordRootSelect(note)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border font-medium transition-colors',
                  chordRoot === note
                    ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                    : 'border-brand-line text-brand-secondary hover:border-brand-primary/40 hover:text-brand-ink',
                )}
              >
                {note}
              </button>
            ))}
            {selectedChord && (
              <button
                onClick={() => { setChordRoot(null); setSelectedChord(null); stopPlayback(); }}
                className="px-2.5 py-1 text-xs rounded-md border border-brand-line text-brand-secondary hover:text-brand-ink transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {chordRoot && (
            <div className="flex flex-wrap gap-1">
              {(COMMON_CHORDS[chordRoot] ?? []).map((chord, i) => (
                <button
                  key={i}
                  onClick={() => handleChordSelect(chord)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors',
                    selectedChord === chord
                      ? 'border-brand-active text-brand-active bg-brand-active/10 font-semibold'
                      : 'border-brand-line text-brand-secondary hover:border-brand-primary/40 hover:text-brand-ink',
                  )}
                >
                  {chord.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drill selector grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tabDrills.map(drill => {
          const best = getDrillBest(drill.id);
          const isSelected = selectedDrillId === drill.id;
          return (
            <button
              key={drill.id}
              onClick={() => handleSelectDrill(drill.id)}
              className={cn(
                'text-left rounded-lg border p-4 transition-colors',
                isSelected
                  ? 'border-brand-active bg-brand-active/10'
                  : 'border-brand-line bg-brand-surface hover:border-brand-primary/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-brand-ink">{drill.name}</span>
                <span className="text-xs text-brand-secondary whitespace-nowrap flex-shrink-0">
                  Best: {best !== null ? `${best} BPM` : '—'}
                </span>
              </div>
              <p className="text-xs text-brand-secondary mt-1 leading-snug">{drill.description}</p>
            </button>
          );
        })}
      </div>

      {/* Trainer panel */}
      {selectedDrill && (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-5 space-y-5">
          {/* Drill title + safety note */}
          <div>
            <h2 className="text-base font-semibold text-brand-ink">
              {selectedDrill.name}
              {selectedChord && (
                <span className="ml-2 text-sm font-normal text-brand-secondary">— {selectedChord.name}</span>
              )}
            </h2>
            {selectedDrill.safetyNote && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ {selectedDrill.safetyNote}
              </p>
            )}
          </div>

          {/* Picking annotation strip */}
          {selectedDrill.steps.some(s => s.pick) && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <div className="flex gap-1 pb-1 min-w-max">
                  {selectedDrill.steps.map((s, i) =>
                    s.pick ? (
                      <span
                        key={i}
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors',
                          activeStep === i
                            ? 'bg-amber-400 text-white'
                            : s.pick === 'down' || s.pick === 'up'
                              ? 'bg-brand-surface border border-brand-line text-brand-ink'
                              : 'bg-brand-primary/10 text-brand-primary',
                        )}
                      >
                        {s.pick === 'down' ? '↓' : s.pick === 'up' ? '↑' : s.pick}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
              <p className="text-xs text-brand-secondary">
                {selectedDrill.steps.some(s => s.pick === 'down' || s.pick === 'up')
                  ? '↓ downstroke · ↑ upstroke'
                  : 'p = thumb · i = index · m = middle · a = ring'}
              </p>
            </div>
          )}

          {/* Fretboard */}
          <div className="overflow-x-auto">
            <Fretboard
              showNoteNames={false}
              chord={selectedChord ?? undefined}
              drillDots={drillDots}
              fretRange={fretRange}
              fretsNum={15}
            />
          </div>

          {/* BPM controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => handleBpmChange(-selectedDrill.bpmStep)}
                className="w-10 h-10 rounded-full border border-brand-line text-brand-ink text-xl font-bold hover:border-brand-primary/60 transition-colors"
                aria-label="Decrease BPM"
              >
                −
              </button>
              <div className="text-center min-w-[90px]">
                <input
                  type="text"
                  inputMode="numeric"
                  value={bpmDraft}
                  onChange={e => setBpmDraft(e.target.value)}
                  onBlur={() => {
                    const v = parseInt(bpmDraft, 10);
                    setBpm(Math.min(300, Math.max(30, isNaN(v) ? bpm : v)));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseInt(bpmDraft, 10);
                      setBpm(Math.min(300, Math.max(30, isNaN(v) ? bpm : v)));
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="text-5xl font-bold text-brand-primary tabular-nums w-24 text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-brand-primary/50 rounded"
                />
                <div className="text-xs text-brand-secondary mt-0.5">BPM</div>
              </div>
              <button
                onClick={() => handleBpmChange(selectedDrill.bpmStep)}
                className="w-10 h-10 rounded-full border border-brand-line text-brand-ink text-xl font-bold hover:border-brand-primary/60 transition-colors"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>

            {/* Target milestone */}
            <p className="text-xs text-center text-brand-secondary">
              Target: {selectedDrill.bpmTarget} BPM
              {bpm >= selectedDrill.bpmTarget && (
                <span className="ml-2 font-semibold text-brand-primary">Target reached!</span>
              )}
            </p>

            {/* Play button + notes toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlay}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isPlaying
                    ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
                    : 'border border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-brand-ink whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={playNotes}
                  onChange={e => setPlayNotes(e.target.checked)}
                  className="w-4 h-4 accent-brand-primary"
                />
                Play notes
              </label>
            </div>

            {/* Got it clean */}
            <button
              onClick={handleGotItClean}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              Got it clean — next tempo
            </button>

            {/* Personal best */}
            <div className={cn(
              'text-center text-sm font-semibold transition-colors duration-300',
              bestFlash ? 'text-green-600 dark:text-green-400' : 'text-brand-secondary',
            )}>
              {bestFlash ? '✓ New personal best!' : (
                personalBest !== null
                  ? `Personal best: ${personalBest} BPM`
                  : 'No personal best yet — start drilling!'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
