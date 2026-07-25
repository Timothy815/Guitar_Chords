import React, { useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { Note } from '../types';
import { Fretboard } from './Fretboard';
import { initAudio, playNote, getFretNote, playBend, playSlide, playVibrato, stopNote } from '../lib/audio';
import { cn } from '../lib/utils';

type TechniqueType = 'static' | 'bend' | 'slide' | 'hammer' | 'pulloff' | 'vibrato';

interface SelectedNote {
  stringIdx: number;
  fretIdx: number;
  note: string;
}

interface TechniqueExplorerProps {
  rootNote?: Note;
}

export function TechniqueExplorer({ rootNote = 'A' }: TechniqueExplorerProps) {
  const [firstNote, setFirstNote] = useState<SelectedNote | null>(null);
  const [secondNote, setSecondNote] = useState<SelectedNote | null>(null);
  const [technique, setTechnique] = useState<TechniqueType>('static');
  const [bendAmount, setBendAmount] = useState(2); // semitones
  const [speed, setSpeed] = useState(0.5); // seconds
  const [isPlaying, setIsPlaying] = useState(false);

  function handleFretClick(stringIdx: number, fretIdx: number) {
    if (isPlaying) return;

    const note = getFretNote(stringIdx, fretIdx);
    const selected: SelectedNote = { stringIdx, fretIdx, note };

    if (!firstNote) {
      setFirstNote(selected);
    } else if (!secondNote) {
      setSecondNote(selected);
    } else {
      // Reset and start over
      setFirstNote(selected);
      setSecondNote(null);
    }
  }

  function clearSelection() {
    setFirstNote(null);
    setSecondNote(null);
  }

  async function playTechnique() {
    if (!firstNote) return;

    setIsPlaying(true);
    await initAudio();

    try {
      if (!secondNote) {
        // Single note techniques
        if (technique === 'vibrato') {
          await playVibrato(firstNote.note, 2.5, 0.8, 5.5);
        } else {
          playNote(firstNote.note, '2n');
        }
      } else {
        // Two note techniques
        if (technique === 'static') {
          // Play both notes simultaneously
          playNote(firstNote.note, '2n');
          playNote(secondNote.note, '2n');
        } else if (technique === 'bend') {
          // Play first note, bend to second note
          playNote(firstNote.note, `${(speed + 1) * 2}n`);

          setTimeout(async () => {
            await playBend(secondNote.note, bendAmount, speed, speed);
          }, 50);
        } else if (technique === 'slide') {
          // Slide from first note to second note
          playNote(firstNote.note, `${speed + 1}n`);

          setTimeout(async () => {
            await playSlide(firstNote.note, secondNote.note, speed);
          }, 50);
        } else if (technique === 'hammer') {
          // Hammer-on: pick first note, hammer to second note
          playNote(firstNote.note, '16n');

          setTimeout(() => {
            stopNote();
            playNote(secondNote.note, '4n');
          }, 150);
        } else if (technique === 'pulloff') {
          // Pull-off: pick second note, pull off to first note
          playNote(secondNote.note, '16n');

          setTimeout(() => {
            stopNote();
            playNote(firstNote.note, '4n');
          }, 150);
        } else if (technique === 'vibrato') {
          // Double stop with vibrato on second note
          playNote(firstNote.note, '2n');

          setTimeout(async () => {
            await playVibrato(secondNote.note, 2.5, 0.8, 5.5);
          }, 50);
        }
      }
    } finally {
      setTimeout(() => setIsPlaying(false), Math.max(3000, speed * 2000 + 1000));
    }
  }

  // Build visual markers for fretboard
  const correctPositions = new Set<string>();
  if (firstNote) correctPositions.add(`${firstNote.stringIdx}-${firstNote.fretIdx}`);
  if (secondNote) correctPositions.add(`${secondNote.stringIdx}-${secondNote.fretIdx}`);

  return (
    <div className="w-full space-y-6">
      {/* Instructions */}
      <div className="text-center space-y-2">
        <p className="text-sm text-brand-secondary">
          Click on the fretboard to select {!firstNote ? 'first note' : !secondNote ? 'second note (optional)' : 'notes'}
        </p>
        {(firstNote || secondNote) && (
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm font-medium text-brand-ink">
              {firstNote && <span>1st: {firstNote.note}</span>}
              {firstNote && secondNote && <span className="mx-2">→</span>}
              {secondNote && <span>2nd: {secondNote.note}</span>}
            </p>
            <button
              onClick={clearSelection}
              className="text-brand-secondary hover:text-brand-ink transition-colors"
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Fretboard */}
      <div className="w-full">
        <Fretboard
          fretsNum={15}
          onFretClick={handleFretClick}
          showNoteNames={true}
          correctPositions={correctPositions}
          compact={false}
        />
      </div>

      <div className="space-y-4">
        {/* Technique Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-brand-secondary block mb-2">
            Technique
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'static', label: 'Double Stop' },
              { key: 'hammer', label: 'Hammer On' },
              { key: 'pulloff', label: 'Pull Off' },
              { key: 'slide', label: 'Slide' },
              { key: 'bend', label: 'Bend' },
              { key: 'vibrato', label: 'Vibrato' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTechnique(key)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  technique === key
                    ? 'bg-brand-primary text-white'
                    : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Technique Parameters */}
        {technique === 'bend' && (
          <div className="space-y-3 p-4 border border-brand-line rounded-lg bg-brand-sidebar">
            <div>
              <label className="text-xs font-semibold text-brand-secondary block mb-2">
                Bend Amount: {bendAmount} semitone{bendAmount !== 1 ? 's' : ''}
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.5"
                value={bendAmount}
                onChange={(e) => setBendAmount(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-secondary block mb-2">
                Bend Speed: {speed.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {technique === 'slide' && (
          <div className="p-4 border border-brand-line rounded-lg bg-brand-sidebar">
            <div>
              <label className="text-xs font-semibold text-brand-secondary block mb-2">
                Slide Speed: {speed.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Play Button */}
      <div className="flex justify-center">
        <button
          onClick={playTechnique}
          disabled={isPlaying || !firstNote}
          className={cn(
            'flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-semibold transition-all',
            isPlaying || !firstNote
              ? 'bg-brand-secondary/50 text-white cursor-not-allowed'
              : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg hover:shadow-xl'
          )}
        >
          <Volume2 size={24} />
          {isPlaying ? 'Playing...' : 'Play Technique'}
        </button>
      </div>

      {/* Technique Info */}
      {firstNote && (
        <div className="p-4 border border-brand-line rounded-lg bg-brand-sidebar">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
              {technique === 'static' && 'Double Stop'}
              {technique === 'hammer' && 'Hammer On'}
              {technique === 'pulloff' && 'Pull Off'}
              {technique === 'slide' && 'Slide'}
              {technique === 'bend' && 'Bend'}
              {technique === 'vibrato' && 'Vibrato'}
            </p>
            <p className="text-sm text-brand-ink">
              {!secondNote && technique === 'vibrato' && `Single note: ${firstNote.note} with vibrato`}
              {!secondNote && technique !== 'vibrato' && `Select a second note for ${technique}`}
              {secondNote && technique === 'static' && `Play ${firstNote.note} + ${secondNote.note} together`}
              {secondNote && technique === 'hammer' && `Pick ${firstNote.note}, hammer to ${secondNote.note}`}
              {secondNote && technique === 'pulloff' && `Pick ${secondNote.note}, pull off to ${firstNote.note}`}
              {secondNote && technique === 'slide' && `Slide from ${firstNote.note} to ${secondNote.note}`}
              {secondNote && technique === 'bend' && `Play ${firstNote.note}, bend ${secondNote.note} up ${bendAmount} semitones`}
              {secondNote && technique === 'vibrato' && `Play ${firstNote.note}, add vibrato to ${secondNote.note}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
