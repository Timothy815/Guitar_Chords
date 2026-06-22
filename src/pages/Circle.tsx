import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, ChordShape } from '../types';
import { ALL_NOTES, COMMON_CHORDS } from '../data/guitarData';
import { Fretboard } from '../components/Fretboard';
import { CircleOfFifths } from '../components/CircleOfFifths';
import { playStrum, initAudio, getFretNote } from '../lib/audio';
import { ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

// Compute the note N semitones above `root` in the chromatic scale.
function noteAt(root: Note, semitones: number): Note {
  return ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12];
}

// The seven diatonic degrees of a major key.
const DIATONIC = [
  { roman: 'I',    interval: 0,  quality: 'Major' as const },
  { roman: 'ii',   interval: 2,  quality: 'Minor' as const },
  { roman: 'iii',  interval: 4,  quality: 'Minor' as const },
  { roman: 'IV',   interval: 5,  quality: 'Major' as const },
  { roman: 'V',    interval: 7,  quality: 'Major' as const },
  { roman: 'vi',   interval: 9,  quality: 'Minor' as const },
  { roman: 'vii°', interval: 11, quality: 'dim'   as const },
] as const;

// Return the first chord shape from COMMON_CHORDS matching the degree root + quality.
// Returns null for 'dim' (no diminished shapes in COMMON_CHORDS).
function getDiatonicChord(
  key: Note,
  interval: number,
  quality: 'Major' | 'Minor' | 'dim',
): ChordShape | null {
  if (quality === 'dim') return null;
  const degreeRoot = noteAt(key, interval);
  const chords = COMMON_CHORDS[degreeRoot] ?? [];
  return (
    chords.find(c =>
      quality === 'Major' ? c.name.includes('Major') : c.name.includes('Minor'),
    ) ?? null
  );
}

// Display label for a Note (uses flat spellings for conventional enharmonics).
const DISPLAY_NAMES: Partial<Record<Note, string>> = {
  'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb', 'F#': 'F#/Gb',
};
function displayNote(n: Note): string {
  return DISPLAY_NAMES[n] ?? n;
}

export function Circle() {
  const [selectedKey, setSelectedKey] = useState<Note>('C');
  const [selectedDegree, setSelectedDegree] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleKeySelect = (key: Note) => {
    setSelectedKey(key);
    setSelectedDegree(null);
  };

  const handleDegreeClick = async (degIdx: number) => {
    const deg = DIATONIC[degIdx];
    if (deg.quality === 'dim') return;
    setSelectedDegree(degIdx);
    const chord = getDiatonicChord(selectedKey, deg.interval, deg.quality);
    if (!chord) return;
    await initAudio();
    const notes = chord.frets
      .map((fret, strIdx) => (fret !== -1 ? getFretNote(strIdx, fret) : null))
      .filter((n): n is string => n !== null);
    playStrum(notes, 2, 'down');
  };

  const activeChord =
    selectedDegree !== null
      ? getDiatonicChord(
          selectedKey,
          DIATONIC[selectedDegree].interval,
          DIATONIC[selectedDegree].quality,
        )
      : null;

  const keyDisplay = displayNote(selectedKey);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div>
        <h1 className="text-4xl font-serif font-bold text-brand-ink mb-2">Circle of Fifths</h1>
        <p className="text-brand-secondary text-lg max-w-2xl">
          Each key is a fifth apart from its neighbors. Click any key to explore its diatonic chords —
          the seven chords that naturally belong to that key.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Circle */}
        <div className="bg-brand-surface border border-brand-line rounded-xl p-6 shadow-sm">
          <CircleOfFifths selectedKey={selectedKey} onKeySelect={handleKeySelect} />
        </div>

        {/* Chord panel */}
        <div className="bg-brand-surface border border-brand-line rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-brand-ink">{keyDisplay} Major</h2>
            <button
              onClick={() => navigate('/dictionary')}
              className="flex items-center gap-1.5 text-sm text-brand-secondary hover:text-brand-primary transition-colors"
            >
              <ExternalLink size={14} /> View in Dictionary
            </button>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">
            Diatonic Chords
          </p>

          {/* Roman numeral buttons */}
          <div className="flex flex-wrap gap-2">
            {DIATONIC.map((deg, i) => {
              const isDim = deg.quality === 'dim';
              const isMajor = deg.quality === 'Major';
              const isSelected = selectedDegree === i;
              const chordRoot = displayNote(noteAt(selectedKey, deg.interval));
              return (
                <button
                  key={deg.roman}
                  onClick={() => handleDegreeClick(i)}
                  disabled={isDim}
                  className={cn(
                    'flex flex-col items-center px-3 py-2 rounded-lg border text-sm font-bold transition-all min-w-[52px]',
                    isDim
                      ? 'opacity-40 cursor-not-allowed border-brand-line text-brand-secondary'
                      : isSelected
                      ? isMajor
                        ? 'bg-brand-active text-white border-brand-active shadow-md'
                        : 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                      : isMajor
                      ? 'border-brand-active text-brand-active hover:bg-brand-active/10'
                      : 'border-brand-line text-brand-secondary hover:bg-brand-sidebar',
                  )}
                >
                  <span className="text-[10px] font-normal opacity-80">{chordRoot}</span>
                  <span>{deg.roman}</span>
                </button>
              );
            })}
          </div>

          {/* Fretboard diagram for selected degree */}
          {selectedDegree !== null && activeChord ? (
            <div className="pt-2">
              <p className="text-xs text-brand-secondary mb-2">{activeChord.name}</p>
              <Fretboard chord={activeChord} fretsNum={12} showNoteNames={false} />
            </div>
          ) : (
            <p className="text-sm text-brand-secondary/70 text-center py-6">
              Click a Roman numeral to see the chord shape and hear it played.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
