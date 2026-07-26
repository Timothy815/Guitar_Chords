import React, { useState, useCallback, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import { IntervalFretboardRound, SessionScore } from '@/src/lib/earTraining';
import { initAudio, playNote, getFretNote } from '@/src/lib/audio';

interface Props {
  round: IntervalFretboardRound;
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

type PositionMode = 'along' | 'across' | 'both';
type PlaybackMode = 'melodic' | 'harmonic' | 'both';

export function IntervalFretboardTrainer({ round, score, onComplete }: Props) {
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [positionMode, setPositionMode] = useState<PositionMode>('both');
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('both');

  // Reset state when round changes
  useEffect(() => {
    setSelectedPosition(null);
    setIsRevealed(false);
  }, [round]);

  // Play interval on mount
  useEffect(() => {
    handlePlay();
  }, [round]);

  const handlePlay = useCallback(async () => {
    await initAudio();

    if (playbackMode === 'melodic') {
      playNote(round.rootNoteWithOctave, '4n');
      setTimeout(() => playNote(round.targetNoteWithOctave, '4n'), 600);
    } else if (playbackMode === 'harmonic') {
      playNote(round.rootNoteWithOctave, '2n');
      playNote(round.targetNoteWithOctave, '2n');
    } else { // both
      // Play melodic first
      playNote(round.rootNoteWithOctave, '4n');
      setTimeout(() => playNote(round.targetNoteWithOctave, '4n'), 600);
      // Then play harmonic after a pause
      setTimeout(() => {
        playNote(round.rootNoteWithOctave, '2n');
        playNote(round.targetNoteWithOctave, '2n');
      }, 1400);
    }
  }, [round, playbackMode]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealed) return;

    const key = `${stringIdx}-${fretIdx}`;

    // Don't allow clicking the root position
    if (stringIdx === round.rootStringIdx && fretIdx === round.rootFret) return;

    setSelectedPosition(key);

    // Play the selected note + interval for feedback
    const selectedNote = getFretNote(stringIdx, fretIdx);
    if (selectedNote) {
      initAudio().then(() => {
        playNote(round.rootNoteWithOctave, '4n');
        setTimeout(() => playNote(selectedNote, '4n'), 400);
      }).catch(() => {});
    }
  }, [isRevealed, round]);

  const handleConfirm = useCallback(() => {
    if (!selectedPosition || isRevealed) return;

    const [stringIdx, fretIdx] = selectedPosition.split('-').map(Number);

    // Check if position is valid based on position mode
    let isValid = false;

    if (positionMode === 'along') {
      // Must be on the same string as root
      isValid = round.validTargets.some(
        t => t.stringIdx === stringIdx && t.fret === fretIdx && stringIdx === round.rootStringIdx
      );
    } else if (positionMode === 'across') {
      // Must be on a different string from root
      isValid = round.validTargets.some(
        t => t.stringIdx === stringIdx && t.fret === fretIdx && stringIdx !== round.rootStringIdx
      );
    } else { // both
      // Any valid target position
      isValid = round.validTargets.some(
        t => t.stringIdx === stringIdx && t.fret === fretIdx
      );
    }

    setIsRevealed(true);
    setTimeout(() => onComplete(isValid), 1000);
  }, [selectedPosition, isRevealed, round, positionMode, onComplete]);

  // Build correct positions set for visual feedback
  const correctPositions = new Set<string>();
  const rootPosition = `${round.rootStringIdx}-${round.rootFret}`;

  if (isRevealed) {
    // Show valid targets based on position mode
    if (positionMode === 'along') {
      round.validTargets
        .filter(t => t.stringIdx === round.rootStringIdx)
        .forEach(t => correctPositions.add(`${t.stringIdx}-${t.fret}`));
    } else if (positionMode === 'across') {
      round.validTargets
        .filter(t => t.stringIdx !== round.rootStringIdx)
        .forEach(t => correctPositions.add(`${t.stringIdx}-${t.fret}`));
    } else { // both
      round.validTargets.forEach(t => correctPositions.add(`${t.stringIdx}-${t.fret}`));
    }
  }

  const isCorrect = selectedPosition !== null && correctPositions.has(selectedPosition);
  const wrongPosition = isRevealed && selectedPosition && !isCorrect ? selectedPosition : null;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-secondary">
            Find the interval on the fretboard
          </p>
          <p className="text-xs text-brand-secondary">
            Root: <span className="font-bold text-brand-ink">{round.rootNote}</span> on string {6 - round.rootStringIdx}, fret {round.rootFret}
            {' · '}
            Interval: <span className="font-bold text-brand-ink">{round.intervalLabel}</span>
          </p>
        </div>
        <button
          onClick={handlePlay}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      {/* Position mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-brand-secondary font-medium">Position:</span>
        <div className="flex gap-1">
          {(['along', 'across', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPositionMode(mode)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                positionMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
              }`}
            >
              {mode === 'along' ? 'Along String' : mode === 'across' ? 'Across Strings' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      {/* Playback mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-brand-secondary font-medium">Playback:</span>
        <div className="flex gap-1">
          {(['melodic', 'harmonic', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPlaybackMode(mode)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                playbackMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fretboard */}
      <div className="relative">
        <Fretboard
          fretsNum={round.fretsNum}
          onFretClick={handleFretClick}
          showNoteNames={false}
          correctPositions={correctPositions}
          wrongPosition={wrongPosition}
          previewPosition={!isRevealed ? selectedPosition : null}
          rootPosition={rootPosition}
          compact
        />
      </div>

      {/* Confirm button and feedback */}
      <div className="flex items-center justify-between min-h-[36px]">
        {isRevealed ? (
          <p className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
            {isCorrect
              ? `✓ Correct! ${round.targetNote} is a ${round.intervalLabel} from ${round.rootNote}`
              : `✗ Not quite — any ${round.targetNote} ${positionMode === 'along' ? 'on the same string' : positionMode === 'across' ? 'on a different string' : 'anywhere'} is correct`}
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedPosition || isRevealed}
          className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({Math.round((score.correct / score.total) * 100)}%)
        </p>
      )}
    </div>
  );
}
