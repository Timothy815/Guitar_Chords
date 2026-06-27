import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Play, Square, Volume2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { playTunedString, playReferenceTone } from '@/src/lib/audio';
import {
  TUNING_DEFS,
  DETUNE_WINDOWS,
  CENT_STEPS,
  DEFAULT_SETTINGS,
  IN_TUNE_THRESHOLD,
  isInTune,
  displayHz,
  randomizeOffsets,
  getDetuneColors,
  getColorModeRowStyle,
  type TuningName,
  type TunerSettings,
  type StringState,
  type DetuneName,
  type ScaffoldMode,
} from '@/src/lib/tunerData';

const STORAGE_KEY = 'guitar_tuner_settings';

function loadSettings(): TunerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

const SCAFFOLD_LABELS: Record<ScaffoldMode, string> = {
  ear: 'By Ear',
  color: 'Color',
  cents: 'Cents',
};

export function Tuner() {
  const [settings, setSettings] = useState<TunerSettings>(loadSettings);
  const [strings, setStrings] = useState<StringState[]>(() => {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    return randomizeOffsets(tuning, settings.detuneWindowCents);
  });
  const [allInTune, setAllInTune] = useState(false);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const playingRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  useEffect(() => {
    if (!allInTune && strings.every(s => isInTune(s.centsOffset))) {
      setAllInTune(true);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
    }
  }, [strings, allInTune]);

  function reRandomize() {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
    setAllInTune(false);
    playingRef.current = false;
    setIsPlayingAll(false);
  }

  function handleTuningChange(name: TuningName) {
    const tuning = TUNING_DEFS.find(t => t.name === name) ?? TUNING_DEFS[0];
    setSettings(s => ({ ...s, tuning: name }));
    setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
    setAllInTune(false);
  }

  function handleWindowChange(cents: number) {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    setSettings(s => ({ ...s, detuneWindowCents: cents }));
    setStrings(randomizeOffsets(tuning, cents));
    setAllInTune(false);
  }

  function adjustOffset(idx: number, delta: number) {
    setStrings(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const newOffset = Math.max(-60, Math.min(60, s.centsOffset + delta));
      playTunedString(s.targetHz, newOffset, '4n');
      if (settings.playReference) playReferenceTone(s.targetHz, '4n');
      return { ...s, centsOffset: newOffset };
    }));
  }

  async function playSingleString(idx: number) {
    playTunedString(strings[idx].targetHz, strings[idx].centsOffset, '1n');
    if (settings.playReference) playReferenceTone(strings[idx].targetHz, '1n');
  }

  async function handlePlayAll() {
    if (playingRef.current) {
      playingRef.current = false;
      setIsPlayingAll(false);
      return;
    }
    playingRef.current = true;
    setIsPlayingAll(true);
    try {
      if (settings.audioMode === 'simultaneous') {
        strings.forEach((s, i) => {
          setTimeout(() => {
            playTunedString(s.targetHz, s.centsOffset, '1n');
            if (settings.playReference) playReferenceTone(s.targetHz, '1n');
          }, i * 20);
        });
        await new Promise<void>(r => setTimeout(r, 2500));
      } else {
        for (let i = 5; i >= 0; i--) {
          if (!playingRef.current) break;
          playTunedString(strings[i].targetHz, strings[i].centsOffset, '1n');
          if (settings.playReference) playReferenceTone(strings[i].targetHz, '1n');
          if (i > 0) await new Promise<void>(r => setTimeout(r, 2000));
        }
      }
    } finally {
      playingRef.current = false;
      setIsPlayingAll(false);
    }
  }

  const displayedStrings = [...strings].reverse();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-brand-surface border border-brand-line">
        <h1 className="text-lg font-bold text-brand-ink font-serif mr-2">Tuner Simulator</h1>

        <select
          value={settings.tuning}
          onChange={e => handleTuningChange(e.target.value as TuningName)}
          className="px-3 py-1.5 rounded-md border border-brand-line bg-brand-bg text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
        >
          {TUNING_DEFS.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>

        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(Object.entries(DETUNE_WINDOWS) as [DetuneName, number][]).map(([label, cents]) => (
            <button
              key={label}
              onClick={() => handleWindowChange(cents)}
              className={cn(
                'px-3 py-1.5 transition-colors',
                settings.detuneWindowCents === cents
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(['simultaneous', 'sequential'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, audioMode: mode }))}
              className={cn(
                'px-3 py-1.5 capitalize transition-colors',
                settings.audioMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Scaffold mode */}
        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(['ear', 'color', 'cents'] as ScaffoldMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, scaffoldMode: mode }))}
              className={cn(
                'px-3 py-1.5 transition-colors',
                settings.scaffoldMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {SCAFFOLD_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Ref toggle */}
        <button
          onClick={() => setSettings(s => ({ ...s, playReference: !s.playReference }))}
          title={settings.playReference ? 'Reference tone on — click to disable' : 'Reference tone off — click to enable'}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
            settings.playReference
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
          )}
        >
          Ref
        </button>

        {/* Hz toggle */}
        <button
          onClick={() => setSettings(s => ({ ...s, showHz: !s.showHz }))}
          title={settings.showHz ? 'Hz display on — click to hide' : 'Hz display off — click to show'}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
            settings.showHz
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
          )}
        >
          Hz
        </button>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={reRandomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-line text-sm text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
          >
            <RefreshCw size={14} />
            Re-randomize
          </button>
          <button
            onClick={handlePlayAll}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isPlayingAll
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-brand-primary text-white hover:bg-brand-primary/90'
            )}
          >
            {isPlayingAll
              ? <><Square size={14} /> Stop</>
              : <><Play size={14} /> Play All</>}
          </button>
        </div>
      </div>

      {/* Celebration banner */}
      {allInTune && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-400">
          <div>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">Guitar in tune!</p>
            <p className="text-sm text-green-600 dark:text-green-500">All strings within ±{IN_TUNE_THRESHOLD}¢</p>
          </div>
          <button
            onClick={reRandomize}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <RefreshCw size={14} />
            Tune Again
          </button>
        </div>
      )}

      {/* String rows — high E at top, low E at bottom */}
      <div className="space-y-2">
        {displayedStrings.map((s, displayIdx) => {
          const realIdx = strings.length - 1 - displayIdx;
          const colors = getDetuneColors(s.centsOffset);
          const inTune = isInTune(s.centsOffset);
          const isSharp = s.centsOffset > 0;
          const pct = Math.min(50, (Math.abs(s.centsOffset) / 60) * 50);
          const showHzSection = settings.scaffoldMode === 'cents' || settings.showHz;

          const rowClass = cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-colors',
            settings.scaffoldMode === 'cents'
              ? colors.row
              : settings.scaffoldMode === 'color'
                ? getColorModeRowStyle(s.centsOffset)
                : 'border-brand-line'
          );

          const arrowText = inTune ? '✓' : isSharp ? '↑' : '↓';
          const arrowColor = Math.abs(s.centsOffset) <= 3
            ? 'text-green-600 dark:text-green-400'
            : Math.abs(s.centsOffset) <= 10
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-500 dark:text-red-400';

          return (
            <div key={realIdx} className={rowClass}>
              {/* String label */}
              <div className="w-12 shrink-0 text-center">
                <div className="text-sm font-bold text-brand-ink">{s.targetNote}</div>
                <div className="text-xs text-brand-secondary">str {realIdx + 1}</div>
              </div>

              {/* Hz display — always visible in Cents mode; visible in other modes only when showHz toggle is on */}
              {showHzSection && (
                <div className="w-28 shrink-0 text-right space-y-0.5">
                  <div className="text-sm font-mono text-brand-ink">
                    {displayHz(s.targetHz, s.centsOffset)} Hz
                  </div>
                  {settings.showHz && (
                    <div className="text-xs font-mono text-brand-secondary">
                      → {s.targetHz.toFixed(1)} target
                    </div>
                  )}
                </div>
              )}

              {/* Color mode: arrow indicator */}
              {settings.scaffoldMode === 'color' && (
                <div className={cn('w-8 shrink-0 text-center text-lg font-bold', arrowColor)}>
                  {arrowText}
                </div>
              )}

              {/* Cents mode: deviation meter bar + label */}
              {settings.scaffoldMode === 'cents' ? (
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="relative h-3 bg-brand-sidebar rounded-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-brand-secondary/50 -translate-x-1/2" />
                    <div
                      className={cn('absolute top-0 bottom-0 transition-all duration-75', colors.bar)}
                      style={
                        inTune
                          ? { left: '48%', right: '48%' }
                          : isSharp
                            ? { left: '50%', width: `${pct}%` }
                            : { right: '50%', width: `${pct}%` }
                      }
                    />
                  </div>
                  <div className={cn('text-xs font-medium', colors.text)}>
                    {inTune
                      ? 'IN TUNE ✓'
                      : `${isSharp ? '+' : ''}${s.centsOffset.toFixed(1)}¢ ${isSharp ? 'SHARP' : 'FLAT'}`}
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* Decrement buttons (gross → fine, right to left: −20 −10 −5 −2 −0.5) */}
              <div className="flex gap-0.5 shrink-0">
                {[...CENT_STEPS].reverse().map(step => (
                  <button
                    key={`dec-${step}`}
                    onClick={() => adjustOffset(realIdx, -step)}
                    className={cn(
                      'rounded text-xs font-mono border border-brand-line transition-colors',
                      'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                      step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                    )}
                  >
                    −{step}
                  </button>
                ))}
              </div>

              {/* Increment buttons (fine → gross, left to right: +0.5 +2 +5 +10 +20) */}
              <div className="flex gap-0.5 shrink-0">
                {[...CENT_STEPS].map(step => (
                  <button
                    key={`inc-${step}`}
                    onClick={() => adjustOffset(realIdx, step)}
                    className={cn(
                      'rounded text-xs font-mono border border-brand-line transition-colors',
                      'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                      step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                    )}
                  >
                    +{step}
                  </button>
                ))}
              </div>

              {/* Play button */}
              <button
                onClick={() =>
                  settings.audioMode === 'simultaneous'
                    ? handlePlayAll()
                    : playSingleString(realIdx)
                }
                title={settings.audioMode === 'simultaneous' ? 'Play all strings (strum)' : 'Play this string'}
                className="shrink-0 p-2 rounded-lg border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
              >
                <Play size={14} />
              </button>

              {/* Play target pitch alone */}
              <button
                onClick={() => playReferenceTone(s.targetHz, '1n')}
                title={`Play target pitch alone (${s.targetNote} = ${s.targetHz.toFixed(1)} Hz)`}
                className="shrink-0 p-2 rounded-lg border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
              >
                <Volume2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-brand-secondary text-center pb-4">
        {settings.scaffoldMode === 'ear'
          ? 'Listen for the beating to slow and stop as each string approaches its target pitch.'
          : settings.scaffoldMode === 'color'
            ? 'Follow the arrows — tune until all rows turn green and show ✓.'
            : 'Use the increment buttons to tune — listen for the beating to slow and stop as each string approaches its target pitch.'}
      </p>
    </div>
  );
}
