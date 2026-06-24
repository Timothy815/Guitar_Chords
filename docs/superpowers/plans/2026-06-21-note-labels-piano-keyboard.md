# Note Labels + Piano Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show note name labels on selected frets in Identify mode, and render an SVG piano keyboard below the fretboard in Chord and Identify modes that highlights the exact notes (with correct octaves) being played.

**Architecture:** One 2-line fix to `Fretboard.tsx` for the note labels. A new self-contained `PianoKeyboard` SVG component. Minimal wiring in `Dictionary.tsx` to compute the note list and render the keyboard.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, SVG

## Global Constraints

- No test suite — verification is `npm run lint` (TypeScript type-check) + visual browser check
- `@` path alias resolves to project root; use `../lib/utils` and `../types` style for relative imports inside `src/`
- Tailwind v4 — no config file; use brand CSS variables like `var(--color-brand-active)`, `var(--color-brand-line)`, `var(--color-brand-secondary)`
- `getFretNote(stringIdx, fretIdx)` returns note+octave strings like `"E2"`, `"C#4"` — already respects the globally-set tuning via `setAudioTuning`
- Dark mode is on `document.documentElement.classList` — use explicit white/`#222` fills for piano keys so they look like a real piano in both themes

---

### Task 1: Fix note labels on selected frets in Identify mode

**Files:**
- Modify: `src/components/Fretboard.tsx:60-62`

**Interfaces:**
- Consumes: existing `showNoteNames` prop (defaults to `true`), `noteStr` local variable already set to `getFretNote(stringIdx, fretIdx)` earlier in `renderNoteMarker`
- Produces: no new exports — internal rendering change only

**Context:** In identify mode, `Dictionary.tsx` passes `fingers: [-1,-1,-1,-1,-1,-1]` for the chord shape. Line 61 in `renderNoteMarker` resolves to empty string because `finger === -1` fails the condition. Open strings (fret 0) already show note names at line 65. Only frets > 0 need fixing.

- [ ] **Step 1: Edit `src/components/Fretboard.tsx` line 61**

Replace this single line:
```typescript
         text = (finger !== undefined && finger !== 0 && finger !== -1) ? finger.toString() : "";
```
With:
```typescript
         text = (finger !== undefined && finger !== 0 && finger !== -1)
           ? finger.toString()
           : (showNoteNames ? noteStr.replace(/[0-9]/g, '') : '');
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Visual verify**

```bash
npm run dev
```
Navigate to `/dictionary` → Identify tab → click several frets above fret 0. Each orange dot should now show the note name (e.g., `G`, `C#`) instead of a blank circle.

- [ ] **Step 4: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: show note names on selected frets in identify mode"
```

---

### Task 2: Create PianoKeyboard component

**Files:**
- Create: `src/components/PianoKeyboard.tsx`

**Interfaces:**
- Produces: `PianoKeyboard({ highlightedNotes: string[], className?: string })` — default export from this file; `highlightedNotes` are note+octave strings like `["E2", "G3", "C#4"]`

**Design:** SVG piano spanning C2–B5 (4 octaves = 28 white keys). White keys: 22px wide × 72px tall. Black keys: 14px wide × 44px tall, overlaid on top. Highlighted keys use `var(--color-brand-active)` fill matching the fretboard's selected-note color. Note name label shown on highlighted keys. Faint `C2`/`C3`/… octave markers on un-highlighted C keys for orientation.

- [ ] **Step 1: Create `src/components/PianoKeyboard.tsx`**

```tsx
import React from 'react';
import { cn } from '../lib/utils';

interface PianoKeyboardProps {
  highlightedNotes: string[]; // note+octave strings e.g. ["E2", "G3", "C#4"]
  className?: string;
}

const WK_W = 22;   // white key width
const WK_H = 72;   // white key height
const BK_W = 14;   // black key width
const BK_H = 44;   // black key height
const PAD = 4;
const START_OCT = 2;
const END_OCT = 5;                           // C2..B5, 4 octaves
const NUM_OCTS = END_OCT - START_OCT + 1;   // 4
const TOTAL_W = NUM_OCTS * 7 * WK_W + PAD * 2;
const TOTAL_H = WK_H + PAD * 2;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'] as const;

// x position of black key center, measured in white-key-widths from the octave's C
const BLACK_KEY_OFFSET: Record<string, number> = {
  'C#': 0.65, 'D#': 1.65, 'F#': 3.65, 'G#': 4.65, 'A#': 5.65,
};

const WHITE_NOTE_IDX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

export function PianoKeyboard({ highlightedNotes, className }: PianoKeyboardProps) {
  const highlighted = new Set(highlightedNotes);
  const octaveX = (oct: number) => PAD + (oct - START_OCT) * 7 * WK_W;

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        className="h-24 min-w-[400px] w-full"
        style={{ maxWidth: TOTAL_W }}
      >
        {/* White keys */}
        {Array.from({ length: NUM_OCTS }, (_, i) => START_OCT + i).flatMap(oct =>
          WHITE_NOTES.map(note => {
            const id = `${note}${oct}`;
            const x = octaveX(oct) + WHITE_NOTE_IDX[note] * WK_W;
            const lit = highlighted.has(id);
            return (
              <g key={id}>
                <rect
                  x={x} y={PAD}
                  width={WK_W - 1} height={WK_H}
                  fill={lit ? 'var(--color-brand-active)' : 'white'}
                  stroke="var(--color-brand-line)"
                  strokeWidth={0.5}
                  rx={2}
                />
                {lit && (
                  <text
                    x={x + WK_W / 2} y={PAD + WK_H - 10}
                    textAnchor="middle" fontSize={9} fontWeight="bold" fill="white"
                  >
                    {note}
                  </text>
                )}
                {note === 'C' && !lit && (
                  <text
                    x={x + 2} y={PAD + WK_H - 2}
                    fontSize={6} fill="var(--color-brand-secondary)" opacity={0.4}
                  >
                    C{oct}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Black keys — rendered after white keys so they appear on top */}
        {Array.from({ length: NUM_OCTS }, (_, i) => START_OCT + i).flatMap(oct =>
          BLACK_NOTES.map(note => {
            const id = `${note}${oct}`;
            const x = octaveX(oct) + BLACK_KEY_OFFSET[note] * WK_W - BK_W / 2;
            const lit = highlighted.has(id);
            return (
              <g key={id}>
                <rect
                  x={x} y={PAD}
                  width={BK_W} height={BK_H}
                  fill={lit ? 'var(--color-brand-active)' : '#222'}
                  rx={2}
                />
                {lit && (
                  <text
                    x={x + BK_W / 2} y={PAD + BK_H - 5}
                    textAnchor="middle" fontSize={7} fontWeight="bold" fill="white"
                  >
                    {note}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PianoKeyboard.tsx
git commit -m "feat: add PianoKeyboard SVG component (C2-B5, highlights by octave)"
```

---

### Task 3: Wire PianoKeyboard into Dictionary

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `PianoKeyboard` from `../components/PianoKeyboard`, `getFretNote` already imported from `../lib/audio`
- Produces: piano keyboard rendered below fretboard in chord + identify modes

**Placement:** Inside the existing `print-area` div, after the instruction hint `<p>` and before the arpeggiator/sequencer panels. Wrapped in `print:hidden` so it never prints.

- [ ] **Step 1: Add import to `src/pages/Dictionary.tsx`**

Find the existing component imports block (lines 1–9). Add `PianoKeyboard` import after the `Fretboard` import:

```typescript
import { Fretboard } from '../components/Fretboard';
import { PianoKeyboard } from '../components/PianoKeyboard';
```

- [ ] **Step 2: Compute `pianoNotes` in `src/pages/Dictionary.tsx`**

After line 66 (where `identifiedChordNames` is computed), add:

```typescript
  const activeChordNotes: string[] = mode === 'chords' && activeChord
    ? activeChord.frets
        .map((fret, strIdx) => fret !== -1 ? getFretNote(strIdx, fret) : null)
        .filter((n): n is string => n !== null)
    : [];

  const identifiedNotesWithOctaves: string[] = identifiedFrets
    .map((f, strIdx) => f !== -1 ? getFretNote(strIdx, f) : null)
    .filter((n): n is string => n !== null);

  const pianoNotes = mode === 'chords' ? activeChordNotes : identifiedNotesWithOctaves;
```

- [ ] **Step 3: Render `PianoKeyboard` in `src/pages/Dictionary.tsx`**

Find the hint paragraph (around line 655–657):
```tsx
                  <p className="text-brand-secondary/70 text-sm mt-8 pb-4 print:hidden text-center">
                     Click any dot to hear the note{mode === 'identify' ? ' and set the fret' : ''}, or use keyboard numbers <strong>1-6</strong> to play individual strings.
                  </p>
```

Add the piano keyboard immediately after it:
```tsx
                  {(mode === 'chords' || mode === 'identify') && (
                    <div className="w-full mt-2 print:hidden">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary mb-2 text-center">Piano</p>
                      <PianoKeyboard highlightedNotes={pianoNotes} />
                    </div>
                  )}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Visual verify — Identify mode**

```bash
npm run dev
```
- Go to `/dictionary` → Identify tab
- Click several frets on different strings
- Confirm: each selected fret shows a note label on the fretboard AND the corresponding key on the piano highlights in orange
- Click the same fret again to deselect — piano key should un-highlight

- [ ] **Step 6: Visual verify — Chord mode**

- Switch to Chords tab
- Select a key (e.g., C) and a chord (e.g., C Major)
- Confirm: the piano shows the correct chord tones highlighted (e.g., C3, E3, G3 for an open C Major)
- Switch chord variations — piano should update

- [ ] **Step 7: Visual verify — Scale mode**

- Switch to Scales tab
- Confirm: piano is NOT visible in scale mode

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: show piano keyboard in chord and identify modes"
```
