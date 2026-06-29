import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { ScaleDrillRound, SessionScore, generateScaleDrillRound, SCALE_DRILL_POSITIONS } from '@/src/lib/earTraining';
import { Fretboard } from '@/src/components/Fretboard';
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
import { initAudio, playArpeggio, getFretNote } from '@/src/lib/audio';
import { STANDARD_TUNING } from '@/src/types';
import type { Note } from '@/src/types';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type Position = 'full' | 'open' | 'mid' | 'upper';

const POSITION_LABELS: Record<Position, string> = {
  full:  'Full neck',
  open:  'Open (0–4)',
  mid:   'Mid (5–9)',
  upper: 'Upper (9–12)',
};

// Group COMMON_SCALES by category for the dropdown
const SCALE_CATEGORIES = Array.from(new Set(COMMON_SCALES.map(s => s.category)));

interface ScaleDrillTrainerProps {
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}

export function ScaleDrillTrainer({ score, onComplete }: ScaleDrillTrainerProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [scaleName, setScaleName] = useState<string>(COMMON_SCALES[0].name);
  const [root, setRoot] = useState<Note>('A');
  const [position, setPosition] = useState<Position>('full');

  const [studyMode, setStudyMode] = useState(true);
  const [round, setRound] = useState<ScaleDrillRound>(() =>
    generateScaleDrillRound({ scaleName: COMMON_SCALES[0].name, root: 'A', fretRange: SCALE_DRILL_POSITIONS.full })
  );
  const [selected, setSelected] = useState<Note | null>(null);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  const streakKey = `${root}|${scaleName}`;
  const currentStreak = streaks[streakKey] ?? 0;

  const scaleDef = COMMON_SCALES.find(s => s.name === scaleName) ?? COMMON_SCALES[0];
  const scalePattern = generateScalePattern(root, scaleDef);

  function makeRound(sName: string, r: Note, pos: Position): ScaleDrillRound {
    return generateScaleDrillRound({ scaleName: sName, root: r, fretRange: SCALE_DRILL_POSITIONS[pos] });
  }

  function handlePickerChange(newScale: string, newRoot: Note, newPos: Position) {
    setScaleName(newScale);
    setRoot(newRoot);
    setPosition(newPos);
    setStudyMode(true);
    setSelected(null);
    setFlashCorrect(false);
    setRound(makeRound(newScale, newRoot, newPos));
  }

  async function handlePlayScale() {
    await initAudio();
    // Collect all fretted positions of scale notes sorted by pitch (ascending)
    const notes: { note: string; midi: number }[] = [];
    STANDARD_TUNING.notes.forEach((openNote, stringIdx) => {
      for (let fret = 0; fret <= 12; fret++) {
        const noteStr = getFretNote(stringIdx, fret);
        const noteName = noteStr.replace(/[0-9]/g, '');
        if (scalePattern.notes.includes(noteName as Note)) {
          // Rough MIDI: parse octave from noteStr
          const octave = parseInt(noteStr.replace(/[^0-9]/g, ''), 10);
          const chromaticIdx = ALL_NOTES.indexOf(noteName as Note);
          notes.push({ note: noteStr, midi: octave * 12 + chromaticIdx });
        }
      }
    });
    // Deduplicate by MIDI pitch, keep lowest-fret representative
    const seen = new Set<number>();
    const unique = notes
      .sort((a, b) => a.midi - b.midi)
      .filter(n => { if (seen.has(n.midi)) return false; seen.add(n.midi); return true; });
    playArpeggio(unique.map(n => n.note), 80, '4n');
  }

  function handleStartDrilling() {
    setStudyMode(false);
    setSelected(null);
    setFlashCorrect(false);
    setRound(makeRound(scaleName, root, position));
  }

  function handleSelect(note: Note) {
    if (selected !== null) return;
    setSelected(note);
    const isCorrect = note === round.targetNote;

    if (isCorrect) {
      setStreaks(prev => ({ ...prev, [streakKey]: (prev[streakKey] ?? 0) + 1 }));
      onComplete(true);
      setTimeout(() => {
        setSelected(null);
        setRound(makeRound(scaleName, root, position));
      }, 600);
    } else {
      setStreaks(prev => ({ ...prev, [streakKey]: 0 }));
      setFlashCorrect(true);
      setTimeout(() => {
        setFlashCorrect(false);
        setSelected(null);
        onComplete(false);
        setRound(makeRound(scaleName, root, position));
      }, 1500);
    }
  }

  const labeledDots: { stringIdx: number; fret: number }[] | undefined =
    difficulty === 'Intermediate'
      ? [{ stringIdx: round.anchorStringIdx, fret: round.anchorFret }]
      : undefined;

  const fretRange: [number, number] = SCALE_DRILL_POSITIONS[position];

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">

      {/* Pickers row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Root picker */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Root</label>
            <select
              value={root}
              onChange={e => handlePickerChange(scaleName, e.target.value as Note, position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {ALL_NOTES.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Scale picker */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Scale</label>
            <select
              value={scaleName}
              onChange={e => handlePickerChange(e.target.value, root, position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {SCALE_CATEGORIES.map(cat => (
                <optgroup key={cat} label={cat}>
                  {COMMON_SCALES.filter(s => s.category === cat).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Position picker */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">Position</label>
            <select
              value={position}
              onChange={e => handlePickerChange(scaleName, root, e.target.value as Position)}
              className="text-sm border border-brand-line rounded px-2 py-1 bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              {(Object.keys(POSITION_LABELS) as Position[]).map(p => (
                <option key={p} value={p}>{POSITION_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Difficulty pills */}
        <div className="flex gap-2">
          {(['Beginner', 'Intermediate', 'Advanced'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                difficulty === d
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Score + streak row */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <div className="flex items-center gap-3">
          {currentStreak >= 3 && (
            <span className="text-brand-primary font-semibold">
              Streak: {currentStreak}
            </span>
          )}
          <span>{score.correct}/{score.total} correct</span>
        </div>
      </div>

      {studyMode ? (
        /* ── Study mode ─────────────────────────────────────────────── */
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-ink">
            Study: <span className="text-brand-primary font-bold">{root} {scaleName}</span>
            <span className="text-brand-secondary font-normal"> — {POSITION_LABELS[position]}</span>
          </p>
          <p className="text-xs text-brand-secondary">
            All notes are labeled. Use Play to hear the scale, then start drilling when ready.
          </p>
          <div className="overflow-x-auto">
            <Fretboard
              scale={scalePattern}
              showNoteNames={true}
              fretsNum={12}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePlayScale}
              className="px-4 py-2 rounded-lg border border-brand-line text-sm font-medium text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
            >
              Play scale
            </button>
            <button
              onClick={handleStartDrilling}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              Start Drilling →
            </button>
          </div>
        </div>
      ) : (
        /* ── Drill mode ──────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-brand-ink">
              What note is highlighted (★) in{' '}
              <span className="text-brand-primary font-bold">{round.root} {round.scaleName}</span>?
            </p>
            {difficulty === 'Intermediate' && (
              <p className="text-xs text-brand-secondary">
                The labeled dot is your anchor — use it to navigate to the star.
              </p>
            )}
            <p className="text-xs text-brand-secondary">
              String {round.targetStringIdx + 1} (from low E), fret {round.targetFret}
            </p>
          </div>

          <div className="overflow-x-auto">
            <Fretboard
              scale={scalePattern}
              fretRange={fretRange}
              highlightNote={{ stringIdx: round.targetStringIdx, fret: round.targetFret }}
              showNoteNames={difficulty === 'Beginner'}
              labeledDots={labeledDots}
              flashHighlight={flashCorrect}
              fretsNum={12}
            />
          </div>

          {/* Answer buttons */}
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
            <p className={cn(
              'text-sm font-semibold text-center',
              selected === round.targetNote ? 'text-green-600' : 'text-red-500'
            )}>
              {selected === round.targetNote
                ? 'Correct!'
                : `Not quite — it\'s ${round.targetNote}`}
            </p>
          )}

          <button
            onClick={() => { setStudyMode(true); setSelected(null); setFlashCorrect(false); }}
            className="w-full py-1.5 rounded-lg border border-brand-line text-xs text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
          >
            Back to Study
          </button>
        </div>
      )}
    </div>
  );
}
