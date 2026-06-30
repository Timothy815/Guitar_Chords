import React, { useState } from 'react';
import { ALL_NOTES } from '../data/guitarData';
import type { Note } from '../types';
import { cn } from '../lib/utils';
import { initPianoSampler, playPianoNote } from '../lib/audio';

// ─── Interval names ────────────────────────────────────────────────────────────

const INTERVAL_NAMES: Record<number, string> = {
  0: 'Root',    1: 'Min 2nd', 2: 'Maj 2nd', 3: 'Min 3rd', 4: 'Maj 3rd',
  5: 'Perf 4th', 6: 'Dim 5th', 7: 'Perf 5th', 8: 'Aug 5th',
  9: 'Maj 6th', 10: 'Min 7th', 11: 'Maj 7th',
};

// ─── Chord type data ───────────────────────────────────────────────────────────

interface ChordTypeDef {
  name: string;
  abbr: string;
  intervals: number[];
  qualityPrefix: string;
  context: string;
}

const CHORD_FAMILIES: { family: string; types: ChordTypeDef[] }[] = [
  {
    family: 'Triads',
    types: [
      { name: 'Major',      abbr: '',    intervals: [0,4,7],    qualityPrefix: 'Major', context: 'I, IV (major) · I (major key)' },
      { name: 'Minor',      abbr: 'm',   intervals: [0,3,7],    qualityPrefix: 'Minor', context: 'ii, iii, vi (major) · i (minor key)' },
      { name: 'Diminished', abbr: '°',   intervals: [0,3,6],    qualityPrefix: 'dim',   context: 'vii° (major) · ii° (minor key)' },
      { name: 'Augmented',  abbr: '+',   intervals: [0,4,8],    qualityPrefix: 'aug',   context: 'III+ (harmonic minor)' },
    ],
  },
  {
    family: '7ths & Extended',
    types: [
      { name: 'Dominant 7',      abbr: '7',    intervals: [0,4,7,10],  qualityPrefix: '7',    context: 'V7 in any major or minor key' },
      { name: 'Major 7',         abbr: 'maj7', intervals: [0,4,7,11],  qualityPrefix: 'Maj7', context: 'Imaj7, IVmaj7 (major) · jazz/pop' },
      { name: 'Minor 7',         abbr: 'm7',   intervals: [0,3,7,10],  qualityPrefix: 'm7',   context: 'ii7, iii7, vi7 (major) · jazz, R&B' },
      { name: 'Diminished 7',    abbr: '°7',   intervals: [0,3,6,9],   qualityPrefix: 'dim7', context: 'vii°7 (harmonic minor) · classical tension' },
      { name: 'Half-Diminished', abbr: 'ø7',   intervals: [0,3,6,10],  qualityPrefix: 'm7b5', context: 'ii∅ (minor key) · bittersweet jazz sound' },
    ],
  },
  {
    family: 'Suspended',
    types: [
      { name: 'Sus2', abbr: 'sus2', intervals: [0,2,7], qualityPrefix: 'sus2', context: 'Ambiguous — no 3rd, floats between major & minor' },
      { name: 'Sus4', abbr: 'sus4', intervals: [0,5,7], qualityPrefix: 'sus4', context: 'V suspension that resolves down to major' },
    ],
  },
];

// ─── Scale data ────────────────────────────────────────────────────────────────

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

// ─── Mode data ────────────────────────────────────────────────────────────────

interface ModeDef {
  name: string;
  steps: number[];
  degree: string;
  hint: string;
  songs: string;
}

const MODE_DEFS: ModeDef[] = [
  { name: 'Ionian',     steps: [0,2,4,5,7,9,11], degree: 'I',    hint: 'Same as major — bright, resolved',           songs: 'Happy Birthday, Joy to the World' },
  { name: 'Dorian',     steps: [0,2,3,5,7,9,10], degree: 'ii',   hint: 'Minor with raised 6th — jazzy, funky',       songs: 'Smoke on the Water, Oye Como Va' },
  { name: 'Phrygian',   steps: [0,1,3,5,7,8,10], degree: 'iii',  hint: 'Minor with ♭2 — flamenco, metal edge',       songs: 'Wherever I May Roam, flamenco' },
  { name: 'Lydian',     steps: [0,2,4,6,7,9,11], degree: 'IV',   hint: 'Major with ♯4 — dreamy, floating',           songs: 'The Simpsons theme, Flying (Beatles)' },
  { name: 'Mixolydian', steps: [0,2,4,5,7,9,10], degree: 'V',    hint: 'Major with ♭7 — bluesy, rock dominant',      songs: 'Norwegian Wood, Sweet Home Chicago' },
  { name: 'Aeolian',    steps: [0,2,3,5,7,8,10], degree: 'vi',   hint: 'Same as natural minor — dark, melancholic',  songs: 'Stairway to Heaven, Nothing Else Matters' },
  { name: 'Locrian',    steps: [0,1,3,5,6,8,10], degree: 'vii°', hint: '♭2 and ♭5 — tense, rarely a tonic',         songs: 'YYZ intro (Rush) — used in fragments' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noteAt(root: Note, semitones: number): string {
  return ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12];
}

// Builds a piano note string like "C#5" from a root and a semitone offset.
function pianoNote(root: Note, semitones: number, baseOctave: number): string {
  const rootIdx = ALL_NOTES.indexOf(root);
  const abs = rootIdx + semitones;
  return `${ALL_NOTES[abs % 12]}${baseOctave + Math.floor(abs / 12)}`;
}

// Plays a chord as a quick ascending arpeggio (piano).
function playChord(root: Note, intervals: number[], baseOctave: number) {
  initPianoSampler()
    .then(() => {
      intervals.forEach((s, i) => {
        setTimeout(() => playPianoNote(pianoNote(root, s, baseOctave), '2n'), i * 70);
      });
    })
    .catch(() => {});
}

// Plays a scale or mode ascending then holds the top note (piano).
function playScale(root: Note, steps: number[], baseOctave: number) {
  initPianoSampler()
    .then(() => {
      // append octave root at the top for resolution
      const extended = [...steps, 12];
      extended.forEach((s, i) => {
        setTimeout(() => playPianoNote(pianoNote(root, s, baseOctave), i === extended.length - 1 ? '2n' : '8n'), i * 160);
      });
    })
    .catch(() => {});
}

// Returns the diatonic triad info for each degree of a 7-note scale.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function getDiatonicTriads(root: Note, steps: number[]): Array<{ degree: string; noteRoot: string; abbr: string }> {
  if (steps.length !== 7) return [];
  return steps.map((step, i) => {
    const thirdInterval = (steps[(i + 2) % 7] - step + 12) % 12;
    const fifthInterval  = (steps[(i + 4) % 7] - step + 12) % 12;
    const noteRoot = noteAt(root, step);

    let degree = ROMAN[i];
    let abbr = '';

    if (thirdInterval === 4 && fifthInterval === 7) {
      // Major — roman stays uppercase
    } else if (thirdInterval === 3 && fifthInterval === 7) {
      degree = degree.toLowerCase();
      abbr = 'm';
    } else if (thirdInterval === 3 && fifthInterval === 6) {
      degree = degree.toLowerCase() + '°';
      abbr = '°';
    } else if (thirdInterval === 4 && fifthInterval === 8) {
      degree = degree + '+';
      abbr = '+';
    }

    return { degree, noteRoot, abbr };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onOpenInChords: (root: Note, qualityPrefix: string) => void;
  onExploreInIdentify: (root: Note, qualityPrefix: string) => void;
  onAddToProgression: (root: Note, qualityPrefix: string, octave: number, intervals: number[]) => void;
}

export function TheoryReference({ onOpenInChords, onExploreInIdentify, onAddToProgression }: Props) {
  const [localRoot, setLocalRoot] = useState<Note>('C');
  const [octave, setOctave] = useState(4);
  const [view, setView] = useState<'chords' | 'scales' | 'modes'>('chords');

  return (
    <div className="space-y-6">
      {/* Root + octave selectors */}
      <div className="flex flex-wrap items-end gap-6">
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

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-secondary">Octave</p>
          <div className="flex gap-1">
            {[3, 4, 5].map(o => (
              <button
                key={o}
                onClick={() => setOctave(o)}
                className={cn(
                  'w-10 h-8 rounded text-xs font-bold border transition-colors',
                  octave === o
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
                )}
              >
                {o}
              </button>
            ))}
          </div>
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

      {/* ── Chords view ── */}
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
                    octave={octave}
                    onOpenInChords={() => onOpenInChords(localRoot, ct.qualityPrefix)}
                    onExploreInIdentify={() => onExploreInIdentify(localRoot, ct.qualityPrefix)}
                    onAddToProgression={() => onAddToProgression(localRoot, ct.qualityPrefix, octave, ct.intervals)}
                    onPlay={() => playChord(localRoot, ct.intervals, octave)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Scales view ── */}
      {view === 'scales' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCALE_DEFS.map(scale => {
            const diatonic = getDiatonicTriads(localRoot, scale.steps);
            return (
              <div key={scale.name} className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-brand-ink text-sm">{localRoot} {scale.name}</h3>
                    <p className="text-xs text-brand-secondary mt-0.5">{scale.description}</p>
                  </div>
                  <button
                    onClick={() => playScale(localRoot, scale.steps, octave)}
                    className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors flex-shrink-0"
                    title="Play ascending"
                  >
                    ▶
                  </button>
                </div>

                <p className="text-xs font-mono tracking-widest bg-brand-bg rounded px-2 py-1.5 text-brand-primary">
                  {scale.pattern}
                </p>

                <div className="flex flex-wrap gap-1">
                  {scale.steps.map(s => (
                    <span key={s} className="text-xs bg-brand-sidebar border border-brand-line text-brand-ink px-2 py-0.5 rounded font-medium">
                      {noteAt(localRoot, s)}
                    </span>
                  ))}
                </div>

                {/* Diatonic chords — 7-note scales only */}
                {diatonic.length > 0 && (
                  <div className="pt-2 border-t border-brand-line space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">Diatonic Chords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {diatonic.map(({ degree, noteRoot, abbr }) => (
                        <div key={degree} className="flex flex-col items-center">
                          <span className="text-[9px] font-mono text-brand-secondary leading-none mb-0.5">{degree}</span>
                          <span className="text-xs bg-brand-active/10 text-brand-active border border-brand-active/20 px-2 py-0.5 rounded font-medium">
                            {noteRoot}{abbr}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modes view ── */}
      {view === 'modes' && (
        <div className="space-y-4">
          <p className="text-sm text-brand-secondary">
            Modes are rotations of the major scale — each starting on a different degree.
            In <strong className="text-brand-ink">{localRoot} Major</strong> the seven modes are:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {MODE_DEFS.map(mode => (
              <div key={mode.name} className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-brand-secondary mr-1.5">{mode.degree}</span>
                    <span className="font-semibold text-brand-ink text-sm">{mode.name}</span>
                    <span className="ml-2 text-xs font-bold text-brand-primary">{noteAt(localRoot, mode.steps[0])}</span>
                  </div>
                  <button
                    onClick={() => playScale(localRoot, mode.steps, octave)}
                    className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors flex-shrink-0"
                    title="Play ascending"
                  >
                    ▶
                  </button>
                </div>

                <p className="text-xs text-brand-secondary">{mode.hint}</p>

                <p className="text-[11px] text-brand-secondary/70 italic">{mode.songs}</p>

                <div className="flex flex-wrap gap-1 pt-1">
                  {mode.steps.map((s, si) => (
                    <span
                      key={si}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-medium border',
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

// ─── Chord card ───────────────────────────────────────────────────────────────

interface ChordCardProps {
  type: ChordTypeDef;
  root: Note;
  octave: number;
  onOpenInChords: () => void;
  onExploreInIdentify: () => void;
  onAddToProgression: () => void;
  onPlay: () => void;
}

const ChordCard: React.FC<ChordCardProps> = ({ type, root, onOpenInChords, onExploreInIdentify, onAddToProgression, onPlay }) => {
  const { name, abbr, intervals, context } = type;

  // Alternating label / delta items: Root +4 Maj 3rd +3 Perf 5th
  type Item = { label: string } | { delta: number };
  const recipe: Item[] = [];
  for (let i = 0; i < intervals.length; i++) {
    recipe.push({ label: INTERVAL_NAMES[intervals[i]] ?? String(intervals[i]) });
    if (i < intervals.length - 1) recipe.push({ delta: intervals[i + 1] - intervals[i] });
  }

  const noteNames = intervals.map(s => noteAt(root, s));

  return (
    <div
      onClick={onPlay}
      className="bg-brand-surface border border-brand-line rounded-lg p-4 space-y-3 hover:border-brand-primary/40 cursor-pointer transition-colors group"
      title="Click to hear"
    >
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-brand-ink text-sm">{name}</p>
          <p className="text-[11px] font-mono text-brand-secondary">{root}{abbr}</p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onOpenInChords(); }}
            className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors whitespace-nowrap"
          >
            Chords →
          </button>
          <button
            onClick={e => { e.stopPropagation(); onExploreInIdentify(); }}
            className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors whitespace-nowrap"
          >
            Explore →
          </button>
          <button
            onClick={e => { e.stopPropagation(); onAddToProgression(); }}
            className="text-[10px] px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors whitespace-nowrap"
          >
            + Prog
          </button>
        </div>
      </div>

      {/* Interval recipe */}
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
          <span key={i} className="text-xs bg-brand-active/10 text-brand-active border border-brand-active/20 px-2 py-0.5 rounded font-medium">
            {n}
          </span>
        ))}
      </div>

      {/* Scale degree context */}
      <p className="text-[10px] text-brand-secondary/70 italic">{context}</p>

      {/* Raw semitone numbers */}
      <p className="text-[10px] font-mono text-brand-secondary/50 tracking-widest">{intervals.join('  ')}</p>
    </div>
  );
};
