import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, ChordShape } from '../types';
import { Fretboard } from '../components/Fretboard';
import { CircleOfFifths } from '../components/CircleOfFifths';
import { playStrum, initAudio, getFretNote } from '../lib/audio';
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  noteAt,
  displayNote,
  diatonicDegrees,
  borrowedChords,
  effectiveBorrowedQuality,
  chordsForQuality,
  chordLabel,
  wedgeQualityFor,
  relativeMinorOf,
  relativeMajorOf,
  WedgeQuality,
  DiatonicQuality,
  SeventhQuality,
} from '../data/musicTheory';

type Selection = { kind: 'degree' | 'borrowed'; index: number };

// Common preset progressions (indices into diatonicDegrees('major'|'minor')).
const PRESET_PROGRESSIONS_MAJOR: Array<{ label: string; degrees: number[] }> = [
  { label: 'I–IV–V',    degrees: [0, 3, 4] },
  { label: 'I–V–vi–IV', degrees: [0, 4, 5, 3] },
  { label: 'ii–V–I',    degrees: [1, 4, 0] },
  { label: 'I–vi–IV–V', degrees: [0, 5, 3, 4] },
  { label: 'vi–IV–I–V', degrees: [5, 3, 0, 4] },
];

const PRESET_PROGRESSIONS_MINOR: Array<{ label: string; degrees: number[] }> = [
  { label: 'i–iv–v',       degrees: [0, 3, 4] },
  { label: 'i–VI–III–VII', degrees: [0, 5, 2, 6] },
  { label: 'i–VII–VI',     degrees: [0, 6, 5] },
  { label: 'i–iv–VII–III', degrees: [0, 3, 6, 2] },
];

export function Circle() {
  const [tonic, setTonic] = useState<Note>('C');
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [sevenths, setSevenths] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: 'degree', index: 0 });
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const navigate = useNavigate();

  const activeDegrees = diatonicDegrees(mode);
  const activeBorrowed = borrowedChords(mode);
  const presetProgressions = mode === 'major' ? PRESET_PROGRESSIONS_MAJOR : PRESET_PROGRESSIONS_MINOR;

  useEffect(() => { setVoicingIdx(0); }, [tonic, mode, sevenths, selection.kind, selection.index]);

  async function playChord(chord: ChordShape) {
    await initAudio();
    const notes = chord.frets
      .map((fret, strIdx) => (fret !== -1 ? getFretNote(strIdx, fret) : null))
      .filter((n): n is string => n !== null);
    playStrum(notes, 2, 'down');
  }

  const handleWheelSelect = (root: Note, quality: WedgeQuality) => {
    setTonic(root);
    setMode(quality);
    setSelection({ kind: 'degree', index: 0 });
    const tonicQuality: DiatonicQuality | SeventhQuality = sevenths
      ? (quality === 'major' ? 'Maj7' : 'm7')
      : (quality === 'major' ? 'Major' : 'Minor');
    const chords = chordsForQuality(root, tonicQuality);
    if (chords[0]) playChord(chords[0]);
  };

  const handleModeToggle = (newMode: 'major' | 'minor') => {
    if (newMode === mode) return;
    setTonic(newMode === 'minor' ? relativeMinorOf(tonic) : relativeMajorOf(tonic));
    setMode(newMode);
    setSelection({ kind: 'degree', index: 0 });
  };

  const handleDegreeChipClick = (index: number) => {
    setSelection({ kind: 'degree', index });
    const deg = activeDegrees[index];
    const root = noteAt(tonic, deg.interval);
    const quality = sevenths ? deg.seventh : deg.quality;
    const chords = chordsForQuality(root, quality);
    if (chords[0]) playChord(chords[0]);
  };

  const handleBorrowedChipClick = (index: number) => {
    setSelection({ kind: 'borrowed', index });
    const b = activeBorrowed[index];
    const root = noteAt(tonic, b.interval);
    const quality = effectiveBorrowedQuality(b, sevenths);
    const chords = chordsForQuality(root, quality);
    if (chords[0]) playChord(chords[0]);
  };

  function handleAddPresetProgression(degrees: number[]) {
    let addedCount = 0;
    for (const degIdx of degrees) {
      const deg = activeDegrees[degIdx];
      const root = noteAt(tonic, deg.interval);
      const chords = chordsForQuality(root, sevenths ? deg.seventh : deg.quality);
      const chord = chords[0] ?? null;
      if (chord && addChordToActiveProgression(chord)) addedCount++;
    }
    if (addedCount > 0) {
      setAddedToast(`Added ${addedCount} chords to progression`);
    } else {
      setAddedToast('No progression saved yet — create one first');
    }
    setTimeout(() => setAddedToast(null), 2500);
  }

  const selRoot: Note = selection.kind === 'degree'
    ? noteAt(tonic, activeDegrees[selection.index].interval)
    : noteAt(tonic, activeBorrowed[selection.index].interval);

  const selQuality: DiatonicQuality | SeventhQuality = selection.kind === 'degree'
    ? (sevenths ? activeDegrees[selection.index].seventh : activeDegrees[selection.index].quality)
    : effectiveBorrowedQuality(activeBorrowed[selection.index], sevenths);

  const selNumeral = selection.kind === 'degree'
    ? activeDegrees[selection.index].roman
    : activeBorrowed[selection.index].label;

  const selWhy = selection.kind === 'borrowed' ? activeBorrowed[selection.index].why : null;

  const allVoicings: ChordShape[] = chordsForQuality(selRoot, selQuality);
  const activeChord = allVoicings[voicingIdx] ?? null;

  const handleVoicingChange = (delta: number) => {
    const next = voicingIdx + delta;
    if (next < 0 || next >= allVoicings.length) return;
    setVoicingIdx(next);
    playChord(allVoicings[next]);
  };

  function handleAddToProgression(chord: ChordShape) {
    const ok = addChordToActiveProgression(chord);
    setAddedToast(ok ? `Added ${chord.name}` : 'No progression saved yet — create one first');
    setTimeout(() => setAddedToast(null), 2000);
  }

  const wheelQuality = wedgeQualityFor(selQuality);
  const wheelSelected = wheelQuality ? { root: selRoot, quality: wheelQuality } : null;
  const keyDisplay = `${displayNote(tonic)} ${mode === 'major' ? 'Major' : 'Minor'}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div>
        <h1 className="text-4xl font-serif font-bold text-brand-ink mb-2">Circle of Fifths</h1>
        <p className="text-brand-secondary text-lg max-w-2xl">
          Each key is a fifth apart from its neighbors. Click any wedge to hear it and explore its chords —
          in-key chords and common borrowed chords are listed below.
        </p>
      </div>

      {addedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-ink text-brand-surface text-sm px-4 py-2 rounded-lg shadow-lg z-50 pointer-events-none">
          {addedToast}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="bg-brand-surface border border-brand-line rounded-xl p-6 shadow-sm">
          <CircleOfFifths tonic={tonic} mode={mode} selected={wheelSelected} onSelect={handleWheelSelect} />
        </div>

        <div className="bg-brand-surface border border-brand-line rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-brand-ink">{keyDisplay}</h2>
            <button
              onClick={() => navigate('/dictionary')}
              className="flex items-center gap-1.5 text-sm text-brand-secondary hover:text-brand-primary transition-colors"
            >
              <ExternalLink size={14} /> View in Dictionary
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(['major', 'minor'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => handleModeToggle(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                    mode === m
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
                  )}
                >
                  {m === 'major' ? 'Major' : 'Minor'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {([false, true] as const).map(sev => (
                <button
                  key={String(sev)}
                  onClick={() => setSevenths(sev)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                    sevenths === sev
                      ? 'bg-brand-secondary text-white border-brand-secondary'
                      : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
                  )}
                >
                  {sev ? '7ths' : 'Triads'}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">In the Key</p>
          <div className="flex flex-wrap gap-2">
            {activeDegrees.map((deg, i) => {
              const root = noteAt(tonic, deg.interval);
              const quality = sevenths ? deg.seventh : deg.quality;
              const isSelected = selection.kind === 'degree' && selection.index === i;
              return (
                <button
                  key={deg.roman}
                  onClick={() => handleDegreeChipClick(i)}
                  className={cn(
                    'flex flex-col items-center px-3 py-2 rounded-lg border text-sm font-bold transition-all min-w-[56px]',
                    isSelected
                      ? 'bg-brand-active text-white border-brand-active shadow-md'
                      : 'border-brand-active/40 text-brand-active hover:bg-brand-active/10',
                  )}
                >
                  <span className="text-[10px] font-normal opacity-80">{chordLabel(root, quality)}</span>
                  <span>{deg.roman}</span>
                </button>
              );
            })}
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">Borrowed Chords</p>
          <div className="flex flex-wrap gap-2">
            {activeBorrowed.map((b, i) => {
              const root = noteAt(tonic, b.interval);
              const quality = effectiveBorrowedQuality(b, sevenths);
              const isSelected = selection.kind === 'borrowed' && selection.index === i;
              return (
                <button
                  key={b.label}
                  onClick={() => handleBorrowedChipClick(i)}
                  title={b.why}
                  className={cn(
                    'flex flex-col items-center px-3 py-2 rounded-lg border border-dashed text-sm font-bold transition-all min-w-[56px]',
                    isSelected
                      ? 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                      : 'border-brand-line text-brand-secondary hover:bg-brand-sidebar',
                  )}
                >
                  <span className="text-[10px] font-normal opacity-80">{chordLabel(root, quality)}</span>
                  <span>{b.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">Quick Add Progression</p>
            <div className="flex flex-wrap gap-1.5">
              {presetProgressions.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handleAddPresetProgression(preset.degrees)}
                  className="text-xs px-2.5 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                  title={`Add ${preset.label} in ${keyDisplay} to active progression`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {activeChord ? (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-brand-ink">
                    {activeChord.name} <span className="text-brand-active font-normal">({selNumeral})</span>
                  </p>
                  {selWhy && <p className="text-xs text-brand-secondary/80 italic">{selWhy}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {allVoicings.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleVoicingChange(-1)}
                        disabled={voicingIdx === 0}
                        className="p-0.5 rounded text-brand-secondary hover:text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Previous position"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-brand-secondary tabular-nums">
                        {voicingIdx + 1}/{allVoicings.length}
                      </span>
                      <button
                        onClick={() => handleVoicingChange(1)}
                        disabled={voicingIdx === allVoicings.length - 1}
                        className="p-0.5 rounded text-brand-secondary hover:text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Next position"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => handleAddToProgression(activeChord)}
                    className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                    title="Add to active progression"
                  >
                    + Progression
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/dictionary?mode=identify&frets=${activeChord.frets.join(',')}`)
                    }
                    className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                    title="Load into Identifier to experiment"
                  >
                    Explore →
                  </button>
                </div>
              </div>
              <Fretboard chord={activeChord} fretsNum={12} showNoteNames={false} />
            </div>
          ) : (
            <p className="text-sm text-brand-secondary/70 text-center py-6">
              No guitar voicing available for this chord yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
