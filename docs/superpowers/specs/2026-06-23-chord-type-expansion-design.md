# Chord Type Expansion Design

**Date:** 2026-06-23  
**Status:** Approved

## Goal

Add comprehensive chord type support across GuitarMaster: diminished, augmented, diminished 7th, and half-diminished (m7b5) chords. This unlocks the vii° chord on the Circle of Fifths page and enriches the Dictionary and Progressions pages with the full fundamental chord vocabulary.

## Scope

- All four triad types covered: Major ✓, Minor ✓, Diminished (new), Augmented (new)
- All standard 7th qualities covered: Dom7 ✓, Maj7 ✓, m7 ✓, Dim7 (new), m7b5 (new)
- Extended chords (add9, 6th, 9th) are out of scope for this task

## Section 1 — Data Layer (`src/data/guitarData.ts`)

Add four new entries to the `shapes` array. The existing transposition loop at module load auto-generates all 12 keys for each new shape — no additional iteration code needed.

### New shape templates

| Type | `nameStr` | `baseRoot` | `relFrets` | `fingers` | `rootString` |
|---|---|---|---|---|---|
| dim | `'dim (A Shape)'` | `'A'` | `[-1, 0, 1, 2, 1, -1]` | `[-1, 0, 1, 3, 2, -1]` | `1` |
| aug | `'aug (A Shape)'` | `'A'` | `[-1, 0, 3, 2, 2, 1]` | `[-1, 0, 4, 3, 2, 1]` | `1` |
| dim7 | `'dim7 (A Shape)'` | `'A'` | `[-1, 0, 1, 2, 1, 2]` | `[-1, 0, 1, 3, 2, 4]` | `1` |
| m7b5 | `'m7b5 (A Shape)'` | `'A'` | `[-1, 0, 1, 0, 1, -1]` | `[-1, 0, 1, 0, 2, -1]` | `1` |

### Voicing verification (all shapes, root A)

All notes confirmed by interval calculation:

| Shape | Frets | Notes | Expected | Pass |
|---|---|---|---|---|
| dim `[-1,0,1,2,1,-1]` | x-A-Eb-A-C-x | A, C, Eb | Adim (1, b3, b5) | ✓ |
| aug `[-1,0,3,2,2,1]` | x-A-F-A-C#-F | A, C#, F | Aaug (1, 3, #5) | ✓ |
| dim7 `[-1,0,1,2,1,2]` | x-A-Eb-A-C-F# | A, C, Eb, F# | Adim7 (1, b3, b5, bb7) | ✓ |
| m7b5 `[-1,0,1,0,1,-1]` | x-A-Eb-G-C-x | A, C, Eb, G | Am7b5 (1, b3, b5, b7) | ✓ |

At max shift (11 semitones), highest fret = max(relFrets)+11 ≤ 14 for all shapes. All 12 transpositions are safe.

### Chord name convention

Generated names follow the existing pattern: `"${note} ${nameStr}"`, e.g. `"B dim (A Shape)"`. The `nameStr` prefix (`'dim'`, `'aug'`, `'dim7'`, `'m7b5'`) is the substring used for lookups.

## Section 2 — Circle of Fifths (`src/pages/Circle.tsx`)

### `getDiatonicChord` update

Remove the `if (quality === 'dim') return null` bail. Add a lookup branch that matches `c.name.includes('dim')` for quality `'dim'`, consistent with how Major and Minor are matched.

```ts
// Before
if (quality === 'dim') return null;

// After
chords.find(c =>
  quality === 'Major' ? c.name.includes('Major') :
  quality === 'Minor' ? c.name.includes('Minor') :
  /* dim */            c.name.includes('dim')
) ?? null
```

Note: `dim7` names also contain `'dim'`, so the match will prefer the first result. Since `dim` shapes are added before `dim7` in the `shapes` array, the dim triad is returned first — correct for the diatonic vii° use case.

### `handleDegreeClick` update

Remove the `if (deg.quality === 'dim') return` guard. The vii° button becomes fully interactive.

### Button styling

Add a third visual state for `isDim`: a distinct muted color (e.g. `border-purple-400 text-purple-600`) to communicate diminished quality visually, separate from Major (blue) and Minor (gray).

Remove `disabled={isDim}` and `cursor-not-allowed` / `opacity-40` from the vii° button.

## Section 3 — Dictionary & Progressions (no code changes)

Both pages read directly from `COMMON_CHORDS`. Once the data layer is updated, new chord types appear automatically:
- **Dictionary**: dim, aug, dim7, m7b5 entries appear in the chord list for every root note
- **Progressions**: chord picker includes the new types for all roots

No changes required in `Dictionary.tsx` or `Progressions.tsx`.

## File Change Summary

| File | Change |
|---|---|
| `src/data/guitarData.ts` | Add 4 shape templates to `shapes` array |
| `src/pages/Circle.tsx` | Update `getDiatonicChord`, `handleDegreeClick`, and vii° button styling |

## Out of Scope

- Minor key diatonic mode on Circle of Fifths (would add aug as III+)
- Extended chords: add9, 6th, 9th, major 6th
- Open-position voicings for new types (transposed barre shapes are sufficient)
