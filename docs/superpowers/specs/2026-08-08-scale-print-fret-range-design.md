# Scale Print Fret Range — Design Spec

## Goal

Fix two coupled regressions in the Dictionary → Scales tab "Full" fretboard view (`scaleViewMode === 'full'`, 22 frets):

1. **Screen:** fret-number labels 13–22 are missing. The interactive view must show labels 1–22 again and remain horizontally scrollable, unchanged otherwise.
2. **Print:** printing currently clones whatever is on screen at click time (`handlePrint`) and silently clips it to a fixed 12-fret-wide box, cutting off content beyond fret 12 regardless of scroll position. Printing must instead let the user choose an explicit fret range (e.g. `0–12`, `2–14`) at print time, fully decoupled from the interactive view's scroll state, and render exactly that range with no labels or dots cut off.

## Root cause

`Fretboard.tsx` renders one SVG shared by screen and print. A hardcoded `12` shows up in three places, all added by the same recent fix (`81ced16`, `eb1ece1`):

- Screen-only SVG fret-number labels are capped at `Math.min(fretsNum, 12)` even though that block already carries `print:hidden` — the cap serves no print purpose and only breaks the screen.
- The print-only HTML fret-number label block is capped at `Math.min(fretsNum, 12)`.
- `printMaxWidth` (the CSS `max-width` applied to `.fretboard-print-wrapper` under `@media print`) is computed from a hardcoded `12`, not from `fretsNum` — so the printed SVG is clipped to a 12-fret-wide box no matter how many frets were meant to be shown.

`handlePrint('print-area')` (in `lib/utils.ts`) clones the live DOM's `innerHTML` into a new window and calls `print()` there; it has no concept of a print-specific fret range — it prints whatever the interactive component currently renders.

## Architecture

- Replace the hardcoded `12` in `Fretboard.tsx` with a shared `PRINT_FRET_CAP = 15` constant, used only for the print-width/print-label calculations (not the screen labels, which become uncapped).
- Add a new small modal component, `PrintFretRangeDialog.tsx`, that collects a validated `[start, end]` range.
- In `Dictionary.tsx`, when the Scales tab's view is `'full'`, the existing "Print Diagram" button opens this dialog instead of printing immediately. On confirm, a second, print-only `<Fretboard>` instance — sized exactly to the chosen range — is rendered alongside the interactive one, and `handlePrint('print-area')` runs against it.
- All other print paths in the app (Chords tab, Identify mode, Progressions chord sheets) are untouched functionally; they keep calling `handlePrint`/`printChordSheet` directly, unaffected by the new dialog. They incidentally benefit from the `12 → 15` cap increase in the (currently unused) case where their `fretsNum` exceeds 12 — see Out of scope.

**Tech stack:** React 19, TypeScript, Tailwind v4, existing `Fretboard.tsx` / `Dictionary.tsx` / `lib/utils.ts`.

---

## 1. `src/components/Fretboard.tsx`

### Screen fret-number labels (SVG, ~line 570)

Change the loop bound from `Math.min(fretsNum, 12)` to `fretsNum`. This block already has `print:hidden`, so it never affects print output — the cap was serving no purpose there and is simply removed. Restores labels 1–22 on the interactive full-neck view; the existing `overflow-x-auto` scroll container is unchanged.

### Print fret-number labels (HTML, ~line 611) and `printMaxWidth` (~line 342)

```typescript
const PRINT_FRET_CAP = 15; // max frets guaranteed to fit legibly on one printed page
const printMaxWidth = paddingX * 2 + fretSpacing * Math.min(fretsNum, PRINT_FRET_CAP);
```

```typescript
{Array.from({ length: Math.min(fretsNum, PRINT_FRET_CAP) }).map(...)}
```

For the new print-only instance described below, `fretsNum` is constructed to already equal the user's chosen span (≤ 15 by construction — see validation), so `Math.min(fretsNum, PRINT_FRET_CAP)` is always the identity and nothing is clipped. No new props are added to `Fretboard`; it already supports `startFret`, `fretsNum`, and `fretRange` (which restricts which scale dots are shown to a sub-window) — the print-only instance simply passes these three explicitly.

---

## 2. `src/components/PrintFretRangeDialog.tsx` (new)

```typescript
interface PrintFretRangeDialogProps {
  isOpen: boolean;
  defaultStart?: number;   // 0
  defaultEnd?: number;     // 12
  maxFret?: number;        // 22
  maxSpan?: number;        // 15
  onCancel: () => void;
  onConfirm: (start: number, end: number) => void;
}
```

Modal overlay following the existing pattern in `Progressions.tsx` (`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4`, click-outside-to-close via `onClick={onCancel}` on the backdrop, `stopPropagation` on the card).

Content: title ("Print Fret Range"), two numeric inputs (**Start Fret**, **End Fret**), a validation message when the range is invalid, and **Cancel** / **Print** buttons. **Print** is disabled until the range is valid.

**Validation rules** (checked live as the user types):
- `0 ≤ start ≤ maxFret`
- `start < end ≤ maxFret`
- `end - start ≤ maxSpan` (so a 15-fret span is the largest allowed — keeps dots/labels legible on one page)

On confirm, calls `onConfirm(start, end)` and closes.

---

## 3. `src/pages/Dictionary.tsx`

### New state

```typescript
const [printRangeOpen, setPrintRangeOpen] = useState(false);
const [printFretRange, setPrintFretRange] = useState<[number, number] | null>(null);
```

### "Print Diagram" button (Scales tab, ~line 2102)

```typescript
onClick={() => scaleViewMode === 'full' ? setPrintRangeOpen(true) : handlePrint('print-area')}
```

Only the full-neck view is intercepted — the position/box/diagonal/three-notes-per-string scale views already render ≤ 12 frets and print correctly today, so they keep the existing one-click print behavior.

### Dialog wiring

```tsx
<PrintFretRangeDialog
  isOpen={printRangeOpen}
  onCancel={() => setPrintRangeOpen(false)}
  onConfirm={(start, end) => {
    setPrintFretRange([start, end]);
    setPrintRangeOpen(false);
  }}
/>
```

### Print-only Fretboard instance (~line 2336, inside the `mode === 'scales'` render branch)

The interactive `<Fretboard>` gains `print:hidden` for this specific case (full view with a chosen print range pending), and a second instance renders next to it, visible only in print:

```tsx
<div className="w-full" onMouseEnter={initAudio}>
  <Fretboard
    className={scaleViewMode === 'full' && printFretRange ? 'print:hidden' : undefined}
    fretsNum={scaleFretsNum}
    startFret={scaleStartFret}
    scale={displayedScale ?? undefined}
    /* ...existing props unchanged... */
  />
  {scaleViewMode === 'full' && printFretRange && (
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

`fretRange={printFretRange}` restricts which scale dots are drawn to the chosen window (the same mechanism already used by position/box views), so the print-only diagram shows exactly — and only — the notes within the requested range.

### Triggering print

A `useEffect` fires `handlePrint('print-area')` after `printFretRange` transitions from `null` to a value, giving React one render cycle to commit the new print-only `<Fretboard>` into the DOM before the clone-and-print happens:

```typescript
useEffect(() => {
  if (printFretRange) handlePrint('print-area');
}, [printFretRange]);
```

`printFretRange` is reset to `null` whenever the print dialog is reopened (`setPrintRangeOpen(true)` also clears it), so a stale range is never silently reused — each print is a fresh, explicit choice.

---

## Edge cases

- **Invalid input** (end ≤ start, span > 15, out of 0–22 bounds): **Print** button stays disabled; no partial/garbage range can be confirmed.
- **Range with no scale notes** (e.g. a narrow range that misses the shape): the print-only diagram legitimately renders with few or no dots — this is correct behavior, not an error.
- **Native browser print** (Cmd/Ctrl+P, bypassing the "Print Diagram" button): falls back to today's behavior — the interactive view prints using the `PRINT_FRET_CAP` (15) clipping, same as before this change but with a slightly larger cap (12 → 15). Out of scope to add the range picker to this path.
- **Chords tab / Identify mode / Progressions chord sheets**: unaffected — they don't route through the new dialog. They incidentally get the same `12 → 15` cap increase, which only changes behavior for Identify mode (`fretsNum = 15`), and only for the better (its print currently silently clips to 12 of its 15 frets; after this change it prints all 15). This is a side effect, not a goal, and no other code changes are made for that path.

## Testing

No automated test suite exists (`npm run lint` is TypeScript-only). Manual verification:

1. Dictionary → Scales → Full view: confirm fret labels 1–22 all render on screen and the view still scrolls horizontally.
2. Click "Print Diagram": confirm the dialog opens with defaults 0–12.
3. Print-preview with default 0–12, then with 2–14: confirm the printed diagram shows exactly that fret range, all labels visible, no cut-off content.
4. Try an invalid range (e.g. end < start, or a 20-fret span): confirm **Print** stays disabled with a validation message.
5. Switch to a non-"full" scale view (e.g. a CAGED box) and click "Print Diagram": confirm it still prints immediately with no dialog (unchanged behavior).
6. Spot check Dictionary Chords tab print and Progressions chord sheet print still work as before.

## Out of scope

- Adding the print-range picker to any page/tab other than Dictionary → Scales → Full view (Chords tab, Identify mode, CAGED, Scale Positions, Progressions).
- Fixing Identify mode's pre-existing 15-fret print clipping beyond the incidental `12 → 15` cap increase described above.
- Multi-page print layouts for spans that don't fit on one page (spans are capped at 15 frets specifically to avoid this).
- Persisting the chosen print range across sessions or across print actions.
