import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { ScaleDrillRound, SessionScore } from '@/src/lib/earTraining';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES } from '@/src/data/guitarData';
import type { Note } from '@/src/types';

interface ScaleDrillTrainerProps {
  round: ScaleDrillRound;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function ScaleDrillTrainer({ round, score, onComplete }: ScaleDrillTrainerProps) {
  const [selected, setSelected] = useState<Note | null>(null);

  const scaleDef = COMMON_SCALES.find(s => s.name === round.scaleName) ?? COMMON_SCALES[0];
  const scalePattern = generateScalePattern(round.root, scaleDef);

  // Build highlight frets: full scale in grey, target in orange/red
  // We pass scale to Fretboard for highlighting, then overlay target marker via CSS
  const isCorrect = selected === round.targetNote;

  function handleSelect(note: Note) {
    if (selected !== null) return;
    setSelected(note);
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-brand-ink">
          What note is highlighted (★) in{' '}
          <span className="text-brand-primary font-bold">{round.root} {round.scaleName}</span>?
        </p>
        <p className="text-xs text-brand-secondary">
          String {round.targetStringIdx + 1} (from low E), fret {round.targetFret}
        </p>
      </div>

      {/* Fretboard showing full scale pattern with target position highlighted */}
      <div className="overflow-x-auto">
        <Fretboard
          scale={scalePattern}
          fretRange={[Math.max(0, round.targetFret - 2), Math.min(12, round.targetFret + 2)]}
          highlightNote={{ stringIdx: round.targetStringIdx, fret: round.targetFret }}
        />
      </div>

      {/* Note name options */}
      <div className="grid grid-cols-4 gap-2">
        {round.options.map(note => (
          <button
            key={note}
            onClick={() => handleSelect(note)}
            disabled={selected !== null}
            className={cn(
              'py-3 rounded-lg text-sm font-bold border transition-colors',
              selected === null
                ? 'border-brand-line text-brand-ink hover:border-brand-primary/60 hover:bg-brand-sidebar/50'
                : note === round.targetNote
                  ? 'bg-green-500 text-white border-green-500'
                  : note === selected
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-brand-line text-brand-secondary opacity-50',
            )}
          >
            {note}
          </button>
        ))}
      </div>

      {selected !== null && (
        <div className="space-y-2">
          <p className={cn('text-sm font-semibold text-center', isCorrect ? 'text-green-600' : 'text-red-500')}>
            {isCorrect ? 'Correct!' : `Not quite — it's ${round.targetNote}`}
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
