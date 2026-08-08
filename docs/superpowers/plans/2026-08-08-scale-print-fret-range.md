# Scale Print Fret Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Dictionary → Scales → Full-neck fretboard view so the screen shows all 22 fret labels and remains scrollable, while printing lets the user pick an explicit fret range (up to 15 frets) at print time and renders exactly that range with nothing cut off.

**Architecture:** Replace a hardcoded `12`-fret cap inside `Fretboard.tsx` (which today clips both screen labels and printed output) with a shared `PRINT_FRET_CAP = 15` used only for print sizing. Add a new `PrintFretRangeDialog` modal. Wire it into `Dictionary.tsx` so the existing "Print Diagram" button, when the Scales tab is in `'full'` view, opens the dialog instead of printing immediately; on confirm, a second print-only `<Fretboard>` sized exactly to the chosen range is rendered (`hidden print:block`) alongside the interactive one, and the existing `handlePrint()` clone-and-print flow runs against it.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (Vite plugin, no config file), existing `lib/utils.ts` `handlePrint`.

## Global Constraints

- No test framework exists in this repo. `npm run lint` (`tsc --noEmit`) is the only static check — run it after every code change instead of a test command.
- Do not touch print behavior on any tab/page other than Dictionary → Scales → Full view (Chords tab, Identify mode, CAGED, Scale Positions, Progressions chord sheets stay exactly as they are today).
- `@` path alias resolves to the project root, not `src/` — use relative imports (`../components/...`) inside `src/`, matching existing files.
- Follow the existing brand token / `cn()` class-merging conventions already used throughout the codebase; don't introduce new ad-hoc colors.

---

## 1. `src/components/Fretboard.tsx`

**Responsibility:** Fix the screen/print label caps and the print-width clipping that currently both cut off content beyond fret 12.

## 2. `src/components/PrintFretRangeDialog.tsx` (new)

**Responsibility:** Self-contained modal that collects and validates a `[start, end]` fret range and reports it back via `onConfirm`.

## 3. `src/pages/Dictionary.tsx`

**Responsibility:** Wire the dialog into the Scales tab's "Print Diagram" button, add print-only-range state, and render a second, exactly-sized `<Fretboard>` instance for print.

---

### Task 1: Fix `Fretboard.tsx` label/print-width caps

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: nothing new — no prop or signature changes to `Fretboard`.
- Produces: a new module-level constant `PRINT_FRET_CAP = 15`, used internally only. No public API change; `Fretboard`'s existing `fretsNum`/`startFret`/`fretRange` props already do what Task 3 needs.

- [ ] **Step 1: Add the `PRINT_FRET_CAP` constant**

In `src/components/Fretboard.tsx`, right after the existing `INTERVAL_NAMES` constant (currently line 10), add:

```typescript
// Max frets guaranteed to fit legibly on one printed page.
const PRINT_FRET_CAP = 15;
```

- [ ] **Step 2: Base `printMaxWidth` on `fretsNum`, not a hardcoded 12**

Find this block (currently around line 341-342):

```typescript
  // For print mode, limit to 12 frets since patterns repeat
  const printMaxWidth = paddingX * 2 + fretSpacing * 12;
```

Replace with:

```typescript
  // Print output is capped at PRINT_FRET_CAP frets so labels/dots stay legible on one page.
  const printMaxWidth = paddingX * 2 + fretSpacing * Math.min(fretsNum, PRINT_FRET_CAP);
```

- [ ] **Step 3: Uncap the screen-only SVG fret-number labels**

Find this block (currently around line 569-570):

```typescript
        {/* Fret numbers — screen only (limit to 12 frets for print compatibility) */}
        {Array.from({ length: Math.min(fretsNum, 12) }).map((_, i) => {
```

Replace with:

```typescript
        {/* Fret numbers — screen only. This block already carries print:hidden below, so it never affects print output. */}
        {Array.from({ length: fretsNum }).map((_, i) => {
```

(The rest of that block, including the `print:hidden` class on the rendered `<text>`, is unchanged.)

- [ ] **Step 4: Cap the print-only HTML fret-number labels at `PRINT_FRET_CAP`, not 12**

Find this block (currently around line 611-619):

```typescript
      {/* Fret numbers for print — HTML so they render at full CSS size (limit to 12 frets) */}
      <div
        className="hidden print:flex text-[9px] font-mono text-gray-600"
        style={{ paddingLeft: `${(paddingX / printMaxWidth) * 100}%`, paddingRight: `${(paddingX / printMaxWidth) * 100}%` }}
      >
        {Array.from({ length: Math.min(fretsNum, 12) }).map((_, i) => (
          <div key={i} className="flex-1 text-center">{startFret === 0 ? i + 1 : startFret + i}</div>
        ))}
      </div>
```

Replace the `Math.min(fretsNum, 12)` with `Math.min(fretsNum, PRINT_FRET_CAP)`:

```typescript
      {/* Fret numbers for print — HTML so they render at full CSS size (capped at PRINT_FRET_CAP frets) */}
      <div
        className="hidden print:flex text-[9px] font-mono text-gray-600"
        style={{ paddingLeft: `${(paddingX / printMaxWidth) * 100}%`, paddingRight: `${(paddingX / printMaxWidth) * 100}%` }}
      >
        {Array.from({ length: Math.min(fretsNum, PRINT_FRET_CAP) }).map((_, i) => (
          <div key={i} className="flex-1 text-center">{startFret === 0 ? i + 1 : startFret + i}</div>
        ))}
      </div>
```

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification — screen labels**

Run: `npm run dev`. Open the app, go to **Dictionary → Scales**, pick any key/scale, switch the view mode to **Full**. Confirm fret-number labels `1` through `22` are all visible under the fretboard and the fretboard area still scrolls horizontally. Also spot check a 12-or-fewer-fret view (e.g. a CAGED box position) still shows the correct labels for its own range — this step's change must not alter anything there since `fretsNum` there is already ≤ 12.

- [ ] **Step 7: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "$(cat <<'EOF'
fix: restore full 1-22 fret labels on screen, decouple print width cap

Screen fret-number labels were capped at 12 by a recent print fix, even
though that block is print:hidden and the cap served no print purpose.
Also switch the print-width clipping from a hardcoded 12 to a shared
PRINT_FRET_CAP (15), based on the actual fretsNum instead of ignoring it.
EOF
)"
```

---

### Task 2: Create `PrintFretRangeDialog.tsx`

**Files:**
- Create: `src/components/PrintFretRangeDialog.tsx`

**Interfaces:**
- Consumes: `lucide-react`'s `X` icon (already a dependency, used elsewhere for modal close buttons — see `src/pages/Progressions.tsx`); `cn` from `../lib/utils`.
- Produces:
  ```typescript
  export interface PrintFretRangeDialogProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: (start: number, end: number) => void;
    defaultStart?: number; // default 0
    defaultEnd?: number;   // default 12
    maxFret?: number;      // default 22
    maxSpan?: number;      // default 15
  }
  export function PrintFretRangeDialog(props: PrintFretRangeDialogProps): JSX.Element | null
  ```
  Task 3 imports `{ PrintFretRangeDialog }` from `'../components/PrintFretRangeDialog'` and uses exactly this prop shape.

- [ ] **Step 1: Write the component**

Create `src/components/PrintFretRangeDialog.tsx`:

```typescript
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PrintFretRangeDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (start: number, end: number) => void;
  defaultStart?: number;
  defaultEnd?: number;
  maxFret?: number;
  maxSpan?: number;
}

export function PrintFretRangeDialog({
  isOpen,
  onCancel,
  onConfirm,
  defaultStart = 0,
  defaultEnd = 12,
  maxFret = 22,
  maxSpan = 15,
}: PrintFretRangeDialogProps) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  if (!isOpen) return null;

  const errors: string[] = [];
  if (Number.isNaN(start) || start < 0 || start > maxFret) {
    errors.push(`Start fret must be between 0 and ${maxFret}.`);
  }
  if (Number.isNaN(end) || end <= start || end > maxFret) {
    errors.push(`End fret must be greater than start and no more than ${maxFret}.`);
  }
  if (!Number.isNaN(start) && !Number.isNaN(end) && end - start > maxSpan) {
    errors.push(`Range can't exceed ${maxSpan} frets (so labels stay legible on one page).`);
  }
  const isValid = errors.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-brand-surface rounded-xl border border-brand-line shadow-xl w-full max-w-sm space-y-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">Print Fret Range</h2>
          <button onClick={onCancel} className="text-brand-secondary hover:text-brand-ink">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-brand-secondary">
          Choose the fret range to print. Up to {maxSpan} frets fit legibly on one page.
        </p>

        <div className="flex items-center gap-3">
          <label className="flex-1 text-sm text-brand-ink">
            Start Fret
            <input
              type="number"
              value={start}
              min={0}
              max={maxFret}
              onChange={e => setStart(parseInt(e.target.value, 10))}
              className="mt-1 w-full font-mono text-sm p-2 rounded-lg border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
            />
          </label>
          <label className="flex-1 text-sm text-brand-ink">
            End Fret
            <input
              type="number"
              value={end}
              min={0}
              max={maxFret}
              onChange={e => setEnd(parseInt(e.target.value, 10))}
              className="mt-1 w-full font-mono text-sm p-2 rounded-lg border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
            />
          </label>
        </div>

        {errors.length > 0 && (
          <p className="text-xs text-red-500">{errors[0]}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-brand-line text-brand-ink hover:border-brand-primary/60 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => isValid && onConfirm(start, end)}
            disabled={!isValid}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
              isValid
                ? 'bg-brand-primary text-white hover:opacity-90'
                : 'bg-brand-line text-brand-secondary cursor-not-allowed'
            )}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PrintFretRangeDialog.tsx
git commit -m "feat: add PrintFretRangeDialog for choosing a print fret range"
```

---

### Task 3: Wire the dialog and a print-only Fretboard into `Dictionary.tsx`

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `PrintFretRangeDialog` from Task 2 (`{ isOpen, onCancel, onConfirm }`), `PRINT_FRET_CAP`-aware `Fretboard` from Task 1 (no prop changes needed — uses existing `fretsNum`, `startFret`, `fretRange`).
- Produces: nothing consumed elsewhere — this is the top of the chain.

- [ ] **Step 1: Import the dialog**

In `src/pages/Dictionary.tsx`, add to the imports (near the other component imports, currently lines 4-6):

```typescript
import { PrintFretRangeDialog } from '../components/PrintFretRangeDialog';
```

- [ ] **Step 2: Add print-range state**

Near the existing `showAllNotes` state (currently line 434), add:

```typescript
  const [printRangeOpen, setPrintRangeOpen] = useState(false);
  const [printFretRange, setPrintFretRange] = useState<[number, number] | null>(null);
```

- [ ] **Step 3: Intercept the Scales-tab "Print Diagram" button**

Find the Scales-tab print button (currently around line 2100-2104):

```typescript
                 {mode === 'scales' && activeScale && (
                    <div className="flex gap-3 print:hidden">
                       <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm">
                          <Printer size={16} /> Print Diagram
                       </button>
```

Replace the `onClick` so only the `'full'` view opens the dialog; every other scale view mode keeps printing immediately:

```typescript
                 {mode === 'scales' && activeScale && (
                    <div className="flex gap-3 print:hidden">
                       <button
                         onClick={() => scaleViewMode === 'full' ? setPrintRangeOpen(true) : handlePrint('print-area')}
                         className="flex items-center gap-2 px-4 py-2 bg-transparent border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm"
                       >
                          <Printer size={16} /> Print Diagram
                       </button>
```

- [ ] **Step 4: Render the dialog**

Immediately after that button's closing `</div>` (end of the `mode === 'scales' && activeScale` block, currently around line 2113), add the dialog as a sibling:

```typescript
                 )}
                 <PrintFretRangeDialog
                   isOpen={printRangeOpen}
                   onCancel={() => setPrintRangeOpen(false)}
                   onConfirm={(start, end) => {
                     setPrintFretRange([start, end]);
                     setPrintRangeOpen(false);
                   }}
                 />
```

(The first `)}` above is the existing closing brace for the `mode === 'scales' && activeScale && (...)` block — don't duplicate it, just add the `<PrintFretRangeDialog />` line right after it, still inside the same parent `<div className="w-full flex justify-between items-center ...">`.)

- [ ] **Step 5: Add the print-only Fretboard instance**

Find the main scale/chord `<Fretboard>` render (currently around line 2334-2355):

```typescript
                <>
                  <div className="w-full" onMouseEnter={initAudio}>
                     <Fretboard
                        fretsNum={scaleFretsNum}
                        startFret={scaleStartFret}
                        chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: identifiedFrets.map(f => (f === -1 ? -1 : 0)) as Finger[] } : undefined)}
                        showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
                        scale={mode === 'scales' ? displayedScale ?? undefined : undefined}
                        playingNotes={playingNotes}
                        fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
                        scalePositions={mode === 'scales' ? (activeStrictScalePositions ?? dedupedScalePositions) : undefined}
                        cagedPositionMap={cagedPositionMap}
                        cagedColors={CAGED_COLORS}
                        onNoteClick={(str) => {
                          // Handled by onFretClick if possible, fallback
                          import('../lib/audio').then(m => m.playNote(str, sustain));
                        }}
                        onFretClick={handleFretClick}
                        tuning={currentTuning}
                        showAllNotes={mode === 'identify' && showAllNotes}
                     />
                  </div>
```

Replace it with the same `<Fretboard>` plus a `print:hidden` class gated on the pending print-range, and a second print-only instance:

```typescript
                <>
                  <div className="w-full" onMouseEnter={initAudio}>
                     <Fretboard
                        className={mode === 'scales' && scaleViewMode === 'full' && printFretRange ? 'print:hidden' : undefined}
                        fretsNum={scaleFretsNum}
                        startFret={scaleStartFret}
                        chord={mode === 'chords' ? scaffoldedChord : (mode === 'identify' ? { name: 'Identified', frets: identifiedFrets, fingers: identifiedFrets.map(f => (f === -1 ? -1 : 0)) as Finger[] } : undefined)}
                        showNoteNames={!(mode === 'chords' && scaffoldLevel === 1)}
                        scale={mode === 'scales' ? displayedScale ?? undefined : undefined}
                        playingNotes={playingNotes}
                        fretRange={mode === 'scales' && scaleFretRange.length === 2 ? [scaleFretRange[0], scaleFretRange[1]] : undefined}
                        scalePositions={mode === 'scales' ? (activeStrictScalePositions ?? dedupedScalePositions) : undefined}
                        cagedPositionMap={cagedPositionMap}
                        cagedColors={CAGED_COLORS}
                        onNoteClick={(str) => {
                          // Handled by onFretClick if possible, fallback
                          import('../lib/audio').then(m => m.playNote(str, sustain));
                        }}
                        onFretClick={handleFretClick}
                        tuning={currentTuning}
                        showAllNotes={mode === 'identify' && showAllNotes}
                     />
                     {mode === 'scales' && scaleViewMode === 'full' && printFretRange && (
                       <div className="hidden print:block">
                         <Fretboard
                           fretsNum={printFretRange[1] - printFretRange[0] + 1}
                           startFret={printFretRange[0]}
                           fretRange={printFretRange}
                           scale={displayedScale ?? undefined}
                           cagedPositionMap={cagedPositionMap}
                           cagedColors={CAGED_COLORS}
                           tuning={currentTuning}
                         />
                       </div>
                     )}
                  </div>
```

- [ ] **Step 6: Trigger print once the print-only Fretboard has committed to the DOM**

Near the other `useEffect` hooks in the component (any existing one is fine as an anchor — `useEffect` is already imported), add:

```typescript
  useEffect(() => {
    if (printFretRange) {
      handlePrint('print-area');
      setPrintFretRange(null);
    }
  }, [printFretRange]);
```

Resetting to `null` right after triggering print means the print-only block unmounts once its job is done, and reopening the dialog always starts from a clean slate.

- [ ] **Step 7: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Manual verification**

Run `npm run dev` and in the browser:

1. Go to **Dictionary → Scales**, pick a scale, switch to **Full** view.
2. Click **Print Diagram** — confirm the `PrintFretRangeDialog` opens (not an immediate print), with Start=0/End=12 prefilled.
3. Change the range to `2` / `14`, confirm **Print** is enabled, click it.
4. Without letting the browser's native print dialog block automation, verify via the page's DOM (e.g. a `document.querySelector('.hidden.print\\:block')` check, or by inspecting the print window `handlePrint` opens) that the injected print-only fretboard has `fretsNum = 13` worth of fret lines/labels spanning frets 2–14, with no fret cut off. Close the print window/dialog without needing to actually complete a physical print.
5. Reopen the dialog, try an invalid range (e.g. End=3 with Start=5, or a 20-fret span) — confirm the **Print** button is disabled and an inline error message appears.
6. Switch the Scales tab to a non-`'full'` view (e.g. a CAGED box) and click **Print Diagram** — confirm it prints immediately with no dialog, unchanged from before this change.
7. Spot check the Dictionary **Chords** tab print button and a Progressions chord-sheet print still behave exactly as before.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "$(cat <<'EOF'
feat: print-time fret range picker for the Scales full-neck view

Print Diagram, when the Scales tab is in Full view, now opens a dialog
to choose a fret range (e.g. 2-14) instead of cloning whatever the
screen happens to be scrolled to. A dedicated print-only Fretboard
instance is rendered sized exactly to the chosen range so nothing is
cut off. Other scale views and other tabs keep printing immediately,
unchanged.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Screen fix (spec §1) → Task 1 Steps 1-3. Print-width clipping root cause (spec's Root Cause section) → Task 1 Steps 1-2, 4. Dialog + validation (spec §2) → Task 2. Button interception, print-only instance, effect trigger, state reset (spec §3) → Task 3. Edge cases (invalid input, empty range, native print fallback, other tabs unaffected) → Task 3 Step 8 manual checks 5-7.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact manual-check script.
- **Type consistency:** `PrintFretRangeDialogProps` in Task 2 matches the call site in Task 3 Step 4 exactly (`isOpen`, `onCancel`, `onConfirm(start, end)`). `printFretRange` is consistently `[number, number] | null` across Task 3 Steps 2, 5, 6.
