// src/components/MelodyTrainer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { MelodyRound, MelodySettings, buildAllowedPitches } from '../lib/melodyTraining';
import { SessionScore, DifficultyLevel } from '../lib/earTraining';
import { initAudio, playNote } from '../lib/audio';
import { PianoInput } from './PianoInput';
import { FretboardInput } from './FretboardInput';

interface MelodyTrainerProps {
  round: MelodyRound;
  score: SessionScore;
  settings: MelodySettings;
  difficulty: DifficultyLevel;
  onComplete: (wasCorrect: boolean) => void;
}

export function MelodyTrainer({ round, score, settings, difficulty, onComplete }: MelodyTrainerProps) {
  const [placedNotes, setPlacedNotes] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<('correct' | 'wrong')[] | null>(null);
  const [inputMode, setInputMode] = useState<'piano' | 'fretboard'>('piano');
  const [attempts, setAttempts] = useState(0);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const allowedPitches = buildAllowedPitches(round.rootKey, difficulty);

  function stopMelody() {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  }

  function playSequence(notes: string[]) {
    stopMelody();
    const noteDuration = (60 / round.bpm) * 1000;
    notes.forEach((pitch, i) => {
      const id = setTimeout(() => {
        initAudio().then(() => playNote(`${pitch}4`)).catch(() => {});
      }, i * noteDuration);
      timeoutIds.current.push(id);
    });
  }

  // Auto-play on new round; clear state
  useEffect(() => {
    setPlacedNotes(settings.showFirstNote ? [round.notes[0]] : []);
    setFeedback(null);
    setAttempts(0);
    initAudio().then(() => playSequence(round.notes)).catch(() => {});
    return () => stopMelody();
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = useCallback(() => {
    playSequence(round.notes);
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayAnswer = useCallback(() => {
    if (placedNotes.length === 0) return;
    playSequence(placedNotes);
  }, [placedNotes, round.bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNoteSelect(pitch: string) {
    if (feedback || placedNotes.length >= round.notes.length) return;
    setPlacedNotes(prev => [...prev, pitch]);
  }

  function handleDelete() {
    if (feedback) return;
    if (settings.showFirstNote && placedNotes.length <= 1) return;
    setPlacedNotes(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (placedNotes.length !== round.notes.length || feedback) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const fb = round.notes.map((correct, i) =>
      placedNotes[i] === correct ? 'correct' as const : 'wrong' as const,
    );
    setFeedback(fb);
  }

  function handleTryAgain() {
    setPlacedNotes(settings.showFirstNote ? [round.notes[0]] : []);
    setFeedback(null);
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    const wasCorrect = attempts === 1 && allCorrect;
    stopMelody();
    onComplete(wasCorrect);
  }

  const canSubmit = placedNotes.length === round.notes.length && !feedback;
  const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
  const isWrong = feedback !== null && !allCorrect;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">
      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Placed notes row */}
      <div>
        <p className="text-xs text-brand-secondary mb-1.5">
          {feedback ? 'Result' : `${placedNotes.length} / ${round.notes.length} placed`}
        </p>
        <div className="flex gap-1.5 flex-wrap min-h-[40px]">
          {round.notes.map((_, i) => {
            const placed = placedNotes[i];
            const fb = feedback?.[i];
            const isGiven = settings.showFirstNote && i === 0;
            return (
              <div
                key={i}
                className={cn(
                  'w-10 h-10 rounded-lg border text-sm font-bold flex items-center justify-center',
                  !placed && 'border-brand-line text-brand-secondary',
                  placed && !feedback && !isGiven && 'border-brand-primary bg-brand-sidebar text-brand-ink',
                  isGiven && !feedback && 'border-brand-secondary bg-brand-sidebar text-brand-secondary opacity-70',
                  fb === 'correct' && 'border-green-500 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  fb === 'wrong' && 'border-red-500 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                )}
              >
                {placed ?? '—'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback message */}
      {feedback && (
        <p className={cn(
          'text-sm font-semibold text-center',
          allCorrect ? 'text-green-600' : 'text-red-500',
        )}>
          {allCorrect ? 'Correct! 🎯' : 'Not quite — review above'}
        </p>
      )}

      {/* Input toggle */}
      {!feedback && (
        <div className="flex rounded-lg border border-brand-line overflow-hidden w-fit text-sm font-medium">
          <button
            onClick={() => setInputMode('piano')}
            className={cn(
              'px-4 py-1.5 transition-colors',
              inputMode === 'piano'
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar',
            )}
          >
            Piano
          </button>
          <button
            onClick={() => setInputMode('fretboard')}
            className={cn(
              'px-4 py-1.5 transition-colors border-l border-brand-line',
              inputMode === 'fretboard'
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar',
            )}
          >
            Fretboard
          </button>
        </div>
      )}

      {/* Active input */}
      {!feedback && (
        inputMode === 'piano'
          ? <PianoInput
              onNoteSelect={handleNoteSelect}
              allowedPitches={allowedPitches}
              disabled={placedNotes.length >= round.notes.length}
            />
          : <FretboardInput
              onNoteSelect={handleNoteSelect}
              allowedPitches={allowedPitches}
              disabled={placedNotes.length >= round.notes.length}
            />
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
          disabled={placedNotes.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ▶ My Answer
        </button>
        {!feedback && (
          <button
            onClick={handleDelete}
            disabled={placedNotes.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Delete
          </button>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Submit
          </button>
        )}
        {isWrong && (
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
