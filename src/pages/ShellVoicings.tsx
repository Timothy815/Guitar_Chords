import React, { useState } from 'react';
import { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { Fretboard } from '../components/Fretboard';
import { initAudio, playStrum, getFretNote } from '../lib/audio';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

// Per-string-set color identity — used on both the card and the fretboard dots
const SET_CONFIG: Record<string, { hex: string; label: string }> = {
  '6-4': { hex: '#f59e0b', label: 'Strings 6–4' }, // amber
  '5-3': { hex: '#14b8a6', label: 'Strings 5–3' }, // teal
  '4-2': { hex: '#8b5cf6', label: 'Strings 4–2' }, // violet
};

const SHELL_QUALITIES = [
  { key: 'maj7',  label: 'maj7',  thirdSt: 4, seventhSt: 11, thirdName: 'Major 3rd', seventhName: 'Major 7th' },
  { key: 'm7',    label: 'm7',    thirdSt: 3, seventhSt: 10, thirdName: 'Minor 3rd', seventhName: 'Minor 7th' },
  { key: 'dom7',  label: '7',     thirdSt: 4, seventhSt: 10, thirdName: 'Major 3rd', seventhName: 'Minor 7th' },
  { key: 'm7b5',  label: 'm7♭5', thirdSt: 3, seventhSt: 10, thirdName: 'Minor 3rd', seventhName: 'Minor 7th' },
  { key: 'dim7',  label: 'dim7',  thirdSt: 3, seventhSt: 9,  thirdName: 'Minor 3rd', seventhName: 'Dim. 7th'  },
] as const;

type QualityKey = typeof SHELL_QUALITIES[number]['key'];

const STRING_SETS: Array<{ strings: readonly [number, number, number]; setKey: string; openNames: string }> = [
  { strings: [0, 1, 2], setKey: '6-4', openNames: 'E · A · D' },
  { strings: [1, 2, 3], setKey: '5-3', openNames: 'A · D · G' },
  { strings: [2, 3, 4], setKey: '4-2', openNames: 'D · G · B' },
];

interface ShellVoicing {
  frets: number[];
  rootFret: number;
  thirdFret: number;
  seventhFret: number;
  strings: readonly [number, number, number];
  setKey: string;
  openNames: string;
  rootNote: string;
  thirdNote: string;
  seventhNote: string;
}

function noteNameFromMidi(midi: number): string {
  return ALL_NOTES[midi % 12];
}

function computeShellVoicings(root: Note, thirdSt: number, seventhSt: number): ShellVoicing[] {
  const results: ShellVoicing[] = [];

  for (const { strings, setKey, openNames } of STRING_SETS) {
    const [s0, s1, s2] = strings;

    for (let rootFret = 0; rootFret <= 12; rootFret++) {
      const rootMidi = OPEN_MIDI[s0] + rootFret;
      if (noteNameFromMidi(rootMidi) !== root) continue;

      // Find 3rd on middle string — closest position at or above root pitch
      let thirdMidi = rootMidi + thirdSt;
      let thirdFret = thirdMidi - OPEN_MIDI[s1];
      if (thirdFret < 0) { thirdFret += 12; thirdMidi += 12; }

      // Find 7th on top string — must be above 3rd in pitch
      let seventhMidi = rootMidi + seventhSt;
      while (seventhMidi <= thirdMidi) seventhMidi += 12;
      let seventhFret = seventhMidi - OPEN_MIDI[s2];
      while (seventhFret < 0) { seventhFret += 12; seventhMidi += 12; }

      // Only include truly closed voicings (≤ 12 semitone span root to 7th)
      if (seventhMidi - rootMidi > 12) continue;
      if (rootFret > 15 || thirdFret > 15 || seventhFret > 15) continue;

      const frets: number[] = [-1, -1, -1, -1, -1, -1];
      frets[s0] = rootFret;
      frets[s1] = thirdFret;
      frets[s2] = seventhFret;

      results.push({
        frets, rootFret, thirdFret, seventhFret, strings, setKey, openNames,
        rootNote: getFretNote(s0, rootFret),
        thirdNote: getFretNote(s1, thirdFret),
        seventhNote: getFretNote(s2, seventhFret),
      });
    }
  }

  return results;
}

// Suppresses open-string ghost circles without affecting drillDots or showAllNotes
const MUTED_CHORD = { name: '', frets: [-1, -1, -1, -1, -1, -1] as number[], fingers: [-1, -1, -1, -1, -1, -1] as import('../types').Finger[] };

export function ShellVoicings() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState<QualityKey>('maj7');
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [showTheory, setShowTheory] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [dotLabel, setDotLabel] = useState<'role' | 'note'>('role');
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(new Set(['6-4', '5-3', '4-2']));

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const quality = SHELL_QUALITIES.find(q => q.key === qualityKey)!;
  const voicings = computeShellVoicings(root, quality.thirdSt, quality.seventhSt);

  const drillDots = voicings
    .filter(v => activeStringSets.has(v.setKey))
    .flatMap(v => {
      const color = SET_CONFIG[v.setKey].hex;
      return [
        { stringIdx: v.strings[0], fret: v.rootFret,    label: dotLabel === 'role' ? 'R' : v.rootNote.replace(/[0-9]/g, ''),    color },
        { stringIdx: v.strings[1], fret: v.thirdFret,   label: dotLabel === 'role' ? '3' : v.thirdNote.replace(/[0-9]/g, ''),   color },
        { stringIdx: v.strings[2], fret: v.seventhFret, label: dotLabel === 'role' ? '7' : v.seventhNote.replace(/[0-9]/g, ''), color },
      ];
    });

  const handlePlay = async (v: ShellVoicing) => {
    await initAudio();
    const notes = v.frets
      .map((fret, si) => fret === -1 ? null : getFretNote(si, fret))
      .filter((n): n is string => n !== null);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Shell Voicings</h1>
        <p className="text-sm text-brand-secondary mt-1">
          Root, 3rd, and 7th — the chord skeleton used in jazz. The 5th is dropped because it adds no color.
        </p>
      </div>

      {/* Root selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Root</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_NOTES.map(note => (
            <button
              key={note}
              onClick={() => setRoot(note as Note)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                root === note
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Quality selector */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Quality</p>
        <div className="flex flex-wrap gap-1.5">
          {SHELL_QUALITIES.map(q => (
            <button
              key={q.key}
              onClick={() => setQualityKey(q.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                qualityKey === q.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        {qualityKey === 'm7b5' && (
          <p className="text-xs text-brand-secondary/70 mt-2">
            m7♭5 uses the same shell as m7 — only the omitted 5th differs between them.
          </p>
        )}
      </div>

      {/* Formula row */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">R</span>
          <span className="text-brand-secondary">root</span>
        </div>
        <span className="text-brand-line">·</span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
          <span className="text-brand-secondary">{quality.thirdName} ({quality.thirdSt} st)</span>
        </div>
        <span className="text-brand-line">·</span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">7</span>
          <span className="text-brand-secondary">{quality.seventhName} ({quality.seventhSt} st)</span>
        </div>
      </div>

      {/* Fretboard */}
      <div onMouseEnter={initAudio}>
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setShowAllNotes(v => !v)}
            className={cn('text-xs px-2.5 py-0.5 rounded border transition-colors',
              showAllNotes
                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
            )}
          >
            {showAllNotes ? 'All notes: on' : 'All notes: off'}
          </button>
        </div>
        <Fretboard
          fretsNum={15}
          chord={MUTED_CHORD}
          drillDots={drillDots}
          playingNotes={playingNotes}
          showNoteNames={false}
          showAllNotes={showAllNotes}
          compact
        />
        <div className="flex justify-end mt-1">
          <button
            onClick={() => setDotLabel(v => v === 'role' ? 'note' : 'role')}
            className={cn('text-xs px-2.5 py-0.5 rounded border transition-colors',
              dotLabel === 'note'
                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
            )}
          >
            {dotLabel === 'role' ? 'Labels: R / 3 / 7' : 'Labels: note names'}
          </button>
        </div>
      </div>

      {/* Position cards */}
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No closed shell voicings found in frets 0–12 for this combination.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const isActive = activeStringSets.has(v.setKey);
            const color = SET_CONFIG[v.setKey].hex;
            return (
              <div
                key={i}
                className={cn('bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3 transition-opacity duration-200',
                  !isActive && 'opacity-40'
                )}
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-bold text-brand-ink">{SET_CONFIG[v.setKey].label}</h3>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">{v.openNames}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-brand-secondary tabular-nums">
                      fret {v.rootFret === 0 ? 'open' : v.rootFret}
                    </span>
                    <button
                      onClick={() => toggleSet(v.setKey)}
                      className="p-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors"
                      title={isActive ? 'Hide on fretboard' : 'Show on fretboard'}
                    >
                      {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                </div>

                {/* Note roles */}
                <div className="flex items-center gap-4">
                  {([
                    { label: 'R', note: v.rootNote,    cls: 'text-white' },
                    { label: '3', note: v.thirdNote,   cls: 'text-white' },
                    { label: '7', note: v.seventhNote, cls: 'text-white' },
                  ] as const).map(({ label, note, cls }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span
                        className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0', cls)}
                        style={{ backgroundColor: color }}
                      >
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-brand-ink">{note}</span>
                    </div>
                  ))}
                </div>

                {/* Fret map */}
                <div className="grid grid-cols-3 gap-1 text-xs text-center">
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-2 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - si}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {(['R', '3', '7'] as const)[ri]}={v.frets[si] === 0 ? 'open' : v.frets[si]}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlay(v)}
                  onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                  style={{ backgroundColor: color }}
                >
                  ▶ Play
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Theory note */}
      <div className="border border-brand-line rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTheory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-secondary hover:text-brand-ink transition-colors"
        >
          <span>Why leave out the 5th?</span>
          {showTheory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-brand-secondary border-t border-brand-line">
            <p>The perfect 5th is harmonically neutral — it reinforces the root but adds no color or tension. Whether it's present or absent, the chord quality stays exactly the same.</p>
            <p>Dropping it keeps the voicing on just 3 strings, leaving the other strings free for a bass note below or extensions (9th, 11th, 13th) above. Jazz pianists use this exact principle: left hand plays the shell, right hand plays melody or color tones.</p>
            <p>Compare maj7 vs. 7 on any string set — only the 7th note changes by one fret. That small movement is the entire difference in sound between "dreamy" (maj7) and "tense" (dom7).</p>
          </div>
        )}
      </div>
    </div>
  );
}
