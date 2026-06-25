import React, { useState, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import {
  FretboardRound, SessionScore,
  getAbsoluteSemitoneDistance, getAbsoluteDirection,
  playFretboardRound,
} from '../lib/earTraining';
import { initAudio, playNote, initPianoSampler, playPianoNote } from '../lib/audio';
import { PianoKeyboard } from './PianoKeyboard';

interface PianoTrainerProps {
  round: FretboardRound;
  score: SessionScore;
  octaveMin: number;
  octaveMax: number;
  mode: 'guess' | 'hunt' | 'sing' | 'singhunt';
  droneNote?: string | null;
  droneMode?: 'off' | 'continuous' | 'cue';
  onComplete: (wasCorrect: boolean) => void;
}

export function PianoTrainer({
  round, score, octaveMin, octaveMax, mode, droneNote, droneMode, onComplete,
}: PianoTrainerProps) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [correctKeys, setCorrectKeys] = useState<Set<string>>(new Set());
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);
  const [locked, setLocked] = useState(mode === 'sing' || mode === 'singhunt');
  const [feedback, setFeedback] = useState<string | null>(null);

  const isSingMode = mode === 'sing' || mode === 'singhunt';

  useEffect(() => {
    setPreviewKey(null);
    setCorrectKeys(new Set());
    setWrongKey(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    setFeedback(null);
    setLocked(isSingMode);

    initPianoSampler().catch(() => {});

    if (droneMode === 'cue' && droneNote) {
      initAudio()
        .then(() => {
          playNote(droneNote, '2n');
          setTimeout(() => playFretboardRound(round).catch(() => {}), 600);
        })
        .catch(() => {});
    } else {
      playFretboardRound(round).catch(() => {});
    }
  }, [round]);

  const handleKeyClick = useCallback((note: string) => {
    if (isRevealing || locked) return;
    setPreviewKey(note);
    initPianoSampler()
      .then(() => playPianoNote(note, '4n'))
      .catch(() => {});
  }, [isRevealing, locked]);

  const handleConfirm = useCallback(() => {
    if (!previewKey || isRevealing) return;
    const isCorrect = previewKey === round.targetNote;

    if (isCorrect) {
      setCorrectKeys(new Set([previewKey]));
      setNoteRevealed(true);
      setIsRevealing(true);
      setTimeout(() => onComplete(true), 600);
    } else {
      const semitones = getAbsoluteSemitoneDistance(previewKey, round.targetNote);
      const direction = getAbsoluteDirection(previewKey, round.targetNote);
      const dirStr = direction === 'correct' ? '' : ` (${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction})`;
      setFeedback(`You picked ${previewKey} — correct was ${round.targetNote}${dirStr}`);
      setWrongKey(previewKey);
      setCorrectKeys(new Set([round.targetNote]));
      setNoteRevealed(true);
      setIsRevealing(true);
      initPianoSampler()
        .then(() => playPianoNote(round.targetNote, '4n'))
        .catch(() => {});
      setTimeout(() => onComplete(false), 1500);
    }
  }, [previewKey, isRevealing, round, onComplete]);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const targetPitchClass = round.targetNote.replace(/\d$/, '');

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          {isSingMode ? 'Sing the note' : 'Find the note on the keyboard'}
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {targetPitchClass}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      <div className="relative">
        <PianoKeyboard
          octaveMin={octaveMin}
          octaveMax={octaveMax}
          correctKeys={correctKeys}
          wrongKey={wrongKey}
          previewKey={!wrongKey ? previewKey : null}
          onKeyClick={handleKeyClick}
        />
        {isSingMode && locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-bg/80 rounded-lg z-10">
            <p className="text-sm text-brand-secondary text-center px-4">
              Sing or hum the note, then tap Ready
            </p>
            <button
              onClick={() => setLocked(false)}
              className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
            >
              Ready
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <p className="text-sm text-brand-secondary">{feedback}</p>
      )}

      <div className="flex items-center justify-between min-h-[36px]">
        <span />
        <button
          onClick={handleConfirm}
          disabled={!previewKey || isRevealing}
          className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
