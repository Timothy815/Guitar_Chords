import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
import { initAudio, playNote } from '@/src/lib/audio';
import type { Note } from '@/src/types';
import { STANDARD_TUNING } from '@/src/types';

// CAGED positions are 5 pattern "windows" on the neck for a given scale/root
// Each window covers a 4-fret span starting at specific frets relative to the root
const CAGED_POSITION_OFFSETS = [0, 3, 5, 7, 10]; // semitone offsets relative to root for each box
const POSITION_LABELS = ['Position 1 (Root box)', 'Position 2', 'Position 3', 'Position 4', 'Position 5'];

const DIATONIC_MODES = [
  { name: 'Ionian (Major)', degree: 1 },
  { name: 'Dorian', degree: 2 },
  { name: 'Phrygian', degree: 3 },
  { name: 'Lydian', degree: 4 },
  { name: 'Mixolydian', degree: 5 },
  { name: 'Aeolian (Minor)', degree: 6 },
  { name: 'Locrian', degree: 7 },
];

type DrillMode = 'identify-position' | 'identify-mode' | 'free-explore';

export function ScalePositions() {
  const [root, setRoot] = useState<Note>('G');
  const [scaleIdx, setScaleIdx] = useState(0);
  const [positionIdx, setPositionIdx] = useState(0);
  const [drillMode, setDrillMode] = useState<DrillMode>('free-explore');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');

  const scaleDef = COMMON_SCALES[scaleIdx];

  // Compute start fret for current position
  const rootNoteIdx = ALL_NOTES.indexOf(root);
  const positionRootNoteIdx = (rootNoteIdx + CAGED_POSITION_OFFSETS[positionIdx]) % 12;

  // Find lowest fret of positionRootNote on the low E string (string 0)
  // This gives us the fret range window start
  const lowEOpen = STANDARD_TUNING.notes[0];
  const lowEOpenIdx = ALL_NOTES.indexOf(lowEOpen);
  let startFret = (positionRootNoteIdx - lowEOpenIdx + 12) % 12;
  if (startFret === 0) startFret = 12; // prefer non-open position for clarity
  const fretRange: [number, number] = [startFret, startFret + 4];

  const pattern = generateScalePattern(root, scaleDef);

  const handlePlayAscending = useCallback(async () => {
    await initAudio();
    const notesInWindow = pattern.notes;
    notesInWindow.forEach((note, i) => {
      setTimeout(() => playNote(`${note}4`, '8n'), i * 250);
    });
  }, [pattern]);

  function startDrill() {
    const correct = POSITION_LABELS[positionIdx];
    const shuffled = POSITION_LABELS.filter(l => l !== correct)
      .sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [correct, ...shuffled].sort(() => Math.random() - 0.5);
    setQuizOptions(opts);
    setCorrectAnswer(correct);
    setSelected(null);
    setPositionIdx(Math.floor(Math.random() * 5));
  }

  function handleSelect(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
  }

  function nextQuestion() {
    setSelected(null);
    setPositionIdx(Math.floor(Math.random() * 5));
    startDrill();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Scale Positions</h1>
        <p className="text-sm text-brand-secondary">
          Explore and drill the 5 CAGED scale positions across the neck.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-secondary">Root</label>
          <div className="flex gap-1 flex-wrap">
            {ALL_NOTES.map(n => (
              <button
                key={n}
                onClick={() => setRoot(n)}
                className={cn(
                  'w-10 h-8 rounded text-xs font-bold border transition-colors',
                  root === n
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-secondary">Scale</label>
          <div className="flex gap-1 flex-wrap">
            {COMMON_SCALES.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setScaleIdx(i)}
                className={cn(
                  'px-3 h-8 rounded text-xs font-medium border transition-colors',
                  scaleIdx === i
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['free-explore', 'identify-position', 'identify-mode'] as DrillMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setDrillMode(m); setSelected(null); if (m !== 'free-explore') startDrill(); }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              drillMode === m
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
            )}
          >
            {m === 'free-explore' ? 'Explore' : m === 'identify-position' ? 'Drill: Name the Position' : 'Drill: Mode Context'}
          </button>
        ))}
      </div>

      {/* Position selector (free-explore only) */}
      {drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {POSITION_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setPositionIdx(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                positionIdx === i
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {root} {scaleDef.name} — {POSITION_LABELS[positionIdx]}
            {drillMode === 'free-explore' && (
              <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
            )}
          </p>
          <button
            onClick={handlePlayAscending}
            className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            ▶ Play ascending
          </button>
        </div>
        <div className="overflow-x-auto">
          <Fretboard
            scale={pattern}
            fretRange={fretRange}
          />
        </div>
      </div>

      {/* Quiz area */}
      {drillMode === 'identify-position' && quizOptions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-ink">Which position is shown above?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quizOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={selected !== null}
                className={cn(
                  'py-3 px-4 rounded-lg text-sm border text-left transition-colors',
                  selected === null
                    ? 'border-brand-line text-brand-ink hover:border-brand-primary/60'
                    : opt === correctAnswer
                      ? 'bg-green-500 text-white border-green-500'
                      : opt === selected
                        ? 'bg-red-500 text-white border-red-500'
                        : 'border-brand-line text-brand-secondary opacity-50',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          {selected !== null && (
            <div className="space-y-2">
              <p className={cn('text-sm font-semibold', selected === correctAnswer ? 'text-green-600' : 'text-red-500')}>
                {selected === correctAnswer ? 'Correct!' : `The answer is: ${correctAnswer}`}
              </p>
              <button
                onClick={nextQuestion}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode context reference */}
      {drillMode === 'free-explore' && scaleDef.intervals.length === 7 && (
        <div className="rounded-lg border border-brand-line bg-brand-bg p-4 space-y-2">
          <p className="text-xs font-medium text-brand-ink">Modal context for {scaleDef.name}:</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {DIATONIC_MODES.map(({ name, degree }) => {
              const modeRoot = ALL_NOTES[(rootNoteIdx + scaleDef.intervals[degree - 1]) % 12];
              return (
                <div key={name} className="text-xs">
                  <span className="font-mono text-brand-primary">{modeRoot}</span>
                  <span className="text-brand-secondary ml-1">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
