import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import {
  RhythmRound, RhythmSettings, RhythmDuration,
  durationBeats, beatsPerMeasure, getCountLabel,
} from '../lib/rhythmTraining';
import { SessionScore } from '../lib/earTraining';
import { initAudio, playRhythmRound, stopRhythm } from '../lib/audio';
import { RhythmStaff, staffMinWidth } from './RhythmStaff';

type SlotLabel = 'N' | 'R' | 'H';

interface CountItTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}

function getAdaptiveStep(enabledDurations: RhythmDuration[]): number {
  if (enabledDurations.includes('16')) return 0.25;
  if (enabledDurations.includes('8') || enabledDurations.includes('qd')) return 0.5;
  return 1.0;
}

export function CountItTrainer({ round, score, settings, onComplete }: CountItTrainerProps) {
  const step = getAdaptiveStep(settings.enabledDurations);
  const totalBeats = beatsPerMeasure(round.timeSignature) * round.measures;
  const totalSlots = Math.round(totalBeats / step);

  const correctLabels: SlotLabel[] = round.units.flatMap(u => {
    const n = Math.round(durationBeats(u.duration) / step);
    if (u.isRest) return Array<SlotLabel>(n).fill('R');
    return ['N' as SlotLabel, ...Array<SlotLabel>(n - 1).fill('H')];
  });

  const slots = Array.from({ length: totalSlots }, (_, i) => ({
    pos: i * step,
    label: getCountLabel(i * step, round.timeSignature),
    widthPct: (step / totalBeats) * 100,
  }));

  const [userLabels, setUserLabels] = useState<(SlotLabel | null)[]>(() => Array(totalSlots).fill(null));
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<('correct' | 'wrong')[] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Clamp floating picker so it stays within the visible scroll container
  useLayoutEffect(() => {
    if (pickerIdx === null || !pickerRef.current || !containerRef.current) return;
    const picker = pickerRef.current;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    let dx = 0;
    if (pickerRect.left < containerRect.left + 4) {
      dx = containerRect.left + 4 - pickerRect.left;
    } else if (pickerRect.right > containerRect.right - 4) {
      dx = containerRect.right - 4 - pickerRect.right;
    }
    picker.style.transform = dx !== 0 ? `translateX(calc(-50% + ${dx}px))` : 'translateX(-50%)';
  }, [pickerIdx]);

  const handlePlay = useCallback(() => {
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
  }, [round, settings.enableLeadIn]);

  useEffect(() => {
    setUserLabels(Array(totalSlots).fill(null));
    setFeedback(null);
    setAttempts(0);
    setPickerIdx(null);
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
    return () => stopRhythm();
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close picker on outside click
  useEffect(() => {
    if (pickerIdx === null) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerIdx]);

  function handleSlotClick(i: number) {
    if (feedback) return;
    setPickerIdx(prev => (prev === i ? null : i));
  }

  function handlePickLabel(i: number, label: SlotLabel) {
    setUserLabels(prev => {
      const next = [...prev];
      next[i] = label;
      return next;
    });
    setPickerIdx(null);
  }

  const allFilled = userLabels.every(l => l !== null);
  const unlabeledCount = userLabels.filter(l => l === null).length;

  function handleSubmit() {
    if (!allFilled || feedback) return;
    setAttempts(a => a + 1);
    const fb = userLabels.map((ul, i) =>
      (ul === correctLabels[i] ? 'correct' : 'wrong') as 'correct' | 'wrong'
    );
    setFeedback(fb);
  }

  function handleTryAgain() {
    setUserLabels(Array(totalSlots).fill(null));
    setFeedback(null);
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    const wasCorrect = attempts === 1 && allCorrect;
    stopRhythm();
    setActiveUnitIdx(null);
    onComplete(wasCorrect);
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Staff + count grid in shared horizontal scroll */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{ minWidth: staffMinWidth(round, round.units) }} className="relative">
          <RhythmStaff
            round={round}
            placedUnits={round.units}
            feedback={null}
            onSwap={() => {}}
          />

          {/* Count grid */}
          <div className="flex font-mono select-none">
            {slots.map((slot, i) => {
              const ul = userLabels[i];
              const fb = feedback?.[i];
              const isPickerOpen = pickerIdx === i;
              const correctLabel = feedback ? correctLabels[i] : null;

              // Determine display label text
              let displayLabel = slot.label;
              if (ul === 'R') displayLabel = `[${slot.label}]`;
              else if (ul === 'H') displayLabel = `(${slot.label})`;

              // Slot background + text color
              const slotClass = fb === 'correct'
                ? 'bg-green-500/20 text-green-700 dark:text-green-400 font-bold'
                : fb === 'wrong'
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-bold'
                  : ul === 'N'
                    ? 'bg-brand-primary/15 text-brand-primary font-bold'
                    : ul === 'R'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : ul === 'H'
                        ? 'bg-brand-line/20 text-brand-secondary italic'
                        : 'text-brand-line';

              return (
                <div
                  key={i}
                  style={{ width: `${slot.widthPct}%` }}
                  className={cn(
                    'relative text-center text-[11px] leading-none py-1 border border-transparent',
                    slotClass,
                    !feedback && 'cursor-pointer hover:border-brand-primary/40 rounded',
                    feedback && 'cursor-default',
                  )}
                  onClick={() => handleSlotClick(i)}
                >
                  <span className="block truncate">{displayLabel}</span>

                  {/* Correct answer hint on wrong slots */}
                  {fb === 'wrong' && correctLabel && (
                    <span className="block text-[9px] text-green-600 font-normal not-italic">
                      {correctLabel === 'R'
                        ? `[${slot.label}]`
                        : correctLabel === 'H'
                          ? `(${slot.label})`
                          : slot.label}
                    </span>
                  )}

                  {/* Floating picker */}
                  {isPickerOpen && (
                    <div
                      ref={pickerRef}
                      style={{ left: '50%', transform: 'translateX(-50%)' }}
                      className="absolute bottom-full mb-1 z-20 flex gap-1 bg-brand-surface border border-brand-line rounded-lg shadow-lg p-1"
                    >
                      {(['N', 'R', 'H'] as SlotLabel[]).map(opt => (
                        <button
                          key={opt}
                          onMouseDown={e => { e.preventDefault(); handlePickLabel(i, opt); }}
                          className={cn(
                            'w-8 h-8 rounded-md text-xs font-bold border transition-colors',
                            ul === opt && opt === 'N' && 'bg-brand-primary text-white border-brand-primary',
                            ul === opt && opt === 'R' && 'bg-amber-500 text-white border-amber-500',
                            ul === opt && opt === 'H' && 'bg-brand-secondary/70 text-white border-brand-secondary',
                            ul !== opt && 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status line */}
      {!feedback && (
        <p className="text-xs text-brand-secondary text-center">
          {unlabeledCount > 0
            ? `${unlabeledCount} slot${unlabeledCount === 1 ? '' : 's'} unlabeled — click a slot to label it`
            : 'All slots labeled — ready to submit'}
        </p>
      )}

      {/* Feedback summary */}
      {feedback && (
        <p className={cn(
          'text-sm font-semibold text-center',
          feedback.every(f => f === 'correct') ? 'text-green-600' : 'text-red-500',
        )}>
          {feedback.every(f => f === 'correct') ? 'Correct! 🎯' : 'Not quite — slots highlighted above'}
        </p>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePlay}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          ▶ Play
        </button>
        {allFilled && !feedback && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Submit
          </button>
        )}
        {feedback && !feedback.every(f => f === 'correct') && (
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            Try Again
          </button>
        )}
        {feedback && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
