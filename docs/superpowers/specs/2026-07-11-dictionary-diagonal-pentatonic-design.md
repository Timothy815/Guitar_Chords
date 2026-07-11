# Dictionary — Diagonal Pentatonic View — Design Spec
**Date:** 2026-07-11

## Overview

Add the existing "Diagonal" pentatonic view (already shipped on `/scale-positions`) as a new Scale View mode on the Dictionary page's Scales tab (`src/pages/Dictionary.tsx`). No changes to `generateDiagonalPentatonic` in `guitarData.ts` — it's reused exactly as-is.

This is purely a UI-integration task: wire the existing cell-computation function into Dictionary's existing Scale View row (Full Neck / CAGED / Box / 3NPS / Pathway), following the same conventions those four already use.

## Naming collision to avoid

Dictionary's `ScaleViewMode` type already has a value literally named `'diagonal'`, bound to an unrelated, pre-existing feature labeled **"Pathway"** in the UI (ascending cross-neck routes for 7-note scales, via `buildDiagonalPattern`). The new mode must use a different internal id — **`'pentDiagonal'`** — even though its button label is "Diagonal" (matching `/scale-positions`'s label for the same feature). Because `pentDiagonalSupported` (5-note scales only) and `diagonalSupported`/Pathway (7-note scales only) are mutually exclusive, both tabs are never enabled at the same time, so the shared "Diagonal" wording next to "Pathway" is not ambiguous in practice.

## Gating

```ts
const pentDiagonalSupported = (activeScaleBase?.intervals.length ?? 0) === 5;
```

Same shape as the existing `boxViewSupported`/`threeNpsSupported`/`diagonalSupported` checks. In `COMMON_SCALES` this currently means exactly Minor Pentatonic and Major Pentatonic.

Add a branch to the existing reset effect:

```ts
if (scaleViewMode === 'pentDiagonal' && !pentDiagonalSupported) {
  setScaleViewMode('full');
}
```

## New state

```ts
const [pentDiagonalVisibleCells, setPentDiagonalVisibleCells] = useState<Set<number>>(new Set([0, 1, 2]));
```

No dropdown/selection state is needed (unlike Box/3NPS/Pathway, which pick one sub-pattern from a list) — Diagonal always shows all 3 cells by default, toggled via checkboxes, matching `/scale-positions`.

## Cell computation

```ts
const pentDiagonalCells = useMemo(
  () => (pentDiagonalSupported && activeScaleBase ? generateDiagonalPentatonic(selectedKey, activeScaleBase) : []),
  [activeScaleBase, pentDiagonalSupported, selectedKey],
);
const strictScalePentDiagonalPositions = useMemo(() => {
  if (scaleViewMode !== 'pentDiagonal') return undefined;
  const set = new Set<string>();
  pentDiagonalCells.forEach((cell, i) => {
    if (!pentDiagonalVisibleCells.has(i)) return;
    cell.positions.forEach(p => set.add(`${p.stringIdx}-${p.fret}`));
  });
  return set;
}, [pentDiagonalCells, pentDiagonalVisibleCells, scaleViewMode]);
```

Import `generateDiagonalPentatonic` from `../data/guitarData` (already exported there).

## Wiring into existing derived state

`activeStrictScalePositions`: add a branch —
```ts
if (scaleViewMode === 'pentDiagonal') return strictScalePentDiagonalPositions;
```

`scaleFretRange`: add a branch returning `[]` (no fretRange window — same "full natural span, not clipped" behavior as `/scale-positions`'s Diagonal mode, and consistent with how the existing modes skip `fretRange` whenever strict positions are already set) —
```ts
if (scaleViewMode === 'pentDiagonal') return [];
```

## Fretboard width (high-fret roots)

`generateDiagonalPentatonic` can produce frets past 15 for roots near the top of the octave (e.g. G#, A). Dictionary's `<Fretboard>` currently renders with a fixed `fretsNum={15}`. Compute a dynamic value only for this mode:

```ts
const pentDiagonalFretsNum = useMemo(() => {
  if (scaleViewMode !== 'pentDiagonal' || !strictScalePentDiagonalPositions || strictScalePentDiagonalPositions.size === 0) return 15;
  const frets = [...strictScalePentDiagonalPositions].map(p => parseInt(p.split('-')[1], 10));
  return Math.max(15, Math.max(...frets) + 1);
}, [scaleViewMode, strictScalePentDiagonalPositions]);
```

Pass `fretsNum={pentDiagonalFretsNum}` on the `<Fretboard>` in the scales/chords/identify render branch (replacing the current hardcoded `fretsNum={15}` for that element only — chords/identify keep behaving exactly as today since `pentDiagonalFretsNum` is `15` whenever `scaleViewMode !== 'pentDiagonal'`).

## UI — View mode row

Add a new entry to the existing button row, positioned right after "Box" (both are pentatonic-only views; keeping them adjacent groups the two 5-note-scale views together, ahead of the two 7-note-scale views "3NPS"/"Pathway"):

```ts
{ id: 'position', label: 'CAGED', disabled: false },
{ id: 'box', label: 'Box', disabled: !boxViewSupported },
{ id: 'pentDiagonal', label: 'Diagonal', disabled: !pentDiagonalSupported },
{ id: 'threeNps', label: '3NPS', disabled: !threeNpsSupported },
{ id: 'diagonal', label: 'Pathway', disabled: !diagonalSupported },
```

(`ScaleViewMode` type gains `'pentDiagonal'`.)

## UI — Cell checkboxes + helper text

When `scaleViewMode === 'pentDiagonal' && pentDiagonalSupported`, render (mirroring the Box/3NPS/Pathway blocks already in the file):

```tsx
<div className="flex gap-3 flex-wrap">
  {pentDiagonalCells.map((cell, i) => (
    <label key={i} className="flex items-center gap-2 text-xs font-medium text-brand-ink cursor-pointer">
      <input
        type="checkbox"
        checked={pentDiagonalVisibleCells.has(i)}
        onChange={() => {
          setPentDiagonalVisibleCells(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i); else next.add(i);
            return next;
          });
        }}
      />
      {cell.label}
    </label>
  ))}
</div>
<p className="text-[10px] text-brand-secondary/70 leading-tight">
  Diagonal view: three connected two-string cells that run diagonally up the neck, each one full octave of the pentatonic scale.
</p>
```

And add the matching "not supported" helper text alongside the existing three:

```tsx
{!pentDiagonalSupported && (
  <p className="text-[10px] text-brand-secondary/70 leading-tight">
    Diagonal view is currently available for Minor Pentatonic and Major Pentatonic.
  </p>
)}
```

## Playback

No changes. Dictionary's Scale Arpeggiator plays `activeScale`'s notes by scanning the full fretboard — it already does not respect any view mode's fret restriction (Box/3NPS/Pathway don't wire into it either), so Diagonal needs no special playback integration to stay consistent with existing behavior.

## Out of scope

- Any change to `generateDiagonalPentatonic` or `DiagonalCell` in `guitarData.ts`
- Persisting `pentDiagonalVisibleCells` to `localStorage` (consistent with the rest of the page's non-persisted state)
- Drill/quiz interaction for this view (Dictionary's Scales tab has no drill mode at all today; out of scope regardless)
