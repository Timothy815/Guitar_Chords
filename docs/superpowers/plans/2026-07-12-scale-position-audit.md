# Scale Position Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Box view's fret-15 cap, surface alternate (duplicate) fret-board locations for CAGED/box shapes, give Whole Tone and both Diminished scales a real sliding-shape position system, verify the remaining scale families against authoritative teaching sources, and fix the Minor Blues arpeggiator's duplicate-note bug — across `Dictionary.tsx` and `ScalePositions.tsx`.

**Architecture:** A single new pure utility, `findShapeAnchors`, takes one fingering shape (relative fret offsets per string) plus a repeat interval and returns every fret on the neck where that shape validly repeats. Standard CAGED/box shapes repeat every 12 frets (surfacing the "duplicate location" the user asked for); a new `symmetricScalePatterns.ts` file authors one real shape each for Whole Tone (repeats every 2 frets) and both Diminished scales (repeat every 3 frets), reusing the same utility to tile the neck. Both pages already branch on "strict pattern available or not" — this plan replaces their per-position option builders with one that calls `findShapeAnchors` and keeps every result as a selectable entry, carrying the resolved `pattern`/`anchorFret` on each option so downstream fretboard rendering no longer re-derives anchors from a fixed 5-entry array.

**Tech Stack:** React 19 + TypeScript, Vite. No test runner — `npm run lint` (`tsc --noEmit`) is the only static check. Pattern-lib files self-validate via build-time `throw` assertions evaluated at module load; `npx tsx <file>` forces that evaluation from the command line.

## Global Constraints

- No test suite exists. Verification is: `npm run lint` passes, `npx tsx <lib-file>` runs clean for every touched/new lib file (forces build-time assertions), and manual verification in the running app (`npm run dev`) per the spec's Testing section.
- Every pattern-lib file follows the existing convention: `type X = readonly (readonly number[])[]`, 6 sub-arrays low-E→high-E, frets stored as intervals-from-root (root sits at fret 0 of low E; `STRING_OFFSETS = [0, 5, 10, 15, 19, 24]` converts string+fret to interval mod 12).
- `findShapeAnchors`'s bounds default to `{ min: 0, max: 24 }` — do not hardcode a different range anywhere it's called.
- No changes to `IntervalFretboard.tsx`, `Caged.tsx`, or `buildThreeNpsPattern`/`buildDiagonalPattern` (Dictionary.tsx lines ~173–272, the 3NPS/Pathway views) — out of scope per the spec.
- Alternate-location entries must never appear as distinct Drill-mode quiz answers in `ScalePositions.tsx` — quiz by shape identity (`shapeLabel`), not fret location.

---

### Task 1: Symmetric scale pattern library

**Files:**
- Create: `src/lib/symmetricScalePatterns.ts`

**Interfaces:**
- Produces: `getSymmetricScalePattern(scaleName: string): SymmetricScalePattern | null`, `getSymmetricScaleRepeat(scaleName: string): number | null`, exported type `SymmetricScalePattern = readonly (readonly number[])[]`. Task 2 imports both functions.

- [ ] **Step 1: Write the file**

```ts
export type SymmetricScalePattern = readonly (readonly number[])[];

const STRING_OFFSETS = [0, 5, 10, 15, 19, 24] as const;

// Whole Tone: derived mathematically (Recommended, per design discussion) — every
// scale tone is a whole step apart, so a 2-notes-per-string shape a whole step wide
// on each string, staggered by a semitone between string pairs, covers the scale
// with no repeated pitch classes.
const WHOLE_TONE: SymmetricScalePattern = [[0, 2], [1, 3], [0, 2], [1, 3], [1, 3], [0, 2]];

// Diminished shapes: 3-notes-per-string, alternating 1-2-4 / 1-3-4 finger pattern,
// sourced from jazzguitar.be/blog/diminished-scale/, jazz-guitar-licks.com, and
// unlocktheguitar.net's 3NPS diminished-scale fingering articles.
const DIM_WHOLE_HALF: SymmetricScalePattern = [[0, 2, 3], [0, 1, 3], [-1, 1, 2], [-1, 0, 2], [-1, 1, 2], [-1, 0, 2]];
const DIM_HALF_WHOLE: SymmetricScalePattern = [[1, 3, 4], [1, 2, 4], [0, 2, 3], [0, 1, 3], [0, 2, 3], [0, 1, 3]];

const PATTERNS: Record<string, SymmetricScalePattern> = {
  'Whole Tone': WHOLE_TONE,
  'Diminished (Half-Whole)': DIM_HALF_WHOLE,
  'Diminished (Whole-Half)': DIM_WHOLE_HALF,
};

const REPEAT_SEMITONES: Record<string, number> = {
  'Whole Tone': 2,
  'Diminished (Half-Whole)': 3,
  'Diminished (Whole-Half)': 3,
};

// Must match src/data/guitarData.ts COMMON_SCALES exactly.
const SCALE_INTERVALS: Record<string, readonly number[]> = {
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished (Half-Whole)': [0, 1, 3, 4, 6, 7, 9, 10],
  'Diminished (Whole-Half)': [0, 2, 3, 5, 6, 8, 9, 11],
};

function mod12(value: number) { return ((value % 12) + 12) % 12; }

for (const [name, pattern] of Object.entries(PATTERNS)) {
  const allowed = SCALE_INTERVALS[name];
  const repeatSemitones = REPEAT_SEMITONES[name];

  if (pattern.length !== 6) throw new Error(`${name} symmetric shape must define six strings`);

  // Interval-membership: every stored fret is a valid scale degree, root on fret 0 of low E.
  pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const interval = mod12(STRING_OFFSETS[stringIndex] + fret);
    if (!allowed.includes(interval)) {
      throw new Error(`${name} symmetric shape contains invalid interval ${interval} on string ${stringIndex}`);
    }
  }));

  // Periodicity: the same literal shape, re-anchored repeatSemitones higher, must still land
  // entirely on scale tones — this is what lets findShapeAnchors tile the neck with one shape.
  pattern.forEach((frets, stringIndex) => frets.forEach(fret => {
    const shiftedInterval = mod12(STRING_OFFSETS[stringIndex] + fret + repeatSemitones);
    if (!allowed.includes(shiftedInterval)) {
      throw new Error(`${name} symmetric shape is not periodic at ${repeatSemitones} semitones`);
    }
  }));
}

export function getSymmetricScalePattern(scaleName: string): SymmetricScalePattern | null {
  return PATTERNS[scaleName] ?? null;
}

export function getSymmetricScaleRepeat(scaleName: string): number | null {
  return REPEAT_SEMITONES[scaleName] ?? null;
}
```

- [ ] **Step 2: Verify build-time assertions pass**

Run: `npx tsx src/lib/symmetricScalePatterns.ts`
Expected: exits with no output and exit code 0 (no thrown error). If any assertion throws, the shape data above has a transcription error — re-check the fret numbers against this plan (they've been hand-verified interval-by-interval; a throw means a typo was introduced, not a data problem).

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/symmetricScalePatterns.ts
git commit -m "feat: add symmetric scale fingering patterns for Whole Tone and Diminished"
```

---

### Task 2: `findShapeAnchors` utility and symmetric-scale routing

**Files:**
- Modify: `src/lib/cagedScalePatterns.ts`

**Interfaces:**
- Consumes: `getSymmetricScalePattern`, `getSymmetricScaleRepeat` from `./symmetricScalePatterns` (Task 1).
- Produces: `findShapeAnchors(pattern, baseAnchor, repeatSemitones, bounds?): number[]`, `getCagedScaleRepeat(scaleName: string): number`. Both consumed by Task 3 (Dictionary.tsx) and Task 5 (ScalePositions.tsx). `getCagedScalePattern` and `getCagedScaleAnchor` keep their existing signatures — callers don't change.

- [ ] **Step 1: Add the import and the two new exports**

Add to the top of `src/lib/cagedScalePatterns.ts`:

```ts
import { getSymmetricScalePattern, getSymmetricScaleRepeat } from './symmetricScalePatterns';
```

Add after `getIonianParentRootFret` import (anywhere at module scope, before `getCagedScalePattern`):

```ts
export function findShapeAnchors(
  pattern: readonly (readonly number[])[],
  baseAnchor: number,
  repeatSemitones: number,
  bounds: { min: number; max: number } = { min: 0, max: 24 },
): number[] {
  const offsets = pattern.flat();
  const minOffset = offsets.length ? Math.min(...offsets) : 0;
  const maxOffset = offsets.length ? Math.max(...offsets) : 0;
  const fits = (anchor: number) => anchor + minOffset >= bounds.min && anchor + maxOffset <= bounds.max;
  const anchors = new Set<number>([baseAnchor]);
  for (let anchor = baseAnchor - repeatSemitones; fits(anchor); anchor -= repeatSemitones) anchors.add(anchor);
  for (let anchor = baseAnchor + repeatSemitones; fits(anchor); anchor += repeatSemitones) anchors.add(anchor);
  return [...anchors].sort((a, b) => a - b);
}

export function getCagedScaleRepeat(scaleName: string): number {
  return getSymmetricScaleRepeat(scaleName) ?? 12;
}
```

- [ ] **Step 2: Route `getCagedScalePattern` through symmetric scales first**

Replace the existing `getCagedScalePattern` function body:

```ts
export function getCagedScalePattern(scaleName: string, positionIndex: number) {
  const symmetricPattern = getSymmetricScalePattern(scaleName);
  if (symmetricPattern) return positionIndex === 0 ? symmetricPattern : null;
  return getPentatonicPattern(scaleName, positionIndex)
    ?? getBluesBoxPattern(scaleName, positionIndex)
    ?? getIonianCagedPattern(scaleName, positionIndex)
    ?? getMinorFamilyCagedPattern(scaleName, positionIndex);
}
```

`getCagedScaleAnchor` and `supportsCagedScale` need no changes — `getCagedScaleAnchor`'s `offsets` computation already calls `getCagedScalePattern` for indices 0–4 and flattens whatever comes back (index 0 only, for symmetric scales), and `getIonianParentRootFret`/`getMinorFamilyParentRootFret` already pass unrecognized scale names through unchanged, so `anchorFret` correctly resolves to `rootFret` for Whole Tone/Diminished. `supportsCagedScale` already returns `true` once `getCagedScalePattern(scaleName, 0) !== null`, which is now true for the three symmetric scales — this is what lights up the previously-hidden tab automatically.

- [ ] **Step 3: Verify build-time assertions and types**

Run: `npx tsx src/lib/cagedScalePatterns.ts`
Expected: exits with no output and exit code 0.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cagedScalePatterns.ts
git commit -m "feat: add findShapeAnchors utility and symmetric-scale routing"
```

---

### Task 3: Dictionary.tsx — fret-15 cap, alternate locations, symmetric scales

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `findShapeAnchors`, `getCagedScaleRepeat` from `../lib/cagedScalePatterns` (Task 2, added to the existing import at line 16).
- Produces: a shared `ScalePositionOption` type used by both `scalePositionOptions` and `scaleBoxOptions`; both memos now return `{ id, shapeLabel, label, range, pattern, anchorFret }[]` instead of `{ id, label, range }[]`. `strictScalePositionPositions`/`strictScaleBoxPositions` are simplified to look up the selected option and build positions from its `pattern`/`anchorFret` directly. No other memo in the file (`scaleFretRange`, `scaleFretsNum`, `activeStrictScalePositions`) needs to change — they only read `.id` and `.range`, both still present.

- [ ] **Step 1: Add the import**

In `src/pages/Dictionary.tsx` line 16, change:

```ts
import { getCagedScaleAnchor, getCagedScalePattern, supportsCagedScale } from '../lib/cagedScalePatterns';
```

to:

```ts
import { getCagedScaleAnchor, getCagedScalePattern, getCagedScaleRepeat, findShapeAnchors, supportsCagedScale } from '../lib/cagedScalePatterns';
```

- [ ] **Step 2: Add the shared option type**

Immediately after the existing `type RelativeBoxPattern = readonly (readonly number[])[];` line (currently line 128), add:

```ts
type ScalePositionOption = {
  id: string;
  shapeLabel: string;
  label: string;
  range: [number, number];
  pattern: readonly (readonly number[])[] | null;
  anchorFret: number;
};
```

- [ ] **Step 3: Replace `scalePositionOptions`**

Replace the current `scalePositionOptions` useMemo (currently lines 565–594) with:

```ts
  const scalePositionOptions = useMemo<ScalePositionOption[]>(() => {
    if (!activeScaleBase) return [];
    const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
    const rootNoteIdx = ALL_NOTES.indexOf(selectedKey);
    const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;

    const repeatSemitones = getCagedScaleRepeat(activeScaleBase.name);
    if (repeatSemitones < 12) {
      const pattern = getCagedScalePattern(activeScaleBase.name, 0);
      if (!pattern) return [];
      const baseAnchor = getCagedScaleAnchor(activeScaleBase.name, rootFret);
      const offsets = pattern.flat();
      return findShapeAnchors(pattern, baseAnchor, repeatSemitones).map((anchorFret, index) => {
        const minFret = anchorFret + Math.min(...offsets);
        const maxFret = anchorFret + Math.max(...offsets);
        return {
          id: `sym${index + 1}`,
          shapeLabel: `Position ${index + 1}`,
          label: `Position ${index + 1} (${minFret}-${maxFret})`,
          range: [minFret, maxFret] as [number, number],
          pattern,
          anchorFret,
        };
      });
    }

    return SCALE_POSITION_BOXES.flatMap((box, positionIndex) => {
      const strictCagedPattern = getCagedScalePattern(activeScaleBase.name, positionIndex);
      if (strictCagedPattern) {
        const anchorFret = getCagedScaleAnchor(activeScaleBase.name, rootFret);
        const offsets = strictCagedPattern.flat();
        return findShapeAnchors(strictCagedPattern, anchorFret, 12).map((alt, altIndex) => {
          const minFret = alt + Math.min(...offsets);
          const maxFret = alt + Math.max(...offsets);
          return {
            id: altIndex === 0 ? box.id : `${box.id}-alt${altIndex}`,
            shapeLabel: box.label,
            label: `${box.label} (${minFret}-${maxFret})`,
            range: [minFret, maxFret] as [number, number],
            pattern: strictCagedPattern,
            anchorFret: alt,
          };
        });
      }
      let startFret = rootFret + box.startOff;
      if (startFret < 0) startFret = 0;
      if (startFret > 11) startFret = startFret % 12;
      const endFret = startFret + SCALE_BOX_SPAN;
      return [{
        id: box.id,
        shapeLabel: box.label,
        label: `${box.label} (${startFret}-${endFret})`,
        range: [startFret, endFret] as [number, number],
        pattern: null,
        anchorFret: startFret,
      }];
    });
  }, [activeScaleBase, selectedKey]);
```

- [ ] **Step 4: Replace `strictScalePositionPositions`**

Replace the current `strictScalePositionPositions` useMemo (currently lines 596–613) with:

```ts
  const strictScalePositionPositions = useMemo(() => {
    if (scaleViewMode !== 'position') return undefined;
    const option = scalePositionOptions.find(o => o.id === scalePositionSelection);
    if (!option?.pattern) return undefined;
    const positions = new Set<string>();
    option.pattern.forEach((stringOffsets, stringIdx) => {
      stringOffsets.forEach(offset => positions.add(`${stringIdx}-${option.anchorFret + offset}`));
    });
    return positions;
  }, [scalePositionOptions, scalePositionSelection, scaleViewMode]);
```

- [ ] **Step 5: Replace `scaleBoxOptions`**

Replace the current `scaleBoxOptions` useMemo (currently lines 615–645) with:

```ts
  const scaleBoxOptions = useMemo<ScalePositionOption[]>(() => {
    if (!boxViewSupported || !activeScaleBase) return [];
    const lowENoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[0] as Note);
    const rootNoteIdx = ALL_NOTES.indexOf(selectedKey);
    const rootFret = (rootNoteIdx - lowENoteIdx + 12) % 12;
    const familyBoxes = boxFamily === 'majorFamily' ? MAJOR_FAMILY_BOXES : MINOR_FAMILY_BOXES;
    return familyBoxes.flatMap(box => {
      const strictPattern = getStrictBoxPattern(activeScaleBase.name, box.id);
      if (strictPattern) {
        let anchorFret = getBluesPositionAnchor(activeScaleBase.name, rootFret);
        const allOffsets = strictPattern.flat();
        const minOffset = Math.min(...allOffsets);
        while (anchorFret + minOffset < 0) anchorFret += 12;
        return findShapeAnchors(strictPattern, anchorFret, 12).map((alt, altIndex) => {
          const minFret = Math.min(...allOffsets.map(o => alt + o));
          const maxFret = Math.max(...allOffsets.map(o => alt + o));
          return {
            id: altIndex === 0 ? box.id : `${box.id}-alt${altIndex}`,
            shapeLabel: box.label,
            label: `${box.label} (${minFret}-${maxFret})`,
            range: [minFret, maxFret] as [number, number],
            pattern: strictPattern,
            anchorFret: alt,
          };
        });
      }
      let startFret = rootFret + box.startOff;
      if (startFret < 0) startFret += 12;
      if (startFret > 14) startFret -= 12;
      const endFret = startFret + box.span;
      return [{
        id: box.id,
        shapeLabel: box.label,
        label: `${box.label} (${startFret}-${endFret})`,
        range: [startFret, endFret] as [number, number],
        pattern: null,
        anchorFret: startFret,
      }];
    });
  }, [activeScaleBase, boxFamily, boxViewSupported, selectedKey]);
```

- [ ] **Step 6: Replace `strictScaleBoxPositions` (this is Fix #1 — the fret-15 cap removal)**

Replace the current `strictScaleBoxPositions` useMemo (currently lines 646–673) with:

```ts
  const strictScaleBoxPositions = useMemo(() => {
    if (scaleViewMode !== 'box') return undefined;
    const option = scaleBoxOptions.find(o => o.id === scaleBoxSelection);
    if (!option?.pattern) return undefined;
    const positions = new Set<string>();
    option.pattern.forEach((stringOffsets, stringIdx) => {
      stringOffsets.forEach(offset => {
        const fret = option.anchorFret + offset;
        if (fret >= 0) positions.add(`${stringIdx}-${fret}`);
      });
    });
    return positions;
  }, [scaleBoxOptions, scaleBoxSelection, scaleViewMode]);
```

Note the cap `fret <= 15` is gone — `scaleFretsNum` (already unchanged, currently lines 742–746) computes `Math.max(15, Math.max(...frets) + 1)` from `activeStrictScalePositions`, so the fretboard now grows to fit exactly like the Position view already does.

- [ ] **Step 7: Update the tab label for symmetric scales**

In the Scale View tab list (currently around line 1365), change:

```tsx
{ id: 'position', label: 'CAGED', disabled: !cagedViewSupported },
```

to:

```tsx
{ id: 'position', label: activeScaleBase && getCagedScaleRepeat(activeScaleBase.name) < 12 ? 'Positions' : 'CAGED', disabled: !cagedViewSupported },
```

- [ ] **Step 8: Update the Position-view caption for symmetric scales**

In the same JSX block, the caption directly below the Position `<select>` (currently lines 1401–1403):

```tsx
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            CAGED view: root-relative neck regions organized by connected chord-shape positions.
                          </p>
```

Replace with:

```tsx
                          <p className="text-[10px] text-brand-secondary/70 leading-tight">
                            {activeScaleBase && getCagedScaleRepeat(activeScaleBase.name) < 12
                              ? 'Positions view: one symmetric shape, slid across the neck by its repeat interval.'
                              : 'CAGED view: root-relative neck regions organized by connected chord-shape positions.'}
                          </p>
```

- [ ] **Step 9: Type-check**

Run: `npm run lint`
Expected: no new errors. Pay attention to any implicit-`any` or union-mismatch errors on `scalePositionOptions`/`scaleBoxOptions` — both must satisfy `ScalePositionOption[]`.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, open `/dictionary`, Scales tab.
- Select Minor Pentatonic, Box view, cycle through all 5 boxes: confirm no note is cut off above fret 15 for boxes that extend past it, and the fretboard visibly grows to show them.
- Select any Ionian-family scale (e.g. Major (Ionian)), Position view, find a position whose fret range repeats near the nut (e.g. root near fret 12+); confirm an extra `<option>` appears in the dropdown for the alternate location and that selecting it renders the correct lower-fret notes.
- Select Whole Tone: confirm the tab label reads "Positions" (not "CAGED"), the tab is enabled, and the dropdown shows multiple sliding-position entries that tile the neck.
- Select each Diminished scale: same check, with entries every 3 frets.

- [ ] **Step 11: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "fix: remove Box view fret cap, surface alternate CAGED locations, support symmetric scale positions"
```

---

### Task 4: Dictionary.tsx arpeggiator MIDI dedup (Fix #5)

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- No new exports or signature changes — this is a self-contained fix inside the `arpPlaying` `useEffect`.

- [ ] **Step 1: Replace the note-collection loop**

In the `arpPlaying` `useEffect` (currently lines 960–1005), replace the note-collection block (currently lines 969–977):

```ts
      const scaleNotes: { stringIdx: number; fretIdx: number; note: string }[] = [];
      for (let s = 0; s < 6; s++) {
        for (let f = minFret; f <= maxFret; f++) {
          const noteStr = getFretNote(s, f);
          if (currentScale.notes.includes(noteStr.replace(/[0-9]/g, '') as any)) {
            scaleNotes.push({ stringIdx: s, fretIdx: f, note: noteStr });
          }
        }
      }
```

with:

```ts
      const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
      const scaleNotes: { stringIdx: number; fretIdx: number; note: string }[] = [];
      const seenMidi = new Set<number>();
      for (let s = 0; s < 6; s++) {
        for (let f = minFret; f <= maxFret; f++) {
          const noteStr = getFretNote(s, f);
          if (currentScale.notes.includes(noteStr.replace(/[0-9]/g, '') as any)) {
            const midi = OPEN_STRING_MIDI[s] + f;
            if (seenMidi.has(midi)) continue;
            seenMidi.add(midi);
            scaleNotes.push({ stringIdx: s, fretIdx: f, note: noteStr });
          }
        }
      }
```

This preserves the original string-major/fret-minor scan order (unlike `dedupedScalePositions`, which sorts by fret first — that would corrupt this loop's intended arpeggio playback order), and skips any candidate whose MIDI pitch was already claimed by an earlier (lower-indexed) string.

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/dictionary`, Scales tab. Select root A, Minor Blues, Position/Box view set to CAGED position 1, start the arpeggiator. Confirm the note sequence no longer plays a duplicate note between D# and E on the B string.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "fix: dedupe arpeggiator notes by MIDI pitch to remove duplicate B-string note"
```

---

### Task 5: ScalePositions.tsx — alternate locations and symmetric scale support

**Files:**
- Modify: `src/pages/ScalePositions.tsx`

**Interfaces:**
- Consumes: `getCagedScaleRepeat`, `findShapeAnchors` from `@/src/lib/cagedScalePatterns` (Task 2), added to the existing import at line 8.
- Produces: `PositionOption` type, `positionOptions` useMemo, `selectedOption` useMemo, `selectedPositionId` state (replaces `positionIdx` state). `CAGED_BOXES` gains an `id` field per entry.

- [ ] **Step 1: Update the import and add `id` to `CAGED_BOXES`**

Line 1, add `useEffect` to the React import:

```ts
import React, { useState, useCallback, useEffect, useMemo } from 'react';
```

Line 8, add the two new imports:

```ts
import { getCagedScaleAnchor, getCagedScalePattern, getCagedScaleRepeat, findShapeAnchors, supportsCagedScale } from '@/src/lib/cagedScalePatterns';
```

Lines 16–22, add `id` to each entry:

```ts
const CAGED_BOXES = [
  { id: 'pos1', label: 'Position 1 (E-shape)', startOff: -1 },
  { id: 'pos2', label: 'Position 2 (D-shape)', startOff: 2 },
  { id: 'pos3', label: 'Position 3 (C-shape)', startOff: 4 },
  { id: 'pos4', label: 'Position 4 (A-shape)', startOff: 7 },
  { id: 'pos5', label: 'Position 5 (G-shape)', startOff: 9 },
];
```

- [ ] **Step 2: Add the `PositionOption` type**

After the `BOX_SPAN = 4;` line (currently line 24), add:

```ts
type PositionOption = {
  id: string;
  shapeLabel: string;
  label: string;
  range: [number, number];
  pattern: readonly (readonly number[])[] | null;
  anchorFret: number;
};
```

- [ ] **Step 3: Replace `positionIdx` state with `selectedPositionId`, and remove the old fret-window chain**

Replace line 42 (`const [positionIdx, setPositionIdx] = useState(0);`) with:

```ts
  const [selectedPositionId, setSelectedPositionId] = useState('pos1');
```

Replace lines 59–75 (from `const box = CAGED_BOXES[positionIdx];` through `const fretsNum = Math.max(12, endFret + 1);`) with:

```ts
  const isSymmetric = cagedSupported && getCagedScaleRepeat(scaleDef.name) < 12;

  const positionOptions = useMemo<PositionOption[]>(() => {
    if (!cagedSupported) return [];
    const repeatSemitones = getCagedScaleRepeat(scaleDef.name);
    if (repeatSemitones < 12) {
      const pattern = getCagedScalePattern(scaleDef.name, 0);
      if (!pattern) return [];
      const baseAnchor = getCagedScaleAnchor(scaleDef.name, rootFret);
      const offsets = pattern.flat();
      return findShapeAnchors(pattern, baseAnchor, repeatSemitones).map((anchorFret, index) => {
        const minFret = anchorFret + Math.min(...offsets);
        const maxFret = anchorFret + Math.max(...offsets);
        return {
          id: `sym${index + 1}`,
          shapeLabel: `Position ${index + 1}`,
          label: `Position ${index + 1} (${minFret}-${maxFret})`,
          range: [minFret, maxFret] as [number, number],
          pattern,
          anchorFret,
        };
      });
    }
    return CAGED_BOXES.flatMap((box, boxIndex) => {
      const pattern = getCagedScalePattern(scaleDef.name, boxIndex);
      if (pattern) {
        const anchorFret = getCagedScaleAnchor(scaleDef.name, rootFret);
        const offsets = pattern.flat();
        return findShapeAnchors(pattern, anchorFret, 12).map((alt, altIndex) => {
          const minFret = alt + Math.min(...offsets);
          const maxFret = alt + Math.max(...offsets);
          return {
            id: altIndex === 0 ? box.id : `${box.id}-alt${altIndex}`,
            shapeLabel: box.label,
            label: `${box.label} (${minFret}-${maxFret})`,
            range: [minFret, maxFret] as [number, number],
            pattern,
            anchorFret: alt,
          };
        });
      }
      let startFret = rootFret + box.startOff;
      if (startFret < 0) startFret = 0;
      if (startFret > 11) startFret = startFret % 12;
      const endFret = startFret + BOX_SPAN;
      return [{
        id: box.id,
        shapeLabel: box.label,
        label: `${box.label} (${startFret}-${endFret})`,
        range: [startFret, endFret] as [number, number],
        pattern: null,
        anchorFret: startFret,
      }];
    });
  }, [cagedSupported, scaleDef, rootFret]);

  const selectedOption = useMemo(
    () => positionOptions.find(o => o.id === selectedPositionId) ?? positionOptions[0],
    [positionOptions, selectedPositionId],
  );

  useEffect(() => {
    if (positionOptions.length && !positionOptions.some(o => o.id === selectedPositionId)) {
      setSelectedPositionId(positionOptions[0].id);
    }
  }, [positionOptions, selectedPositionId]);

  const fretRange: [number, number] = selectedOption ? selectedOption.range : [0, BOX_SPAN];
  const fretsNum = Math.max(12, fretRange[1] + 1);
```

- [ ] **Step 4: Replace `scalePositions`**

Replace the current `scalePositions` useMemo (currently lines 83–110, which starts `const scalePositions = useMemo(() => { if (strictCagedPattern) {`) with:

```ts
  const scalePositions = useMemo(() => {
    if (selectedOption?.pattern) {
      const positions = new Set<string>();
      selectedOption.pattern.forEach((frets, stringIdx) => {
        frets.forEach(relativeFret => positions.add(`${stringIdx}-${selectedOption.anchorFret + relativeFret}`));
      });
      return positions;
    }
    const [rangeStart, rangeEnd] = fretRange;
    const candidates: { s: number; f: number; midi: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const openMidi = OPEN_STRING_MIDI[s];
      const openNoteIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = rangeStart; f <= rangeEnd; f++) {
        const name = ALL_NOTES[(openNoteIdx + f) % 12];
        if (pattern.notes.includes(name as Note)) {
          candidates.push({ s, f, midi: openMidi + f });
        }
      }
    }
    // Sort by fret ascending — lower fret wins for the same MIDI pitch.
    candidates.sort((a, b) => a.f - b.f);
    const seen = new Set<number>();
    const positions = new Set<string>();
    for (const { s, f, midi } of candidates) {
      if (!seen.has(midi)) { seen.add(midi); positions.add(`${s}-${f}`); }
    }
    return positions;
  }, [pattern, fretRange, selectedOption]);
```

- [ ] **Step 5: Replace `getBoxNotes`**

Replace the current `getBoxNotes` useCallback (currently lines 136–161) with:

```ts
  const getBoxNotes = useCallback((): Array<[string, number]> => {
    if (selectedOption?.pattern) {
      const notes: Array<[string, number]> = [];
      selectedOption.pattern.forEach((frets, stringIdx) => {
        const openIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[stringIdx] as Note);
        frets.forEach(relativeFret => {
          const fret = selectedOption.anchorFret + relativeFret;
          notes.push([ALL_NOTES[(openIdx + fret) % 12], OPEN_STRING_MIDI[stringIdx] + fret]);
        });
      });
      return notes.sort((a, b) => a[1] - b[1]);
    }
    const [rangeStart, rangeEnd] = fretRange;
    const seen = new Set<number>();
    const notes: Array<[string, number]> = [];
    for (let s = 0; s < 6; s++) {
      const openIdx = ALL_NOTES.indexOf(STANDARD_TUNING.notes[s] as Note);
      for (let f = rangeStart; f <= rangeEnd; f++) {
        const name = ALL_NOTES[(openIdx + f) % 12];
        if (pattern.notes.includes(name as Note)) {
          const pitch = OPEN_STRING_MIDI[s] + f;
          if (!seen.has(pitch)) { seen.add(pitch); notes.push([name, pitch]); }
        }
      }
    }
    return notes.sort((a, b) => a[1] - b[1]);
  }, [pattern, fretRange, selectedOption]);
```

- [ ] **Step 6: Replace `startDrill` to quiz on shape identity only**

Replace the current `startDrill` function (currently lines 188–200) with:

```ts
  function startDrill() {
    const newIdx = Math.floor(Math.random() * CAGED_BOXES.length);
    const correct = CAGED_BOXES[newIdx].label;
    const shuffled = CAGED_BOXES
      .filter((_, i) => i !== newIdx)
      .map(b => b.label)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    setSelectedPositionId(CAGED_BOXES[newIdx].id);
    setQuizOptions([correct, ...shuffled].sort(() => Math.random() - 0.5));
    setCorrectAnswer(correct);
    setSelected(null);
  }
```

`CAGED_BOXES[newIdx].id` always resolves to a canonical (non-`-altN`) entry, so alternate-location entries never surface as quiz answers or quiz targets, matching the spec's Drill-mode scope requirement.

- [ ] **Step 7: Gate the Drill tab off for symmetric scales**

Replace the Mode tabs block (currently lines 289–307):

```tsx
      {viewMode === 'box' && cagedSupported && (
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

with:

```tsx
      {viewMode === 'box' && cagedSupported && (
        <div className="flex gap-2">
          {(['free-explore', 'identify-position'] as DrillMode[])
            .filter(m => m !== 'identify-position' || !isSymmetric)
            .map(m => (
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

- [ ] **Step 8: Render `positionOptions` in the button row**

Replace the Position selector block (currently lines 309–327):

```tsx
      {viewMode === 'box' && cagedSupported && drillMode === 'free-explore' && (
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
      {viewMode === 'box' && cagedSupported && drillMode === 'free-explore' && (
        <div className="flex gap-2 flex-wrap">
          {positionOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setSelectedPositionId(option.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                selectedPositionId === option.id
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 9: Update the fretboard header to use `selectedOption`**

Replace the header paragraph (currently lines 361–367):

```tsx
            {viewMode === 'box' ? (
              <>
                {root} {scaleDef.name} — {CAGED_BOXES[positionIdx].label}
                {drillMode === 'free-explore' && (
                  <span className="text-brand-secondary ml-2 text-xs">(frets {fretRange[0]}–{fretRange[1]})</span>
                )}
              </>
            ) : (
```

with:

```tsx
            {viewMode === 'box' ? (
              <>{root} {scaleDef.name} — {selectedOption?.label ?? ''}</>
            ) : (
```

(The fret range is now embedded directly in `selectedOption.label`, e.g. `"Position 3 (C-shape) (12-16)"`, so the separate `(frets X–Y)` span is redundant and removed.)

- [ ] **Step 10: Type-check**

Run: `npm run lint`
Expected: no new errors. In particular, `positionIdx` must have zero remaining references — search the file to confirm.

- [ ] **Step 11: Manual verification**

Run: `npm run dev`, open `/scale-positions`.
- Root G, Major Pentatonic, Box view: cycle through all 5 positions, confirm correct notes and that Position 3 (or whichever has a duplicate) now shows two buttons (one per fret-range).
- Select Whole Tone: confirm the button row shows several sliding "Position N" entries tiling the neck, Drill tab is disabled/absent, Explore still works and plays correctly.
- Select a Diminished scale: same check, positions 3 frets apart.
- Drill mode on a standard scale (e.g. Minor Pentatonic): confirm quiz answers are exactly the 5 canonical shape names (never an "-alt" fret-range variant), and selecting the correct answer highlights the drilled position correctly.

- [ ] **Step 12: Commit**

```bash
git add src/pages/ScalePositions.tsx
git commit -m "feat: surface alternate CAGED locations and symmetric scale positions in Scale Positions page"
```

---

### Task 6: Verify remaining scale families against authoritative sources (Fix #4)

**Files:**
- Modify (only if a mismatch is found): `src/lib/ionianCagedPatterns.ts`, `src/lib/minorFamilyCagedPatterns.ts`, `src/lib/bluesBoxPatterns.ts`
- Create: `docs/superpowers/specs/2026-07-12-scale-position-audit-verification.md`

**Interfaces:**
- No code interfaces — this is a research-and-compare task. If a mismatch is found and fixed, the existing build-time assertions in the modified file re-validate the fix automatically (no new assertion code needed).

**Context:** Minor Pentatonic has already been verified against an authoritative source (that work predates this plan). This task covers everything else: Major Pentatonic, Minor Blues, Major Blues, the Ionian-family template (shared by all 7 modes), Harmonic Minor, Melodic Minor, Phrygian Dominant. Major/Minor Pentatonic are *derived* from Major/Minor Blues by filtering out the blue note (see `getPentatonicPattern` in `src/lib/cagedScalePatterns.ts`), so verifying the two Blues scales' box shapes also verifies both Pentatonic scales' note membership — only their per-box degree ordering needs a separate sanity pass. Harmonic Minor, Melodic Minor, and Phrygian Dominant are *generated* from the Aeolian (Natural Minor) CAGED template via `alterAeolianPattern` in `src/lib/minorFamilyCagedPatterns.ts`, not hand-authored — if a mismatch is found there, the fix is a hand-authored override for that specific scale+position, not a change to the generation algorithm (the algorithm is a mechanical transposition and is not itself in question; only whether transposed Aeolian fingerings match how harmonic/melodic minor are actually taught is).

- [ ] **Step 1: Verify the Ionian-family template**

Current data, `src/lib/ionianCagedPatterns.ts`, `IONIAN_CAGED` (frets are intervals-from-root, root at fret 0 of low E; string order low-E, A, D, G, B, high-E):

```
Pos1 (E-shape): [[-1,0,2],[-1,0,2],[-1,1,2],[-1,1,2],[0,2],[-1,0,2]]
Pos2 (D-shape): [[2,4,5],[2,4],[1,2,4],[1,2,4],[2,4,5],[2,4,5]]
Pos3 (C-shape): [[4,5,7],[4,6,7],[4,6,7],[4,6],[4,5,7],[4,5,7]]
Pos4 (A-shape): [[7,9],[6,7,9],[6,7,9],[6,8,9],[7,9,10],[7,9]]
Pos5 (G-shape): [[9,11,12],[9,11,12],[9,11],[8,9,11],[9,10,12],[9,11,12]]
```

Using WebSearch/WebFetch, find 1–2 reputable guitar-teaching sources with an explicit fret diagram for the 5 CAGED major-scale positions (e.g. a well-known teaching site's "5 CAGED scale shapes" article, or a video transcript with tab). Compare each position's shape (relative fret pattern per string) against the stored data above, position-by-position, string-by-string. It's fine if the source uses a different key — normalize by subtracting the source's root fret before comparing.

If every position matches (allowing for the standard E-D-C-A-G naming/ordering convention): record "match" plus the source URL(s) in the verification doc (Step 6).

If any position doesn't match: correct the relevant sub-array in `IONIAN_CAGED` directly. The file's existing build-time assertions (interval-membership, position-to-position overlap) will throw immediately if the correction breaks internal consistency — resolve any such throw before moving on.

- [ ] **Step 2: Verify Minor Blues and Major Blues**

Current data, `src/lib/bluesBoxPatterns.ts`:

```
MINOR_BLUES:
box1: [[0,3],[0,1,2],[0,2],[0,2,3],[0,3],[0,3]]
box2: [[3,5,6],[2,5],[2,5],[2,3,4],[3,5],[3,5,6]]
box3: [[5,6,7],[5,7],[5,7,8],[4,7],[5,8],[5,6,7]]
box4: [[7,10],[7,10],[7,8,9],[7,9],[8,10,11],[7,10]]
box5: [[10,12],[10,12,13],[9,12],[9,12],[10,11,12],[10,12]]

MAJOR_BLUES:
box1: [[0,2,3],[-1,2],[-1,2],[-1,0,1],[0,2],[0,2,3]]
box2: [[2,3,4],[2,4],[2,4,5],[1,4],[2,5],[2,3,4]]
box3: [[4,7],[4,7],[4,5,6],[4,6],[5,7,8],[4,7]]
box4: [[7,9],[7,9,10],[6,9],[6,9],[7,8,9],[7,9]]
box5: [[9,12],[9,10,11],[9,11],[9,11,12],[9,12],[9,12]]
```

Find 1–2 reputable sources for the 5 (or equivalent) Minor Blues and Major Blues scale box shapes (many pentatonic-box teaching sources include the blue note as an add-on to the standard minor pentatonic boxes — that's a valid comparison target since Minor Blues = Minor Pentatonic + b5). Compare position-by-position as in Step 1. Correct + re-validate via the file's own assertions if any mismatch is found; record the result either way.

Also sanity-check Major/Minor Pentatonic's per-box starting degree against a source (their fret data is derived automatically via `getPentatonicPattern` in `cagedScalePatterns.ts`, so no separate fix location exists for them — if the derived pentatonic shape looks wrong, the bug is in the underlying Blues box data checked above, not in a separate pentatonic file).

- [ ] **Step 3: Verify Harmonic Minor, Melodic Minor, Phrygian Dominant**

Current data is generated, not hand-authored (`src/lib/minorFamilyCagedPatterns.ts`'s `alterAeolianPattern`, applied to the Ionian file's Aeolian template from Step 1). Find 1–2 reputable sources for Harmonic Minor's 5 CAGED-style positions specifically (Melodic Minor and Phrygian Dominant are less commonly taught as standalone CAGED systems — if no direct source exists for one of them, note that in the verification doc and instead confirm its notes are theoretically correct: Melodic Minor = Harmonic Minor with a natural 6th, Phrygian Dominant = mode V of Harmonic Minor, already asserted at module load).

Compare Harmonic Minor's generated shapes against the source. If a position doesn't match standard teaching, the fix is a targeted override: change `PATTERNS['Harmonic Minor'][positionIndex]` (and, if Phrygian Dominant inherits the same position via `PATTERNS['Phrygian Dominant'] = PATTERNS['Harmonic Minor']`, that override propagates automatically since it's a reference, not a copy — confirm that's still the desired behavior for the corrected position, or split the alias if a position needs to differ between the two scales).

- [ ] **Step 4: Verify Melodic Minor separately if it diverges from Harmonic Minor's pattern usage**

Melodic Minor's shapes are generated the same way as Harmonic Minor (Aeolian template with an altered 6th and 7th degree). If Step 3 found no correction was needed for the shared generation logic, Melodic Minor needs no separate fix — its correctness follows from the same `alterAeolianPattern` mechanism and the file's build-time interval-membership assertion (which runs independently per scale name). Record its verification result (match/not independently teachable via CAGED) in the doc regardless.

- [ ] **Step 5: Re-run all lib-file build-time checks**

Run each of:

```bash
npx tsx src/lib/ionianCagedPatterns.ts
npx tsx src/lib/minorFamilyCagedPatterns.ts
npx tsx src/lib/bluesBoxPatterns.ts
npx tsx src/lib/cagedScalePatterns.ts
npx tsx src/lib/symmetricScalePatterns.ts
```

Expected: every command exits with no output and exit code 0.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Write the verification appendix**

Create `docs/superpowers/specs/2026-07-12-scale-position-audit-verification.md` with one section per scale family verified in Steps 1–4:

```markdown
# Scale Position Audit — Verification Appendix

For each scale family: source(s) consulted, result (match / corrected), and what changed if corrected.

## Ionian-family template (all 7 modes)
- Source(s):
- Result:

## Minor Blues
- Source(s):
- Result:

## Major Blues
- Source(s):
- Result:

## Major Pentatonic / Minor Pentatonic (derived from Blues)
- Source(s):
- Result:

## Harmonic Minor
- Source(s):
- Result:

## Melodic Minor
- Source(s):
- Result:

## Phrygian Dominant
- Source(s):
- Result:
```

Fill in each `Source(s)`/`Result` pair with what was actually found and done in Steps 1–4 — no placeholder text.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-12-scale-position-audit-verification.md
# also add any lib files corrected in Steps 1-4, if any:
# git add src/lib/ionianCagedPatterns.ts src/lib/minorFamilyCagedPatterns.ts src/lib/bluesBoxPatterns.ts
git commit -m "docs: verify remaining scale families against authoritative sources"
```

---

## Self-Review

**Spec coverage:**
- Fix #1 (fret-15 cap) → Task 3 Step 6.
- Fix #2 (alternate locations) → Task 3 Steps 3/5 (Dictionary.tsx), Task 5 Step 3 (ScalePositions.tsx).
- Fix #3 (symmetric scales) → Task 1 (patterns), Task 2 Step 2 (routing), Task 3 Steps 3/7/8 (Dictionary.tsx UI), Task 5 Steps 3/7 (ScalePositions.tsx UI + Drill gating).
- Fix #4 (verification) → Task 6.
- Fix #5 (arpeggiator dedup) → Task 4.
- `findShapeAnchors` shared utility → Task 2 Step 1.
- Drill-mode quiz-by-shape-identity requirement → Task 5 Step 6.
- Out-of-scope items (3NPS, Pathway, IntervalFretboard, Caged.tsx) → untouched by every task; called out in Global Constraints.

**Placeholder scan:** No "TBD"/"implement later" strings in any task. Task 6 is a research task with a defined procedure and an explicit "no placeholder text" instruction for its own output — its *result* isn't knowable until executed, which is inherent to a verification task, not a plan gap.

**Type consistency:** `ScalePositionOption` (Dictionary.tsx, Task 3) and `PositionOption` (ScalePositions.tsx, Task 5) are separate local types in separate files by design (each page keeps its own option-building logic per the spec's Out of Scope section) but share the identical field shape (`id, shapeLabel, label, range, pattern, anchorFret`) so both consume `findShapeAnchors`/`getCagedScaleRepeat`/`getCagedScalePattern`/`getCagedScaleAnchor` from Task 2 identically. `findShapeAnchors`'s signature (`pattern, baseAnchor, repeatSemitones, bounds?`) is used identically in Task 3 Steps 3/5 and Task 5 Step 3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-12-scale-position-audit.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
