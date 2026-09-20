# Circle of Fifths Two-Ring Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `CircleOfFifths.tsx` into a two-ring wheel (outer = major keys, inner = relative minors) with Roman-numeral wedges, and rework `Circle.tsx`'s chord panel around in-key + borrowed chip rows, while leaving `Progressions.tsx`'s compact key-picker usage minimal.

**Architecture:** All diatonic/borrowed-chord theory logic moves into a new shared module, `src/data/musicTheory.ts`, so `CircleOfFifths.tsx` (a dumb, presentational two-ring SVG component), `Circle.tsx` (full-featured page), and `Progressions.tsx` (compact key-picker) all read from one source of truth instead of duplicating theory tables.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 (brand design tokens only, no new colors), no test framework — verification is `npm run lint` (`tsc --noEmit`) plus manual dev-server click-through.

## Global Constraints

- No automated test suite exists in this repo; every task's verification step is `npm run lint` plus a manual check in the dev server — never invent a test file.
- Use only existing Tailwind brand tokens (`brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`, `brand-active`, `brand-fretborder`) — no new ad hoc colors.
- `@` path alias resolves to the project root, not `src/` — use relative imports (`../data/musicTheory`) inside `src/`, matching existing files.
- Do not modify `src/components/Fretboard.tsx`, `src/lib/audio.ts`, `src/data/guitarData.ts`, or `src/types.ts`.
- `ChordShape.name` follows the `` `${note} ${nameStr}` `` convention (e.g. `"C Major (E Shape)"`, `"C m7b5 (A Shape)"`) — any new quality-matching helper must filter on these exact substrings, matching existing code in `Circle.tsx`/`Progressions.tsx`.
- The redesigned wheel applies to both `Circle.tsx` and `Progressions.tsx`; `Progressions.tsx` keeps its existing diatonic-highlighting/chord-palette logic (`getDiatonicRoots`, `isChordDiatonic`) untouched and does not get chip rows or numerals.

---

### Task 1: Shared music theory module

**Files:**
- Create: `src/data/musicTheory.ts`

**Interfaces:**
- Consumes: `Note`, `ChordShape` from `../types`; `ALL_NOTES`, `COMMON_CHORDS` from `./guitarData`.
- Produces (used by Tasks 2–4):
  - `noteAt(root: Note, semitones: number): Note`
  - `relativeMinorOf(major: Note): Note`
  - `relativeMajorOf(minor: Note): Note`
  - `displayNote(n: Note): string`
  - `type DiatonicQuality = 'Major' | 'Minor' | 'dim'`
  - `type SeventhQuality = 'Maj7' | 'dom7' | 'm7' | 'm7b5'`
  - `type WedgeQuality = 'major' | 'minor'`
  - `interface DiatonicDegree { roman: string; interval: number; quality: DiatonicQuality; seventh: SeventhQuality }`
  - `diatonicDegrees(mode: 'major' | 'minor'): DiatonicDegree[]`
  - `interface WedgeInfo { isTonic: boolean; isDiatonic: boolean; numeral: string | null }`
  - `wedgeInfo(tonic: Note | null, mode: 'major' | 'minor', root: Note, quality: WedgeQuality): WedgeInfo`
  - `wedgeQualityFor(quality: DiatonicQuality | SeventhQuality): WedgeQuality | null`
  - `interface BorrowedChordDef { interval: number; quality: DiatonicQuality | 'dom7'; label: string; why: string }`
  - `borrowedChords(mode: 'major' | 'minor'): BorrowedChordDef[]`
  - `effectiveBorrowedQuality(b: BorrowedChordDef, sevenths: boolean): DiatonicQuality | SeventhQuality`
  - `chordLabel(root: Note, quality: DiatonicQuality | SeventhQuality): string`
  - `chordsForQuality(root: Note, quality: DiatonicQuality | SeventhQuality): ChordShape[]`

- [ ] **Step 1: Write the module**

Create `src/data/musicTheory.ts`:

```ts
import { Note, ChordShape } from '../types';
import { ALL_NOTES, COMMON_CHORDS } from './guitarData';

// Compute the note N semitones above `root` in the chromatic scale.
export function noteAt(root: Note, semitones: number): Note {
  return ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12];
}

export function relativeMinorOf(major: Note): Note {
  return noteAt(major, 9);
}

export function relativeMajorOf(minor: Note): Note {
  return noteAt(minor, 3);
}

// Conventional display spelling — flats for the flat side of the circle.
export const DISPLAY_NAMES: Partial<Record<Note, string>> = {
  'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb', 'F#': 'F#/Gb',
};
export function displayNote(n: Note): string {
  return DISPLAY_NAMES[n] ?? n;
}

export type DiatonicQuality = 'Major' | 'Minor' | 'dim';
export type SeventhQuality = 'Maj7' | 'dom7' | 'm7' | 'm7b5';
export type WedgeQuality = 'major' | 'minor';

export interface DiatonicDegree {
  roman: string;
  interval: number;
  quality: DiatonicQuality;
  seventh: SeventhQuality;
}

export const DIATONIC_MAJOR: DiatonicDegree[] = [
  { roman: 'I',    interval: 0,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'ii',   interval: 2,  quality: 'Minor', seventh: 'm7' },
  { roman: 'iii',  interval: 4,  quality: 'Minor', seventh: 'm7' },
  { roman: 'IV',   interval: 5,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'V',    interval: 7,  quality: 'Major', seventh: 'dom7' },
  { roman: 'vi',   interval: 9,  quality: 'Minor', seventh: 'm7' },
  { roman: 'vii°', interval: 11, quality: 'dim',   seventh: 'm7b5' },
];

export const DIATONIC_MINOR: DiatonicDegree[] = [
  { roman: 'i',    interval: 0,  quality: 'Minor', seventh: 'm7' },
  { roman: 'ii°',  interval: 2,  quality: 'dim',   seventh: 'm7b5' },
  { roman: 'III',  interval: 3,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'iv',   interval: 5,  quality: 'Minor', seventh: 'm7' },
  { roman: 'v',    interval: 7,  quality: 'Minor', seventh: 'm7' },
  { roman: 'VI',   interval: 8,  quality: 'Major', seventh: 'Maj7' },
  { roman: 'VII',  interval: 10, quality: 'Major', seventh: 'dom7' },
];

export function diatonicDegrees(mode: 'major' | 'minor'): DiatonicDegree[] {
  return mode === 'major' ? DIATONIC_MAJOR : DIATONIC_MINOR;
}

function toWedgeQuality(q: DiatonicQuality): WedgeQuality | null {
  if (q === 'Major') return 'major';
  if (q === 'Minor') return 'minor';
  return null;
}

// Maps any resolved chord quality back to which ring (major/minor) it
// visually belongs to on the wheel. Diminished chords have no ring.
export function wedgeQualityFor(quality: DiatonicQuality | SeventhQuality): WedgeQuality | null {
  if (quality === 'Major' || quality === 'Maj7' || quality === 'dom7') return 'major';
  if (quality === 'Minor' || quality === 'm7' || quality === 'm7b5') return 'minor';
  return null;
}

export interface WedgeInfo {
  isTonic: boolean;
  isDiatonic: boolean;
  numeral: string | null;
}

// Diatonic/tonic/numeral status of a single wheel wedge (root+quality)
// relative to the given tonic/mode. Only major/minor triads get a wedge —
// the diminished diatonic degree (vii° in major, ii° in minor) has no
// wedge, matching the wheel's fixed 12-major/12-minor layout.
export function wedgeInfo(tonic: Note | null, mode: 'major' | 'minor', root: Note, quality: WedgeQuality): WedgeInfo {
  if (!tonic) return { isTonic: false, isDiatonic: false, numeral: null };
  const isTonic = root === tonic && quality === mode;
  const match = diatonicDegrees(mode).find(
    d => toWedgeQuality(d.quality) === quality && noteAt(tonic, d.interval) === root,
  );
  return { isTonic, isDiatonic: !!match, numeral: match ? match.roman : null };
}

export interface BorrowedChordDef {
  interval: number;
  quality: DiatonicQuality | 'dom7';
  label: string;
  why: string;
}

export const BORROWED_MAJOR: BorrowedChordDef[] = [
  { interval: 2,  quality: 'dom7',  label: 'V7/V',  why: 'Dominant of the V chord — strong pull toward V.' },
  { interval: 9,  quality: 'dom7',  label: 'V7/ii', why: 'Secondary dominant leading into ii.' },
  { interval: 4,  quality: 'dom7',  label: 'V7/vi', why: 'Secondary dominant leading into vi, the relative minor.' },
  { interval: 0,  quality: 'dom7',  label: 'V7/IV', why: 'Turns the I chord into a dominant 7 to pull into IV.' },
  { interval: 5,  quality: 'Minor', label: 'iv',    why: 'Minor iv borrowed from the parallel minor key — a common darker turn before resolving home.' },
  { interval: 10, quality: 'Major', label: '♭VII',  why: 'Borrowed from the parallel minor — classic rock ♭VII–I cadence.' },
  { interval: 3,  quality: 'Major', label: '♭III',  why: "Borrowed from the parallel minor's relative major — a moody, modal color." },
];

export const BORROWED_MINOR: BorrowedChordDef[] = [
  { interval: 7, quality: 'dom7',  label: 'V7',  why: "Harmonic-minor dominant — raises the natural minor's 7th for a stronger pull home." },
  { interval: 5, quality: 'Major', label: 'IV',  why: 'Major IV borrowed from the parallel major — brightens the usual minor iv.' },
  { interval: 1, quality: 'Major', label: '♭II', why: "The 'Neapolitan' chord — a dramatic half-step move toward i." },
];

export function borrowedChords(mode: 'major' | 'minor'): BorrowedChordDef[] {
  return mode === 'major' ? BORROWED_MAJOR : BORROWED_MINOR;
}

// A borrowed chord's displayed quality respects the triads/7ths toggle,
// except secondary dominants (quality: 'dom7'), which always stay dominant
// 7th regardless of the toggle — that's what makes them "secondary dominants".
export function effectiveBorrowedQuality(b: BorrowedChordDef, sevenths: boolean): DiatonicQuality | SeventhQuality {
  if (b.quality === 'dom7') return 'dom7';
  if (!sevenths) return b.quality;
  return b.quality === 'Major' ? 'Maj7' : b.quality === 'Minor' ? 'm7' : b.quality;
}

const QUALITY_SUFFIX: Record<DiatonicQuality | SeventhQuality, string> = {
  Major: '', Minor: 'm', dim: 'dim', Maj7: 'maj7', dom7: '7', m7: 'm7', m7b5: 'm7♭5',
};
export function chordLabel(root: Note, quality: DiatonicQuality | SeventhQuality): string {
  return `${root}${QUALITY_SUFFIX[quality]}`;
}

// Matches this project's ChordShape.name convention, e.g. "C Major (E Shape)",
// "C 7 (E7 Shape)", "C m7b5 (A Shape)" — see src/data/guitarData.ts.
export function chordsForQuality(root: Note, quality: DiatonicQuality | SeventhQuality): ChordShape[] {
  const chords = COMMON_CHORDS[root] ?? [];
  switch (quality) {
    case 'Major': return chords.filter(c => c.name.includes('Major'));
    case 'Minor': return chords.filter(c => c.name.includes('Minor'));
    case 'dim':   return chords.filter(c => c.name.includes('dim ('));
    case 'Maj7':  return chords.filter(c => c.name.includes('Maj7'));
    case 'dom7':  return chords.filter(c => c.name.includes(' 7 ('));
    case 'm7':    return chords.filter(c => c.name.includes('m7 ('));
    case 'm7b5':  return chords.filter(c => c.name.includes('m7b5'));
    default:      return [];
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run lint`
Expected: no errors mentioning `musicTheory.ts` (unused-export warnings, if any, are fine — every export here is consumed by Tasks 2–4).

- [ ] **Step 3: Commit**

```bash
git add src/data/musicTheory.ts
git commit -m "feat: add shared music theory module for Circle of Fifths redesign"
```

---

### Task 2: Two-ring `CircleOfFifths.tsx` wheel + `Circle.tsx` rework

**Files:**
- Modify: `src/components/CircleOfFifths.tsx` (full rewrite)
- Modify: `src/pages/Circle.tsx` (full rewrite)

**Interfaces:**
- Consumes: everything produced by Task 1 (`noteAt`, `displayNote`, `diatonicDegrees`, `borrowedChords`, `effectiveBorrowedQuality`, `chordsForQuality`, `chordLabel`, `wedgeQualityFor`, `relativeMinorOf`, `relativeMajorOf`, `wedgeInfo`, and the `WedgeQuality`/`DiatonicQuality`/`SeventhQuality` types); `Fretboard` from `../components/Fretboard`; `playStrum`, `initAudio`, `getFretNote` from `../lib/audio`; `addChordToActiveProgression` from `../lib/progressionUtils`; `cn` from `../lib/utils`.
- Produces (used by Task 3): `CircleOfFifths` component with props
  ```ts
  interface CircleOfFifthsProps {
    tonic: Note | null;
    mode: 'major' | 'minor';
    selected?: { root: Note; quality: WedgeQuality } | null;
    onSelect: (root: Note, quality: WedgeQuality) => void;
    showNumerals?: boolean;
    compact?: boolean;
    className?: string;
  }
  ```

This task intentionally changes `CircleOfFifths.tsx`'s prop contract (old: `selectedKey`/`onKeySelect`) and rewrites its only full-featured consumer, `Circle.tsx`, together — after this task `npm run lint` will still report errors in `Progressions.tsx` (fixed in Task 3) since it still calls the old prop names.

- [ ] **Step 1: Rewrite `src/components/CircleOfFifths.tsx`**

Replace the entire file with:

```tsx
import React from 'react';
import { Note } from '../types';
import { cn } from '../lib/utils';
import { relativeMinorOf, displayNote, wedgeInfo, WedgeQuality } from '../data/musicTheory';

interface CircleOfFifthsProps {
  tonic: Note | null;
  mode: 'major' | 'minor';
  selected?: { root: Note; quality: WedgeQuality } | null;
  onSelect: (root: Note, quality: WedgeQuality) => void;
  showNumerals?: boolean;
  compact?: boolean;
  className?: string;
}

const CX = 200, CY = 200;

// Clockwise from top (major key at 12 o'clock), in fifths.
const MAJOR_NOTES: Note[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

const MAJOR_OUTER_R = 180, MAJOR_INNER_R = 118;
const MINOR_OUTER_R = 116, MINOR_INNER_R = 58;
const MAJOR_LABEL_R = 163, MAJOR_NUMERAL_R = 135;
const MINOR_LABEL_R = 100, MINOR_NUMERAL_R = 74;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polar(r: number, angleDeg: number) {
  return { x: CX + r * Math.cos(toRad(angleDeg)), y: CY + r * Math.sin(toRad(angleDeg)) };
}

function wedgePath(i: number, r0: number, r1: number): string {
  const gap = 1.5;
  const s = i * 30 - 90 + gap / 2;
  const e = (i + 1) * 30 - 90 - gap / 2;
  const p1 = polar(r1, s);
  const p2 = polar(r1, e);
  const p3 = polar(r0, e);
  const p4 = polar(r0, s);
  return (
    `M ${p1.x} ${p1.y} ` +
    `A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} ` +
    `L ${p3.x} ${p3.y} ` +
    `A ${r0} ${r0} 0 0 0 ${p4.x} ${p4.y} Z`
  );
}

function textAt(r: number, i: number) {
  const mid = i * 30 - 90 + 15;
  return polar(r, mid);
}

function wedgeFill(isTonic: boolean, isDiatonic: boolean, isSelected: boolean): string {
  if (isTonic) return 'var(--color-brand-active)';
  if (isSelected) return 'var(--color-brand-primary)';
  if (isDiatonic) return 'color-mix(in srgb, var(--color-brand-active) 20%, var(--color-brand-surface))';
  return 'var(--color-brand-surface)';
}

export function CircleOfFifths({
  tonic,
  mode,
  selected = null,
  onSelect,
  showNumerals = true,
  compact = false,
  className,
}: CircleOfFifthsProps) {
  const numeralsOn = showNumerals && !compact;

  return (
    <div className={cn('w-full max-w-sm mx-auto', className)}>
      <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-md">
        {MAJOR_NOTES.map((majorNote, i) => {
          const minorNote = relativeMinorOf(majorNote);
          const majorInfo = wedgeInfo(tonic, mode, majorNote, 'major');
          const minorInfo = wedgeInfo(tonic, mode, minorNote, 'minor');
          const majorSelected = !!selected && selected.root === majorNote && selected.quality === 'major';
          const minorSelected = !!selected && selected.root === minorNote && selected.quality === 'minor';

          const majorLabelPos = textAt(MAJOR_LABEL_R, i);
          const majorNumeralPos = textAt(MAJOR_NUMERAL_R, i);
          const minorLabelPos = textAt(MINOR_LABEL_R, i);
          const minorNumeralPos = textAt(MINOR_NUMERAL_R, i);
          const majorDisplay = displayNote(majorNote);
          const majorFontSize = compact
            ? (majorDisplay.length > 2 ? 8 : 11)
            : (majorDisplay.length > 2 ? 9 : 13);

          return (
            <g key={majorNote}>
              {/* Outer (major) wedge */}
              <g onClick={() => onSelect(majorNote, 'major')} style={{ cursor: 'pointer' }}>
                <path
                  d={wedgePath(i, MAJOR_INNER_R, MAJOR_OUTER_R)}
                  fill={wedgeFill(majorInfo.isTonic, majorInfo.isDiatonic, majorSelected)}
                  stroke="var(--color-brand-line)"
                  strokeWidth={majorSelected ? 2.5 : 1}
                />
                <text
                  x={majorLabelPos.x} y={majorLabelPos.y + 5}
                  textAnchor="middle"
                  fontSize={majorFontSize}
                  fontWeight="bold"
                  fill={majorInfo.isTonic || majorSelected ? 'white' : 'var(--color-brand-ink)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {majorDisplay}
                </text>
                {numeralsOn && majorInfo.numeral && (
                  <text
                    x={majorNumeralPos.x} y={majorNumeralPos.y + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={majorInfo.isTonic || majorSelected ? 'rgba(255,255,255,0.85)' : 'var(--color-brand-secondary)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {majorInfo.numeral}
                  </text>
                )}
              </g>

              {/* Inner (relative minor) wedge */}
              <g onClick={() => onSelect(minorNote, 'minor')} style={{ cursor: 'pointer' }}>
                <path
                  d={wedgePath(i, MINOR_INNER_R, MINOR_OUTER_R)}
                  fill={wedgeFill(minorInfo.isTonic, minorInfo.isDiatonic, minorSelected)}
                  stroke="var(--color-brand-line)"
                  strokeWidth={minorSelected ? 2.5 : 1}
                />
                <text
                  x={minorLabelPos.x} y={minorLabelPos.y + 4}
                  textAnchor="middle"
                  fontSize={compact ? 7 : 8}
                  fill={minorInfo.isTonic || minorSelected ? 'white' : 'var(--color-brand-secondary)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {displayNote(minorNote)}m
                </text>
                {numeralsOn && minorInfo.numeral && (
                  <text
                    x={minorNumeralPos.x} y={minorNumeralPos.y + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fill={minorInfo.isTonic || minorSelected ? 'rgba(255,255,255,0.8)' : 'var(--color-brand-secondary)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {minorInfo.numeral}
                  </text>
                )}
              </g>
            </g>
          );
        })}
        {/* Decorative center circle */}
        <circle cx={CX} cy={CY} r={50} fill="var(--color-brand-fretborder)" opacity={0.25} />
        <text
          x={CX} y={CY + 5}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="var(--color-brand-secondary)"
          style={{ userSelect: 'none' }}
        >
          5ths
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/pages/Circle.tsx`**

Replace the entire file with:

```tsx
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
```

- [ ] **Step 3: Verify types compile (Progressions.tsx errors expected, fixed in Task 3)**

Run: `npx tsc --noEmit 2>&1 | grep -v "Progressions.tsx"`
Expected: no output (no errors outside `Progressions.tsx`).

- [ ] **Step 4: Commit**

```bash
git add src/components/CircleOfFifths.tsx src/pages/Circle.tsx
git commit -m "feat: rebuild Circle of Fifths as a two-ring wheel with in-key and borrowed chip rows"
```

---

### Task 3: Wire `Progressions.tsx`'s compact wheel to the new component API

**Files:**
- Modify: `src/pages/Progressions.tsx:7` (import), `src/pages/Progressions.tsx:1379-1391` (component usage)

**Interfaces:**
- Consumes: `CircleOfFifths` props from Task 2; `relativeMajorOf` from Task 1's `src/data/musicTheory.ts`.
- Produces: nothing new — this is the final piece that makes `npm run lint` pass cleanly again.

- [ ] **Step 1: Add the `relativeMajorOf` import**

In `src/pages/Progressions.tsx`, after line 7 (`import { CircleOfFifths } from '../components/CircleOfFifths';`), add:

```tsx
import { relativeMajorOf } from '../data/musicTheory';
```

- [ ] **Step 2: Update the `CircleOfFifths` usage**

Replace lines 1379-1391:

```tsx
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
```

with:

```tsx
                    <CircleOfFifths
                      tonic={circleKey}
                      mode="major"
                      selected={circleKey ? { root: circleKey, quality: 'major' } : null}
                      compact
                      onSelect={(root, quality) => {
                        const key = quality === 'minor' ? relativeMajorOf(root) : root;
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
```

- [ ] **Step 3: Verify types compile cleanly across the whole project**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Progressions.tsx
git commit -m "fix: wire Progressions compact wheel to the new CircleOfFifths API"
```

---

### Task 4: Manual verification pass

**Files:** none (no code changes — this task is a manual QA checklist against the spec's Verification section).

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the Circle page wheel**

Open `/circle` in the browser and check:
- The wheel renders two concentric rings (outer major, inner relative minor), each of the 24 wedges independently clickable.
- Clicking several major wedges (including sharp/flat ones like F#, C#/Db, G#/Ab) sets that key as tonic, updates the heading, plays a strum, and highlights the tonic wedge plus the other 6 diatonic wedges (a lighter fill) with Roman numerals shown on all diatonic wedges.
- Clicking an inner (minor) wedge sets that note as tonic with mode Minor.
- Toggling the Major/Minor buttons re-roots to the relative key **without moving any wedge** — same angular position, just a different tonic/numeral context.
- Toggling Triads/7ths updates both chip-row subtitles (e.g. `C` → `Cmaj7`, `G` → `G7`) and the selected chord's name/voicing in the detail panel.
- Clicking an "In the Key" chip selects that chord (heading roman-numeral tag, `Fretboard` diagram, voicing browser) without changing the tonic or moving the wheel highlight off the wedge that corresponds to that chip's root+quality.
- Clicking a "Borrowed Chords" chip does the same, and hovering it shows the `why` tooltip; the wheel highlight moves to that borrowed chord's wedge (or shows no extra highlight if it's a chord with no wedge, i.e. none in the current curated lists since none resolve to `dim`).
- The voicing prev/next buttons cycle through alternate shapes and play each one; "+ Progression" and "Explore →" behave as before.
- "Quick Add Progression" preset buttons still add multiple chords to the active saved progression (or show the "no progression saved" toast).

- [ ] **Step 3: Verify the Progressions page wheel**

Open `/progressions`, click "Circle of 5ths" to expand the compact wheel, and check:
- It renders with no numerals (compact mode) and still shows tonic/diatonic highlighting once a key is picked.
- Clicking an outer (major) wedge sets `circleKey` to that note directly.
- Clicking an inner (minor) wedge sets `circleKey` to that note's **relative major** (e.g. clicking the "Am" wedge sets the key to C, not A).
- The chord palette below still filters/highlights diatonic chords correctly for the resulting key, and the "Clear" button still resets `circleKey` to `null`.

- [ ] **Step 4: Final full-project lint check**

Run: `npm run lint`
Expected: no errors.

---

## Self-Review

**Spec coverage:**
- Two-ring wheel (outer major / inner relative minor), radially aligned — Task 2, Step 1. ✅
- Roman numerals baked into the wheel — `wedgeInfo`/`numeral` rendering in Task 2, Step 1. ✅
- Applies everywhere (`Circle.tsx` + `Progressions.tsx`) — Tasks 2 and 3. ✅
- Old Roman-numeral grid removed from `Circle.tsx` — replaced by chip rows in Task 2, Step 2 (no `DIATONIC`/`selectedDegree` remnants). ✅
- Major/Minor toggle re-roots in place without moving wedges — `handleModeToggle` in Task 2, Step 2 changes `tonic`/`mode` only, never wedge geometry. ✅
- Triads/7ths toggle — `sevenths` state, `deg.seventh`/`effectiveBorrowedQuality` in Task 2, Step 2. ✅
- Voicing browser + chord diagram — `voicingIdx`/`allVoicings`/`Fretboard` carried over unchanged in Task 2, Step 2. ✅
- In-key chip row + borrowed chip row with tooltips — Task 2, Step 2 JSX. ✅
- `Progressions.tsx` minor-ring click maps to relative major, no chip rows/numerals added — Task 3. ✅
- Shared theory module (`musicTheory.ts`) as single source of truth — Task 1. ✅
- Verification steps from the spec's Verification section — Task 4. ✅

**Placeholder scan:** no "TBD"/"TODO"/"add error handling" phrases; every step has complete, runnable code. ✅

**Type consistency:** `WedgeQuality`, `DiatonicQuality`, `SeventhQuality`, `DiatonicDegree`, `BorrowedChordDef`, `wedgeInfo`, `wedgeQualityFor`, `chordsForQuality`, `chordLabel`, `effectiveBorrowedQuality`, `diatonicDegrees`, `borrowedChords`, `noteAt`, `displayNote`, `relativeMinorOf`, `relativeMajorOf` are defined once in Task 1 and used with identical names/signatures in Tasks 2 and 3 — no renamed duplicates. ✅
