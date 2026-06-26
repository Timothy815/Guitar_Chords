import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import {
  RhythmRound, RhythmUnit, RhythmSettings, RhythmDuration,
  durationBeats, beatsPerMeasure, getCountLabel,
} from '../lib/rhythmTraining';
import { SessionScore } from '../lib/earTraining';
import { initAudio, playRhythmRound, stopRhythm } from '../lib/audio';
import { RhythmStaff, CLEF_EXTRA, MIN_MEASURE_W } from './RhythmStaff';

interface RhythmTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}

const DURATION_LABELS: Record<RhythmDuration, string> = {
  w: 'W', h: 'H', hd: 'H.', q: 'Q', qd: 'Q.', '8': '8', '16': '16',
};

export function RhythmTrainer({ round, score, settings, onComplete }: RhythmTrainerProps) {
  const [placedUnits, setPlacedUnits] = useState<RhythmUnit[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<RhythmDuration>('q');
  const [isRest, setIsRest] = useState(false);
  const [feedback, setFeedback] = useState<('correct' | 'wrong' | null)[] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);

  const totalBeats = beatsPerMeasure(round.timeSignature) * round.measures;
  const usedBeats = placedUnits.reduce((s, u) => s + durationBeats(u.duration), 0);
  const remainingBeats = Math.max(0, totalBeats - usedBeats);

  const handlePlay = useCallback(() => {
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
  }, [round, settings.enableLeadIn]);

  // Auto-play on new round
  useEffect(() => {
    setPlacedUnits([]);
    setSelectedDuration('q');
    setIsRest(false);
    setFeedback(null);
    setAttempts(0);
    setActiveUnitIdx(null);
    initAudio().then(() => playRhythmRound(round, settings.enableLeadIn, setActiveUnitIdx)).catch(() => {});
    return () => stopRhythm();
  }, [round]);

  function handlePlaceImmediate(dur: RhythmDuration) {
    if (durationBeats(dur) > remainingBeats + 0.001 || !!feedback) return;
    setPlacedUnits(prev => [...prev, { duration: dur, isRest }]);
  }

  function handleDelete() {
    if (feedback) return;
    setPlacedUnits(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (remainingBeats > 0.001 || feedback) return;
    setAttempts(a => a + 1);

    // Compare rhythms at the 16th-note grid level so that e.g. a quarter rest
    // and two eighth rests (identical silence) are treated as equivalent.
    const toGrid = (units: RhythmUnit[]) =>
      units.flatMap(u => {
        const slots = Math.round(durationBeats(u.duration) * 4);
        if (u.isRest) return Array(slots).fill('R');
        return ['N', ...Array(slots - 1).fill('S')];
      });

    const correctGrid = toGrid(round.units);
    const placedGrid  = toGrid(placedUnits);
    const gridMatch = correctGrid.length === placedGrid.length &&
      correctGrid.every((v, i) => v === placedGrid[i]);

    if (gridMatch) {
      setFeedback(round.units.map(() => 'correct' as const));
      return;
    }

    const fb = round.units.map((correct, i) => {
      const placed = placedUnits[i];
      if (!placed) return 'wrong' as const;
      return placed.duration === correct.duration && placed.isRest === correct.isRest
        ? 'correct' as const
        : 'wrong' as const;
    });
    setFeedback(fb);
  }

  function handleSwap(i: number, j: number) {
    if (feedback) return;
    setPlacedUnits(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    const wasCorrect = attempts === 1 && allCorrect;
    stopRhythm();
    setActiveUnitIdx(null);
    onComplete(wasCorrect);
  }

  function handleTryAgain() {
    setPlacedUnits([]);
    setFeedback(null);
  }

  const handlePlayAnswer = useCallback(() => {
    if (placedUnits.length === 0) return;
    const answerRound: RhythmRound = {
      kind: 'rhythm',
      units: placedUnits,
      measures: round.measures,
      timeSignature: round.timeSignature,
      bpm: round.bpm,
    };
    initAudio().then(() => playRhythmRound(answerRound, false)).catch(() => {});
  }, [placedUnits, round]);

  // Pre-compute count labels — one segment per attack plus dimmed markers for sustained beats
  const countLabels: { label: string; isRest: boolean; widthPct: number; isAttack: boolean; beatIndex: number; unitIdx: number }[] = (() => {
    if (!round.units) return [];
    const tb = beatsPerMeasure(round.timeSignature) * round.measures;
    // In 6/8, beats are every 0.5 quarter-notes; in simple time, every 1.0
    const beatStep = round.timeSignature === '6/8' ? 0.5 : 1.0;
    const result: { label: string; isRest: boolean; widthPct: number; isAttack: boolean; beatIndex: number; unitIdx: number }[] = [];
    let cursor = 0;
    for (let unitIdx = 0; unitIdx < round.units.length; unitIdx++) {
      const unit = round.units[unitIdx];
      const duration = durationBeats(unit.duration);
      const label = getCountLabel(cursor, round.timeSignature);
      const noteEnd = cursor + duration;
      // First integer (or half-beat for 6/8) boundary strictly after the attack
      const nextBeat = (Math.floor(cursor / beatStep + 0.001) + 1) * beatStep;
      const seg1End = Math.min(noteEnd, nextBeat);
      result.push({ label, isRest: unit.isRest, widthPct: (seg1End - cursor) / tb * 100, isAttack: true, beatIndex: Math.floor(cursor), unitIdx });
      // Dimmed markers for each beat the note sustains through without attacking
      for (let beat = nextBeat; beat < noteEnd - 0.001; beat += beatStep) {
        const segEnd = Math.min(beat + beatStep, noteEnd);
        result.push({
          label: getCountLabel(beat, round.timeSignature),
          isRest: unit.isRest,
          widthPct: (segEnd - beat) / tb * 100,
          isAttack: false,
          beatIndex: Math.floor(beat),
          unitIdx,
        });
      }
      cursor += duration;
    }
    return result;
  })();

  const canSubmit = remainingBeats < 0.001 && !feedback;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Staff + count hint in a shared horizontal scroll container */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: CLEF_EXTRA + MIN_MEASURE_W * round.measures }}>
          <RhythmStaff
            round={round}
            placedUnits={placedUnits}
            feedback={feedback}
            onSwap={handleSwap}
          />
          {settings.showCount && (
            <div className="flex font-mono select-none" aria-label="Verbal count">
              {countLabels.map((cl, i) => (
                <div
                  key={i}
                  style={{ width: `${cl.widthPct}%` }}
                  className={cn(
                    'text-center text-[11px] leading-none py-0.5 transition-colors duration-75',
                    cl.unitIdx === activeUnitIdx
                      ? 'bg-brand-primary/40 text-brand-ink font-bold'
                      : cl.isAttack ? 'text-brand-secondary' : 'text-brand-line italic',
                    cl.unitIdx !== activeUnitIdx && (cl.beatIndex % 2 === 0 ? 'bg-brand-primary/10' : 'bg-transparent'),
                  )}
                >
                  {cl.isAttack
                    ? (cl.isRest ? `[${cl.label}]` : cl.label)
                    : `(${cl.label})`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Counting guide toggle */}
      {settings.showCount && (
        <div className="flex justify-end -mt-2">
          <button
            onClick={() => setShowHelp(h => !h)}
            className="text-[11px] text-brand-line hover:text-brand-secondary transition-colors select-none"
          >
            {showHelp ? '▲ Hide guide' : 'ℹ Counting guide'}
          </button>
        </div>
      )}

      {/* Counting guide panel */}
      {showHelp && settings.showCount && (
        <div className="rounded-lg bg-brand-bg border border-brand-line p-3 text-xs space-y-2.5">
          <p className="font-semibold text-brand-ink">How rhythm counting works</p>
          <p className="text-brand-secondary">Each beat divides into four 16th-note slots, spoken as <span className="font-mono text-brand-ink">"1 – e – and – a"</span>:</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono">
            <span className="text-brand-ink">1  2  3  4</span><span className="text-brand-secondary font-sans">downbeat — quarter note positions</span>
            <span className="text-brand-ink">1+ 2+ 3+</span><span className="text-brand-secondary font-sans">"and" — halfway through each beat (8th or 16th)</span>
            <span className="text-brand-ink">1e 2e 3e</span><span className="text-brand-secondary font-sans">"e" — 1st 16th after the beat (16th notes only)</span>
            <span className="text-brand-ink">1a 2a 3a</span><span className="text-brand-secondary font-sans">"a" — 3rd 16th after the beat (16th notes only)</span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="font-mono text-brand-secondary">3</span><span className="text-brand-secondary">note attacks on beat 3</span>
            <span className="font-mono text-brand-line italic">(3)</span><span className="text-brand-secondary">beat 3 is sustained — a held note passes through it</span>
            <span className="font-mono text-brand-secondary">[3]</span><span className="text-brand-secondary">rest on beat 3</span>
          </div>
          <p className="text-brand-secondary border-t border-brand-line pt-2">
            <span className="font-medium text-brand-ink">Downbeat</span> = beat 1, the strongest beat (conductor's baton moves <em>down</em>).{' '}
            <span className="font-medium text-brand-ink">Upbeat</span> = the "ands" (+) between beats, or beat 4 leading back to beat 1 (baton moves <em>up</em>).
            Tap your foot: floor = downbeat · lift = upbeat.
          </p>
          <p className="text-brand-secondary">
            <span className="font-medium text-brand-ink">Beat shading:</span> alternating tinted bands show which subdivisions belong to the same beat — all of "3 3+ 3a" share one band.
          </p>
        </div>
      )}

      {/* Remaining beat indicator */}
      {!feedback && (
        <p className="text-xs text-brand-secondary text-center">
          {remainingBeats > 0.001
            ? `${remainingBeats.toFixed(2).replace(/\.?0+$/, '')} beats remaining`
            : 'All beats filled — ready to submit'}
        </p>
      )}

      {/* Feedback result */}
      {feedback && (
        <p className={cn(
          'text-sm font-semibold text-center',
          feedback.every(f => f === 'correct') ? 'text-green-600' : 'text-red-500',
        )}>
          {feedback.every(f => f === 'correct') ? 'Correct! 🎯' : 'Not quite — review in green/red above'}
        </p>
      )}

      {/* Palette */}
      {!feedback && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            {settings.enabledDurations.map(dur => (
              <button
                key={dur}
                onClick={() => { setSelectedDuration(dur); handlePlaceImmediate(dur); }}
                disabled={durationBeats(dur) > remainingBeats + 0.001}
                className={cn(
                  'w-10 h-10 rounded-lg text-sm font-bold border transition-colors',
                  selectedDuration === dur
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                  durationBeats(dur) > remainingBeats + 0.001 && 'opacity-40 cursor-not-allowed',
                )}
              >
                {DURATION_LABELS[dur]}
              </button>
            ))}
            {settings.enableRests && (
              <button
                onClick={() => setIsRest(r => !r)}
                className={cn(
                  'px-3 h-10 rounded-lg text-sm font-medium border transition-colors',
                  isRest
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                )}
              >
                Rest
              </button>
            )}
          </div>
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
        <button
          onClick={handlePlayAnswer}
          disabled={placedUnits.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ▶ My Answer
        </button>
        {!feedback && (
          <button
            onClick={handleDelete}
            disabled={placedUnits.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Delete
          </button>
        )}
        {canSubmit && !feedback && (
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
