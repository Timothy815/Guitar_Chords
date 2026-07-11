import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES, generateDiagonalPentatonic, OPEN_STRING_MIDI } from '@/src/data/guitarData';
import { initAudio, playNote } from '@/src/lib/audio';
import type { Note } from '@/src/types';
import { STANDARD_TUNING } from '@/src/types';
import { getBluesBoxPattern } from '@/src/lib/bluesBoxPatterns';

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
type ViewMode = 'box' | 'diagonal';

export function ScalePositions() {
  const [root, setRoot] = useState<Note>('G');
  const [scaleIdx, setScaleIdx] = useState(0);
  const [positionIdx, setPositionIdx] = useState(0);
  const [drillMode, setDrillMode] = useState<DrillMode>('free-explore');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('box');
  const [visibleCells, setVisibleCells] = useState<Set<number>>(new Set([0, 1, 2]));

  const scaleDef = COMMON_SCALES[scaleIdx];
  const diagonalSupported = scaleDef.intervals.length === 5;

  // Find root's fret on low E, then offset to the chosen CAGED box window.
  // High boxes (> fret 11) wrap an octave down so they stay on a playable neck region.
  const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
  const rootNoteIdx = ALL_NOTES.indexOf(root);
  const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;

  const box = CAGED_BOXES[positionIdx];
  const strictBluesPattern = getBluesBoxPattern(scaleDef.name, positionIdx);
  const relativeFrets = strictBluesPattern?.flat() ?? [];
  const boxStartOff = relativeFrets.length ? Math.min(...relativeFrets) : box.startOff;
  const boxEndOff = relativeFrets.length ? Math.max(...relativeFrets) : box.startOff + BOX_SPAN;
  let octaveShift = 0;
  while (rootFret + octaveShift + boxStartOff < 0) octaveShift += 12;
  while (rootFret + octaveShift + boxStartOff > 11) octaveShift -= 12;
  const positionedRootFret = rootFret + octaveShift;
  let startFret = positionedRootFret + boxStartOff;
  if (startFret < 0) startFret = 0;
  if (startFret > 11) startFret = startFret % 12;
  const endFret = startFret + (boxEndOff - boxStartOff);
  const fretRange: [number, number] = [startFret, endFret];
  const fretsNum = Math.max(12, endFret + 1);

  const pattern = generateScalePattern(root, scaleDef);

  // Build an explicit string-fret set for the Fretboard, deduplicated by MIDI pitch.
  // When the same pitch appears on two strings within the box (e.g. G string fret 4
  // and open B string are both B3), we keep only the lowest-fret occurrence so the
  // player sees the correct position-box fingering with no doubled notes.
  const scalePositions = useMemo(() => {
    if (strictBluesPattern) {
      const positions = new Set<string>();
      strictBluesPattern.forEach((frets, stringIdx) => {
        frets.forEach(relativeFret => positions.add(`${stringIdx}-${positionedRootFret + relativeFret}`));
      });
      return positions;
    }
    const candidates: { s: number; f: number; midi: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const openMidi = OPEN_STRING_MIDI[s];
      const openNoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = startFret; f <= endFret; f++) {
        const name = ALL_NOTES[(openNoteIdx + f) % 12];
        if (pattern.notes.includes(name as Note)) {
          candidates.push({ s, f, midi: openMidi + f });
        }
      }
    }
    // Sort by fret ascending — lower fret wins for the same MIDI pitch.
    candidates.sort((a, b) => a.f - b.f);
    const seen = new Set<number>();
    const positions = new Set<string>();
    for (const { s, f, midi } of candidates) {
      if (!seen.has(midi)) { seen.add(midi); positions.add(`${s}-${f}`); }
    }
    return positions;
  }, [pattern, startFret, endFret, strictBluesPattern, positionedRootFret]);

  const diagonalCells = useMemo(
    () => generateDiagonalPentatonic(root, scaleDef),
    [root, scaleDef],
  );

  const diagonalPositions = useMemo(() => {
    const set = new Set<string>();
    diagonalCells.forEach((cell, i) => {
      if (!visibleCells.has(i)) return;
      cell.positions.forEach(p => set.add(`${p.stringIdx}-${p.fret}`));
    });
    return set;
  }, [diagonalCells, visibleCells]);

  const diagonalFretsNum = useMemo(() => {
    let maxFret = 0;
    diagonalPositions.forEach(pos => {
      const fret = Number(pos.split('-')[1]);
      if (fret > maxFret) maxFret = fret;
    });
    return Math.max(12, maxFret + 1);
  }, [diagonalPositions]);

  // Collect unique pitches in the box window, sorted low→high.
  const getBoxNotes = useCallback((): Array<[string, number]> => {
    if (strictBluesPattern) {
      const notes: Array<[string, number]> = [];
      strictBluesPattern.forEach((frets, stringIdx) => {
        const openIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[stringIdx] as Note);
        frets.forEach(relativeFret => {
          const fret = positionedRootFret + relativeFret;
          notes.push([ALL_NOTES[(openIdx + fret) % 12], OPEN_STRING_MIDI[stringIdx] + fret]);
        });
      });
      return notes.sort((a, b) => a[1] - b[1]);
    }
    const seen = new Set<number>();
    const notes: Array<[string, number]> = [];
    for (let s = 0; s < 6; s++) {
      const openIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = startFret; f <= endFret; f++) {
        const name = ALL_NOTES[(openIdx + f) % 12];
        if (pattern.notes.includes(name as Note)) {
          const pitch = OPEN_STRING_MIDI[s] + f;
          if (!seen.has(pitch)) { seen.add(pitch); notes.push([name, pitch]); }
        }
      }
    }
    return notes.sort((a, b) => a[1] - b[1]);
  }, [pattern, startFret, endFret, strictBluesPattern, positionedRootFret]);

  const getDiagonalNotes = useCallback((): Array<[string, number]> => {
    const notes: Array<[string, number]> = [];
    diagonalCells.forEach((cell, i) => {
      if (!visibleCells.has(i)) return;
      cell.positions.forEach(p => {
        notes.push([p.note, OPEN_STRING_MIDI[p.stringIdx] + p.fret]);
      });
    });
    return notes;
  }, [diagonalCells, visibleCells]);

  const handlePlay = useCallback(async (direction: 'ascending' | 'descending' | 'up-down' | 'down-up') => {
    await initAudio();
    const asc = viewMode === 'diagonal' ? getDiagonalNotes() : getBoxNotes();
    const desc = [...asc].reverse();
    const seq = direction === 'descending' ? desc
               : direction === 'up-down'   ? [...asc, ...desc.slice(1)]
               : direction === 'down-up'   ? [...desc, ...asc.slice(1)]
               : asc;
    seq.forEach(([name, pitch], i) => {
      const octave = Math.floor(pitch / 12) - 1;
      setTimeout(() => playNote(`${name}${octave}`, '8n'), i * 220);
    });
  }, [viewMode, getBoxNotes, getDiagonalNotes]);

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

  function handleViewModeChange(mode: ViewMode) {
    if (mode === 'diagonal' && !diagonalSupported) return;
    setViewMode(mode);
    if (mode === 'diagonal') {
      setDrillMode('free-explore');
    }
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
          <label className="block text-xs font-medium text-brand-secondary">Scale</label>
          <select
            value={scaleIdx}
            onChange={e => setScaleIdx(Number(e.target.value))}
            className="h-8 px-2 rounded border border-brand-line bg-brand-surface text-brand-ink text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
          >
            {COMMON_SCALES.map((s, i) => (viewMode === 'diagonal' && s.intervals.length !== 5) ? null : (
              <option key={s.name} value={i}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex gap-2">
        {(['box', 'diagonal'] as ViewMode[]).map(m => {
          const disabled = m === 'diagonal' && !diagonalSupported;
          return (
            <button
              key={m}
              onClick={() => handleViewModeChange(m)}
              disabled={disabled}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                viewMode === m
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                disabled && 'opacity-40 cursor-not-allowed hover:border-brand-line',
              )}
            >
              {m === 'box' ? 'Box' : 'Diagonal'}
            </button>
          );
        })}
      </div>

      {!diagonalSupported && (
        <p className="text-[10px] text-brand-secondary/70 leading-tight">
          Diagonal view is currently available for Minor Pentatonic and Major Pentatonic.
        </p>
      )}

      {/* Mode tabs (box view only — drill/quiz is CAGED-box-specific) */}
      {viewMode === 'box' && (
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
      )}

      {/* Position selector (box mode, free-explore only) */}
      {viewMode === 'box' && drillMode === 'free-explore' && (
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

      {/* Cell checkboxes (diagonal mode) */}
      {viewMode === 'diagonal' && (
        <div className="flex gap-3 flex-wrap">
          {diagonalCells.map((cell, i) => (
            <label key={i} className="flex items-center gap-2 text-xs font-medium text-brand-ink cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCells.has(i)}
                onChange={() => {
                  setVisibleCells(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  });
                }}
              />
              {cell.label}
            </label>
          ))}
        </div>
      )}

      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {viewMode === 'box' ? (
              <>
                {root} {scaleDef.name} — {CAGED_BOXES[positionIdx].label}
                {drillMode === 'free-explore' && (
                  <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
                )}
              </>
            ) : (
              <>{root} {scaleDef.name} — Diagonal Pattern</>
            )}
          </p>
          <div className="flex gap-1">
            <button onClick={() => handlePlay('ascending')}  className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲ Up</button>
            <button onClick={() => handlePlay('descending')} className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼ Down</button>
            <button onClick={() => handlePlay('up-down')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲▼ Up–Down</button>
            <button onClick={() => handlePlay('down-up')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼▲ Down–Up</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {viewMode === 'box' ? (
            <Fretboard
              scale={pattern}
              fretRange={fretRange}
              scalePositions={scalePositions}
              fretsNum={fretsNum}
            />
          ) : (
            <Fretboard
              scale={pattern}
              scalePositions={diagonalPositions}
              fretsNum={diagonalFretsNum}
            />
          )}
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
      {viewMode === 'box' && drillMode === 'free-explore' && scaleDef.intervals.length === 7 && (
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
