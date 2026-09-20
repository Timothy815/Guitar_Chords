# Jazz Manouche Chord Additions — Design Spec

## Goal

Add five chord qualities common in Jazz Manouche (Gypsy jazz) and mainstream jazz — **m6, 6, 6/9, mMaj7, 7b9** — so they are:

1. Browsable as real chord shapes in the Dictionary's Chords tab (`COMMON_CHORDS`).
2. Explained in the Dictionary's Theory tab, with "Open in Chords" / "Explore in Identify" / "Add to Progression" actions that work correctly.
3. Findable and constructible from fretboard input in the Dictionary's Identify tab — i.e. Tonal's `Chord.detect()` must name them correctly, and the app's navigation-routing logic must resolve that name back to the new shapes.

All three surfaces are backed by one set of new `COMMON_CHORDS` entries; the Theory and Identify tabs each need their own routing logic updated to recognize the new qualities.

## Architecture

- Add 5 new CAGED-style "A Shape" templates to the `shapes` array in `src/data/guitarData.ts`, following the existing single-shape precedent for `dim`/`aug`/`dim7`/`m7b5`/`sus2`. Each template is transposed across all 12 roots by the existing generation loop — no new machinery needed.
- Every new template **includes the perfect 5th**, unlike the existing 4-note shell voicings elsewhere in the file. This is required because Tonal's `Chord.detect()` only names m6/6/6/9/mMaj7/7b9 correctly when the 5th is present in the note set — omitting it produces ambiguous or wrong detections.
- Add 5 new cases to `Dictionary.tsx`'s `getNavigationChords()`, covering every alias Tonal's `chord-type` package recognizes for each quality, so a detected or typed chord symbol in any accepted spelling routes to the right shape.
- Add a new "Sixths & Jazz" family to `TheoryReference.tsx`'s `CHORD_FAMILIES`, with one `ChordTypeDef` per new quality, each carrying a `qualityPrefix` used by the Theory tab's own (simpler) name-matching mechanism for its action buttons.
- Two small existing-code fixes are required as prerequisites — without them, the new qualities would either misroute or get swept into the wrong existing feature (details in §3 and §4).

**Tech stack:** existing modules only (`@tonaljs/tonal`, already-shipped React components). No new dependencies.

---

## 1. `src/data/guitarData.ts` — five new chord shape templates

Add five entries to the `shapes` array, each `baseRoot: 'A'`, following the existing template shape (`relFrets`, `nameStr`, etc.) used by `dim`/`aug`/`dim7`/`m7b5`/`sus2`. All templates were verified by direct `Chord.detect()` execution against their resulting absolute note sets.

| Quality | `nameStr` | `relFrets` (low E → high E) | Notes (root=A) | `Chord.detect()` result |
|---|---|---|---|---|
| m6 | `"m6 (A Shape)"` | `[-1, 0, 2, 2, 1, 2]` | A, C, E, F# | `Am6` (first of `["Am6","F#m7b5/A"]`) |
| 6 | `"6 (A Shape)"` | `[-1, 0, 2, 2, 2, 2]` | A, C#, E, F# | `A6` (first of `["A6","F#m7/A"]`) |
| mMaj7 | `"mmaj7 (A Shape)"` | `[-1, 0, 2, 1, 1, 0]` | A, C, E, G# | `Am/ma7` (only result) |
| 6/9 | `"6/9 (A Shape)"` | `[-1, 0, 2, 4, 2, 2]` | A, C#, E, F#, B | `A6add9` (first of `["A6add9","F#m7add11/A","B11/A","B9sus4/A"]`) |
| 7b9 | `"7b9 (A Shape)"` | `[-1, 0, 2, 3, 2, 3]` | A, C#, E, G, A# | `A7b9` (first of `["A7b9","A#o7M7/A"]`) |

**Naming constraint:** the mMaj7 shape's `nameStr` must use lowercase `"mmaj7"`, never `"Maj7"` or `"mMaj7"`. `src/data/musicTheory.ts`'s `chordsForQuality()` does a case-sensitive `.includes('Maj7')` check (used by the Circle of Fifths borrowed-chord lookup) — a capitalized `"Maj7"` substring inside the mMaj7 shape's name would cause it to be misidentified as a plain Maj7 shape. `"mmaj7"` contains no `"Maj7"` substring, so this is safe.

Each root's transposed set will therefore gain five new browsable entries, e.g. for root A: `"A m6 (A Shape)"`, `"A 6 (A Shape)"`, `"A mmaj7 (A Shape)"`, `"A 6/9 (A Shape)"`, `"A 7b9 (A Shape)"` — appearing in the Chords tab's per-root shape list alongside the existing CAGED shapes.

---

## 2. `src/pages/Dictionary.tsx` — Identify tab: `getNavigationChords()`

### 2.1 Prerequisite fix: slash-split regex

`getNavigationChords()` (lines 63–108) splits a detected Tonal chord symbol on `/` to strip a bass note before matching quality. The exact substring to change, wherever it appears in that function:

```ts
tonalName.split('/')[0]
```

becomes:

```ts
tonalName.split(/\/(?=[A-G])/)[0]
```

**Why:** Tonal's canonical detection for mMaj7 is `Am/ma7` — a slash that is *not* a bass-note separator, it's part of the alias spelling `m/ma7`. The naive `split('/')[0]` would truncate this to `Am`, misrouting it to the plain Minor case. The fix only splits on `/` when it is immediately followed by a note letter A–G, which is the actual bass-note-slash convention (`Am7/G`, `C7/E`). Verified against both:
- New case: `"Am/ma7".split(/\/(?=[A-G])/)` → `["Am/ma7"]` (unchanged, no split — `m` after `/` is not A-G).
- Existing real slash chords: `"Am7/G".split(/\/(?=[A-G])/)` → `["Am7", "G"]`; `"C7/E".split(/\/(?=[A-G])/)` → `["C7", "E"]` (both split correctly, same as before).

### 2.2 New switch cases

Add alongside the existing quality cases in `getNavigationChords()`, covering every alias `@tonaljs/chord-type`'s `ChordType.all()` lists for each new quality:

```ts
case 'm6': case '-6':
  shapes = pool.filter(c => q(c).startsWith('m6')); break;
case '6': case 'add6': case 'M6':
  shapes = pool.filter(c => { const s = q(c); return s.startsWith('6') && !s.startsWith('6/9'); }); break;
case '6add9': case '6/9': case '69':
  shapes = pool.filter(c => q(c).startsWith('6/9')); break;
case 'm/ma7': case 'm/maj7': case 'mM7': case 'mMaj7':
  shapes = pool.filter(c => q(c).startsWith('mmaj7')); break;
case '7b9':
  shapes = pool.filter(c => q(c).startsWith('7b9')); break;
```

`q(c)` is the existing helper that returns the portion of `c.name` after `"<root> "`. For the new shapes this is e.g. `"m6 (A Shape)"`, `"6 (A Shape)"`, `"6/9 (A Shape)"`, `"mmaj7 (A Shape)"`, `"7b9 (A Shape)"`.

**Verified non-collision** (every pairwise `startsWith` check among new and existing cases):
- `'6'` vs `'6/9'`: `"6/9 (A Shape)".startsWith('6')` is `true`, so the `'6'` case explicitly excludes anything also starting with `'6/9'` via the `&& !s.startsWith('6/9')` guard.
- `'m6'` vs existing `'m7'`/`'m7b5'` cases: `"m6 (A Shape)"` does not start with `'m7'`, no collision.
- `'mmaj7'` vs existing `'Minor'`/`'m7'` cases: those match on different prefixes (`m` alone is not used as a bare case elsewhere; the codebase's existing Minor case matches full `"Minor"`, not a bare `'m'` prefix), no collision.
- `'7b9'` vs existing `'7'` case: the existing dominant-7 case in this switch matches `s.startsWith('7 ') || s === '7' || s.startsWith('7(')` (space, exact, or open-paren immediately after `7`) — `"7b9 (A Shape)"` matches none of those (next char after `7` is `b`, not space/end/paren), so it falls through cleanly to the new `case '7b9':`.

Every alias list above was taken directly from `@tonaljs/chord-type`'s `ChordType.all()` output at build time (verified via a Node.js script during design), so any of these spellings arriving from Tonal's `Chord.detect()` or from a typed/piano-input chord symbol will route correctly.

---

## 3. `src/components/TheoryReference.tsx` — new "Sixths & Jazz" family

### 3.1 Prerequisite fix: existing Dominant 7 entry

Current entry (~line 38):

```ts
{ name: 'Dominant 7', abbr: '7', intervals: [0,4,7,10], qualityPrefix: '7', context: 'V7 in any major or minor key' }
```

Change `qualityPrefix: '7'` to `qualityPrefix: '7 ('`.

**Why:** The Theory tab's action buttons match chords via `c.name.slice(root.length+1).startsWith(qualityPrefix)` against `COMMON_CHORDS[root]`. With the bare prefix `'7'`, the new `"7b9 (A Shape)"` entry would incorrectly match (`"7b9 (A Shape)".startsWith('7')` is `true`), polluting the Dominant 7 family's "add nearest voicing" behavior with a 7b9 shape. Tightening to `'7 ('` still matches the existing real Dominant-7 shape names (e.g. `"7 (A7 Shape)"`, `"7 (E7 Shape)"`) exactly as before, since every existing dominant-7 shape name has a space then an open paren immediately after the `7`. No existing behavior changes.

### 3.2 New family and five entries

Add a fourth family to `CHORD_FAMILIES`, alongside the existing Triads / 7ths & Extended / Suspended:

```ts
{
  family: 'Sixths & Jazz',
  chords: [
    { name: 'Major 6th', abbr: '6', intervals: [0,4,7,9], qualityPrefix: '6 (',
      context: 'Adds a 6th to a major triad — sweet, but a defining swing/Gypsy-jazz color.' },
    { name: 'Minor 6th', abbr: 'm6', intervals: [0,3,7,9], qualityPrefix: 'm6',
      context: 'The signature Jazz Manouche minor chord — minor triad plus a major 6th.' },
    { name: 'Six-Nine', abbr: '6/9', intervals: [0,4,7,9,14], qualityPrefix: '6/9',
      context: 'Major 6th chord with an added 9th — lush, often used as a I-chord substitute.' },
    { name: 'Minor-Major 7', abbr: 'm(maj7)', intervals: [0,3,7,11], qualityPrefix: 'mmaj7',
      context: 'Minor triad with a major 7th — the dramatic "minor tonic" sound in minor-key jazz.' },
    { name: '7♭9 (Altered Dominant)', abbr: '7b9', intervals: [0,4,7,10,13], qualityPrefix: '7b9',
      context: 'Dominant 7th with a flat 9 — the tense, exotic Gypsy-jazz/bebop dominant sound.' },
  ],
}
```

**Verified non-collision among the new `qualityPrefix` values themselves** (same `startsWith` mechanism as §2.2, since the Theory tab's matching is also a `startsWith` check):
- `'6 ('` vs `'6/9'`: `"6/9 (A Shape)".startsWith('6 (')` is `false` (`'6/9'` has no space after `6`) — no collision, and the reverse (`"6 (A Shape)".startsWith('6/9')`) is also `false`. Using the space+paren form for plain "6" (mirroring the codebase's existing `m7`/`m7b5` disambiguation pattern) avoids needing an explicit exclusion here, unlike §2.2 where the switch-case form required one.
- `'m6'` vs `'mmaj7'`: `"mmaj7 (A Shape)".startsWith('m6')` is `false` — no collision.
- `'7b9'` vs the fixed `'7 ('` (Dominant 7): `"7b9 (A Shape)".startsWith('7 (')` is `false` — no collision, confirming the §3.1 fix is sufficient.
- No other existing family's `qualityPrefix` (Triads: `'Major'`/`'Minor'`/`'dim'`/`'aug'`; 7ths & Extended: `'Maj7'`/`'m7'` — with `m7b5`'s own existing disambiguation/`'9'`/`'13'`; Suspended: `'sus2'`/`'sus4'`) overlaps any new prefix.

---

## 4. Summary of all edits

| File | Change |
|---|---|
| `src/data/guitarData.ts` | Add 5 new shape templates (m6, 6, mMaj7, 6/9, 7b9) to the `shapes` array, `baseRoot: 'A'` |
| `src/pages/Dictionary.tsx` | Fix `getNavigationChords()`'s slash-split to `/\/(?=[A-G])/`; add 5 new switch cases |
| `src/components/TheoryReference.tsx` | Fix Dominant 7's `qualityPrefix: '7'` → `'7 ('`; add "Sixths & Jazz" family with 5 entries |

## Edge cases

- **Tonal's alternate detection results** (e.g. `Am6`'s second listed detection `F#m7b5/A`): only the *first* result in `Chord.detect()`'s output array is used by the app's existing detection-consumption logic (unchanged by this design), and every new shape's first result is the intended quality — verified in §1's table.
- **A chord symbol arriving in an alias not listed in §2.2's switch cases:** falls through to the existing `default:`/empty-result behavior, same as any currently-unsupported quality. The alias lists used were pulled directly from `@tonaljs/chord-type`'s canonical `ChordType.all()` data, so this should not occur for the 5 target qualities.
- **Case sensitivity of `mmaj7` matching:** both `getNavigationChords` (`q(c).startsWith('mmaj7')`) and the Theory tab (`qualityPrefix: 'mmaj7'`) rely on the shape's `nameStr` using exactly lowercase `"mmaj7"` as specified in §1 — consistent across both mechanisms.

## Testing

No automated test suite exists (`npm run lint` is TypeScript-only). Manual verification:

1. `npm run lint` passes after all three file edits.
2. Dictionary → Chords tab: for a few roots (e.g. A, C, G, F#), confirm the 5 new shapes appear in the per-root shape list and render sensible fretboard diagrams (root on the A string, matching the fret patterns in §1's table transposed to that root).
3. Dictionary → Theory tab: confirm the new "Sixths & Jazz" family appears with all 5 entries, correct context blurbs, and that "Open in Chords" / "Explore in Identify" / "Add to Progression" work for each without pulling in a wrong shape (in particular: Major 6th doesn't pull in a 6/9 shape, and Dominant 7's existing buttons don't pull in a 7b9 shape).
4. Dictionary → Identify tab: for each of the 5 new qualities, input the notes of a shape from §1 on the fretboard (or use the corresponding shape's frets directly) and confirm the identifier detects the correct quality and that "Explore in Identify" style navigation resolves to the matching `COMMON_CHORDS` entry, not an empty result or a wrong quality.
5. Spot-check the mMaj7 case specifically end-to-end: Theory tab → "Explore in Identify" → confirm it does not land on a plain Minor or plain Maj7 shape.

## Out of scope

- Additional Jazz Manouche voicings beyond one shape per quality (e.g. alternate CAGED shapes for m6/6/6-9/mMaj7/7b9) — one clean, correctly-detecting shape per quality satisfies the stated requirement; more shapes can be added later following the same template if wanted.
- Any change to the ear-training, scale-positions, or CAGED pages — this feature is scoped to the Dictionary's Chords/Theory/Identify tabs only, per the user's original request.
- Any change to `chordsForQuality()` in `musicTheory.ts` beyond relying on its existing case-sensitive `Maj7` check (which the mMaj7 naming constraint in §1 is designed to satisfy, not change).
- Scale-level additions (e.g. a dedicated "Gypsy scale" or harmonic-minor-based mode) — the user's request was scoped to chords by the earlier clarifying-question exchange; scales were not included.
