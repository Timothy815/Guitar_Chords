import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import { FretboardFocusSelector } from './FretboardFocusSelector';
import {
  FretboardRound, DifficultyLevel, SessionScore, HuntResult, FretboardFocus,
  getCorrectPositions, playFretboardRound, getAbsoluteSemitoneDistance, getAbsoluteDirection,
} from '../lib/earTraining';
import { getFretNote, initAudio, playNote, startNote, stopNote } from '../lib/audio';
import {
  loadHuntHistory, exportToCsv, mergeHuntEntries, parseFromCsv,
} from '../lib/huntHistory';

interface FretboardTrainerProps {
  round: FretboardRound;
  difficulty: DifficultyLevel;
  score: SessionScore;
  isHuntMode: boolean;
  focus?: FretboardFocus;
  onFocusChange?: (focus: FretboardFocus) => void;
  droneNote?: string | null;
  droneMode?: 'off' | 'continuous' | 'cue';
  singMode?: boolean;
  sessionAvgSemitones?: number;
  sessionAvgTaps?: number;
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}

function liveColor(semi: number, taps: number): string {
  if (semi <= 1.5 && taps <= 1.5) return '#27ae60';
  if (semi <= 3.0 && taps <= 2.5) return '#f1c40f';
  return '#c0392b';
}

export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  droneNote, droneMode,
  singMode,
  sessionAvgSemitones,
  sessionAvgTaps,
  onComplete,
}: FretboardTrainerProps) {
  // Shared state (Guess + Hunt)
  const [correctPositions, setCorrectPositions] = useState<Set<string>>(new Set());
  const [wrongPosition, setWrongPosition] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [noteRevealed, setNoteRevealed] = useState(false);
  const [locked, setLocked] = useState(true);

  // Hunt-only state
  const mouseDownFiredRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null); // full note+octave e.g. "C4"
  const [attemptCount, setAttemptCount] = useState(0);
  const [selectionCount, setSelectionCount] = useState(0);
  const [firstSelectionSemitones, setFirstSelectionSemitones] = useState<number | null>(null);
  const [firstSelectionDirection, setFirstSelectionDirection] = useState<'sharp' | 'flat' | 'correct' | null>(null);
  const [wrongConfirmFlash, setWrongConfirmFlash] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (singMode) setLocked(true);
    setCorrectPositions(new Set());
    setWrongPosition(null);
    setIsRevealing(false);
    setNoteRevealed(false);
    setSelectedPosition(null);
    setSelectedNote(null);
    setAttemptCount(0);
    setSelectionCount(0);
    setFirstSelectionSemitones(null);
    setFirstSelectionDirection(null);
    setWrongConfirmFlash(false);
    setRoundFeedback(null);

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
    // droneMode and droneNote intentionally omitted from deps: effect must only
    // fire when a new round starts, not when the user adjusts drone settings mid-round.
  }, [round]);

  const handleFretMouseDown = useCallback((stringIdx: number, fretIdx: number) => {
    if (!isHuntMode || isRevealing) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const key = `${stringIdx}-${fretIdx}`;
    setSelectedPosition(key);
    setSelectedNote(noteStr);
    setSelectionCount(c => c + 1);
    setFirstSelectionSemitones(prev =>
      prev !== null ? prev : getAbsoluteSemitoneDistance(noteStr, round.targetNote),
    );
    setFirstSelectionDirection(prev =>
      prev !== null ? prev : getAbsoluteDirection(noteStr, round.targetNote),
    );
    mouseDownFiredRef.current = true;
    initAudio().then(() => startNote(noteStr)).catch(() => {});
  }, [isHuntMode, isRevealing, round.targetNote]);

  useEffect(() => {
    if (!isHuntMode) return;
    const release = () => stopNote();
    window.addEventListener('mouseup', release);
    return () => window.removeEventListener('mouseup', release);
  }, [isHuntMode]);

  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    if (singMode && locked) return;
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (!noteStr) return;
    const key = `${stringIdx}-${fretIdx}`;

    if (isHuntMode) {
      // mousedown already handled this on pointer devices; only run for touch.
      if (mouseDownFiredRef.current) {
        mouseDownFiredRef.current = false;
        return;
      }
      setSelectedPosition(key);
      setSelectedNote(noteStr);
      setSelectionCount(c => c + 1);
      setFirstSelectionSemitones(prev =>
        prev !== null ? prev : getAbsoluteSemitoneDistance(noteStr, round.targetNote),
      );
      setFirstSelectionDirection(prev =>
        prev !== null ? prev : getAbsoluteDirection(noteStr, round.targetNote),
      );
      initAudio().then(() => playNote(noteStr, '2n')).catch(() => {});
      return;
    }

    // Guess mode — octave-precise grading
    if (noteStr === round.targetNote) {
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
      initAudio().then(() => {
        playNote(noteStr, '2n');
        setTimeout(() => playNote(round.targetNote, '2n'), 800);
      }).catch(() => {});
      setTimeout(() => onComplete(false), 2000);
    }
  }, [isRevealing, isHuntMode, round, onComplete, singMode, locked]);

  const handleConfirm = useCallback(() => {
    if (!selectedPosition || !selectedNote || isRevealing) return;
    const isCorrect = selectedNote === round.targetNote;

    const semitones =
      firstSelectionSemitones ??
      getAbsoluteSemitoneDistance(selectedNote, round.targetNote);
    const direction =
      firstSelectionDirection ??
      getAbsoluteDirection(selectedNote, round.targetNote);

    if (isCorrect) {
      const stars = semitones === 0 ? 3 : semitones <= 2 ? 2 : semitones <= 5 ? 1 : 0;
      const attempts = attemptCount + 1;
      const totalTaps = selectionCount;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const feedback =
        semitones === 0 && totalTaps === 1
          ? '★★★  Direct hit — confirmed first try'
          : `${starStr}  ${totalTaps} tap${totalTaps !== 1 ? 's' : ''} · confirmed ${
              attempts === 1
                ? 'first try'
                : attempts === 2
                ? '2nd try'
                : attempts === 3
                ? '3rd try'
                : `${attempts}th try`
            } · first tap ${semitones} semitone${semitones !== 1 ? 's' : ''} ${direction}`;
      setRoundFeedback(feedback);
      setCorrectPositions(new Set([selectedPosition]));
      setIsRevealing(true);
      setNoteRevealed(true);
      setTimeout(() =>
        onComplete(true, {
          stars,
          attempts,
          selectionCount: totalTaps,
          direction,
          firstSelectionSemitones: semitones,
        }),
        600,
      );
    } else {
      setIsRevealing(true);
      setWrongConfirmFlash(true);
      setAttemptCount(a => a + 1);
      setCorrectPositions(getCorrectPositions(round.targetNote, round.fretsNum));
      setNoteRevealed(true);
      setTimeout(() => {
        setWrongConfirmFlash(false);
        onComplete(false);
      }, 1500);
    }
  }, [
    selectedPosition, selectedNote, isRevealing, round,
    firstSelectionSemitones, firstSelectionDirection,
    attemptCount, selectionCount, onComplete,
  ]);

  const handleExportCsv = useCallback(() => {
    const csv = exportToCsv(loadHuntHistory());
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guitar-hunt-stats.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, []);

  const handleImportCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseFromCsv(text);
    if (parsed.length === 0) {
      setImportMsg('Import failed — check file format.');
    } else {
      mergeHuntEntries(parsed);
      setImportMsg(`Imported ${parsed.length} rows`);
    }
    e.target.value = '';
    setTimeout(() => setImportMsg(null), 3000);
  }, []);

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          {isHuntMode ? 'Hunt the note' : singMode ? 'Sing the note' : 'Find the note'}
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote.replace(/\d$/, '')}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      {isHuntMode && (
        <div className="space-y-2">
          {onFocusChange && (
            <FretboardFocusSelector
              focus={focus}
              fretsNum={round.fretsNum}
              onChange={onFocusChange}
            />
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="px-3 py-1 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              Import CSV
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCsv}
            />
          </div>
          {importMsg && (
            <p className={`text-xs ${importMsg.startsWith('Import failed') ? 'text-red-500' : 'text-green-600'}`}>
              {importMsg}
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <Fretboard
          fretsNum={round.fretsNum}
          onFretClick={handleFretClick}
          onFretMouseDown={isHuntMode ? handleFretMouseDown : undefined}
          showNoteNames={false}
          correctPositions={correctPositions}
          wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
          previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
          focusZone={isHuntMode ? focus : undefined}
          compact
        />
        {singMode && locked && (
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

      {isHuntMode && sessionAvgSemitones !== undefined && (
        <p
          className="text-xs text-center tabular-nums"
          style={{ color: liveColor(sessionAvgSemitones, sessionAvgTaps ?? 0) }}
        >
          Session avg: {sessionAvgSemitones.toFixed(1)} semi · {(sessionAvgTaps ?? 0).toFixed(1)} taps
        </p>
      )}

      {score.total > 0 && (
        <p className="text-xs text-brand-secondary text-right">
          {score.correct} / {score.total} correct ({accuracy}%)
        </p>
      )}
    </div>
  );
}
