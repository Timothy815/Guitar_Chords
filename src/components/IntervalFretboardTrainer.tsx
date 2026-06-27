import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { IntervalFretboardRound, SessionScore } from '@/src/lib/earTraining';
import { initAudio, playNote } from '@/src/lib/audio';
import { STANDARD_TUNING } from '@/src/types';
import { ALL_NOTES } from '@/src/data/guitarData';

const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

interface Props {
  round: IntervalFretboardRound;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function IntervalFretboardTrainer({ round, score, onComplete }: Props) {
  const [selected, setSelected] = useState<{ stringIdx: number; fret: number } | null>(null);

  const allChoices = React.useMemo(() => [
    { stringIdx: round.targetStringIdx, fret: round.targetFret, note: round.targetNote, isCorrect: true },
    ...round.distractors.map(d => ({ ...d, isCorrect: false })),
  ].sort(() => Math.random() - 0.5), [round]);

  const handlePlay = useCallback(async () => {
    await initAudio();
    const rootOctave = STANDARD_TUNING.octaves[round.rootStringIdx];
    const rootPCIdx = ALL_NOTES.indexOf(round.rootNote);
    const targetPCIdx = ALL_NOTES.indexOf(round.targetNote);
    // Always play ascending: target wraps to next octave when its pitch class is <= root's
    const targetOctave = targetPCIdx > rootPCIdx ? rootOctave : rootOctave + 1;
    playNote(`${round.rootNote}${rootOctave}`, '4n');
    setTimeout(() => playNote(`${round.targetNote}${targetOctave}`, '4n'), 600);
  }, [round]);

  const isCorrect = selected !== null &&
    selected.stringIdx === round.targetStringIdx &&
    selected.fret === round.targetFret;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-brand-ink">
          Root: <span className="text-brand-primary font-bold">{round.rootNote}</span>
          {' '}on string {STRING_LABELS[round.rootStringIdx]}, fret {round.rootFret}
        </p>
        <p className="text-sm font-medium text-brand-ink">
          Interval: <span className="text-brand-primary font-bold">{round.intervalLabel}</span>
        </p>
        <p className="text-xs text-brand-secondary">
          Target note: {selected !== null ? round.targetNote : '?'} — select the correct fretboard position below
        </p>
      </div>

      <button
        onClick={handlePlay}
        className="w-full py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
      >
        ▶ Play Interval
      </button>

      {/* Choice grid: string × fret cards */}
      <div className="space-y-1">
        <p className="text-xs text-brand-secondary font-medium">Select the position of the target note:</p>
        <div className="grid grid-cols-2 gap-2">
          {allChoices.map((choice, i) => (
            <button
              key={i}
              onClick={() => { if (!selected) setSelected(choice); }}
              disabled={selected !== null}
              className={cn(
                'py-3 rounded-lg text-sm border transition-colors text-left px-3',
                selected === null
                  ? 'border-brand-line text-brand-ink hover:border-brand-primary/60 hover:bg-brand-sidebar/50'
                  : choice.isCorrect
                    ? 'bg-green-500 text-white border-green-500'
                    : selected.stringIdx === choice.stringIdx && selected.fret === choice.fret
                      ? 'bg-red-500 text-white border-red-500'
                      : 'border-brand-line text-brand-secondary opacity-50',
              )}
            >
              <span className="font-bold">{STRING_LABELS[choice.stringIdx]}</span>
              <span className="text-xs ml-2">fret {choice.fret}</span>
              {selected !== null && (
                <span className="ml-1 text-xs">({choice.note})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected !== null && (
        <div className="space-y-2">
          <p className={cn('text-sm font-semibold text-center', isCorrect ? 'text-green-600' : 'text-red-500')}>
            {isCorrect
              ? `Correct! ${round.targetNote} is a ${round.intervalLabel} above ${round.rootNote}`
              : `Not quite — ${round.targetNote} is on string ${STRING_LABELS[round.targetStringIdx]}, fret ${round.targetFret}`}
          </p>
          <button
            onClick={() => onComplete(isCorrect)}
            className="w-full py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
