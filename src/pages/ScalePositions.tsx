import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
import { initAudio, playNote } from '@/src/lib/audio';
import type { Note } from '@/src/types';
import { STANDARD_TUNING } from '@/src/types';

// Five CAGED box positions. startOff is semitones relative to root fret on low E.
// E-shape: root sits at the bottom of the box (-1 fret below root)
// D-shape: root appears on D+B strings, box starts 2 above root
// C-shape: root on A string, box starts 4 above root (perfect 4th)
// A-shape: root on A string one octave up, box starts 7 above root (5th)
// G-shape: root on E strings, box starts 9 above root (wraps to open end of neck)
const CAGED_BOXES = [
  { label: 'Position 1 (E-shape)', startOff: -1 },
  { label: 'Position 2 (D-shape)', startOff: 2 },
  { label: 'Position 3 (C-shape)', startOff: 4 },
  { label: 'Position 4 (A-shape)', startOff: 7 },
  { label: 'Position 5 (G-shape)', startOff: 9 },
];

const BOX_SPAN = 4;

// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

const DIATONIC_MODES = [
  { name: 'Ionian (Major)', degree: 1 },
  { name: 'Dorian', degree: 2 },
  { name: 'Phrygian', degree: 3 },
  { name: 'Lydian', degree: 4 },
  { name: 'Mixolydian', degree: 5 },
  { name: 'Aeolian (Minor)', degree: 6 },
  { name: 'Locrian', degree: 7 },
];

type DrillMode = 'identify-position' | 'free-explore';

export function ScalePositions() {
  const [root, setRoot] = useState<Note>('G');
  const [scaleIdx, setScaleIdx] = useState(0);
  const [positionIdx, setPositionIdx] = useState(0);
  const [drillMode, setDrillMode] = useState<DrillMode>('free-explore');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');

  const scaleDef = COMMON_SCALES[scaleIdx];

  // Find root's fret on low E, then offset to the chosen CAGED box window.
  // High boxes (> fret 11) wrap an octave down so they stay on a playable neck region.
  const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
  const rootNoteIdx = ALL_NOTES.indexOf(root);
  const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;

  const box = CAGED_BOXES[positionIdx];
  let startFret = rootFret + box.startOff;
  if (startFret < 0) startFret = 0;
  if (startFret > 11) startFret = startFret % 12;
  const endFret = startFret + BOX_SPAN;
  const fretRange: [number, number] = [startFret, endFret];
  const fretsNum = Math.max(12, endFret + 1);

  const pattern = generateScalePattern(root, scaleDef);

  // Play only the notes visible in the current box, sorted low to high pitch.
  const handlePlayAscending = useCallback(async () => {
    await initAudio();
    const seen = new Set<number>();
    const toPlay: Array<[string, number]> = [];
    for (let s = 0; s < 6; s++) {
      const openIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = startFret; f <= endFret; f++) {
        const name = ALL_NOTES[(openIdx + f) % 12];
        if (pattern.notes.includes(name as Note)) {
          const pitch = OPEN_STRING_MIDI[s] + f;
          if (!seen.has(pitch)) { seen.add(pitch); toPlay.push([name, pitch]); }
        }
      }
    }
    toPlay.sort((a, b) => a[1] - b[1]);
    toPlay.forEach(([name, pitch], i) => {
      const octave = Math.floor(pitch / 12) - 1;
      setTimeout(() => playNote(`${name}${octave}`, '8n'), i * 250);
    });
  }, [pattern, startFret, endFret]);

  function startDrill() {
    const newIdx = Math.floor(Math.random() * 5);
    const correct = CAGED_BOXES[newIdx].label;
    const shuffled = CAGED_BOXES
      .filter((_, i) => i !== newIdx)
      .map(b => b.label)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    setPositionIdx(newIdx);
    setQuizOptions([correct, ...shuffled].sort(() => Math.random() - 0.5));
    setCorrectAnswer(correct);
    setSelected(null);
  }

  function handleSelect(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
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

        <div className="space-y-2">
          <label className="text-xs font-medium text-brand-secondary">Scale</label>
          <select
            value={scaleIdx}
            onChange={e => setScaleIdx(Number(e.target.value))}
            className="h-8 px-2 rounded border border-brand-line bg-brand-surface text-brand-ink text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
          >
            {COMMON_SCALES.map((s, i) => (
              <option key={s.name} value={i}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['free-explore', 'identify-position'] as DrillMode[]).map(m => (
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
            {m === 'free-explore' ? 'Explore' : 'Drill: Name the Position'}
          </button>
        ))}
      </div>

      {/* Position selector (free-explore only) */}
      {drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {CAGED_BOXES.map((b, i) => (
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
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {root} {scaleDef.name} — {CAGED_BOXES[positionIdx].label}
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
            fretsNum={fretsNum}
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
                onClick={startDrill}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal context reference */}
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
