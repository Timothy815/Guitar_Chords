import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, ChordShape, Finger } from '../types';
import { ALL_NOTES, COMMON_CHORDS } from '../data/guitarData';
import { Fretboard } from '../components/Fretboard';
import { CircleOfFifths } from '../components/CircleOfFifths';
import { playStrum, initAudio, getFretNote } from '../lib/audio';
import { addChordToActiveProgression } from '@/src/lib/progressionUtils';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Return all chord shapes matching the degree root + quality.
function getDiatonicChords(
  key: Note,
  interval: number,
  quality: 'Major' | 'Minor' | 'dim',
): ChordShape[] {
  const degreeRoot = noteAt(key, interval);
  const chords = COMMON_CHORDS[degreeRoot] ?? [];
  if (quality === 'Major') return chords.filter(c => c.name.includes('Major'));
  if (quality === 'Minor') return chords.filter(c => c.name.includes('Minor'));
  // dim triad specifically: match 'dim (' to exclude dim7
  return chords.filter(c => c.name.includes('dim ('));
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
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const navigate = useNavigate();

  // Reset voicing when key or degree changes.
  useEffect(() => { setVoicingIdx(0); }, [selectedKey, selectedDegree]);

  const handleKeySelect = (key: Note) => {
    setSelectedKey(key);
    setSelectedDegree(null);
  };

  const allVoicings: ChordShape[] =
    selectedDegree !== null
      ? getDiatonicChords(selectedKey, DIATONIC[selectedDegree].interval, DIATONIC[selectedDegree].quality)
      : [];

  const activeChord = allVoicings[voicingIdx] ?? null;

  async function playChord(chord: ChordShape) {
    await initAudio();
    const notes = chord.frets
      .map((fret, strIdx) => (fret !== -1 ? getFretNote(strIdx, fret) : null))
      .filter((n): n is string => n !== null);
    playStrum(notes, 2, 'down');
  }

  const handleDegreeClick = async (degIdx: number) => {
    const resetVoicing = selectedDegree !== degIdx;
    const nextVoicingIdx = resetVoicing ? 0 : voicingIdx;
    setSelectedDegree(degIdx);
    if (resetVoicing) setVoicingIdx(0);
    const chords = getDiatonicChords(selectedKey, DIATONIC[degIdx].interval, DIATONIC[degIdx].quality);
    const chord = chords[nextVoicingIdx] ?? null;
    if (chord) playChord(chord);
  };

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

      {/* Toast */}
      {addedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-ink text-brand-surface text-sm px-4 py-2 rounded-lg shadow-lg z-50 pointer-events-none">
          {addedToast}
        </div>
      )}

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
                  className={cn(
                    'flex flex-col items-center px-3 py-2 rounded-lg border text-sm font-bold transition-all min-w-[52px]',
                    isSelected
                      ? isDim
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : isMajor
                        ? 'bg-brand-active text-white border-brand-active shadow-md'
                        : 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                      : isDim
                      ? 'border-rose-400 text-rose-600 hover:bg-rose-50'
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
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-brand-ink">{activeChord.name}</p>
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
              Click a Roman numeral to see the chord shape and hear it played.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
