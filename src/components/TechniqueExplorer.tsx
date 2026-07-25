import React, { useState } from 'react';
import { Play, Volume2 } from 'lucide-react';
import { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { initAudio, playNote, getFretNote, playBend, playSlide } from '../lib/audio';
import { cn } from '../lib/utils';

const INTERVALS = [
  { name: 'Unison',      short: 'P1',  semitones: 0 },
  { name: 'Minor 2nd',   short: 'm2',  semitones: 1 },
  { name: 'Major 2nd',   short: 'M2',  semitones: 2 },
  { name: 'Minor 3rd',   short: 'm3',  semitones: 3 },
  { name: 'Major 3rd',   short: 'M3',  semitones: 4 },
  { name: 'Perfect 4th', short: 'P4',  semitones: 5 },
  { name: 'Tritone',     short: 'TT',  semitones: 6 },
  { name: 'Perfect 5th', short: 'P5',  semitones: 7 },
  { name: 'Minor 6th',   short: 'm6',  semitones: 8 },
  { name: 'Major 6th',   short: 'M6',  semitones: 9 },
  { name: 'Minor 7th',   short: 'm7',  semitones: 10 },
  { name: 'Major 7th',   short: 'M7',  semitones: 11 },
  { name: 'Octave',      short: '8ve', semitones: 12 },
];

const STRING_PAIRS = [
  { name: 'E + A', strings: [0, 1] },
  { name: 'A + D', strings: [1, 2] },
  { name: 'D + G', strings: [2, 3] },
  { name: 'G + B', strings: [3, 4] },
  { name: 'B + E', strings: [4, 5] },
] as const;

type TechniqueType = 'static' | 'bend' | 'slide' | 'hammer' | 'vibrato';

interface TechniqueExplorerProps {
  rootNote?: Note;
}

export function TechniqueExplorer({ rootNote = 'A' }: TechniqueExplorerProps) {
  const [stringPair, setStringPair] = useState(0); // Index into STRING_PAIRS
  const [fretPosition, setFretPosition] = useState(7);
  const [intervalSemitones, setIntervalSemitones] = useState(5); // P4
  const [technique, setTechnique] = useState<TechniqueType>('static');
  const [bendAmount, setBendAmount] = useState(2); // semitones
  const [speed, setSpeed] = useState(0.5); // seconds
  const [isPlaying, setIsPlaying] = useState(false);

  const currentPair = STRING_PAIRS[stringPair];
  const lowerString = currentPair.strings[0];
  const upperString = currentPair.strings[1];

  const lowerNote = getFretNote(lowerString, fretPosition);
  const upperNote = getFretNote(upperString, fretPosition + intervalSemitones);

  async function playTechnique() {
    setIsPlaying(true);
    await initAudio();

    try {
      if (technique === 'static') {
        // Play both notes simultaneously (double stop)
        playNote(lowerNote, '2n');
        playNote(upperNote, '2n');
      } else if (technique === 'bend') {
        // Play lower note (pedal tone), then bend upper note
        playNote(lowerNote, `${speed * 2}n`);

        // Start upper note and bend it up
        setTimeout(async () => {
          await playBend(upperNote, bendAmount, speed, speed * 2);
        }, 100);
      } else if (technique === 'slide') {
        // Play lower note (pedal), then slide to upper note
        playNote(lowerNote, '2n');

        // Calculate start position (a few frets below upper note)
        const slideStart = getFretNote(upperString, Math.max(0, fretPosition + intervalSemitones - 3));
        setTimeout(async () => {
          await playSlide(slideStart, upperNote, speed);
        }, 100);
      } else if (technique === 'hammer') {
        // Hammer-on: play lower note, then hammer upper note
        playNote(lowerNote, '2n');

        // Hammer-on has a quick, percussive attack
        setTimeout(() => {
          playNote(upperNote, '1n');
        }, 150);
      } else if (technique === 'vibrato') {
        // Play both notes with simulated vibrato (rapid micro-bends)
        playNote(lowerNote, '2n');

        // Vibrato: oscillate pitch slightly
        const vibratoNote = upperNote;
        setTimeout(async () => {
          playNote(vibratoNote, '2n');

          // Simulate vibrato with small bends
          for (let i = 0; i < 4; i++) {
            setTimeout(() => {
              playNote(vibratoNote, '4n');
            }, i * 200 + 100);
          }
        }, 100);
      }
    } finally {
      setTimeout(() => setIsPlaying(false), speed * 2000 + 1000);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        {/* String Pair Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-brand-secondary block mb-2">
            String Pair
          </label>
          <div className="flex flex-wrap gap-2">
            {STRING_PAIRS.map((pair, idx) => (
              <button
                key={idx}
                onClick={() => setStringPair(idx)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  stringPair === idx
                    ? 'bg-brand-primary text-white'
                    : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                )}
              >
                {pair.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fret Position */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-brand-secondary block mb-2">
            Fret Position: {fretPosition}
          </label>
          <input
            type="range"
            min="0"
            max="12"
            value={fretPosition}
            onChange={(e) => setFretPosition(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Interval Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-brand-secondary block mb-2">
            Interval
          </label>
          <div className="flex flex-wrap gap-2">
            {INTERVALS.slice(0, 8).map((interval) => (
              <button
                key={interval.semitones}
                onClick={() => setIntervalSemitones(interval.semitones)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  intervalSemitones === interval.semitones
                    ? 'bg-brand-primary text-white'
                    : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                )}
              >
                {interval.short}
              </button>
            ))}
          </div>
        </div>

        {/* Technique Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-brand-secondary block mb-2">
            Technique
          </label>
          <div className="flex flex-wrap gap-2">
            {(['static', 'bend', 'slide', 'hammer', 'vibrato'] as TechniqueType[]).map((tech) => (
              <button
                key={tech}
                onClick={() => setTechnique(tech)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize',
                  technique === tech
                    ? 'bg-brand-primary text-white'
                    : 'border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                )}
              >
                {tech}
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

        {(technique === 'slide' || technique === 'hammer') && (
          <div className="p-4 border border-brand-line rounded-lg bg-brand-sidebar">
            <div>
              <label className="text-xs font-semibold text-brand-secondary block mb-2">
                Speed: {speed.toFixed(1)}s
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
          disabled={isPlaying}
          className={cn(
            'flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-semibold transition-all',
            isPlaying
              ? 'bg-brand-secondary/50 text-white cursor-not-allowed'
              : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg hover:shadow-xl'
          )}
        >
          <Volume2 size={24} />
          {isPlaying ? 'Playing...' : 'Play Technique'}
        </button>
      </div>

      {/* Info Display */}
      <div className="p-4 border border-brand-line rounded-lg bg-brand-sidebar text-center">
        <p className="text-sm text-brand-secondary mb-1">Playing:</p>
        <p className="text-lg font-bold text-brand-ink">
          {lowerNote} + {upperNote}
        </p>
        <p className="text-xs text-brand-secondary mt-1">
          {currentPair.name} strings · Fret {fretPosition} · {INTERVALS.find(i => i.semitones === intervalSemitones)?.name}
        </p>
      </div>
    </div>
  );
}
