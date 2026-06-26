import React, { useEffect, useState, useCallback } from 'react';
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

// Convert a count label like "1+", "2e", "3a" to its spoken syllable
function spokenName(countLabel: string): string {
  if (countLabel.endsWith('+')) return 'and';
  if (countLabel.endsWith('e')) return 'e';
  if (countLabel.endsWith('a')) return 'a';
  return countLabel; // bare beat number: "1", "2", etc.
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
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState<('correct' | 'wrong')[] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);

  const handlePlay = useCallback(() => {
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
  }, [round, settings.enableLeadIn]);

  useEffect(() => {
    setUserLabels(Array(totalSlots).fill(null));
    setSelected(new Set());
    setFeedback(null);
    setAttempts(0);
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
    return () => stopRhythm();
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSlotClick(i: number) {
    if (feedback) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleApplyLabel(label: SlotLabel) {
    if (selected.size === 0 || feedback) return;
    setUserLabels(prev => {
      const next = [...prev];
      selected.forEach(i => { next[i] = label; });
      return next;
    });
    setSelected(new Set());
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
    setSelected(new Set());
    setFeedback(null);
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    const wasCorrect = attempts === 1 && allCorrect;
    stopRhythm();
    setActiveUnitIdx(null);
    onComplete(wasCorrect);
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Staff + count grid in shared horizontal scroll */}
      <div className="overflow-x-auto">
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
              const isSelected = selected.has(i);
              const correctLabel = feedback ? correctLabels[i] : null;

              let displayLabel = slot.label;
              if (ul === 'R') displayLabel = `[${slot.label}]`;
              else if (ul === 'H') displayLabel = `(${slot.label})`;

              const slotClass = fb === 'correct'
                ? 'bg-green-500/20 text-green-700 dark:text-green-400 font-bold'
                : fb === 'wrong'
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-bold'
                  : isSelected
                    ? 'bg-brand-primary/20 text-brand-primary font-bold'
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
                    'relative text-center text-[11px] leading-none py-1 border transition-colors',
                    slotClass,
                    !feedback && 'cursor-pointer rounded',
                    isSelected ? 'border-brand-primary' : 'border-transparent',
                    !feedback && !isSelected && 'hover:border-brand-primary/40',
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
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Label toolbar — visible when slots are selected */}
      {hasSelection && !feedback && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-secondary">
            {selected.size} slot{selected.size === 1 ? '' : 's'} selected:
          </span>
          {(['N', 'R', 'H'] as SlotLabel[]).map(opt => (
            <button
              key={opt}
              onClick={() => handleApplyLabel(opt)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors',
                opt === 'N' && 'bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/80',
                opt === 'R' && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-400',
                opt === 'H' && 'bg-brand-secondary/70 text-white border-brand-secondary/70 hover:bg-brand-secondary/50',
              )}
            >
              {opt === 'N' ? 'N — Attack' : opt === 'R' ? 'R — Rest' : 'H — Held'}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-brand-line hover:text-brand-secondary transition-colors ml-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Status line */}
      {!feedback && !hasSelection && (
        <p className="text-xs text-brand-secondary text-center">
          {unlabeledCount > 0
            ? `${unlabeledCount} slot${unlabeledCount === 1 ? '' : 's'} unlabeled — click slots to select, then choose a label`
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

      {/* Spoken count display — shown after a correct submission */}
      {feedback && feedback.every(f => f === 'correct') && (
        <div className="rounded-lg bg-brand-bg border border-brand-line p-3 space-y-2">
          <p className="text-xs font-semibold text-brand-secondary">How to count it aloud:</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono">
            {slots.map((slot, i) => {
              const role = correctLabels[i];
              const word = spokenName(slot.label);
              if (role === 'N') {
                return (
                  <span key={i} className="text-sm font-bold text-brand-ink">{word}</span>
                );
              }
              if (role === 'H') {
                return (
                  <span key={i} className="text-xs text-brand-line italic">({word})</span>
                );
              }
              // rest
              return (
                <span key={i} className="text-xs text-brand-line">[{word}]</span>
              );
            })}
          </div>
          <p className="text-[10px] text-brand-line leading-relaxed">
            <span className="font-bold text-brand-ink not-italic">voiced</span>
            {' · '}
            <span className="italic">(held — feel it, don't say it)</span>
            {' · '}
            <span>[rest — count silently]</span>
          </p>
        </div>
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
