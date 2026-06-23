# Chord Sheet Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a printable chord sheet to the Progressions page showing a fretboard-diagram grid (with VexFlow staff + tab) and/or a bar-by-bar lead chart, controlled by toggles in a print modal.

**Architecture:** A new `ChordCard` component renders each unique chord's fretboard + VexFlow staff + tab. A new `ChordSheet` component composes the diagram grid and lead chart. `Progressions.tsx` renders `ChordSheet` in an off-screen div for printing and again inside a modal for live preview. The existing `handlePrint` utility is used unchanged.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4, VexFlow (new dependency), existing `Fretboard` component, existing `handlePrint` utility.

## Global Constraints

- No new routes; all rendering stays within `src/pages/Progressions.tsx` and two new component files
- VexFlow renders into a `div` ref via `useEffect`; no SSR
- Key signature auto-derived from `progression.key` — no user picker for key
- Time signature: fixed 4/4, no UI to change it
- Lead chart: one chord per bar, 4 bars per line via CSS grid `grid-cols-4`
- Chord cards: deduplicated by `chord.name`; each unique chord appears once
- All modal and toggle UI is `print:hidden`; only the sheet itself prints
- Existing `Print` button and `handlePrint('print-area')` call are unchanged
- Guitar notation transposes one octave up (concert pitch + 12 semitones) for treble clef readability
- VexFlow tab string numbering: 1 = high e, 6 = low E (opposite of app convention: 0 = low E)
- `npm run lint` must pass after every task

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `key: string` to `Progression` |
| Modify | `src/pages/Progressions.tsx` | Persist key, add modal state, add ChordSheet off-screen div and modal |
| Modify | `vite.config.ts` | Add VexFlow to `optimizeDeps.include` |
| Create | `src/components/ChordCard.tsx` | Single chord: name + Fretboard + VexFlow staff + tab |
| Create | `src/components/ChordSheet.tsx` | Diagram grid (ChordCard[]) + lead chart; exported for use in Progressions |

---

## Task 1: Add `key` to `Progression` and wire it in Progressions.tsx

**Files:**
- Modify: `src/types.ts:51-56`
- Modify: `src/pages/Progressions.tsx` (multiple sites — all listed below)

**Interfaces:**
- Produces: `Progression.key: string` — used in Tasks 3 and 4

- [ ] **Step 1: Add `key` field to `Progression` in `src/types.ts`**

Replace lines 51–56:

```typescript
export interface Progression {
  id: string;
  name: string;
  bpm: number;    // default 80, range 40–200
  key: string;   // root note, e.g. "C", "G", "F#" — defaults to "C"
  slots: ChordSlot[];
}
```

- [ ] **Step 2: Add `PRESET_KEYS` map in `src/pages/Progressions.tsx`**

Add after the `getDiatonicRoots` function (after line 18):

```typescript
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
```

- [ ] **Step 3: Update migration code in the `useEffect` (around line 487)**

Replace the migrated map callback:

```typescript
const migrated = parsed.map((p: any) => {
  if (p.chords && !p.slots) {
    return { ...p, slots: p.chords.map((chord: ChordShape) => ({ chord })), bpm: p.bpm ?? 80, key: p.key ?? 'C' };
  }
  return { ...p, bpm: p.bpm ?? 80, key: p.key ?? 'C' };
});
```

- [ ] **Step 4: Add `key: 'C'` to the default progression in the same `useEffect`**

```typescript
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
```

- [ ] **Step 5: Add `key` to `createProgression`**

```typescript
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
```

- [ ] **Step 6: Add `key` to `loadPreset`**

Inside `loadPreset`, replace the `newProg` object literal:

```typescript
const newProg: Progression = {
  id: Date.now().toString() + Math.random().toString(),
  name: presetName,
  bpm: 80,
  key: PRESET_KEYS[presetName] ?? 'C',
  slots: presetChords.filter(Boolean).map(chord => ({ chord }))
};
```

- [ ] **Step 7: Add `key` to `parseProgressionJSON`**

Replace the `progression` object inside the return statement (around line 100–105):

```typescript
progression: {
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  name: typeof data.name === 'string' ? data.name : 'Imported Progression',
  bpm: typeof data.bpm === 'number' ? Math.min(200, Math.max(40, Math.round(data.bpm))) : 80,
  key: typeof data.key === 'string' ? data.key : 'C',
  slots,
},
```

- [ ] **Step 8: Sync `chordPaletteKey` when active progression changes**

Add a new `useEffect` after the existing load effect (after line 508):

```typescript
useEffect(() => {
  if (activeProgression?.key) {
    setChordPaletteKey(activeProgression.key);
  }
}, [activeProgId]);
```

- [ ] **Step 9: Persist key when palette key button is clicked (around line 927)**

Replace the `onClick` on the key button:

```typescript
onClick={() => {
  setChordPaletteKey(key);
  if (activeProgression) {
    saveProgressions(progressions.map(p =>
      p.id === activeProgression.id ? { ...p, key } : p
    ));
  }
}}
```

- [ ] **Step 10: Persist key when Circle of Fifths key is selected (around line 912-915)**

Replace the `onKeySelect` handler:

```typescript
onKeySelect={(key) => {
  setCircleKey(key);
  setChordPaletteKey(key);
  if (activeProgression) {
    saveProgressions(progressions.map(p =>
      p.id === activeProgression.id ? { ...p, key } : p
    ));
  }
}}
```

- [ ] **Step 11: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/types.ts src/pages/Progressions.tsx
git commit -m "feat: persist key on Progression type, sync with palette selector"
```

---

## Task 2: Install VexFlow and create `ChordCard.tsx`

**Files:**
- Modify: `vite.config.ts`
- Create: `src/components/ChordCard.tsx`

**Interfaces:**
- Consumes: `ChordShape` from `src/types.ts`, `Fretboard` from `src/components/Fretboard.tsx`, `getFretNote` from `src/lib/audio.ts`
- Produces: `export function ChordCard({ chord, progressionKey }: ChordCardProps)` — used by `ChordSheet` in Task 3

- [ ] **Step 1: Install VexFlow**

```bash
npm install vexflow
```

Expected: `vexflow` appears in `package.json` dependencies.

- [ ] **Step 2: Add VexFlow to Vite's `optimizeDeps`**

In `vite.config.ts`, add `optimizeDeps` to the returned config object:

```typescript
export default defineConfig(() => {
  return {
    base: '/Guitar_Chords/',
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['vexflow'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

- [ ] **Step 3: Create `src/components/ChordCard.tsx`**

```typescript
import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, TabStave, TabNote, Voice, Formatter, Accidental } from 'vexflow';
import { ChordShape } from '../types';
import { Fretboard } from './Fretboard';
import { getFretNote } from '../lib/audio';

interface ChordCardProps {
  chord: ChordShape;
  progressionKey: string;
}

// Maps our sharp-only root notes to VexFlow key signature strings
const SHARP_TO_VEX_KEY: Record<string, string> = {
  'C': 'C', 'C#': 'Db', 'D': 'D', 'D#': 'Eb', 'E': 'E',
  'F': 'F', 'F#': 'F#', 'G': 'G', 'G#': 'Ab', 'A': 'A',
  'A#': 'Bb', 'B': 'B',
};

// Converts 'C#4' → 'c#/5' (adds 1 octave for guitar treble clef transposition)
function toVexStaffKey(noteStr: string): string {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return 'c/4';
  return `${match[1].toLowerCase()}/${parseInt(match[2]) + 1}`;
}

export function ChordCard({ chord, progressionKey }: ChordCardProps) {
  const vexRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = vexRef.current;
    if (!div) return;
    div.innerHTML = '';

    // Collect sounding strings: fret >= 0, not muted (-1)
    const sounding = chord.frets
      .map((fret, stringIdx) => ({ fret, stringIdx }))
      .filter(({ fret }) => fret >= 0);

    if (sounding.length === 0) return;

    // Build note arrays
    const staffKeys = sounding.map(({ fret, stringIdx }) =>
      toVexStaffKey(getFretNote(stringIdx, fret))
    );
    // Sort ascending by octave then note for correct chord voicing display
    staffKeys.sort((a, b) => {
      const [na, oa] = a.split('/');
      const [nb, ob] = b.split('/');
      return parseInt(oa) !== parseInt(ob)
        ? parseInt(oa) - parseInt(ob)
        : na.localeCompare(nb);
    });

    // VexFlow tab: str 1=high e, 6=low E; convert from our 0=low E convention
    const tabPositions = sounding.map(({ fret, stringIdx }) => ({
      str: 6 - stringIdx,
      fret: fret,
    }));

    const W = 260;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, 160);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    // Standard notation stave
    const vexKey = SHARP_TO_VEX_KEY[progressionKey] ?? 'C';
    const stave = new Stave(5, 5, W - 15);
    stave.addClef('treble').addKeySignature(vexKey);
    stave.setContext(ctx).draw();

    const staveNote = new StaveNote({ keys: staffKeys, duration: 'w' });
    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    voice.setStrict(false);
    voice.addTickables([staveNote]);
    Accidental.applyAccidentals([voice], vexKey);
    new Formatter().joinVoices([voice]).format([voice], W - 50);
    voice.draw(ctx, stave);

    // Tab stave
    const tabStave = new TabStave(5, 90, W - 15);
    tabStave.addClef('tab');
    tabStave.setContext(ctx).draw();

    const tabNote = new TabNote({ positions: tabPositions, duration: 'w' });
    const tabVoice = new Voice({ num_beats: 4, beat_value: 4 });
    tabVoice.setStrict(false);
    tabVoice.addTickables([tabNote]);
    new Formatter().joinVoices([tabVoice]).format([tabVoice], W - 50);
    tabVoice.draw(ctx, tabStave);
  }, [chord, progressionKey]);

  const maxFret = Math.max(...chord.frets.filter(f => f >= 0));
  const displayFrets = Math.max(5, maxFret <= 5 ? 5 : maxFret + 1);

  return (
    <div className="flex flex-col items-center border border-brand-line rounded-lg p-3 bg-white print:border-gray-300 break-inside-avoid">
      <h3 className="font-serif font-bold text-brand-ink text-base mb-2 text-center print:text-black">
        {chord.name.split('(')[0].trim()}
      </h3>
      <Fretboard
        fretsNum={displayFrets}
        chord={chord}
        showNoteNames={false}
        className="pointer-events-none w-full"
      />
      <div ref={vexRef} className="w-full overflow-hidden" style={{ height: 160 }} />
    </div>
  );
}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify a chord card renders**

```bash
npm run dev
```

Open the Progressions page. Confirm no console errors about VexFlow. Lint passing is the primary check here since VexFlow renders at runtime.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts src/components/ChordCard.tsx package.json package-lock.json
git commit -m "feat: add ChordCard component with VexFlow staff and tab notation"
```

---

## Task 3: Create `ChordSheet.tsx`

**Files:**
- Create: `src/components/ChordSheet.tsx`

**Interfaces:**
- Consumes: `ChordCard` from Task 2, `Progression` (with `key` field) from Task 1
- Produces: `export function ChordSheet({ progression, showDiagrams, showChart }: ChordSheetProps)` — used in Task 4

- [ ] **Step 1: Create `src/components/ChordSheet.tsx`**

```typescript
import React from 'react';
import { Progression, ChordShape } from '../types';
import { ChordCard } from './ChordCard';

interface ChordSheetProps {
  progression: Progression;
  showDiagrams: boolean;
  showChart: boolean;
}

export function ChordSheet({ progression, showDiagrams, showChart }: ChordSheetProps) {
  // Deduplicate chords by name, preserving first occurrence order
  const uniqueChords: ChordShape[] = [];
  const seen = new Set<string>();
  for (const slot of progression.slots) {
    if (!seen.has(slot.chord.name)) {
      seen.add(slot.chord.name);
      uniqueChords.push(slot.chord);
    }
  }

  return (
    <div className="font-sans text-black p-6 print:p-0 space-y-8">
      <h1 className="text-2xl font-serif font-bold text-center border-b-2 border-black pb-3">
        {progression.name || 'Untitled Progression'}
      </h1>

      {showDiagrams && uniqueChords.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
            Chord Reference
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {uniqueChords.map(chord => (
              <ChordCard
                key={chord.name}
                chord={chord}
                progressionKey={progression.key ?? 'C'}
              />
            ))}
          </div>
        </section>
      )}

      {showChart && progression.slots.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Lead Chart — Key of {progression.key ?? 'C'}
            </h2>
            <span className="text-xl font-serif font-bold text-gray-700">4/4</span>
          </div>
          <LeadChart progression={progression} />
        </section>
      )}
    </div>
  );
}

function LeadChart({ progression }: { progression: Progression }) {
  return (
    <div className="grid grid-cols-4 border-t-2 border-l-2 border-black">
      {progression.slots.map((slot, i) => {
        const chordLabel = slot.chord.name.split('(')[0].trim();
        return (
          <div
            key={i}
            className="border-r-2 border-b-2 border-black p-3 min-h-[80px] flex flex-col"
          >
            {i === 0 && (
              <span className="text-[10px] text-gray-400 mb-1 leading-none">
                Key of {progression.key ?? 'C'}
              </span>
            )}
            <span className="font-serif text-xl font-bold leading-tight">{chordLabel}</span>
            <div className="mt-auto flex gap-3 pt-2">
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
            </div>
          </div>
        );
      })}
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
git add src/components/ChordSheet.tsx
git commit -m "feat: add ChordSheet component with diagram grid and lead chart"
```

---

## Task 4: Wire chord sheet modal into `Progressions.tsx`

**Files:**
- Modify: `src/pages/Progressions.tsx`

**Interfaces:**
- Consumes: `ChordSheet` from Task 3, `handlePrint` from `src/lib/utils.ts`

- [ ] **Step 1: Add imports to `Progressions.tsx`**

Add `ChordSheet` and `FileText` imports. Replace the existing import lines:

```typescript
import { Plus, Trash2, Play, Printer, Disc, GripHorizontal, Square, RotateCcw, Pencil, X, Upload, FileText } from 'lucide-react';
```

And add after the existing component imports (after the `CircleOfFifths` import line):

```typescript
import { ChordSheet } from '../components/ChordSheet';
```

- [ ] **Step 2: Add modal state to the `Progressions` component**

Add three state variables after the existing `showImportModal` state (around line 479):

```typescript
const [showChordSheetModal, setShowChordSheetModal] = useState(false);
const [showDiagrams, setShowDiagrams] = useState(true);
const [showChart, setShowChart] = useState(true);
```

- [ ] **Step 3: Add the `ChordSheetModal` component**

Add this as a new function component inside `Progressions.tsx`, directly above the `Progressions` function (after `ImportProgressionModal`):

```typescript
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
  const bothOn = showDiagrams && showChart;

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
            onClick={() => { handlePrint('chord-sheet-area'); onClose(); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

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
          'relative w-10 h-6 rounded-full transition-colors focus:outline-none',
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
```

- [ ] **Step 4: Add the "Chord Sheet" button next to the existing Print button**

In the `print:hidden` toolbar area (around line 783, next to the `<Printer>` Print button), add the new button immediately before it:

```tsx
<button
  onClick={() => setShowChordSheetModal(true)}
  className="flex items-center gap-2 px-4 py-2 bg-transparent text-brand-ink border border-brand-line font-medium rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors"
>
  <FileText size={18} /> Chord Sheet
</button>
```

- [ ] **Step 5: Render the off-screen `chord-sheet-area` div**

Add the following immediately after the closing `</div>` of `print-area` (after line 955, before `</div>` of `lg:col-span-3`):

```tsx
{/* Off-screen chord sheet for printing — positioned outside viewport, not display:none */}
{activeProgression && (
  <div
    id="chord-sheet-area"
    style={{ position: 'absolute', left: '-9999px', top: 0, width: '850px', overflow: 'hidden' }}
    aria-hidden="true"
  >
    <ChordSheet
      progression={activeProgression}
      showDiagrams={showDiagrams}
      showChart={showChart}
    />
  </div>
)}
```

- [ ] **Step 6: Render the modal**

Add the `ChordSheetModal` inside the component's return JSX, alongside the existing `ImportProgressionModal` (after line 664):

```tsx
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
```

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 8: Start dev server and test the full flow**

```bash
npm run dev
```

Test checklist:
1. Open Progressions page — existing Print button still works (prints chord cards)
2. Click "Chord Sheet" button — modal opens with live preview
3. Toggle "Chord Diagrams" off — only lead chart shows in preview and toggles back on
4. Toggle "Lead Chart" off — only diagrams show in preview; disabled toggle can't turn off last section
5. Click Print in modal — browser print dialog opens; printed output shows chord diagrams (with fretboard + staff + tab) and/or lead chart
6. Switch between progressions — chord palette key updates to match each progression's key

- [ ] **Step 9: Commit**

```bash
git add src/pages/Progressions.tsx
git commit -m "feat: add chord sheet print modal with diagram grid and lead chart"
```

- [ ] **Step 10: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ `key` persisted on `Progression` — Task 1
- ✅ `ChordCard`: name + Fretboard + VexFlow staff + tab — Task 2
- ✅ Key signature auto from `progression.key`, fixed 4/4 — Tasks 2 + 3
- ✅ Guitar octave transposition (+1 octave for treble clef) — Task 2
- ✅ Tab string numbering conversion (VexFlow 1–6, app 0–5) — Task 2
- ✅ Chord cards deduplicated by `chord.name` — Task 3
- ✅ Lead chart: one chord per bar, 4 bars per line — Task 3
- ✅ Modal with toggle switches enforcing at least one section on — Task 4
- ✅ Live preview in modal — Task 4
- ✅ Off-screen div for print (not `display:none`) — Task 4
- ✅ Existing Print button unchanged — Task 4 (new button added, old untouched)
- ✅ All modal UI `print:hidden` — chord sheet area is off-screen, not in print-area

**Type consistency:**
- `ChordSheetProps.progression: Progression` — `Progression` has `key` after Task 1 ✅
- `ChordCardProps.chord: ChordShape`, `progressionKey: string` — consumed by `ChordSheet` in Task 3 ✅
- `ChordSheet` export consumed by `Progressions.tsx` in Task 4 ✅
