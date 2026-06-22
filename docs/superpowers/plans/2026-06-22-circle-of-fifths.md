# Circle of Fifths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/circle` page with an interactive SVG Circle of Fifths that lets users click any key to explore its diatonic chords, hear them played, and view fretboard diagrams.

**Architecture:** Three tasks in dependency order — (1) the self-contained SVG circle component, (2) the Circle page composing the circle with a diatonic chord panel, (3) wiring route + nav into App.tsx. No new dependencies; uses existing COMMON_CHORDS, Fretboard, playStrum/initAudio, and React Router.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, SVG, lucide-react, React Router v7, existing `@tonaljs` data via guitarData.ts

## Global Constraints

- No new npm dependencies — use only what's already installed
- `@` alias resolves to project root; use `../lib/utils`, `../types`, `../data/guitarData`, `../components/Fretboard` style for imports inside `src/`
- Tailwind v4: no config file; brand CSS variables only — `var(--color-brand-active)`, `var(--color-brand-surface)`, `var(--color-brand-line)`, `var(--color-brand-ink)`, `var(--color-brand-secondary)`, `var(--color-brand-sidebar)`, `var(--color-brand-fretborder)`
- `BrowserRouter basename="/Guitar_Chords"` — `useNavigate` paths are relative to basename (use `'/dictionary'`, not `'/Guitar_Chords/dictionary'`)
- `initAudio()` must be awaited before every `playStrum` call (browser autoplay policy)
- `COMMON_CHORDS` keys are `Note` type using sharp spellings only: `'C'`, `'C#'`, `'D'`, `'D#'`, `'E'`, `'F'`, `'F#'`, `'G'`, `'G#'`, `'A'`, `'A#'`, `'B'` — never flat strings like `'Db'`
- No test suite — verification is `npm run lint` (TypeScript type-check only) + visual browser check
- The vii° diatonic degree button is always shown but always disabled (no diminished shapes in COMMON_CHORDS)

---

### Task 1: CircleOfFifths SVG Component

**Files:**
- Create: `src/components/CircleOfFifths.tsx`

**Interfaces:**
- Consumes: `Note` from `../types`, `cn` from `../lib/utils`
- Produces: `export function CircleOfFifths({ selectedKey, onKeySelect, className }: CircleOfFifthsProps)` — used by Task 2

---

- [ ] **Step 1: Create `src/components/CircleOfFifths.tsx`**

```tsx
import React from 'react';
import { Note } from '../types';
import { cn } from '../lib/utils';

interface CircleOfFifthsProps {
  selectedKey: Note | null;
  onKeySelect: (key: Note) => void;
  className?: string;
}

const CX = 200, CY = 200;
const OUTER_R = 175, INNER_R = 60;
const TEXT_MAJOR_R = 135, TEXT_MINOR_R = 103, TEXT_SIG_R = 80;

// Clockwise from top (C at 12 o'clock), in fifths.
// `note` is the Note (sharp) spelling used for COMMON_CHORDS lookups.
// `display` is the conventional label shown on the wedge.
const CIRCLE_DATA = [
  { note: 'C'  as Note, display: 'C',      minor: 'Am',  keySig: '0'  },
  { note: 'G'  as Note, display: 'G',      minor: 'Em',  keySig: '1♯' },
  { note: 'D'  as Note, display: 'D',      minor: 'Bm',  keySig: '2♯' },
  { note: 'A'  as Note, display: 'A',      minor: 'F#m', keySig: '3♯' },
  { note: 'E'  as Note, display: 'E',      minor: 'C#m', keySig: '4♯' },
  { note: 'B'  as Note, display: 'B',      minor: 'G#m', keySig: '5♯' },
  { note: 'F#' as Note, display: 'F#/Gb',  minor: 'D#m', keySig: '6♯' },
  { note: 'C#' as Note, display: 'Db',     minor: 'Bbm', keySig: '5♭' },
  { note: 'G#' as Note, display: 'Ab',     minor: 'Fm',  keySig: '4♭' },
  { note: 'D#' as Note, display: 'Eb',     minor: 'Cm',  keySig: '3♭' },
  { note: 'A#' as Note, display: 'Bb',     minor: 'Gm',  keySig: '2♭' },
  { note: 'F'  as Note, display: 'F',      minor: 'Dm',  keySig: '1♭' },
];

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polar(r: number, angleDeg: number) {
  return {
    x: CX + r * Math.cos(toRad(angleDeg)),
    y: CY + r * Math.sin(toRad(angleDeg)),
  };
}

// SVG arc path for one wedge segment at index i (0-11).
function wedgePath(i: number): string {
  const gap = 1.5; // degrees of gap between wedges
  const s = i * 30 - 90 + gap / 2;
  const e = (i + 1) * 30 - 90 - gap / 2;
  const p1 = polar(OUTER_R, s);
  const p2 = polar(OUTER_R, e);
  const p3 = polar(INNER_R, e);
  const p4 = polar(INNER_R, s);
  return (
    `M ${p1.x} ${p1.y} ` +
    `A ${OUTER_R} ${OUTER_R} 0 0 1 ${p2.x} ${p2.y} ` +
    `L ${p3.x} ${p3.y} ` +
    `A ${INNER_R} ${INNER_R} 0 0 0 ${p4.x} ${p4.y} Z`
  );
}

// (x,y) of the midpoint of wedge i at radius r.
function textAt(r: number, i: number) {
  const mid = i * 30 - 90 + 15;
  return polar(r, mid);
}

export function CircleOfFifths({ selectedKey, onKeySelect, className }: CircleOfFifthsProps) {
  return (
    <div className={cn('w-full max-w-sm mx-auto', className)}>
      <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-md">
        {CIRCLE_DATA.map((entry, i) => {
          const isSelected = selectedKey === entry.note;
          const tMajor = textAt(TEXT_MAJOR_R, i);
          const tMinor = textAt(TEXT_MINOR_R, i);
          const tSig   = textAt(TEXT_SIG_R, i);
          // F#/Gb label is long — use a smaller font
          const majorFontSize = entry.display.length > 2 ? 9 : 13;
          return (
            <g
              key={entry.note}
              onClick={() => onKeySelect(entry.note)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={wedgePath(i)}
                fill={isSelected ? 'var(--color-brand-active)' : 'var(--color-brand-surface)'}
                stroke="var(--color-brand-line)"
                strokeWidth={1}
              />
              {/* Major key name */}
              <text
                x={tMajor.x} y={tMajor.y + 5}
                textAnchor="middle"
                fontSize={majorFontSize}
                fontWeight="bold"
                fill={isSelected ? 'white' : 'var(--color-brand-ink)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.display}
              </text>
              {/* Relative minor */}
              <text
                x={tMinor.x} y={tMinor.y + 4}
                textAnchor="middle"
                fontSize={8}
                fill={isSelected ? 'rgba(255,255,255,0.85)' : 'var(--color-brand-secondary)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.minor}
              </text>
              {/* Key signature */}
              <text
                x={tSig.x} y={tSig.y + 3}
                textAnchor="middle"
                fontSize={7}
                fill={isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-brand-secondary)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.keySig}
              </text>
            </g>
          );
        })}
        {/* Decorative center circle */}
        <circle cx={CX} cy={CY} r={55} fill="var(--color-brand-fretborder)" opacity={0.25} />
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

- [ ] **Step 2: Run lint**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```

Expected: no new errors (there are 4 pre-existing errors in `guitarData.ts`, `Caged.tsx`, `Dictionary.tsx` — those are fine to ignore).

- [ ] **Step 3: Commit**

```bash
git add src/components/CircleOfFifths.tsx
git commit -m "feat: add CircleOfFifths SVG component"
```

---

### Task 2: Circle Page with Diatonic Chord Panel

**Files:**
- Create: `src/pages/Circle.tsx`

**Interfaces:**
- Consumes:
  - `CircleOfFifths` from `../components/CircleOfFifths` (Task 1)
  - `Fretboard` from `../components/Fretboard`
  - `Note`, `ChordShape` from `../types`
  - `ALL_NOTES`, `COMMON_CHORDS` from `../data/guitarData`
  - `playStrum`, `initAudio`, `getFretNote` from `../lib/audio`
  - `useNavigate` from `react-router-dom`
  - `ExternalLink` from `lucide-react`
  - `cn` from `../lib/utils`
- Produces: `export function Circle()` — used by Task 3

---

- [ ] **Step 1: Create `src/pages/Circle.tsx`**

```tsx
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
```

- [ ] **Step 2: Run lint**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```

Expected: no new errors beyond the 4 pre-existing ones.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Circle.tsx
git commit -m "feat: add Circle of Fifths page with diatonic chord panel"
```

---

### Task 3: Route and Nav Integration

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Circle` from `./pages/Circle` (Task 2)
- Produces: `/circle` route live in the app, "Circle of 5ths" nav link visible in header

---

- [ ] **Step 1: Edit `src/App.tsx` — add import and nav link**

Find this block at the top of the file:

```tsx
import { Music, Calendar, BookOpen, Sun, Moon } from 'lucide-react';
```

Replace with:

```tsx
import { Music, Calendar, BookOpen, Sun, Moon, Disc } from 'lucide-react';
```

Find the nav block (around line 33–51):

```tsx
            <nav className="flex gap-1">
              <NavLink 
                to="/dictionary" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <BookOpen size={16} /> Dictionary
              </NavLink>
              <NavLink 
                to="/caged" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Music size={16} /> CAGED System
              </NavLink>
              <NavLink 
                to="/progressions" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Calendar size={16} /> Practice
              </NavLink>
            </nav>
```

Replace with:

```tsx
            <nav className="flex gap-1">
              <NavLink 
                to="/dictionary" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <BookOpen size={16} /> Dictionary
              </NavLink>
              <NavLink 
                to="/caged" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Music size={16} /> CAGED System
              </NavLink>
              <NavLink 
                to="/circle" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Disc size={16} /> Circle of 5ths
              </NavLink>
              <NavLink 
                to="/progressions" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Calendar size={16} /> Practice
              </NavLink>
            </nav>
```

- [ ] **Step 2: Edit `src/App.tsx` — add Circle import and route**

Find:

```tsx
import { Caged } from './pages/Caged';
```

Replace with:

```tsx
import { Caged } from './pages/Caged';
import { Circle } from './pages/Circle';
```

Find:

```tsx
          <Route path="/caged" element={<Caged />} />
```

Replace with:

```tsx
          <Route path="/caged" element={<Caged />} />
          <Route path="/circle" element={<Circle />} />
```

- [ ] **Step 3: Run lint**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run lint
```

Expected: no new errors beyond the 4 pre-existing ones.

- [ ] **Step 4: Visual verify in browser**

```bash
cd /Users/timothykoerner/Desktop/Guitar_Master && npm run dev
```

Check these in order:
1. "Circle of 5ths" nav link appears in the header between "CAGED System" and "Practice"
2. Clicking it navigates to `/circle` — page title "Circle of Fifths" is visible
3. SVG circle renders with 12 wedges; C is at top, letters/relative-minors/key-sigs are legible
4. Clicking a wedge (e.g. G) highlights it in the active color and updates the chord panel heading to "G Major"
5. The 7 Roman numeral buttons appear (I through vii°); vii° is grayed out and unclickable
6. Clicking "I" plays a chord and shows a fretboard diagram below the buttons with the chord name above it
7. Clicking "ii" plays a minor chord and shows its diagram (button highlight changes)
8. Clicking a different wedge (e.g. Db) clears the selected degree and updates the panel to "Db Major"
9. Diatonic chord roots update to match the new key (e.g. Db, Eb, F, Gb, Ab, Bb, C)
10. "View in Dictionary" link navigates to `/dictionary`
11. Dark mode toggle — circle wedges, text, and chord panel all render correctly in both themes

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire Circle of Fifths route and nav link"
```
