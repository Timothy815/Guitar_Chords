# Diagonal Pentatonic Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Diagonal" view mode to `/scale-positions` that displays Major/Minor Pentatonic scales as 3 connected two-string cells running diagonally up the neck, alongside the existing CAGED "Box" mode.

**Architecture:** A pure data function (`generateDiagonalPentatonic`) in `guitarData.ts` computes the 3 cells via a pitch-walk algorithm. `ScalePositions.tsx` gets a `viewMode` toggle that swaps which computation feeds the existing `<Fretboard scale scalePositions fretsNum>` render and the existing `handlePlay` note source — no changes to `Fretboard.tsx` itself.

**Tech Stack:** React 19 + TypeScript, existing `@tonaljs`-free hand-rolled music theory in `guitarData.ts`, Tailwind v4 for styling. No test framework exists in this repo — verification is `npm run lint` (`tsc --noEmit`) plus manual smoke testing via `npm run dev`.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-10-diagonal-pentatonic-patterns-design.md` — every requirement in this plan traces back to it.
- `stringIdx 0` = low E, `stringIdx 5` = high E (per `CLAUDE.md`).
- Path alias `@` resolves to the project root — use `@/src/...` for imports.
- No test framework exists; `npm run lint` is the only static check. Verification steps use lint + manual browser smoke tests, matching the precedent in `docs/superpowers/plans/2026-06-29-scale-interval-drill.md`.
- Do not modify `src/components/Fretboard.tsx` — the spec requires reusing it unchanged.
- `OPEN_STRING_MIDI` currently lives locally in `ScalePositions.tsx`; it must move to `guitarData.ts` as a shared export (both box and diagonal code need it).

---

## File Map

- **Modify:** `src/data/guitarData.ts` — add `OPEN_STRING_MIDI`, `DiagonalCell` interface, `generateDiagonalPentatonic()`.
- **Modify:** `src/pages/ScalePositions.tsx` — add `viewMode`/`visibleCells` state, view-mode toggle UI, diagonal cell checkboxes, diagonal computation, conditional Fretboard props, `getDiagonalNotes()` playback source, conditional Mode-tabs/position-selector rendering.

---

### Task 1: Diagonal cell computation in `guitarData.ts`

**Files:**
- Modify: `src/data/guitarData.ts:112-124` (insert after the closing brace of `generateScalePattern`, i.e. after current line 123)

**Interfaces:**
- Consumes: `ALL_NOTES: Note[]` (already defined at `guitarData.ts:3`), `Note` type (already imported at `guitarData.ts:1`)
- Produces:
  - `export const OPEN_STRING_MIDI: number[]` — 6-element array, index 0 = low E
  - `export interface DiagonalCell { label: string; lowerString: number; upperString: number; positions: { stringIdx: number; fret: number; note: Note }[]; }`
  - `export function generateDiagonalPentatonic(root: Note, scaleDef: { intervals: number[] }): DiagonalCell[]` — returns 3 cells, each with 5 positions (3 on `lowerString`, 2 on `upperString`), ascending pitch order within each cell. Returns `[]` if `scaleDef.intervals.length !== 5`.

- [ ] **Step 1: Add the shared MIDI constant, type, and generator function**

Insert immediately after line 123 (the closing `}` of `generateScalePattern`) in `src/data/guitarData.ts`:

```ts

// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4 (stringIdx 0 = low E)
export const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

export interface DiagonalCell {
  label: string;
  lowerString: number;
  upperString: number;
  positions: { stringIdx: number; fret: number; note: Note }[];
}

// Diagonal two-string-pair pentatonic pattern: 3 cells (E-A, D-G, B-E), each one
// full octave of a 5-note scale (3 notes on the lower string, 2 on the upper).
// Only valid for exactly-5-note scales; returns [] otherwise.
export function generateDiagonalPentatonic(
  root: Note,
  scaleDef: { intervals: number[] },
): DiagonalCell[] {
  if (scaleDef.intervals.length !== 5) return [];

  const rootIdx = ALL_NOTES.indexOf(root);
  const lowEIdx = ALL_NOTES.indexOf('E');
  const rootFret = (rootIdx - lowEIdx + 12) % 12;
  const startMidi = OPEN_STRING_MIDI[0] + rootFret;

  const pitches: number[] = [];
  for (let octave = 0; octave < 3; octave++) {
    for (const interval of scaleDef.intervals) {
      pitches.push(startMidi + interval + 12 * octave);
    }
  }

  const pairLabels = ['E–A', 'D–G', 'B–E'];
  const cells: DiagonalCell[] = [];
  for (let n = 0; n < 3; n++) {
    const chunk = pitches.slice(n * 5, n * 5 + 5);
    const lowerString = n * 2;
    const upperString = n * 2 + 1;
    const positions = chunk.map((pitch, i) => {
      const stringIdx = i < 3 ? lowerString : upperString;
      const fret = pitch - OPEN_STRING_MIDI[stringIdx];
      const note = ALL_NOTES[pitch % 12];
      return { stringIdx, fret, note };
    });
    cells.push({ label: `Cell ${n + 1} (${pairLabels[n]})`, lowerString, upperString, positions });
  }
  return cells;
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors (this is a pure additive change; no existing code references the new exports yet).

- [ ] **Step 3: Manual smoke test of the algorithm**

Run: `node -e "
const ts = require('child_process').execSync('npx tsx -e \"' + \`
import { generateDiagonalPentatonic } from './src/data/guitarData';
console.log(JSON.stringify(generateDiagonalPentatonic('G', { intervals: [0,2,4,7,9] }), null, 2));
\`.replace(/\"/g, '\\\\\"') + '\"').toString();
console.log(ts);
"`

This is fiddly to invoke inline — simpler to run directly:

Run: `npx tsx --tsconfig tsconfig.json -e "import('./src/data/guitarData.ts').then(m => console.log(JSON.stringify(m.generateDiagonalPentatonic('G', { intervals: [0,2,4,7,9] }), null, 2)))"`

Expected output: cell 1 positions on stringIdx 0 (frets 3,5,7) and stringIdx 1 (frets 5,7); cell 2 on stringIdx 2 (frets 5,7,9) and stringIdx 3 (frets 7,9); cell 3 on stringIdx 4 (frets 8,10,12) and stringIdx 5 (frets 10,12) — matching the spec's worked G Major Pentatonic example exactly (frets 3,5,7/5,7 → 5,7,9/7,9 → 8,10,12/10,12).

If `npx tsx` has trouble resolving the `@`-alias-free relative import, that's fine — this file has no aliased imports, so the direct relative import above should resolve without needing `tsconfig-paths` registration. If it still fails to run standalone, skip this isolated check and instead do the equivalent verification visually in Task 2's manual smoke test (which renders these exact frets on screen).

- [ ] **Step 4: Commit**

```bash
git add src/data/guitarData.ts
git commit -m "feat: add diagonal pentatonic cell computation to guitarData"
```

---

### Task 2: Wire Diagonal view mode into `ScalePositions.tsx`

**Files:**
- Modify: `src/pages/ScalePositions.tsx` (multiple sections — see steps below)

**Interfaces:**
- Consumes: `OPEN_STRING_MIDI`, `DiagonalCell`, `generateDiagonalPentatonic` from `@/src/data/guitarData` (Task 1)
- Produces: `viewMode: 'box' | 'diagonal'` state, `visibleCells: Set<number>` state, `diagonalCells: DiagonalCell[]`, `diagonalPositions: Set<string>`, `getDiagonalNotes(): Array<[string, number]>` — same tuple shape as the existing `getBoxNotes()` so `handlePlay` (unchanged) can consume either.

- [ ] **Step 1: Update imports — remove local `OPEN_STRING_MIDI`, add new imports from `guitarData`**

In `src/pages/ScalePositions.tsx`, replace line 4:

```ts
import { generateScalePattern, COMMON_SCALES, ALL_NOTES } from '@/src/data/guitarData';
```

with:

```ts
import { generateScalePattern, COMMON_SCALES, ALL_NOTES, generateDiagonalPentatonic, OPEN_STRING_MIDI, type DiagonalCell } from '@/src/data/guitarData';
```

Then delete the now-duplicate local constant at lines 25-26:

```ts
// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
```

(Delete both lines; the blank line above/below can stay as a single separator.)

- [ ] **Step 2: Add `ViewMode` type and new state**

After the existing `type DrillMode = 'identify-position' | 'free-explore';` line (line 38), add:

```ts
type ViewMode = 'box' | 'diagonal';
```

Inside the `ScalePositions()` component, after the existing `const [correctAnswer, setCorrectAnswer] = useState('');` line (line 47), add:

```ts
  const [viewMode, setViewMode] = useState<ViewMode>('box');
  const [visibleCells, setVisibleCells] = useState<Set<number>>(new Set([0, 1, 2]));
```

- [ ] **Step 3: Compute diagonal cells and positions**

After the existing `scalePositions` `useMemo` block (ends at line 91, just before `getBoxNotes`), add:

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

  const diagonalFretsNum = useMemo(() => {
    let maxFret = 0;
    diagonalPositions.forEach(pos => {
      const fret = Number(pos.split('-')[1]);
      if (fret > maxFret) maxFret = fret;
    });
    return Math.max(12, maxFret + 1);
  }, [diagonalPositions]);
```

- [ ] **Step 4: Add `getDiagonalNotes()` playback source**

After the existing `getBoxNotes` callback (ends at line 108, just before `handlePlay`), add:

```ts
  const getDiagonalNotes = useCallback((): Array<[string, number]> => {
    const notes: Array<[string, number]> = [];
    diagonalCells.forEach((cell, i) => {
      if (!visibleCells.has(i)) return;
      cell.positions.forEach(p => {
        notes.push([p.note, OPEN_STRING_MIDI[p.stringIdx] + p.fret]);
      });
    });
    return notes;
  }, [diagonalCells, visibleCells]);
```

- [ ] **Step 5: Swap `handlePlay`'s note source based on `viewMode`**

Replace the existing `handlePlay` callback (lines 110-122):

```ts
  const handlePlay = useCallback(async (direction: 'ascending' | 'descending' | 'up-down' | 'down-up') => {
    await initAudio();
    const asc = getBoxNotes();
    const desc = [...asc].reverse();
    const seq = direction === 'descending' ? desc
               : direction === 'up-down'   ? [...asc, ...desc.slice(1)]
               : direction === 'down-up'   ? [...desc, ...asc.slice(1)]
               : asc;
    seq.forEach(([name, pitch], i) => {
      const octave = Math.floor(pitch / 12) - 1;
      setTimeout(() => playNote(`${name}${octave}`, '8n'), i * 220);
    });
  }, [getBoxNotes]);
```

with:

```ts
  const handlePlay = useCallback(async (direction: 'ascending' | 'descending' | 'up-down' | 'down-up') => {
    await initAudio();
    const asc = viewMode === 'diagonal' ? getDiagonalNotes() : getBoxNotes();
    const desc = [...asc].reverse();
    const seq = direction === 'descending' ? desc
               : direction === 'up-down'   ? [...asc, ...desc.slice(1)]
               : direction === 'down-up'   ? [...desc, ...asc.slice(1)]
               : asc;
    seq.forEach(([name, pitch], i) => {
      const octave = Math.floor(pitch / 12) - 1;
      setTimeout(() => playNote(`${name}${octave}`, '8n'), i * 220);
    });
  }, [viewMode, getBoxNotes, getDiagonalNotes]);
```

- [ ] **Step 6: Force `drillMode` to `free-explore` when switching to Diagonal, and reset scale if needed**

Add a handler function just before the `return` statement (after `handleSelect`, around line 141):

```ts
  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    if (mode === 'diagonal') {
      setDrillMode('free-explore');
      if (scaleDef.intervals.length !== 5) setScaleIdx(0);
    }
  }
```

(`COMMON_SCALES[0]` is `'Minor Pentatonic'`, confirmed 5-interval — resetting to index `0` satisfies the spec's "resets to the index of Minor Pentatonic" requirement.)

- [ ] **Step 7: Add the View mode toggle UI**

In the JSX, insert a new toggle row directly before the existing "Mode tabs" block (before line 188's `{/* Mode tabs */}` comment):

```tsx
      {/* View mode toggle */}
      <div className="flex gap-2">
        {(['box', 'diagonal'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => handleViewModeChange(m)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              viewMode === m
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
            )}
          >
            {m === 'box' ? 'Box' : 'Diagonal'}
          </button>
        ))}
      </div>

```

- [ ] **Step 8: Restrict the Scale `<select>` options in Diagonal mode**

Replace the existing `<select>` block (lines 176-184):

```tsx
          <select
            value={scaleIdx}
            onChange={e => setScaleIdx(Number(e.target.value))}
            className="h-8 px-2 rounded border border-brand-line bg-brand-surface text-brand-ink text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
          >
            {COMMON_SCALES.map((s, i) => (
              <option key={s.name} value={i}>{s.name}</option>
            ))}
          </select>
```

with:

```tsx
          <select
            value={scaleIdx}
            onChange={e => setScaleIdx(Number(e.target.value))}
            className="h-8 px-2 rounded border border-brand-line bg-brand-surface text-brand-ink text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
          >
            {COMMON_SCALES.map((s, i) => (viewMode === 'diagonal' && s.intervals.length !== 5) ? null : (
              <option key={s.name} value={i}>{s.name}</option>
            ))}
          </select>
```

- [ ] **Step 9: Gate the Mode tabs (Explore/Drill) to Box mode only**

Drill/quiz mode is CAGED-box-specific (per spec: "stays box-only"); hiding the Explore/Drill tabs in Diagonal mode keeps the UI from exposing a quiz that doesn't apply there. Replace the existing "Mode tabs" block (lines 188-204):

```tsx
      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['free-explore', 'identify-position'] as DrillMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setDrillMode(m); setSelected(null); if (m !== 'free-explore') startDrill(); }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              drillMode === m
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
            )}
          >
            {m === 'free-explore' ? 'Explore' : 'Drill: Name the Position'}
          </button>
        ))}
      </div>
```

with:

```tsx
      {/* Mode tabs (box view only — drill/quiz is CAGED-box-specific) */}
      {viewMode === 'box' && (
        <div className="flex gap-2">
          {(['free-explore', 'identify-position'] as DrillMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setDrillMode(m); setSelected(null); if (m !== 'free-explore') startDrill(); }}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                drillMode === m
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {m === 'free-explore' ? 'Explore' : 'Drill: Name the Position'}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 10: Replace the CAGED position selector with cell checkboxes in Diagonal mode**

Replace the existing "Position selector" block (lines 206-224):

```tsx
      {/* Position selector (free-explore only) */}
      {drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {CAGED_BOXES.map((b, i) => (
            <button
              key={i}
              onClick={() => setPositionIdx(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                positionIdx === i
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
```

with:

```tsx
      {/* Position selector (box mode, free-explore only) */}
      {viewMode === 'box' && drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {CAGED_BOXES.map((b, i) => (
            <button
              key={i}
              onClick={() => setPositionIdx(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                positionIdx === i
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Cell checkboxes (diagonal mode) */}
      {viewMode === 'diagonal' && (
        <div className="flex gap-3 flex-wrap">
          {diagonalCells.map((cell, i) => (
            <label key={i} className="flex items-center gap-2 text-xs font-medium text-brand-ink cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCells.has(i)}
                onChange={() => {
                  setVisibleCells(prev => {
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
      )}
```

- [ ] **Step 11: Feed the Fretboard the right props per view mode, and adjust the title line**

Replace the existing "Fretboard" block (lines 226-250):

```tsx
      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {root} {scaleDef.name} — {CAGED_BOXES[positionIdx].label}
            {drillMode === 'free-explore' && (
              <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
            )}
          </p>
          <div className="flex gap-1">
            <button onClick={() => handlePlay('ascending')}  className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲ Up</button>
            <button onClick={() => handlePlay('descending')} className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼ Down</button>
            <button onClick={() => handlePlay('up-down')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲▼ Up–Down</button>
            <button onClick={() => handlePlay('down-up')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼▲ Down–Up</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Fretboard
            scale={pattern}
            fretRange={fretRange}
            scalePositions={scalePositions}
            fretsNum={fretsNum}
          />
        </div>
      </div>
```

with:

```tsx
      {/* Fretboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-ink">
            {viewMode === 'box' ? (
              <>
                {root} {scaleDef.name} — {CAGED_BOXES[positionIdx].label}
                {drillMode === 'free-explore' && (
                  <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
                )}
              </>
            ) : (
              <>{root} {scaleDef.name} — Diagonal Pattern</>
            )}
          </p>
          <div className="flex gap-1">
            <button onClick={() => handlePlay('ascending')}  className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲ Up</button>
            <button onClick={() => handlePlay('descending')} className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼ Down</button>
            <button onClick={() => handlePlay('up-down')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▲▼ Up–Down</button>
            <button onClick={() => handlePlay('down-up')}    className="text-xs px-3 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors">▼▲ Down–Up</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {viewMode === 'box' ? (
            <Fretboard
              scale={pattern}
              fretRange={fretRange}
              scalePositions={scalePositions}
              fretsNum={fretsNum}
            />
          ) : (
            <Fretboard
              scale={pattern}
              scalePositions={diagonalPositions}
              fretsNum={diagonalFretsNum}
            />
          )}
        </div>
      </div>
```

- [ ] **Step 12: Gate the Modal context reference panel to Box mode**

The panel is already gated by `scaleDef.intervals.length === 7`, which pentatonic scales never satisfy, so no code change is strictly required — but Diagonal mode should never show it even if a future scale addition accidentally has 7 intervals and 5-length is loosened. Replace the existing gate condition (line 294):

```tsx
      {drillMode === 'free-explore' && scaleDef.intervals.length === 7 && (
```

with:

```tsx
      {viewMode === 'box' && drillMode === 'free-explore' && scaleDef.intervals.length === 7 && (
```

- [ ] **Step 13: Verify lint passes**

Run: `npm run lint`
Expected: no errors. If TypeScript complains about `DiagonalCell` being unused as a type-only import, confirm it's actually referenced (it isn't directly annotated anywhere in this file's new code — `diagonalCells` is inferred from `generateDiagonalPentatonic`'s return type). If unused, remove `type DiagonalCell` from the import in Step 1 rather than leaving an unused import (`tsc --noEmit` with default settings doesn't error on unused imports unless `noUnusedLocals` is set — check `tsconfig.json` for `noUnusedLocals`; if present and true, drop the unused type import).

- [ ] **Step 14: Manual smoke test**

Run `npm run dev`, open `http://localhost:3000/Guitar_Chords/scale-positions` in a browser, and verify:

1. Page loads in Box mode by default (unchanged from before this change) — 5 CAGED position buttons visible, Explore/Drill tabs visible.
2. Click **Diagonal**. The CAGED position buttons and Explore/Drill tabs disappear; 3 checkboxes appear ("Cell 1 (E–A)", "Cell 2 (D–G)", "Cell 3 (B–E)"), all checked.
3. Scale dropdown now only lists "Minor Pentatonic" and "Major Pentatonic".
4. Set Root to **G**, Scale to **Major Pentatonic**. Fretboard shows exactly: low E frets 3,5,7; A string frets 5,7; D string frets 5,7,9; G string frets 7,9; B string frets 8,10,12; high E frets 10,12 — matching the spec's worked example.
5. Uncheck "Cell 2 (D–G)" — the D/G string dots disappear, Cell 1 and Cell 3 dots remain.
6. Click **▲ Up** — audio plays Cell 1's notes then jumps directly to Cell 3's notes (no gap indicator, per spec).
7. Re-check Cell 2, switch Scale to **Minor Pentatonic** — cells recompute correctly for G Minor Pentatonic (frets shift per the minor pentatonic intervals `[0,3,5,7,10]`).
8. Change Root to **G#** — verify Cell 3 renders correctly at higher frets (up into the low-to-mid 20s) without crashing or clipping, and the fretboard's `fretsNum` grows to accommodate it.
9. Click **Box** to switch back — CAGED position buttons and Explore/Drill tabs reappear; previously-selected `positionIdx`/`drillMode` state is intact (no reset).
10. In Box mode, click **Drill: Name the Position** — quiz still works exactly as before (unaffected by this change).

- [ ] **Step 15: Commit**

```bash
git add src/pages/ScalePositions.tsx
git commit -m "feat: add Diagonal pentatonic view mode to Scale Positions"
```

---

## Self-Review

**Spec coverage:**
- Overview / cell shape / octave-per-cell math → Task 1 algorithm, verified against worked example in Task 1 Step 3 and Task 2 Step 14.
- "New state" (`viewMode`, `visibleCells`) → Task 2 Step 2.
- "View mode toggle" behavior (force free-explore, hide CAGED selector → checkboxes, restrict scale dropdown, reset scaleIdx) → Task 2 Steps 6-10.
- "Modal context reference panel" unaffected → Task 2 Step 12 (defensive gate added).
- `DiagonalCell` / `generateDiagonalPentatonic` exact interface → Task 1 Step 1.
- Pitch-walk algorithm steps 1-7 → Task 1 Step 1 implementation matches line-for-line.
- High-fret roots (no capping) → Task 2 Step 14 manual test #8.
- Rendering (`diagonalCells`/`diagonalPositions` useMemo, no `fretRange` in diagonal, `fretsNum` growth) → Task 2 Steps 3, 11.
- Playback (`getDiagonalNotes`, cell-then-cell order, no gap indicator) → Task 2 Steps 4-5, manual test #6.
- Edge cases (all cells unchecked, scale switching, root switching) → covered by existing `useMemo` dependency arrays; no special-casing needed, consistent with spec's "no manual reset needed."
- Out of scope items (blues/7-note diagonals, drill mode, alternate pairings, localStorage persistence) → correctly not implemented.

**Placeholder scan:** No TBD/TODO markers; all code blocks are complete and copy-pasteable.

**Type consistency:** `getDiagonalNotes()` returns `Array<[string, number]>`, matching `getBoxNotes()`'s return type exactly, so `handlePlay` (Task 2 Step 5) needs no signature changes. `DiagonalCell.positions[].note` is typed `Note`, consistent with `ALL_NOTES: Note[]` indexing. `OPEN_STRING_MIDI` is defined once (Task 1) and imported (not redefined) in Task 2.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-10-diagonal-pentatonic-patterns.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
