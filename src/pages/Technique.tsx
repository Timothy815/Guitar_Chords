import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Dumbbell } from 'lucide-react';
import { cn } from '../lib/utils';
import { DRILLS, getDrillBest, saveDrillBest } from '../data/drillData';
import type { Drill } from '../data/drillData';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playClick } from '../lib/audio';

type Category = 'chromatic' | 'spider' | 'legato' | 'stretch';

const CATEGORIES: Category[] = ['chromatic', 'spider', 'legato', 'stretch'];

const CATEGORY_LABELS: Record<Category, string> = {
  chromatic: 'Chromatic',
  spider: 'Spider',
  legato: 'Legato',
  stretch: 'Stretch',
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  chromatic: 'Finger independence across all strings',
  spider: 'Cross-string coordination and string crossing',
  legato: 'Hammer-on and pull-off strength',
  stretch: 'Reach and fret-span conditioning',
};

export function Technique() {
  const [activeTab, setActiveTab] = useState<Category>('chromatic');
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null);
  const [bpm, setBpm] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bestFlash, setBestFlash] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabDrills = DRILLS.filter(d => d.category === activeTab);
  const selectedDrill: Drill | null = selectedDrillId
    ? (DRILLS.find(d => d.id === selectedDrillId) ?? null)
    : null;

  // Load personal best and reset BPM when selected drill changes
  useEffect(() => {
    if (selectedDrill) {
      setPersonalBest(getDrillBest(selectedDrill.id));
      setBpm(selectedDrill.bpmStart);
    }
  }, [selectedDrill ? selectedDrill.id : null]);

  // Click track — restarts whenever isPlaying or bpm changes; cleans up on unmount
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isPlaying) {
      const tick = () => { initAudio().then(() => playClick()); };
      tick();
      intervalRef.current = setInterval(tick, Math.floor(60000 / bpm));
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, bpm]);

  function handleTabChange(tab: Category) {
    setActiveTab(tab);
    setSelectedDrillId(null);
    setIsPlaying(false);
  }

  function handleSelectDrill(drillId: string) {
    if (isPlaying) setIsPlaying(false);
    setSelectedDrillId(prev => (prev === drillId ? null : drillId));
    setBestFlash(false);
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

  const drillDots = selectedDrill
    ? selectedDrill.steps.map(s => ({
        stringIdx: s.stringIdx,
        fret: s.fret,
        label: String(s.finger),
      }))
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
          <Dumbbell size={18} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Technique</h1>
          <p className="text-sm text-brand-secondary">Fretting hand dexterity drills. Slow and accurate builds speed.</p>
        </div>
      </div>

      {/* Warm-up banner */}
      {showBanner && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Warm up first.</span>{' '}
            Spend 2–3 minutes playing open strings or easy chord changes before drilling.
            Stop immediately if you feel pain or tension anywhere in your hand or forearm.
          </p>
          <button
            onClick={() => setShowBanner(false)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tab row */}
      <div className="border-b border-brand-line">
        <div className="flex gap-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleTabChange(cat)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
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

      {/* Category description */}
      <p className="text-xs text-brand-secondary -mt-3">{CATEGORY_DESCRIPTIONS[activeTab]}</p>

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
            <h2 className="text-base font-semibold text-brand-ink">{selectedDrill.name}</h2>
            {selectedDrill.safetyNote && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ {selectedDrill.safetyNote}
              </p>
            )}
          </div>

          {/* Fretboard */}
          <div className="overflow-x-auto">
            <Fretboard
              showNoteNames={false}
              drillDots={drillDots}
              fretRange={[selectedDrill.startFret, selectedDrill.startFret + 4]}
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
                <div className="text-5xl font-bold text-brand-primary tabular-nums">{bpm}</div>
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

            {/* Play and Got it clean buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleTogglePlay}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isPlaying
                    ? 'bg-brand-secondary/80 text-white hover:bg-brand-secondary'
                    : 'border border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {isPlaying ? '■ Stop' : '▶ Start Click Track'}
              </button>
              <button
                onClick={handleGotItClean}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                Got it clean
              </button>
            </div>

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
