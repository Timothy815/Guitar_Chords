import React, { useState } from 'react';
import { ALL_NOTES } from '../data/guitarData';
import type { Note } from '../types';
import { cn } from '../lib/utils';

const INTERVAL_NAMES: Record<number, string> = {
  0: 'Root', 1: 'Min 2nd', 2: 'Maj 2nd', 3: 'Min 3rd', 4: 'Maj 3rd',
  5: 'Perf 4th', 6: 'Dim 5th', 7: 'Perf 5th', 8: 'Aug 5th',
  9: 'Maj 6th', 10: 'Min 7th', 11: 'Maj 7th',
};

interface ChordTypeDef {
  name: string;
  abbr: string;
  intervals: number[];
  qualityPrefix: string;
}

const CHORD_FAMILIES: { family: string; types: ChordTypeDef[] }[] = [
  {
    family: 'Triads',
    types: [
      { name: 'Major',      abbr: '',     intervals: [0, 4, 7],     qualityPrefix: 'Major' },
      { name: 'Minor',      abbr: 'm',    intervals: [0, 3, 7],     qualityPrefix: 'Minor' },
      { name: 'Diminished', abbr: '°',    intervals: [0, 3, 6],     qualityPrefix: 'dim' },
      { name: 'Augmented',  abbr: '+',    intervals: [0, 4, 8],     qualityPrefix: 'aug' },
    ],
  },
  {
    family: '7ths & Extended',
    types: [
      { name: 'Dominant 7',     abbr: '7',    intervals: [0, 4, 7, 10], qualityPrefix: '7' },
      { name: 'Major 7',        abbr: 'maj7', intervals: [0, 4, 7, 11], qualityPrefix: 'Maj7' },
      { name: 'Minor 7',        abbr: 'm7',   intervals: [0, 3, 7, 10], qualityPrefix: 'm7' },
      { name: 'Diminished 7',   abbr: '°7',   intervals: [0, 3, 6, 9],  qualityPrefix: 'dim7' },
      { name: 'Half-Diminished', abbr: 'ø7',  intervals: [0, 3, 6, 10], qualityPrefix: 'm7b5' },
    ],
  },
  {
    family: 'Suspended',
    types: [
      { name: 'Sus2', abbr: 'sus2', intervals: [0, 2, 7], qualityPrefix: 'sus2' },
      { name: 'Sus4', abbr: 'sus4', intervals: [0, 5, 7], qualityPrefix: 'sus4' },
    ],
  },
];

interface ScaleDef {
  name: string;
  steps: number[];
  pattern: string;
  description: string;
}

const SCALE_DEFS: ScaleDef[] = [
  { name: 'Major (Ionian)',          steps: [0,2,4,5,7,9,11],  pattern: 'W  W  H  W  W  W  H',  description: 'Bright, happy — the foundation of Western harmony' },
  { name: 'Natural Minor (Aeolian)', steps: [0,2,3,5,7,8,10],  pattern: 'W  H  W  W  H  W  W',  description: 'Sad, emotional — the basis for minor key music' },
  { name: 'Harmonic Minor',          steps: [0,2,3,5,7,8,11],  pattern: 'W  H  W  W  H  A  H',  description: 'Raised 7th gives a classical, exotic feel' },
  { name: 'Major Pentatonic',        steps: [0,2,4,7,9],        pattern: 'W  W  WH  W  WH',       description: '5-note — bright and singable, great over major chords' },
  { name: 'Minor Pentatonic',        steps: [0,3,5,7,10],       pattern: 'WH  W  W  WH  W',       description: '5-note — the rock/blues workhorse' },
  { name: 'Blues',                   steps: [0,3,5,6,7,10],     pattern: 'WH  W  H  H  WH  W',   description: 'Minor pentatonic + the ♭5 blue note' },
];

interface ModeDef {
  name: string;
  steps: number[];
  degree: string;
  hint: string;
}

const MODE_DEFS: ModeDef[] = [
  { name: 'Ionian',     steps: [0,2,4,5,7,9,11], degree: 'I',    hint: 'Same as major scale — bright, resolved' },
  { name: 'Dorian',     steps: [0,2,3,5,7,9,10], degree: 'ii',   hint: 'Minor with raised 6th — jazzy, funky' },
  { name: 'Phrygian',   steps: [0,1,3,5,7,8,10], degree: 'iii',  hint: 'Minor with ♭2 — flamenco, metal edge' },
  { name: 'Lydian',     steps: [0,2,4,6,7,9,11], degree: 'IV',   hint: 'Major with ♯4 — dreamy, floating' },
  { name: 'Mixolydian', steps: [0,2,4,5,7,9,10], degree: 'V',    hint: 'Major with ♭7 — bluesy, rock dominant' },
  { name: 'Aeolian',    steps: [0,2,3,5,7,8,10], degree: 'vi',   hint: 'Same as natural minor — dark, melancholic' },
  { name: 'Locrian',    steps: [0,1,3,5,6,8,10], degree: 'vii°', hint: '♭2 and ♭5 — tense, rarely used as a tonic' },
];

function noteAt(root: Note, semitones: number): string {
  return ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12];
}

interface Props {
  onOpenInChords: (root: Note, qualityPrefix: string) => void;
}

export function TheoryReference({ onOpenInChords }: Props) {
  const [localRoot, setLocalRoot] = useState<Note>('C');
  const [view, setView] = useState<'chords' | 'scales' | 'modes'>('chords');

  return (
    <div className="space-y-6">
      {/* Root note selector */}
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">Root Note</p>
        <div className="flex gap-1 flex-wrap">
          {ALL_NOTES.map(n => (
            <button
              key={n}
              onClick={() => setLocalRoot(n)}
              className={cn(
                'w-10 h-8 rounded text-xs font-bold border transition-colors',
                localRoot === n
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-0 border-b border-brand-line">
        {(['chords', 'scales', 'modes'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              view === v
                ? 'border-brand-primary text-brand-ink'
                : 'border-transparent text-brand-secondary hover:text-brand-ink',
            )}
          >
            {v === 'chords' ? 'Chord Types' : v === 'scales' ? 'Scales' : 'Modes'}
          </button>
        ))}
      </div>

      {/* Chords view */}
      {view === 'chords' && (
        <div className="space-y-8">
          {CHORD_FAMILIES.map(({ family, types }) => (
            <div key={family}>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary mb-3">{family}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {types.map(ct => (
                  <ChordCard
                    key={ct.name}
                    type={ct}
                    root={localRoot}
                    onOpenInChords={() => onOpenInChords(localRoot, ct.qualityPrefix)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scales view */}
      {view === 'scales' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCALE_DEFS.map(scale => (
            <div key={scale.name} className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-brand-ink text-sm">{localRoot} {scale.name}</h3>
                <p className="text-xs text-brand-secondary mt-0.5">{scale.description}</p>
              </div>
              <p className="text-xs font-mono tracking-widest bg-brand-bg rounded px-2 py-1.5 text-brand-primary">
                {scale.pattern}
              </p>
              <div className="flex flex-wrap gap-1">
                {scale.steps.map(s => (
                  <span
                    key={s}
                    className="text-xs bg-brand-sidebar border border-brand-line text-brand-ink px-2 py-0.5 rounded font-medium"
                  >
                    {noteAt(localRoot, s)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modes view */}
      {view === 'modes' && (
        <div className="space-y-4">
          <p className="text-sm text-brand-secondary">
            Modes are rotations of the major scale — each starts on a different scale degree.
            In the key of <strong className="text-brand-ink">{localRoot} Major</strong> the seven degrees are:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {MODE_DEFS.map((mode, i) => (
              <div key={mode.name} className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-brand-secondary mr-1.5">{mode.degree}</span>
                    <span className="font-semibold text-brand-ink text-sm">{mode.name}</span>
                  </div>
                  <span className="text-xs font-bold text-brand-primary flex-shrink-0">
                    {noteAt(localRoot, mode.steps[0])}
                  </span>
                </div>
                <p className="text-xs text-brand-secondary">{mode.hint}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {mode.steps.map((s, si) => (
                    <span
                      key={si}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded font-medium border',
                        si === 0
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-brand-sidebar border-brand-line text-brand-ink',
                      )}
                    >
                      {noteAt(localRoot, s)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ChordCardProps {
  type: ChordTypeDef;
  root: Note;
  onOpenInChords: () => void;
}

const ChordCard: React.FC<ChordCardProps> = ({ type, root, onOpenInChords }) => {
  const { name, abbr, intervals } = type;

  // Alternating label / delta items so the recipe reads: Root +4 Maj 3rd +3 Perf 5th
  type RecipeItem = { label: string } | { delta: number };
  const recipe: RecipeItem[] = [];
  for (let i = 0; i < intervals.length; i++) {
    recipe.push({ label: INTERVAL_NAMES[intervals[i]] ?? String(intervals[i]) });
    if (i < intervals.length - 1) {
      recipe.push({ delta: intervals[i + 1] - intervals[i] });
    }
  }

  const noteNames = intervals.map(s => noteAt(root, s));

  return (
    <div className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-3 hover:border-brand-primary/40 transition-colors">
      {/* Title + action */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-brand-ink text-sm">{name}</p>
          <p className="text-[11px] font-mono text-brand-secondary">{root}{abbr}</p>
        </div>
        <button
          onClick={onOpenInChords}
          className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors whitespace-nowrap flex-shrink-0"
        >
          Chords →
        </button>
      </div>

      {/* Interval recipe — the "why this chord sounds like this" */}
      <div className="flex flex-wrap items-center gap-1">
        {recipe.map((item, i) =>
          'delta' in item ? (
            <span key={i} className="text-[10px] font-mono text-brand-secondary">+{item.delta}</span>
          ) : (
            <span
              key={i}
              className={cn(
                'text-xs px-1.5 py-0.5 rounded font-medium',
                item.label === 'Root'
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-sidebar border border-brand-line text-brand-ink',
              )}
            >
              {item.label}
            </span>
          )
        )}
      </div>

      {/* Resulting notes for the chosen root */}
      <div className="flex flex-wrap gap-1">
        {noteNames.map((n, i) => (
          <span
            key={i}
            className="text-xs bg-brand-active/10 text-brand-active border border-brand-active/20 px-2 py-0.5 rounded font-medium"
          >
            {n}
          </span>
        ))}
      </div>

      {/* Raw semitone numbers for the musically curious */}
      <p className="text-[10px] font-mono text-brand-secondary/70 tracking-widest">{intervals.join('  ')}</p>
    </div>
  );
}
