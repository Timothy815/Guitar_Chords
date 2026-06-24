import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import {
  FretboardRound, DifficultyLevel, SessionScore, HuntResult,
  getCorrectPositions, playFretboardRound, getSemitoneDistance, getSemitoneDirection,
} from '../lib/earTraining';
import { getFretNote, initAudio, playNote } from '../lib/audio';

interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}

export function FretboardTrainer({ round, score, isHuntMode, onComplete }: FretboardTrainerProps) {
  // Shared state (Guess + Hunt)
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);

  // Hunt-only state
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [firstConfirmSemitones, setFirstConfirmSemitones] = useState<number | null>(null);
  const [firstConfirmDirection, setFirstConfirmDirection] = useState<'sharp' | 'flat' | 'correct' | null>(null);
  const [wrongConfirmFlash, setWrongConfirmFlash] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    setSelectedPosition(null);
    setSelectedNote(null);
    setAttemptCount(0);
    setFirstConfirmSemitones(null);
    setFirstConfirmDirection(null);
    setWrongConfirmFlash(false);
    setRoundFeedback(null);
    playFretboardRound(round).catch(() => {});
  }, [round]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const pitchClass = noteStr.replace(/\d$/, '');
    const key = `${stringIdx}-${fretIdx}`;

    if (isHuntMode) {
      setSelectedPosition(key);
      setSelectedNote(pitchClass);
      initAudio().then(() => playNote(noteStr, '8n')).catch(() => {});
      return;
    }

    // Guess mode — grade immediately
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
  }, [isRevealing, isHuntMode, round, onComplete]);

  const handleConfirm = useCallback(() => {
    if (!selectedPosition || !selectedNote || isRevealing) return;
    const isCorrect = selectedNote === round.targetNote;

    // Capture first-confirm stats (never overwritten on subsequent wrong confirms)
    const semitones = firstConfirmSemitones ?? getSemitoneDistance(selectedNote, round.targetNote);
    const direction = firstConfirmDirection ?? getSemitoneDirection(selectedNote, round.targetNote);
    if (firstConfirmSemitones === null) {
      setFirstConfirmSemitones(semitones);
      setFirstConfirmDirection(direction);
    }

    if (isCorrect) {
      const stars = semitones === 0 ? 3 : semitones <= 2 ? 2 : semitones <= 5 ? 1 : 0;
      const attempts = attemptCount + 1;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const feedback = semitones === 0
        ? '★★★  Found in 1 attempt  ·  Perfect — correct first try!'
        : `${starStr}  Found in ${attempts} attempt${attempts !== 1 ? 's' : ''}  ·  ${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction} on first try`;
      setRoundFeedback(feedback);
      setCorrectPositions(new Set([selectedPosition])); // green dot renders on top of blue preview
      setIsRevealing(true);
      setNoteRevealed(true);
      setTimeout(() => onComplete(true, { stars, attempts, direction }), 600);
    } else {
      setIsRevealing(true);
      setWrongConfirmFlash(true);
      setAttemptCount(a => a + 1);
      setTimeout(() => {
        setWrongConfirmFlash(false);
        setIsRevealing(false);
      }, 600);
    }
  }, [selectedPosition, selectedNote, isRevealing, round, firstConfirmSemitones, firstConfirmDirection, attemptCount, onComplete]);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          {isHuntMode ? 'Hunt the note' : 'Find the note'}
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
        wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
        previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
        compact
      />

      {isHuntMode && (
        <div className="flex items-center justify-between min-h-[36px]">
          {roundFeedback ? (
            <p className="text-sm text-brand-ink font-medium">{roundFeedback}</p>
          ) : (
            <span />
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedPosition || isRevealing}
            className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      )}

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
