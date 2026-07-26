# Dictionary Diagonal Pentatonic View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing "Diagonal" pentatonic fingering view (already shipped on `/scale-positions`) as a new Scale View mode on the Dictionary page's Scales tab, reusing `generateDiagonalPentatonic` from `guitarData.ts` unchanged.

**Architecture:** Pure UI-integration in `src/pages/Dictionary.tsx`. A new `ScaleViewMode` value `'pentDiagonal'` (internal id, button label "Diagonal") is added alongside the existing `full`/`position`/`box`/`threeNps`/`diagonal` modes, following the exact same gate → cell-computation → dispatcher-branch → UI-block pattern those four already use. No changes to `guitarData.ts`.

**Tech Stack:** React 19 + TypeScript, existing hand-rolled music theory in `guitarData.ts`, Tailwind v4. No test framework exists in this repo — verification is `npm run lint` (`tsc --noEmit`) plus manual smoke testing via `npm run dev`.

## Global Constraints

- No changes to `generateDiagonalPentatonic` or `DiagonalCell` in `src/data/guitarData.ts` — reused exactly as-is (spec "Out of scope").
- New internal mode id must be `'pentDiagonal'`, NOT `'diagonal'` — `'diagonal'` is already used by the unrelated "Pathway" feature (`buildDiagonalPattern`). Button label is "Diagonal" (matches `/scale-positions`'s label); both features are mutually exclusive by scale-length gating so the shared wording is unambiguous in practice.
- No persistence of `pentDiagonalVisibleCells` to `localStorage` (matches the rest of the page's non-persisted scale-view state).
- No changes to playback (`Scale Arpeggiator`) — it already ignores view-mode filtering for all four existing modes, so Diagonal needs no special-casing to stay consistent.
- No test framework exists; `npm run lint` is the only static check. Verification steps use lint + manual browser smoke tests, matching the precedent in `docs/superpowers/plans/2026-07-10-diagonal-pentatonic-patterns.md`.

---

### Task 1: Type, import, gating, and state foundation

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `generateDiagonalPentatonic` (exported from `src/data/guitarData.ts`, signature `(root: Note, scaleDef: { intervals: number[] }) => DiagonalCell[]`, already implemented — do not modify it).
- Produces (for Task 2 and Task 3 to consume): `pentDiagonalSupported: boolean`, `pentDiagonalVisibleCells: Set<number>`, `setPentDiagonalVisibleCells: React.Dispatch<React.SetStateAction<Set<number>>>`, and the `'pentDiagonal'` member of `ScaleViewMode`.

- [ ] **Step 1: Add the import**

In `src/pages/Dictionary.tsx`, find this line (currently line 7):

```ts
import { COMMON_CHORDS, COMMON_SCALES, generateScalePattern, ALL_NOTES, ScaleCategory } from '../data/guitarData';
```

Replace it with:

```ts
import { COMMON_CHORDS, COMMON_SCALES, generateScalePattern, generateDiagonalPentatonic, ALL_NOTES, ScaleCategory } from '../data/guitarData';
```

- [ ] **Step 2: Add `'pentDiagonal'` to the `ScaleViewMode` type**

Find (currently line 155):

```ts
type ScaleViewMode = 'full' | 'position' | 'box' | 'threeNps' | 'diagonal';
```

Replace with:

```ts
type ScaleViewMode = 'full' | 'position' | 'box' | 'pentDiagonal' | 'threeNps' | 'diagonal';
```

- [ ] **Step 3: Add the `pentDiagonalVisibleCells` state**

Find (currently line 331):

```ts
  const [scaleDiagonalSelection, setScaleDiagonalSelection] = useState<string>('d1');
```

Replace with (add the new line immediately after, keep the original line unchanged):

```ts
  const [scaleDiagonalSelection, setScaleDiagonalSelection] = useState<string>('d1');
  const [pentDiagonalVisibleCells, setPentDiagonalVisibleCells] = useState<Set<number>>(new Set([0, 1, 2]));
```

- [ ] **Step 4: Add the `pentDiagonalSupported` gate**

Find (currently line 506, right after `boxViewSupported`/`threeNpsSupported`):

```ts
  const diagonalSupported = (activeScaleBase?.intervals.length ?? 0) === 7;
```

Replace with (add the new line immediately after, keep the original line unchanged):

```ts
  const diagonalSupported = (activeScaleBase?.intervals.length ?? 0) === 7;
  const pentDiagonalSupported = (activeScaleBase?.intervals.length ?? 0) === 5;
```

- [ ] **Step 5: Add a reset branch so an unsupported scale falls back to Full Neck**

Find this effect (currently lines 724-734):

```ts
  useEffect(() => {
    if (scaleViewMode === 'box' && !boxViewSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'threeNps' && !threeNpsSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'diagonal' && !diagonalSupported) {
      setScaleViewMode('full');
    }
  }, [boxViewSupported, diagonalSupported, scaleViewMode, threeNpsSupported]);
```

Replace with:

```ts
  useEffect(() => {
    if (scaleViewMode === 'box' && !boxViewSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'pentDiagonal' && !pentDiagonalSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'threeNps' && !threeNpsSupported) {
      setScaleViewMode('full');
    }
    if (scaleViewMode === 'diagonal' && !diagonalSupported) {
      setScaleViewMode('full');
    }
  }, [boxViewSupported, diagonalSupported, pentDiagonalSupported, scaleViewMode, threeNpsSupported]);
```

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: no errors. `generateDiagonalPentatonic` is imported but not yet referenced anywhere else in the file — this is fine, `tsconfig.json` has no `noUnusedLocals`/`noUnusedParameters` set (confirmed by grep), so an as-yet-unused import does not fail the type-check. It will be consumed in Task 2.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: add pentDiagonal scale view mode scaffolding to Dictionary"
```

---

### Task 2: Cell computation and derived-state wiring

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `pentDiagonalSupported`, `pentDiagonalVisibleCells` (Task 1), `activeScaleBase`, `selectedKey`, `scaleViewMode` (pre-existing in the file).
- Produces (for Task 3 to consume): `pentDiagonalCells: DiagonalCell[]`, `strictScalePentDiagonalPositions: Set<string> | undefined`, `pentDiagonalFretsNum: number`. Also extends `activeStrictScalePositions` and `scaleFretRange` (both pre-existing dispatcher `useMemo`s) with a `'pentDiagonal'` branch.

This task has no user-visible effect yet — there is no button to select `'pentDiagonal'` until Task 3. Verification here is lint-only (type-checking that the new memos compile and that `DiagonalCell`'s shape is used correctly).

- [ ] **Step 1: Add `pentDiagonalCells` / `strictScalePentDiagonalPositions`, and extend `activeStrictScalePositions`**

Find this block (currently lines 663-672):

```ts
  const strictScaleDiagonalPositions = useMemo(() => {
    if (scaleViewMode !== 'diagonal') return undefined;
    return scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection)?.positions;
  }, [scaleDiagonalOptions, scaleDiagonalSelection, scaleViewMode]);
  const activeStrictScalePositions = useMemo(() => {
    if (scaleViewMode === 'box') return strictScaleBoxPositions;
    if (scaleViewMode === 'threeNps') return strictScaleThreeNpsPositions;
    if (scaleViewMode === 'diagonal') return strictScaleDiagonalPositions;
    return undefined;
  }, [scaleViewMode, strictScaleBoxPositions, strictScaleThreeNpsPositions, strictScaleDiagonalPositions]);
```

Replace with:

```ts
  const strictScaleDiagonalPositions = useMemo(() => {
    if (scaleViewMode !== 'diagonal') return undefined;
    return scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection)?.positions;
  }, [scaleDiagonalOptions, scaleDiagonalSelection, scaleViewMode]);
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
  const activeStrictScalePositions = useMemo(() => {
    if (scaleViewMode === 'box') return strictScaleBoxPositions;
    if (scaleViewMode === 'pentDiagonal') return strictScalePentDiagonalPositions;
    if (scaleViewMode === 'threeNps') return strictScaleThreeNpsPositions;
    if (scaleViewMode === 'diagonal') return strictScaleDiagonalPositions;
    return undefined;
  }, [scaleViewMode, strictScaleBoxPositions, strictScalePentDiagonalPositions, strictScaleThreeNpsPositions, strictScaleDiagonalPositions]);
```

- [ ] **Step 2: Add a `'pentDiagonal'` branch to `scaleFretRange`, and add `pentDiagonalFretsNum`**

Find this block (currently lines 674-696):

```ts
  const scaleFretRange = useMemo<number[]>(() => {
    if (scaleViewMode === 'full') return [];
    if (scaleViewMode === 'position') {
      const match = scalePositionOptions.find(option => option.id === scalePositionSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'box') {
      if (strictScaleBoxPositions) return [];
      const match = scaleBoxOptions.find(option => option.id === scaleBoxSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'threeNps') {
      if (strictScaleThreeNpsPositions) return [];
      const match = scaleThreeNpsOptions.find(option => option.id === scaleThreeNpsSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'diagonal') {
      if (strictScaleDiagonalPositions) return [];
      const match = scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    return [];
  }, [scaleBoxOptions, scaleBoxSelection, scaleDiagonalOptions, scaleDiagonalSelection, scalePositionOptions, scalePositionSelection, scaleThreeNpsOptions, scaleThreeNpsSelection, scaleViewMode, strictScaleBoxPositions, strictScaleDiagonalPositions, strictScaleThreeNpsPositions]);
```

Replace with:

```ts
  const scaleFretRange = useMemo<number[]>(() => {
    if (scaleViewMode === 'full') return [];
    if (scaleViewMode === 'position') {
      const match = scalePositionOptions.find(option => option.id === scalePositionSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'box') {
      if (strictScaleBoxPositions) return [];
      const match = scaleBoxOptions.find(option => option.id === scaleBoxSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'pentDiagonal') return [];
    if (scaleViewMode === 'threeNps') {
      if (strictScaleThreeNpsPositions) return [];
      const match = scaleThreeNpsOptions.find(option => option.id === scaleThreeNpsSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    if (scaleViewMode === 'diagonal') {
      if (strictScaleDiagonalPositions) return [];
      const match = scaleDiagonalOptions.find(option => option.id === scaleDiagonalSelection);
      return match ? [match.range[0], match.range[1]] : [];
    }
    return [];
  }, [scaleBoxOptions, scaleBoxSelection, scaleDiagonalOptions, scaleDiagonalSelection, scalePositionOptions, scalePositionSelection, scaleThreeNpsOptions, scaleThreeNpsSelection, scaleViewMode, strictScaleBoxPositions, strictScaleDiagonalPositions, strictScaleThreeNpsPositions]);

  const pentDiagonalFretsNum = useMemo(() => {
    if (scaleViewMode !== 'pentDiagonal' || !strictScalePentDiagonalPositions || strictScalePentDiagonalPositions.size === 0) return 15;
    const frets = [...strictScalePentDiagonalPositions].map(p => parseInt(p.split('-')[1], 10));
    return Math.max(15, Math.max(...frets) + 1);
  }, [scaleViewMode, strictScalePentDiagonalPositions]);
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: compute pentDiagonal cells and wire into scale position dispatchers"
```

---

### Task 3: View mode button, checkbox UI, helper text, and Fretboard wiring

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `pentDiagonalSupported`, `pentDiagonalVisibleCells`, `setPentDiagonalVisibleCells` (Task 1), `pentDiagonalCells`, `pentDiagonalFretsNum` (Task 2), `scaleViewMode`, `setScaleViewMode`, `ScaleViewMode` (pre-existing).
- Produces: the complete, user-facing Diagonal pentatonic view mode. No further tasks depend on this one.

- [ ] **Step 1: Add the "Diagonal" button to the View mode row**

Find (currently lines 1310-1311, inside the view-mode button array):

```ts
                          { id: 'box', label: 'Box', disabled: !boxViewSupported },
                          { id: 'threeNps', label: '3NPS', disabled: !threeNpsSupported },
```

Replace with:

```ts
                          { id: 'box', label: 'Box', disabled: !boxViewSupported },
                          { id: 'pentDiagonal', label: 'Diagonal', disabled: !pentDiagonalSupported },
                          { id: 'threeNps', label: '3NPS', disabled: !threeNpsSupported },
```

- [ ] **Step 2: Add the cell-checkbox block, positioned between the Pathway (`'diagonal'`) block and the Full Neck (`'full'`) block**

Find (currently lines 1388-1415 — the end of the `'diagonal'` block through the start of the `'full'` block):

```tsx
                      {scaleViewMode === 'diagonal' && diagonalSupported && (
                        <>
                          <select
                            value={scaleDiagonalSelection}
                            onChange={(e) => {
                              setScaleDiagonalSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scaleDiagonalOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            Pathway view: ascending cross-neck routes for supported 7-note scales. These are movement maps for escaping box-shaped playing, not strict note-by-note scale exercises.
                          </p>
                          <div className="rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[11px] leading-relaxed">
                            <p className="font-semibold text-brand-ink">How to use it</p>
                            <p className="text-brand-secondary/80">Start on the lowest highlighted note and move upward in pitch through the shown route. Treat it as a suggested pathway across the neck, not a fixed published fingering.</p>
                          </div>
                        </>
                      )}

                      {scaleViewMode === 'full' && (
```

Replace with:

```tsx
                      {scaleViewMode === 'diagonal' && diagonalSupported && (
                        <>
                          <select
                            value={scaleDiagonalSelection}
                            onChange={(e) => {
                              setScaleDiagonalSelection(e.target.value);
                            }}
                            className="w-full p-2 text-sm border border-brand-line rounded-md bg-brand-surface text-brand-ink outline-none"
                          >
                            {scaleDiagonalOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            Pathway view: ascending cross-neck routes for supported 7-note scales. These are movement maps for escaping box-shaped playing, not strict note-by-note scale exercises.
                          </p>
                          <div className="rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[11px] leading-relaxed">
                            <p className="font-semibold text-brand-ink">How to use it</p>
                            <p className="text-brand-secondary/80">Start on the lowest highlighted note and move upward in pitch through the shown route. Treat it as a suggested pathway across the neck, not a fixed published fingering.</p>
                          </div>
                        </>
                      )}

                      {scaleViewMode === 'pentDiagonal' && pentDiagonalSupported && (
                        <>
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
                        </>
                      )}

                      {scaleViewMode === 'full' && (
```

- [ ] **Step 3: Add the "not supported" helper paragraph**

Find (currently lines 1417-1423 — the `!boxViewSupported` paragraph immediately followed by the `!threeNpsSupported` block opening):

```tsx
                      {!boxViewSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Box view currently supports Minor Pentatonic, Major Pentatonic, Minor Blues, and Major Blues.
                        </p>
                      )}

                      {!threeNpsSupported && (
```

Replace with:

```tsx
                      {!boxViewSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Box view currently supports Minor Pentatonic, Major Pentatonic, Minor Blues, and Major Blues.
                        </p>
                      )}

                      {!pentDiagonalSupported && (
                        <p className="text-[10px] text-brand-secondary/70 leading-tight">
                          Diagonal view is currently available for Minor Pentatonic and Major Pentatonic.
                        </p>
                      )}

                      {!threeNpsSupported && (
```

- [ ] **Step 4: Wire the dynamic `fretsNum` into the scales/chords/identify `<Fretboard>`**

Find (currently lines 2056-2057 — the `<Fretboard>` used for chords/scales/identify, NOT the `<IntervalFretboard>` a few lines above it):

```tsx
                     <Fretboard
                        fretsNum={15}
```

Replace with:

```tsx
                     <Fretboard
                        fretsNum={pentDiagonalFretsNum}
```

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev` (starts on port 3000), then in a browser:

1. Navigate to `/dictionary`, click the **Scales** tab.
2. Set Root to `G`, select scale `Major Pentatonic` (5-note scale).
3. In the Scale View row, confirm a new **Diagonal** button appears between **Box** and **3NPS**, and is enabled (not greyed out).
4. Click **Diagonal**. Confirm: three checkboxes appear labeled with cell names (e.g. "E–A", "D–G", "B–E"), all checked by default; the fretboard shows only diagonal-cell dots (not the full scale); unchecking one checkbox removes that cell's dots from the fretboard.
5. Change Root to `G#` (a high-fret root). Confirm the fretboard widens (more than 15 frets shown) rather than clipping the third cell.
6. Change the scale to a 7-note scale (e.g. `Major`). Confirm the **Diagonal** button becomes disabled/greyed and clicking it does nothing; confirm the helper text "Diagonal view is currently available for Minor Pentatonic and Major Pentatonic." is visible in the panel.
7. Switch back to `Minor Pentatonic`, confirm **Diagonal** re-enables.
8. Switch to **Chords** tab and back to **Scales** tab; confirm nothing else regressed (Full Neck, CAGED, Box, 3NPS, Pathway all still work as before).

Expected: all of the above behave as described, with no console errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: add Diagonal pentatonic view to Dictionary Scales tab"
```
