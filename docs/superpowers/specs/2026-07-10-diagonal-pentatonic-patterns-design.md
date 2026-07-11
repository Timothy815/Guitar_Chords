# Diagonal Pentatonic Patterns — Design Spec
**Date:** 2026-07-10

## Overview

Add a second view mode to the existing `/scale-positions` page: instead of the 5 static CAGED boxes, "Diagonal" mode displays pentatonic scales as 3 connected two-string cells that run diagonally up the neck, each cell covering exactly one octave. This is a distinct, well-known fingering system (sometimes taught as a "two-string pentatonic pattern") that trades the CAGED boxes' compactness for continuous, connected runs across the full neck.

Each cell puts 3 consecutive scale tones on the lower string of a string pair and 2 on the upper string, e.g. G Major Pentatonic starting at the root on low E fret 3:

| Cell | Strings | Frets |
|---|---|---|
| 1 | Low E / A | 3, 5, 7 / 5, 7 |
| 2 | D / G | 5, 7, 9 / 7, 9 |
| 3 | B / high E | 8, 10, 12 / 10, 12 |

Because a pentatonic scale has exactly 5 notes, each cell is one full, self-contained octave of the scale — cell 2 is cell 1 shifted up an octave, cell 3 is cell 2 shifted up an octave, and the pattern works for **any** root and for both Major and Minor Pentatonic without per-root or per-scale special-casing.

This pattern is mathematically specific to 5-note scales. Blues scales (6 notes) and the diatonic modes/minor variants (7 notes) do not fit this cell shape and are out of scope — the Scale selector is restricted accordingly in Diagonal mode (see below).

---

## UI Changes — `src/pages/ScalePositions.tsx`

### New state

```ts
type ViewMode = 'box' | 'diagonal';
const [viewMode, setViewMode] = useState<ViewMode>('box');
const [visibleCells, setVisibleCells] = useState<Set<number>>(new Set([0, 1, 2]));
```

### View mode toggle

A new toggle (pill buttons, same visual style as the existing `drillMode` tabs) sits above the Mode tabs: **Box** / **Diagonal**.

Selecting `'diagonal'`:
- Forces `drillMode` to `'free-explore'` (the drill/quiz UI is unaffected and stays box-only; switching back to `'box'` does not reset a chosen drill state)
- Hides the CAGED position selector row, replacing it with 3 checkboxes: "Cell 1 (E–A)", "Cell 2 (D–G)", "Cell 3 (B–E)" — all checked by default (`visibleCells = {0,1,2}`)
- Restricts the Scale `<select>` options to entries where `scaleDef.intervals.length === 5` (Major Pentatonic, Minor Pentatonic) by filtering `COMMON_SCALES` for the dropdown's option list only — `COMMON_SCALES` itself is unchanged
- If the currently-selected scale has `intervals.length !== 5` when the user switches to Diagonal mode, `scaleIdx` resets to the index of Minor Pentatonic

Selecting `'box'` restores the existing CAGED position selector and full scale list; `scaleIdx` is left as-is (no reset needed since box mode supports all scales).

### Modal context reference panel

The existing "Modal context for {scaleDef.name}" panel (only shown when `scaleDef.intervals.length === 7`) is unaffected — it simply won't render in Diagonal mode since pentatonic scales have 5 intervals, same as today.

---

## Cell Computation — `src/data/guitarData.ts`

New exported function:

```ts
export interface DiagonalCell {
  label: string;       // "Cell 1 (E–A)", etc.
  lowerString: number; // stringIdx of the pair's lower (bass) string
  upperString: number; // stringIdx of the pair's upper (treble) string
  positions: { stringIdx: number; fret: number; note: Note }[]; // 5 entries, ascending pitch
}

export function generateDiagonalPentatonic(root: Note, scaleDef: { intervals: number[] }): DiagonalCell[]
```

Guard: if `scaleDef.intervals.length !== 5`, return `[]` (defensive; the UI layer prevents this from being called with a non-pentatonic scale, but the function should degrade safely rather than produce garbage frets).

### Algorithm (pitch-walk)

1. `OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64]` (E2 A2 D3 G3 B3 E4) — reuse the constant already defined in `ScalePositions.tsx`; move it to `guitarData.ts` as a shared export since both the box code and the new diagonal code need it.
2. Compute the root's fret on low E: `rootFret = (ALL_NOTES.indexOf(root) - ALL_NOTES.indexOf('E') + 12) % 12` (same approach as the existing `rootFret` calc in `ScalePositions.tsx`).
3. `startMidi = OPEN_STRING_MIDI[0] + rootFret` — the root's pitch in the lowest playable octave on low E.
4. Build an ascending pitch sequence of 15 notes (3 octaves × 5 scale tones): for `octave` in `0..2`, for each `interval` in `scaleDef.intervals`, push `startMidi + interval + 12 * octave`. The result is naturally sorted ascending since intervals within `scaleDef.intervals` are already ascending and octaves are applied in order.
5. Split into 3 chunks of 5 pitches each — chunk `n` corresponds to cell `n`.
6. For cell `n`, lower string = `2n`, upper string = `2n + 1` (pairs: 0–1 = E/A, 2–3 = D/G, 4–5 = B/high E).
7. Within a chunk, the first 3 pitches map to the lower string (`fret = pitch - OPEN_STRING_MIDI[lowerString]`), the last 2 map to the upper string (`fret = pitch - OPEN_STRING_MIDI[upperString]`). Note name for each position: `ALL_NOTES[pitch % 12]`.

No fret-offset constants are hardcoded per cell — the G-B string pair's major-3rd tuning (vs. perfect-4th everywhere else) falls out automatically from step 7's pitch subtraction, since it uses each string's actual open MIDI pitch rather than an assumed uniform string spacing.

### High-fret roots

For roots near the top of the octave (e.g. G#, rootFret = 11), cell 3 can reach into the low-to-mid 20s in fret number. No capping or truncation — same behavior as the existing CAGED G-shape box, which already produces comparably high frets for some roots. The rendering side handles this via the existing `fretsNum` growth pattern (see below).

---

## Rendering

No changes to `Fretboard.tsx`. The page builds a `scalePositions: Set<string>` (the same `"stringIdx-fret"` format the box mode already produces) from the cells whose index is in `visibleCells`:

```ts
const diagonalCells = useMemo(
  () => generateDiagonalPentatonic(root, scaleDef),
  [root, scaleDef],
);
const diagonalPositions = useMemo(() => {
  const set = new Set<string>();
  diagonalCells.forEach((cell, i) => {
    if (!visibleCells.has(i)) return;
    cell.positions.forEach(p => set.add(`${p.stringIdx}-${p.fret}`));
  });
  return set;
}, [diagonalCells, visibleCells]);
```

`fretsNum` in Diagonal mode is computed as `Math.max(12, highestVisibleFret + 1)`, where `highestVisibleFret` is the max fret across all positions in `diagonalPositions` — matching the existing `fretsNum = Math.max(12, endFret + 1)` convention used in Box mode. No `fretRange` prop is passed in Diagonal mode (unlike Box mode, which uses it to isolate a 4-fret window) — the diagonal pattern is rendered across its full natural span, not clipped to a window.

The `<Fretboard>` element itself is shared between both modes; only the props fed to it differ based on `viewMode`.

---

## Playback

The existing `handlePlay('ascending' | 'descending' | 'up-down' | 'down-up')` is reused unchanged. Its note source is swapped based on `viewMode`:

- Box mode: `getBoxNotes()` (unchanged)
- Diagonal mode: a new `getDiagonalNotes()` that flattens `diagonalCells` filtered by `visibleCells`, in cell order (cell 0 then cell 1 then cell 2) and position order within each cell (already ascending by construction), returning the same `Array<[string, number]>` (`[noteName, midiPitch]`) shape `getBoxNotes()` returns so `handlePlay` needs no changes.

If a user unchecks a middle cell (e.g. only cells 1 and 3 visible), playback plays cell 1's notes followed directly by cell 3's notes — no silence or gap indicator for the skipped cell. This is acceptable; the checkboxes are for visualization/isolation practice, not for guaranteeing a continuous scale run.

---

## Edge Cases

- **All 3 checkboxes unchecked:** `diagonalPositions` is an empty set; `<Fretboard>` renders with no dots, same as any other empty-state fretboard elsewhere in the app. No special empty-state message.
- **Switching Scale while in Diagonal mode:** dropdown only ever offers 5-interval scales, so `generateDiagonalPentatonic` never receives an invalid `scaleDef` from user interaction.
- **Switching Root:** recomputes `diagonalCells` via the `useMemo` dependency on `root`; no manual reset needed.

---

## Out of Scope

- Blues scale or 7-note-scale diagonal patterns (different cell shapes entirely; not addressed by this spec)
- Drill/quiz mode for Diagonal view (stays free-explore only; CAGED quiz is unaffected and remains box-only)
- Alternate string-pairing schemes (e.g. starting the pairing on the A string instead of low E) — only the low-E-anchored 3-pair grouping from the worked example is implemented
- Persisting `viewMode`/`visibleCells` to `localStorage` (resets to Box/all-visible on page reload, consistent with the rest of this page's existing state, which is not persisted today)
