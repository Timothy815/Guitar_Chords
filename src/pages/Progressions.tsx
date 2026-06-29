import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Progression, ChordShape, ChordSlot, ArpeggioStep, ArpeggioPattern, Note } from '../types';
import { COMMON_CHORDS, ALL_NOTES } from '../data/guitarData';
import { Fretboard } from '../components/Fretboard';
import { CircleOfFifths } from '../components/CircleOfFifths';
import { ChordSheet } from '../components/ChordSheet';
import { Plus, Trash2, Play, Printer, Disc, GripHorizontal, Square, RotateCcw, Pencil, X, Upload, FileText } from 'lucide-react';
import { Reorder } from 'motion/react';
import { playStrum, initAudio, getFretNote, playProgressionWithPatterns } from '../lib/audio';
import { handlePrint, printChordSheet, cn, avgChordPitch, chordPositionBucket, PositionBucket, POSITION_LABELS } from '../lib/utils';
import { analyzeVoiceLeading } from '@/src/lib/voiceLeading';
import { analyzeKey } from '@/src/lib/keyAnalysis';
import { VoiceLeadingPanel } from '@/src/components/VoiceLeadingPanel';
import { STANDARD_TUNING } from '../types';

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

function getDiatonicRoots(key: Note): Set<string> {
  const rootIdx = ALL_NOTES.indexOf(key);
  if (rootIdx === -1) return new Set();
  return new Set(MAJOR_INTERVALS.map(i => ALL_NOTES[(rootIdx + i) % 12]));
}

function isChordDiatonic(chord: ChordShape, key: Note): boolean {
  const keyIdx = ALL_NOTES.indexOf(key);
  if (keyIdx === -1) return false;
  const chordRoot = chord.name.split(' ')[0] as Note;
  const chordRootIdx = ALL_NOTES.indexOf(chordRoot);
  if (chordRootIdx === -1) return false;
  const degree = (chordRootIdx - keyIdx + 12) % 12;
  const qualStr = chord.name.slice(chordRoot.length + 1);
  const isMajor = qualStr.startsWith('Major');
  const isMinor = qualStr.startsWith('Minor');
  const isDom7 = qualStr.startsWith('7 ') || qualStr === '7';
  const isMaj7 = qualStr.startsWith('Maj7');
  const isM7 = qualStr.startsWith('m7') && !qualStr.startsWith('m7b5');
  const isDim7 = qualStr.startsWith('dim7');
  const isDim = !isDim7 && qualStr.startsWith('dim');
  const isM7b5 = qualStr.startsWith('m7b5');
  if (degree === 0 || degree === 5) return isMajor || isMaj7;
  if (degree === 2 || degree === 4 || degree === 9) return isMinor || isM7;
  if (degree === 7) return isMajor || isDom7;
  if (degree === 11) return isDim || isDim7 || isM7b5;
  return false;
}

const PRESET_KEYS: Record<string, string> = {
  'I-V-vi-IV (C Major)': 'C',
  'ii-V-I (Jazz, C Major)': 'C',
  '12-Bar Blues (A)': 'A',
  'I-vi-IV-V (50s, G Major)': 'G',
  'Andalusian Cadence (Am)': 'A',
  'Doo-Wop (C)': 'C',
  'Minor Plagal (G)': 'G',
  "Pachelbel's Canon (D)": 'D',
  '12-Bar Blues (E)': 'E',
  'La Bamba (I-IV-V, C)': 'C',
  'Jazz Turnaround (vi-ii-V-I, C)': 'C',
};

// ─── JSON Import utilities ───────────────────────────────────────────────────

const FLAT_TO_SHARP: Record<string, Note> = {
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
};

function parseChordName(input: string): ChordShape | null {
  const s = input.trim();
  let root: Note;
  let rest: string;
  const two = s.slice(0, 2);
  if (FLAT_TO_SHARP[two]) { root = FLAT_TO_SHARP[two]; rest = s.slice(2); }
  else if (['C#', 'D#', 'F#', 'G#', 'A#'].includes(two)) { root = two as Note; rest = s.slice(2); }
  else if ('CDEFGAB'.includes(s[0])) { root = s[0] as Note; rest = s.slice(1); }
  else return null;

  const q = rest.trim();
  let quality: string;
  if (/^(maj7|major7|M7|Δ)/i.test(q))       quality = 'Maj7';
  else if (/^(m7b5|ø|half.?dim)/i.test(q))  quality = 'm7b5';
  else if (/^(dim7|°7)/i.test(q))            quality = 'dim7';
  else if (/^(m7|min7|-7)/i.test(q))         quality = 'm7';
  else if (/^sus2/i.test(q))                 quality = 'sus2';
  else if (/^sus/i.test(q))                  quality = 'sus4';
  else if (/^(m|min|minor|-)$/i.test(q))     quality = 'Minor';
  else if (/^(aug|\+)/i.test(q))             quality = 'aug';
  else if (/^(dim|°)/i.test(q))              quality = 'dim';
  else if (/^7/.test(q))                     quality = '7';
  else                                        quality = 'Major';

  return (COMMON_CHORDS[root] ?? []).find(c => c.name.split(' ')[1] === quality) ?? null;
}

const VALID_DURATIONS = new Set<string>(['16n', '8n', '4n', '2n', '1n']);

function parseArpeggioSteps(raw: unknown): ArpeggioStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps: ArpeggioStep[] = [];
  for (const s of raw) {
    if (!s || !Array.isArray((s as any).strings)) continue;
    const strings = ((s as any).strings as unknown[]).filter(
      (n): n is number => typeof n === 'number' && n >= 0 && n <= 5
    );
    const dur = (s as any).duration;
    const duration = (VALID_DURATIONS.has(dur) ? dur : '4n') as ArpeggioStep['duration'];
    steps.push({ strings, duration });
  }
  return steps.length > 0 ? steps : null;
}

function parseArpeggioJSON(raw: string): ArpeggioPattern | null {
  try {
    const data = JSON.parse(raw);
    const steps = parseArpeggioSteps(data?.steps);
    return steps ? { steps } : null;
  } catch { return null; }
}

type ImportResult = { progression: Progression; warnings: string[] };

function parseProgressionJSON(raw: string): ImportResult | null {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.chords) || data.chords.length === 0) return null;
    const warnings: string[] = [];
    const slots: ChordSlot[] = [];
    for (const item of data.chords) {
      const chordStr: string = typeof item === 'string' ? item : (item as any)?.chord;
      if (!chordStr) { warnings.push(`Skipped entry: ${JSON.stringify(item)}`); continue; }
      const shape = parseChordName(chordStr);
      if (!shape) { warnings.push(`Chord not found: "${chordStr}"`); continue; }
      const slot: ChordSlot = { chord: shape };
      if (typeof item === 'object' && (item as any).arpeggio?.steps) {
        const steps = parseArpeggioSteps((item as any).arpeggio.steps);
        if (steps) slot.pattern = { steps };
      }
      slots.push(slot);
    }
    if (slots.length === 0) return null;
    return {
      progression: {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: typeof data.name === 'string' ? data.name : 'Imported Progression',
        bpm: typeof data.bpm === 'number' ? Math.min(200, Math.max(40, Math.round(data.bpm))) : 80,
        key: typeof data.key === 'string' ? data.key : 'C',
        slots,
      },
      warnings,
    };
  } catch { return null; }
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

const IMPORT_EXAMPLE = `{
  "name": "Jazz ii-V-I",
  "bpm": 100,
  "chords": ["Dm7", "G7", "Cmaj7", "Am"]
}`;

const IMPORT_TEMPLATE = {
  "_instructions": "GuitarMaster progression import. Fill in 'name', 'bpm', and 'chords'. Fields starting with _ are comments and are ignored on import.",
  "name": "My Progression",
  "bpm": 100,
  "chords": [
    "Am",
    "C",
    "G",
    "F",
    {
      "_note": "Use object form to attach an arpeggio pattern to a specific chord.",
      "chord": "Em7",
      "arpeggio": {
        "_note": "Each step fires one or more strings simultaneously. strings: 0=low E, 1=A, 2=D, 3=G, 4=B, 5=high e.",
        "steps": [
          { "strings": [0],       "duration": "4n" },
          { "strings": [3, 4],    "duration": "8n" },
          { "strings": [0],       "duration": "8n" },
          { "strings": [2, 3, 4, 5], "duration": "4n" }
        ]
      }
    }
  ],
  "_chord_quality_reference": {
    "_note": "Replace C with any root note. Flats (Bb, Eb, Ab, Db, Gb) are accepted.",
    "major":           ["C", "Cmaj", "CM"],
    "minor":           ["Cm", "Cmin", "C-"],
    "dominant_7":      ["C7"],
    "major_7":         ["Cmaj7", "CM7"],
    "minor_7":         ["Cm7", "Cmin7"],
    "sus2":            ["Csus2"],
    "sus4":            ["Csus4", "Csus"],
    "diminished":      ["Cdim", "C°"],
    "diminished_7":    ["Cdim7", "C°7"],
    "augmented":       ["Caug", "C+"],
    "half_diminished": ["Cm7b5", "Cø"]
  },
  "_string_index_reference": {
    "0": "low E  (E2)",
    "1": "A string (A2)",
    "2": "D string (D3)",
    "3": "G string (G3)",
    "4": "B string (B3)",
    "5": "high e  (E4)"
  },
  "_duration_reference": {
    "16n": "sixteenth note",
    "8n":  "eighth note",
    "4n":  "quarter note",
    "2n":  "half note",
    "1n":  "whole note"
  }
};

function downloadTemplate() {
  const blob = new Blob([JSON.stringify(IMPORT_TEMPLATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guitarmaster-progression-template.json';
  a.click();
  URL.revokeObjectURL(url);
}

function ImportProgressionModal({ onImport, onClose }: {
  onImport: (r: ImportResult) => void;
  onClose: () => void;
}) {
  const [text, setText] = React.useState('');
  const parsed = text.trim() ? parseProgressionJSON(text) : null;
  const invalid = text.trim().length > 0 && !parsed;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-brand-surface rounded-xl border border-brand-line shadow-xl w-full max-w-lg space-y-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">Import Progression</h2>
          <button onClick={onClose} className="text-brand-secondary hover:text-brand-ink"><X size={20} /></button>
        </div>

        <p className="text-sm text-brand-secondary">
          Paste JSON from any AI. Chord names like <code className="text-brand-primary font-mono">Am</code>,{' '}
          <code className="text-brand-primary font-mono">G7</code>,{' '}
          <code className="text-brand-primary font-mono">Cmaj7</code>,{' '}
          <code className="text-brand-primary font-mono">Dm7b5</code> are all supported.
        </p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={IMPORT_EXAMPLE}
          rows={9}
          autoFocus
          className="w-full font-mono text-xs p-3 rounded-lg border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary resize-none"
        />

        {parsed && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-brand-secondary uppercase tracking-wide">
              Preview — {parsed.progression.name} · {parsed.progression.bpm} BPM · {parsed.progression.slots.length} chord{parsed.progression.slots.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.progression.slots.map((slot, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-700 dark:text-green-400 text-xs font-mono">
                  {slot.chord.name.split('(')[0].trim()}{slot.pattern ? ' ♩' : ''}
                </span>
              ))}
            </div>
            {parsed.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-500">{w}</p>
            ))}
          </div>
        )}

        {invalid && <p className="text-xs text-red-500">Invalid JSON or no recognized chords found.</p>}

        <div className="flex items-center justify-between pt-1">
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 text-xs text-brand-secondary hover:text-brand-primary border border-brand-line hover:border-brand-primary rounded-lg transition-colors">
            <Upload size={13} /> Download Template
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-brand-secondary hover:text-brand-ink transition-colors">Cancel</button>
            <button
              onClick={() => { if (parsed) { onImport(parsed); onClose(); } }}
              disabled={!parsed}
              className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sequencer Panel ────────────────────────────────────────────────────────

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // visual top to bottom (high e first)
const VISUAL_TO_STRING_IDX = [5, 4, 3, 2, 1, 0];       // visual row index → string index (0=low E)

function makePreset(name: string): ArpeggioStep[] {
  const eighth = '8n' as const;
  const sixteenth = '16n' as const;
  const quarter = '4n' as const;
  const simple = (strings: number[], dur: typeof eighth | typeof sixteenth | typeof quarter): ArpeggioStep[] =>
    strings.map(s => ({ strings: [s], duration: dur }));
  switch (name) {
    case 'Ascending':        return simple([0,1,2,3,4,5,4,3], eighth);
    case 'Descending':       return simple([5,4,3,2,1,0,1,2], eighth);
    case 'Alternating Bass': return simple([0,3,4,3,0,3,4,3], eighth);
    case 'Travis Pick':      return simple([0,3,1,4,0,3,1,4], eighth);
    case 'Banjo Roll':       return simple([3,4,5,3,4,5,3,4], sixteenth);
    case 'P-i-m-a':         return simple([0,2,3,5,0,2,3,5], eighth);
    case 'Full Strum':       return Array(4).fill(null).map(() => ({ strings: [0,1,2,3,4,5], duration: quarter }));
    case 'Bass + Chord':     return [
      { strings: [0],         duration: quarter },
      { strings: [2,3,4,5],  duration: quarter },
      { strings: [0],         duration: quarter },
      { strings: [2,3,4,5],  duration: quarter },
    ];
    default: return [];
  }
}

interface SequencerPanelProps {
  slot: ChordSlot;
  bpm: number;
  onPatternChange: (pattern: ArpeggioPattern) => void;
  onClose: () => void;
}

function SequencerPanel({ slot, bpm, onPatternChange, onClose }: SequencerPanelProps) {
  const steps: ArpeggioStep[] = slot.pattern?.steps ?? [];
  const [showArpImport, setShowArpImport] = React.useState(false);
  const [arpImportText, setArpImportText] = React.useState('');

  const addStep = () => {
    onPatternChange({ steps: [...steps, { strings: [], duration: '4n' }] });
  };

  const removeStep = () => {
    if (steps.length === 0) return;
    onPatternChange({ steps: steps.slice(0, -1) });
  };

  const toggleCell = (stepIdx: number, stringIdx: number) => {
    const step = steps[stepIdx];
    const newStrings = step.strings.includes(stringIdx)
      ? step.strings.filter(s => s !== stringIdx)
      : [...step.strings, stringIdx].sort((a, b) => a - b);
    const newSteps = steps.map((s, i) => i === stepIdx ? { ...s, strings: newStrings } : s);
    onPatternChange({ steps: newSteps });
  };

  const loadPreset = (name: string) => {
    if (name === 'Clear') { onPatternChange({ steps: [] }); return; }
    onPatternChange({ steps: makePreset(name) });
  };

  const handlePreview = async () => {
    await initAudio();
    const notesByString = slot.chord.frets.map((f, sIdx) =>
      f === -1 ? null : getFretNote(sIdx, f)
    ) as (string | null)[];
    playProgressionWithPatterns([{ notesByString, pattern: slot.pattern }], bpm, false);
  };

  return (
    <div className="border border-brand-primary/30 rounded-xl bg-brand-bg p-4 space-y-3 print:hidden">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-bold text-brand-ink">{slot.chord.name}</span>
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) { loadPreset(e.target.value); e.target.value = ''; } }}
          className="text-xs px-2 py-1 rounded border border-brand-line bg-brand-surface text-brand-ink focus:outline-none focus:border-brand-primary"
        >
          <option value="">Preset…</option>
          <option>Ascending</option>
          <option>Descending</option>
          <option>Alternating Bass</option>
          <option>Travis Pick</option>
          <option>Banjo Roll</option>
          <option>P-i-m-a</option>
          <option>Full Strum</option>
          <option>Bass + Chord</option>
          <option>Clear</option>
        </select>
        <div className="flex items-center gap-1">
          <button
            onClick={removeStep}
            disabled={steps.length === 0}
            className="w-6 h-6 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-sm disabled:opacity-30"
          >−</button>
          <span className="text-xs font-mono text-brand-secondary w-14 text-center">{steps.length} steps</span>
          <button
            onClick={addStep}
            disabled={steps.length >= 16}
            className="w-6 h-6 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-sm disabled:opacity-30"
          >+</button>
        </div>
        <button
          onClick={() => { setShowArpImport(v => !v); setArpImportText(''); }}
          title="Import pattern from JSON"
          className={cn('p-1 rounded transition-colors', showArpImport ? 'text-brand-primary' : 'text-brand-secondary hover:text-brand-ink')}
        >
          <Upload size={14} />
        </button>
        <button onClick={onClose} className="ml-auto p-1 text-brand-secondary hover:text-brand-ink transition-colors">
          <X size={16} />
        </button>
      </div>

      {showArpImport && (
        <div className="space-y-2 border border-brand-primary/30 rounded-lg p-3 bg-brand-surface">
          <p className="text-xs text-brand-secondary">Paste arpeggio pattern JSON:</p>
          <textarea
            value={arpImportText}
            onChange={e => setArpImportText(e.target.value)}
            placeholder={'{\n  "steps": [\n    { "strings": [0], "duration": "4n" },\n    { "strings": [3,4], "duration": "8n" }\n  ]\n}'}
            rows={5}
            autoFocus
            className="w-full font-mono text-xs p-2 rounded border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowArpImport(false)} className="px-3 py-1 text-xs text-brand-secondary hover:text-brand-ink transition-colors">Cancel</button>
            <button
              onClick={() => {
                const pattern = parseArpeggioJSON(arpImportText);
                if (pattern) { onPatternChange(pattern); setShowArpImport(false); }
              }}
              disabled={!parseArpeggioJSON(arpImportText)}
              className="px-3 py-1 text-xs font-medium bg-brand-primary text-white rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {steps.length === 0 && !showArpImport ? (
        <p className="text-xs text-brand-secondary/70 text-center py-4">
          No steps yet — use + or choose a preset to get started.
        </p>
      ) : steps.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {STRING_LABELS.map((label, visualRow) => {
              const stringIdx = VISUAL_TO_STRING_IDX[visualRow];
              return (
                <div key={visualRow} className="flex items-center gap-1 mb-1">
                  <span className="w-4 text-xs font-mono text-brand-secondary text-right shrink-0">{label}</span>
                  {steps.map((step, stepIdx) => {
                    const active = step.strings.includes(stringIdx);
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleCell(stepIdx, stringIdx)}
                        className={cn(
                          'w-8 h-8 rounded border transition-all',
                          active
                            ? 'bg-brand-primary border-brand-primary text-white'
                            : 'bg-brand-surface border-brand-line hover:border-brand-primary/50'
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
            {/* Duration row */}
            <div className="flex items-center gap-1 mt-2">
              <span className="w-4 shrink-0" />
              {steps.map((step, stepIdx) => (
                <select
                  key={stepIdx}
                  value={step.duration}
                  onChange={(e) => {
                    const newSteps = steps.map((s, i) => i === stepIdx ? { ...s, duration: e.target.value as ArpeggioStep['duration'] } : s);
                    onPatternChange({ steps: newSteps });
                  }}
                  className="w-8 h-6 rounded border border-brand-line bg-brand-surface text-brand-secondary text-[10px] cursor-pointer"
                >
                  <option value="16n">16</option>
                  <option value="8n">8</option>
                  <option value="4n">4</option>
                  <option value="2n">2</option>
                  <option value="1n">1</option>
                </select>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end pt-1">
        <button
          onClick={handlePreview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-surface border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          <Play size={12} fill="currentColor" /> Preview
        </button>
      </div>
    </div>
  );
}

// ─── Chord Sheet helpers ─────────────────────────────────────────────────────

function SheetToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-2', disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={disabled ? undefined : onChange}
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors focus:outline-none overflow-hidden',
          checked ? 'bg-brand-primary' : 'bg-brand-line'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>
      <span className="text-sm text-brand-ink">{label}</span>
    </label>
  );
}

function ChordSheetModal({
  progression,
  showDiagrams,
  showChart,
  onToggleDiagrams,
  onToggleChart,
  onClose,
}: {
  progression: Progression;
  showDiagrams: boolean;
  showChart: boolean;
  onToggleDiagrams: () => void;
  onToggleChart: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface rounded-xl border border-brand-line shadow-xl w-full max-w-2xl space-y-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">Print Chord Sheet</h2>
          <button onClick={onClose} className="text-brand-secondary hover:text-brand-ink">
            <X size={20} />
          </button>
        </div>

        {/* Toggles */}
        <div className="flex gap-6">
          <SheetToggle
            label="Chord Diagrams"
            checked={showDiagrams}
            onChange={onToggleDiagrams}
            disabled={showDiagrams && !showChart}
          />
          <SheetToggle
            label="Lead Chart"
            checked={showChart}
            onChange={onToggleChart}
            disabled={showChart && !showDiagrams}
          />
        </div>

        {/* Live preview */}
        <div className="border border-brand-line rounded-lg overflow-y-auto max-h-96 bg-white">
          <ChordSheet
            progression={progression}
            showDiagrams={showDiagrams}
            showChart={showChart}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-brand-secondary hover:text-brand-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onClose(); setTimeout(() => printChordSheet('chord-sheet-area'), 50); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Progressions page ───────────────────────────────────────────────────────

export function Progressions() {
  const navigate = useNavigate();
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [activeProgId, setActiveProgId] = useState<string | null>(null);
  const [chordPaletteKey, setChordPaletteKey] = useState<string>('C');
  const [showCircle, setShowCircle] = useState(false);
  const [circleKey, setCircleKey] = useState<Note | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeChordIdx, setActiveChordIdx] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [openSequencerSlotIdx, setOpenSequencerSlotIdx] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showChordSheetModal, setShowChordSheetModal] = useState(false);
  const [showVoiceLeading, setShowVoiceLeading] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const stopFnRef = useRef<(() => void) | null>(null);
  const [countInEnabled, setCountInEnabled] = useState(false);
  const [countDownBeat, setCountDownBeat] = useState<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const [paletteSortOrder, setPaletteSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [palettePositionFilter, setPalettePositionFilter] = useState<PositionBucket>('all');

  useEffect(() => {
    const saved = localStorage.getItem('guitar_progressions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old format { chords: ChordShape[] } → { slots: ChordSlot[], bpm: number }
        const migrated = parsed.map((p: any) => {
          if (p.chords && !p.slots) {
            return { ...p, slots: p.chords.map((chord: ChordShape) => ({ chord })), bpm: p.bpm ?? 80, key: p.key ?? 'C' };
          }
          return { ...p, bpm: p.bpm ?? 80, key: p.key ?? 'C' };
        });
        setProgressions(migrated);
        const savedActiveId = localStorage.getItem('guitar_active_prog_id');
        if (savedActiveId && migrated.find((p: Progression) => p.id === savedActiveId)) {
          setActiveProgId(savedActiveId);
        }
      } catch { /* ignore corrupt data */ }
    } else {
      const defaultProg: Progression = {
        id: '1',
        name: 'Classic I-V-vi-IV (C Major)',
        bpm: 80,
        key: 'C',
        slots: [
          COMMON_CHORDS['C'][0],
          COMMON_CHORDS['G'][0],
          COMMON_CHORDS['A'][1],
          COMMON_CHORDS['F'][1],
        ].filter(Boolean).map(chord => ({ chord }))
      };
      setProgressions([defaultProg]);
    }
  }, []);

  // Persist active progression ID so addChordToActiveProgression can target it
  useEffect(() => {
    if (activeProgId) {
      try { localStorage.setItem('guitar_active_prog_id', activeProgId); } catch { /* quota */ }
    }
  }, [activeProgId]);

  // Reload progressions when another page adds a chord (same-tab sync)
  useEffect(() => {
    function reload() {
      try {
        const saved = localStorage.getItem('guitar_progressions');
        if (saved) setProgressions(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    window.addEventListener('guitar_progressions_updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('guitar_progressions_updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  useEffect(() => {
    const prog = progressions.find(p => p.id === activeProgId);
    if (prog?.key) {
      setChordPaletteKey(prog.key);
    }
  }, [activeProgId]);

  const saveProgressions = (newProgs: Progression[]) => {
    setProgressions(newProgs);
    localStorage.setItem('guitar_progressions', JSON.stringify(newProgs));
  };

  const createProgression = () => {
    const newProg: Progression = {
      id: Date.now().toString() + Math.random().toString(),
      name: 'New Progression',
      bpm: 80,
      key: chordPaletteKey,
      slots: []
    };
    saveProgressions([...progressions, newProg]);
    setActiveProgId(newProg.id);
  };

  const deleteProgression = (id: string) => {
    const updated = progressions.filter(p => p.id !== id);
    if (updated.length === 0) {
      loadPreset('I-V-vi-IV (C Major)', []);
    } else {
      saveProgressions(updated);
      if (activeProgId === id) {
        setActiveProgId(updated[0].id);
      }
    }
  };

  const loadPreset = (presetName: string, baseProgressions = progressions) => {
    let presetChords: ChordShape[] = [];
    if (presetName === 'I-V-vi-IV (C Major)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['G'][0], COMMON_CHORDS['A'][1], COMMON_CHORDS['F'][1]];
    } else if (presetName === 'ii-V-I (Jazz, C Major)') {
      presetChords = [COMMON_CHORDS['D'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['C'][0]];
    } else if (presetName === '12-Bar Blues (A)') {
      presetChords = [
        COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0],
        COMMON_CHORDS['D'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0],
        COMMON_CHORDS['E'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0]
      ];
    } else if (presetName === 'I-vi-IV-V (50s, G Major)') {
      presetChords = [COMMON_CHORDS['G'][0], COMMON_CHORDS['E'][1], COMMON_CHORDS['C'][0], COMMON_CHORDS['D'][0]];
    } else if (presetName === 'Andalusian Cadence (Am)') {
      presetChords = [COMMON_CHORDS['A'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['F'][1], COMMON_CHORDS['E'][0]];
    } else if (presetName === 'Doo-Wop (C)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['A'][1], COMMON_CHORDS['F'][1], COMMON_CHORDS['G'][0]];
    } else if (presetName === 'Minor Plagal (G)') {
      presetChords = [COMMON_CHORDS['G'][0], COMMON_CHORDS['B'][0], COMMON_CHORDS['C'][0], COMMON_CHORDS['C'][1]];
    } else if (presetName === "Pachelbel's Canon (D)") {
      presetChords = [COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['B'][0], COMMON_CHORDS['F#'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['G'][0], COMMON_CHORDS['A'][0]];
    } else if (presetName === '12-Bar Blues (E)') {
      presetChords = [
        COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0],
        COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0],
        COMMON_CHORDS['B'][1], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['B'][1]
      ];
    } else if (presetName === 'La Bamba (I-IV-V, C)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['F'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['G'][0]];
    } else if (presetName === 'Jazz Turnaround (vi-ii-V-I, C)') {
      presetChords = [COMMON_CHORDS['A'][3], COMMON_CHORDS['D'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['C'][2]];
    }

    const newProg: Progression = {
      id: Date.now().toString() + Math.random().toString(),
      name: presetName,
      bpm: 80,
      key: PRESET_KEYS[presetName] ?? 'C',
      slots: presetChords.filter(Boolean).map(chord => ({ chord }))
    };
    const updated = [...baseProgressions, newProg];
    saveProgressions(updated);
    setActiveProgId(newProg.id);
  };

  const activeProgression = progressions.find(p => p.id === activeProgId) || progressions[0];

  const topKeys = useMemo(() => {
    if (!activeProgression) return [];
    return analyzeKey(activeProgression.slots.map(s => s.chord));
  }, [activeProgression]);

  const addChordToProgression = (chord: ChordShape) => {
    if (!activeProgression) return;
    const updated = progressions.map(p => {
      if (p.id === activeProgression.id) {
        return { ...p, slots: [...p.slots, { chord }] };
      }
      return p;
    });
    saveProgressions(updated);
  };

  const updateBpm = (bpm: number) => {
    if (!activeProgression) return;
    saveProgressions(progressions.map(p => p.id === activeProgression.id ? { ...p, bpm } : p));
  };

  const handleTap = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    if (times.length > 0 && now - times[times.length - 1] > 2500) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length >= 2) {
      const intervals = tapTimesRef.current.slice(1).map((t, i) => t - tapTimesRef.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      updateBpm(Math.min(200, Math.max(40, Math.round(60000 / avg))));
    }
    if (tapTimesRef.current.length > 8) tapTimesRef.current = tapTimesRef.current.slice(-4);
  };

  type PresetDef = { name: string; degrees: number[]; qualities: ('Major' | 'Minor' | 'dom7')[] };
  const PROGRESSION_PRESETS: PresetDef[] = [
    { name: 'I–IV–V',    degrees: [0, 5, 7],       qualities: ['Major', 'Major', 'Major'] },
    { name: 'I–V–vi–IV', degrees: [0, 7, 9, 5],    qualities: ['Major', 'Major', 'Minor', 'Major'] },
    { name: 'ii–V–I',    degrees: [2, 7, 0],        qualities: ['Minor', 'Major', 'Major'] },
    { name: 'I–vi–IV–V', degrees: [0, 9, 5, 7],    qualities: ['Major', 'Minor', 'Major', 'Major'] },
    {
      name: '12-Bar Blues',
      degrees: [0,0,0,0, 5,5,0,0, 7,5,0,0],
      qualities: ['dom7','dom7','dom7','dom7', 'dom7','dom7','dom7','dom7', 'dom7','dom7','dom7','dom7'],
    },
  ];

  const applyPreset = (preset: PresetDef) => {
    if (!activeProgression) return;
    const key = (activeProgression.key ?? 'C') as Note;
    const rootIdx = ALL_NOTES.indexOf(key);
    const slots: ChordSlot[] = preset.degrees.map((deg, i) => {
      const degRoot = ALL_NOTES[(rootIdx + deg) % 12];
      const chords = COMMON_CHORDS[degRoot] ?? [];
      const q = preset.qualities[i];
      let chord = q === 'Major' ? chords.find(c => c.name.includes('Major'))
        : q === 'Minor' ? chords.find(c => c.name.includes('Minor'))
        : chords.find(c => /dom7|7 /.test(c.name)) ?? chords.find(c => c.name.includes('Major'));
      if (!chord) chord = chords[0];
      return chord ? { chord } : null;
    }).filter(Boolean) as ChordSlot[];
    saveProgressions(progressions.map(p =>
      p.id === activeProgression.id ? { ...p, slots } : p
    ));
  };

  const updateSlotPattern = (slotIdx: number, pattern: ArpeggioPattern) => {
    if (!activeProgression) return;
    const newSlots = activeProgression.slots.map((s, i) => i === slotIdx ? { ...s, pattern } : s);
    saveProgressions(progressions.map(p => p.id === activeProgression.id ? { ...p, slots: newSlots } : p));
  };

  const DURATION_MULT: Record<string, number> = { '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4 };

  const handlePlay = async () => {
    if (!activeProgression || activeProgression.slots.length === 0) return;
    await initAudio();

    const audioSlots = activeProgression.slots.map(slot => ({
      notesByString: slot.chord.frets.map((f, sIdx) =>
        f === -1 ? null : getFretNote(sIdx, f)
      ) as (string | null)[],
      pattern: slot.pattern,
    }));

    setIsPlaying(true);
    setActiveChordIdx(0);

    // Visual countdown (cosmetic — audio count-in is handled inside playProgressionWithPatterns)
    if (countInEnabled) {
      const beatMs = (60 / activeProgression.bpm) * 1000;
      [4, 3, 2, 1].forEach((beat, i) => {
        setTimeout(() => setCountDownBeat(beat), i * beatMs);
      });
      setTimeout(() => setCountDownBeat(null), 4 * beatMs);
    }

    const stop = playProgressionWithPatterns(
      audioSlots,
      activeProgression.bpm,
      isLooping,
      (idx) => setActiveChordIdx(idx),
      countInEnabled ? 4 : 0,
    );

    const clearPlaying = () => {
      setIsPlaying(false);
      setActiveChordIdx(null);
    };

    stopFnRef.current = () => { stop(); clearPlaying(); };

    if (!isLooping) {
      const totalDuration = audioSlots.reduce((sum, slot) => {
        if (slot.pattern && slot.pattern.steps.length > 0) {
          return sum + slot.pattern.steps.reduce((s, step) =>
            s + (60 / activeProgression.bpm) * (DURATION_MULT[step.duration] ?? 1), 0);
        }
        return sum + (60 / activeProgression.bpm) * 4;
      }, 0);
      setTimeout(clearPlaying, totalDuration * 1000 + 300);
    }
  };

  const handleStop = () => {
    stopFnRef.current?.();
    stopFnRef.current = null;
  };

  const handleImport = ({ progression, warnings }: ImportResult) => {
    if (warnings.length) console.warn('Import warnings:', warnings);
    const updated = [...progressions, progression];
    saveProgressions(updated);
    setActiveProgId(progression.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {showImportModal && (
        <ImportProgressionModal onImport={handleImport} onClose={() => setShowImportModal(false)} />
      )}
      {showChordSheetModal && activeProgression && (
        <ChordSheetModal
          progression={activeProgression}
          showDiagrams={showDiagrams}
          showChart={showChart}
          onToggleDiagrams={() => setShowDiagrams(v => !v)}
          onToggleChart={() => setShowChart(v => !v)}
          onClose={() => setShowChordSheetModal(false)}
        />
      )}
      <div className="flex justify-between items-center bg-brand-surface p-6 rounded-xl border border-brand-line">
        <div>
          <h1 className="text-2xl font-sans font-bold text-brand-ink">Custom Progressions</h1>
          <p className="text-brand-secondary mt-1">Build and save chord sequences for practice.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 border border-brand-primary text-brand-primary px-4 py-2 rounded-lg hover:bg-brand-primary hover:text-white transition-colors">
            <Upload size={16} /> Import JSON
          </button>
          <button onClick={createProgression} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
            <Plus size={18} /> New Sequence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          {progressions.map((p) => (
            <div
              key={p.id}
              className={`w-full flex items-center justify-between p-4 rounded-md border transition-all ${
                (activeProgId === p.id || (!activeProgId && p === progressions[0]))
                  ? 'bg-brand-primary/10 border-brand-primary text-brand-primary ring-1 ring-brand-primary'
                  : 'bg-brand-surface border-brand-line text-brand-ink hover:border-brand-primary/50'
              }`}
            >
              <button
                onClick={() => setActiveProgId(p.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-brand-ink">{p.name}</div>
                <div className="text-xs text-brand-secondary mt-1">{p.slots.length} chords</div>
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteProgression(p.id); }} className="text-brand-secondary hover:text-red-500 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div className="pt-6 border-t border-brand-line space-y-3">
            <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Load Presets</h3>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  loadPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full p-2 text-sm bg-brand-surface border border-brand-line rounded-md text-brand-ink focus:outline-none focus:border-brand-primary"
            >
              <option value="">-- Choose Preset --</option>
              <option value="I-V-vi-IV (C Major)">Pop Punk (C)</option>
              <option value="ii-V-I (Jazz, C Major)">Jazz ii-V-I (C)</option>
              <option value="12-Bar Blues (A)">12-Bar Blues (A)</option>
              <option value="I-vi-IV-V (50s, G Major)">50s Progression (G)</option>
              <option value="Andalusian Cadence (Am)">Andalusian Cadence (Am)</option>
              <option value="Doo-Wop (C)">Doo-Wop (C)</option>
              <option value="Minor Plagal (G)">Minor Plagal (G)</option>
              <option value="Pachelbel's Canon (D)">Pachelbel's Canon (D)</option>
              <option value="12-Bar Blues (E)">12-Bar Blues (E)</option>
              <option value="La Bamba (I-IV-V, C)">La Bamba (C)</option>
              <option value="Jazz Turnaround (vi-ii-V-I, C)">Jazz Turnaround (C)</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-3">
          {activeProgression ? (
            <div id="print-area" className="bg-brand-surface p-6 md:p-8 print:p-0 print:border-none rounded-xl border border-brand-line space-y-8 print:space-y-4">

              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-brand-line pb-4 print:pb-2 print:border-b-2 print:border-black">
                <input
                  type="text"
                  value={activeProgression.name}
                  onChange={(e) => {
                    saveProgressions(progressions.map(p => p.id === activeProgression.id ? { ...p, name: e.target.value } : p));
                  }}
                  className="text-2xl font-serif text-brand-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0 max-w-xs placeholder:text-brand-line print:hidden"
                  placeholder="Name this progression..."
                />
                <h2 className="hidden print:block text-2xl font-serif text-black">{activeProgression.name || 'Untitled Progression'}</h2>

                <div className="flex items-center gap-3 print:hidden flex-wrap">
                  {/* BPM */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">BPM</span>
                    <input
                      type="range"
                      min={40}
                      max={200}
                      value={activeProgression.bpm}
                      onChange={(e) => updateBpm(Number(e.target.value))}
                      className="w-20 accent-brand-primary cursor-pointer"
                    />
                    <span className="text-sm font-mono font-bold text-brand-ink w-8">{activeProgression.bpm}</span>
                    <button
                      onClick={handleTap}
                      className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors font-mono"
                      title="Tap to set tempo"
                    >
                      Tap
                    </button>
                  </div>
                  {/* Loop */}
                  <button
                    onClick={() => setIsLooping(l => !l)}
                    title={isLooping ? 'Loop on — click to disable' : 'Loop off — click to enable'}
                    className={cn(
                      'p-2 rounded-md border transition-colors',
                      isLooping ? 'bg-brand-primary text-white border-brand-primary' : 'text-brand-secondary border-brand-line hover:text-brand-ink hover:border-brand-primary/50'
                    )}
                  >
                    <RotateCcw size={16} />
                  </button>
                  {/* Count-in toggle */}
                  <button
                    onClick={() => setCountInEnabled(v => !v)}
                    title={countInEnabled ? 'Count-in on — click to disable' : 'Count-in off — 4-beat count-in before playback'}
                    className={cn(
                      'px-2 py-2 rounded-md border transition-colors text-xs font-bold tracking-widest',
                      countInEnabled ? 'bg-brand-primary text-white border-brand-primary' : 'text-brand-secondary border-brand-line hover:text-brand-ink hover:border-brand-primary/50'
                    )}
                  >
                    1234
                  </button>
                  {/* Play / Stop */}
                  {isPlaying ? (
                    <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-medium rounded-md hover:bg-red-600 transition-colors min-w-[80px] justify-center">
                      {countDownBeat !== null
                        ? <span className="font-mono text-base font-bold">{countDownBeat}</span>
                        : <><Square size={16} fill="currentColor" /> Stop</>
                      }
                    </button>
                  ) : (
                    <button onClick={handlePlay} onMouseEnter={initAudio} className="flex items-center gap-2 px-6 py-2 bg-[#F2F5F3] text-brand-primary font-medium border border-brand-primary/30 rounded-md hover:bg-brand-primary hover:text-white transition-colors dark:bg-brand-primary/20 dark:hover:bg-brand-primary dark:text-brand-ink">
                      <Play size={18} fill="currentColor" /> Play
                    </button>
                  )}
                  <button
                    onClick={() => setShowChordSheetModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-transparent text-brand-ink border border-brand-line font-medium rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors"
                  >
                    <FileText size={18} /> Chord Sheet
                  </button>
                  <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent text-brand-ink border border-brand-line font-medium rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors">
                    <Printer size={18} /> Print
                  </button>
                  <button
                    onClick={() => setShowVoiceLeading(v => !v)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded border transition-colors',
                      showVoiceLeading
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink'
                    )}
                  >
                    {showVoiceLeading ? 'Hide Voice Leading' : 'Show Voice Leading'}
                  </button>
                  <button
                    onClick={() => navigate('/ear-training')}
                    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                  >
                    Ear Training →
                  </button>
                  <button onClick={() => deleteProgression(activeProgression.id)} className="flex items-center gap-2 px-3 py-2 bg-transparent text-red-500 border border-brand-line font-medium rounded-md hover:border-red-500 hover:text-red-500 transition-colors" title="Delete Progression">
                    <Trash2 size={18} />
                  </button>
                  {/* Presets — w-full forces a new wrapped row */}
                  <div className="w-full flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Preset:</span>
                    {PROGRESSION_PRESETS.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chord sequence */}
              {activeProgression.slots.length > 0 ? (
                <Reorder.Group
                  as="div"
                  axis="x"
                  values={activeProgression.slots}
                  onReorder={(newOrder) => {
                    const updated = { ...activeProgression, slots: newOrder };
                    saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
                  }}
                  className="flex gap-4 print:gap-4 print:justify-start print:items-start overflow-x-auto pb-4 print:pb-0 print:flex-row print:flex-wrap print:overflow-hidden print:w-full"
                >
                  {activeProgression.slots.map((slot, i) => {
                    const chord = slot.chord;
                    const maxFret = Math.max(...chord.frets);
                    const displayFrets = Math.max(5, maxFret <= 5 ? 5 : maxFret + 1);
                    const isActive = activeChordIdx === i;
                    const isEditing = openSequencerSlotIdx === i;
                    return (
                      <Reorder.Item
                        as="div"
                        key={`${chord.name}-${i}`}
                        value={slot}
                        className={cn(
                          'flex-shrink-0 w-48 rounded-lg p-4 relative group bg-brand-bg print:w-[360px] print:border-none print:shadow-none print:p-0 print:bg-transparent print:mb-8 print:break-inside-avoid cursor-grab active:cursor-grabbing select-none transition-all border',
                          isActive ? 'border-brand-primary ring-2 ring-brand-primary shadow-md' :
                          isEditing ? 'border-brand-primary/60' : 'border-brand-line'
                        )}
                        whileDrag={{ scale: 1.04, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 50 }}
                      >
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-brand-line opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                          <GripHorizontal size={14} />
                        </div>
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            const updated = { ...activeProgression, slots: activeProgression.slots.filter((_, idx) => idx !== i) };
                            saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
                            if (openSequencerSlotIdx === i) setOpenSequencerSlotIdx(null);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-brand-surface border border-brand-line rounded-full text-brand-active opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        >
                          <Trash2 size={14} />
                        </button>
                        {/* Pattern edit button */}
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setOpenSequencerSlotIdx(isEditing ? null : i)}
                          className={cn(
                            'absolute bottom-2 right-2 p-1.5 rounded-full border transition-all print:hidden',
                            isEditing
                              ? 'bg-brand-primary text-white border-brand-primary opacity-100'
                              : 'bg-brand-surface border-brand-line text-brand-secondary opacity-0 group-hover:opacity-100'
                          )}
                          title="Edit arpeggio pattern"
                        >
                          <Pencil size={12} />
                        </button>
                        {/* Step count badge */}
                        {slot.pattern && slot.pattern.steps.length > 0 && (
                          <span className="absolute bottom-2 left-2 text-[10px] font-bold text-brand-primary print:hidden">
                            {slot.pattern.steps.length} steps
                          </span>
                        )}
                        {topKeys[0]?.chordLabels[i] && (
                          <div className={cn(
                            'text-[10px] font-bold text-center mt-3 mb-0.5 print:hidden',
                            topKeys[0].chordLabels[i].isBorrowed
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-brand-secondary'
                          )}>
                            {topKeys[0].chordLabels[i].roman}
                            {topKeys[0].chordLabels[i].isBorrowed && ' ♭'}
                          </div>
                        )}
                        <h4 className={cn(
                          'text-center font-bold text-brand-ink mb-2 print:mb-2 print:mt-0 print:text-xl',
                          topKeys[0]?.chordLabels[i] ? 'mt-0' : 'mt-3'
                        )}>{chord.name}</h4>
                        <Fretboard fretsNum={displayFrets} chord={chord} showNoteNames={false} className="pointer-events-none origin-top print:scale-100 scale-75" />
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              ) : (
                <div className="flex gap-4 pb-4">
                  <div className="text-brand-secondary/70 p-8 border-2 border-dashed border-brand-line bg-brand-bg/50 rounded-lg w-full text-center">
                    No chords yet. Add some from the dictionary below.
                  </div>
                </div>
              )}

              {/* Key analysis summary */}
              {topKeys.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
                  <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider shrink-0">Key</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-brand-primary font-semibold text-sm shrink-0">
                    {topKeys[0].label}
                  </span>
                  <span className="text-xs text-brand-secondary shrink-0">
                    {topKeys[0].diatonicCount}/{topKeys[0].totalChords} diatonic
                  </span>
                  <span className="text-xs font-mono text-brand-secondary">
                    {topKeys[0].chordLabels.map(l => l.roman).join(' — ')}
                  </span>
                  {topKeys[1] && topKeys[1].score >= topKeys[0].score - 0.05 && topKeys[1].label !== topKeys[0].label && (
                    <span className="text-xs text-brand-secondary">
                      · also fits: <span className="font-medium text-brand-ink">{topKeys[1].label}</span>
                    </span>
                  )}
                  {topKeys[0].chordLabels.some(l => l.isBorrowed) && (
                    <span className="text-xs text-amber-500 dark:text-amber-400">
                      ♭ = borrowed chord
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setCircleKey(topKeys[0].key);
                      setShowCircle(true);
                    }}
                    className="text-xs px-2 py-0.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors shrink-0"
                    title="Highlight this key on the Circle of Fifths"
                  >
                    Use on circle
                  </button>
                </div>
              )}

              {/* Sequencer panel */}
              {openSequencerSlotIdx !== null && activeProgression.slots[openSequencerSlotIdx] && (
                <SequencerPanel
                  slot={activeProgression.slots[openSequencerSlotIdx]}
                  bpm={activeProgression.bpm}
                  onPatternChange={(pattern) => updateSlotPattern(openSequencerSlotIdx, pattern)}
                  onClose={() => setOpenSequencerSlotIdx(null)}
                />
              )}

              {/* Voice leading analysis between adjacent chords */}
              {showVoiceLeading && activeProgression.slots.length >= 2 && (
                <div className="space-y-2 print:hidden">
                  <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Voice Leading</h3>
                  {activeProgression.slots.slice(0, -1).map((slot, i) => {
                    const next = activeProgression.slots[i + 1];
                    const analysis = analyzeVoiceLeading(slot.chord, next.chord, STANDARD_TUNING.notes);
                    return (
                      <React.Fragment key={i}>
                        <VoiceLeadingPanel
                          analysis={analysis}
                          fromChordName={slot.chord.name}
                          toChordName={next.chord.name}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Add Chords Palette */}
              <div className="pt-6 border-t border-brand-line print:hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Add from Common Chords</h3>
                  <button
                    onClick={() => {
                      const next = !showCircle;
                      setShowCircle(next);
                      if (!next) setCircleKey(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      showCircle
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-brand-surface text-brand-secondary border-brand-line hover:border-brand-primary hover:text-brand-primary'
                    }`}
                  >
                    <Disc size={13} /> Circle of 5ths
                  </button>
                </div>

                {showCircle && (
                  <div className="mb-5 p-4 bg-brand-bg rounded-xl border border-brand-line">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-brand-secondary">
                        {circleKey ? `Showing diatonic chords for ${circleKey}` : 'Click a key to highlight its diatonic chords'}
                      </p>
                      {circleKey && (
                        <button onClick={() => setCircleKey(null)} className="text-xs text-brand-secondary hover:text-brand-ink underline">Clear</button>
                      )}
                    </div>
                    <CircleOfFifths
                      selectedKey={circleKey}
                      onKeySelect={(key) => {
                        setCircleKey(key);
                        setChordPaletteKey(key);
                        if (activeProgression) {
                          saveProgressions(progressions.map(p =>
                            p.id === activeProgression.id ? { ...p, key } : p
                          ));
                        }
                      }}
                      className="max-w-xs mx-auto"
                    />
                  </div>
                )}

                <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
                  {Object.keys(COMMON_CHORDS).map(key => {
                    const isDiatonic = circleKey ? getDiatonicRoots(circleKey).has(key) : false;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setChordPaletteKey(key);
                          if (activeProgression) {
                            saveProgressions(progressions.map(p =>
                              p.id === activeProgression.id ? { ...p, key } : p
                            ));
                          }
                        }}
                        className={`px-2 py-1 flex-shrink-0 text-xs font-bold rounded transition-colors ${
                          chordPaletteKey === key
                            ? 'bg-brand-primary text-white'
                            : isDiatonic
                            ? 'bg-brand-active/10 border border-brand-active text-brand-active hover:bg-brand-active hover:text-white'
                            : 'bg-brand-surface border border-brand-line text-brand-ink hover:border-brand-primary'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mb-1">
                  <div className="flex gap-1 flex-wrap">
                    {(['all', 'open', 'low', 'high'] as PositionBucket[]).map(bucket => (
                      <button
                        key={bucket}
                        onClick={() => setPalettePositionFilter(bucket)}
                        className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', palettePositionFilter === bucket ? 'bg-brand-active text-white' : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink')}
                      >{POSITION_LABELS[bucket]}</button>
                    ))}
                  </div>
                  <div className="flex gap-0.5 ml-2">
                    <button
                      onClick={() => setPaletteSortOrder(paletteSortOrder === 'asc' ? null : 'asc')}
                      title="Sort low to high"
                      className={cn('px-2 py-0.5 rounded text-xs font-bold transition-colors', paletteSortOrder === 'asc' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:text-brand-ink border border-transparent hover:border-brand-line')}
                    >↑</button>
                    <button
                      onClick={() => setPaletteSortOrder(paletteSortOrder === 'desc' ? null : 'desc')}
                      title="Sort high to low"
                      className={cn('px-2 py-0.5 rounded text-xs font-bold transition-colors', paletteSortOrder === 'desc' ? 'bg-brand-primary text-white' : 'text-brand-secondary hover:text-brand-ink border border-transparent hover:border-brand-line')}
                    >↓</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    let chords = COMMON_CHORDS[chordPaletteKey] ?? [];
                    if (palettePositionFilter !== 'all') chords = chords.filter(c => chordPositionBucket(c) === palettePositionFilter);
                    if (paletteSortOrder) chords = [...chords].sort((a, b) => paletteSortOrder === 'asc' ? avgChordPitch(a) - avgChordPitch(b) : avgChordPitch(b) - avgChordPitch(a));
                    return chords.map((chord, i) => {
                      const diatonic = circleKey ? isChordDiatonic(chord, circleKey) : false;
                      return (
                        <button
                          key={i}
                          onClick={() => addChordToProgression(chord)}
                          className={cn(
                            'px-3 py-1.5 border rounded-md text-sm transition-colors',
                            diatonic
                              ? 'bg-brand-active/10 border-brand-active text-brand-active font-medium hover:bg-brand-active hover:text-white'
                              : 'border-brand-line bg-brand-surface text-brand-ink hover:bg-brand-bg hover:border-brand-primary'
                          )}
                        >
                          {chord.name}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-brand-secondary bg-brand-surface rounded-xl border border-brand-line">Select or create a progression.</div>
          )}
          {/* Chord sheet portal: rendered as a body sibling so print can hide #root and show only this */}
          {activeProgression && createPortal(
            <div
              id="chord-sheet-area"
              style={{ position: 'absolute', left: '-9999px', top: 0, width: '850px' }}
              aria-hidden="true"
            >
              <ChordSheet
                progression={activeProgression}
                showDiagrams={showDiagrams}
                showChart={showChart}
              />
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
