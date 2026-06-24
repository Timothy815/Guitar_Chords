import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import {
  FretboardRound, DifficultyLevel, SessionScore,
  getCorrectPositions, playFretboardRound,
} from '../lib/earTraining';
import { getFretNote } from '../lib/audio';

interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function FretboardTrainer({ round, score, onComplete }: FretboardTrainerProps) {
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);

  useEffect(() => {
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    playFretboardRound(round).catch(() => {});
  }, [round]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const pitchClass = noteStr.replace(/\d$/, '');
    const key = `${stringIdx}-${fretIdx}`;

    if (pitchClass === round.targetNote) {
      setCorrectPositions(new Set([key]));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => onComplete(true), 600);
    } else {
      setWrongPosition(key);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => setWrongPosition(null), 600);
      setTimeout(() => onComplete(false), 1500);
    }
  }, [isRevealing, round, onComplete]);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          Find the note
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={wrongPosition}
        compact
      />

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
