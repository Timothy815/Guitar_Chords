# Jazz Manouche Chord Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five Jazz-Manouche-relevant chord qualities (m6, 6, 6/9, mMaj7, 7b9) to the Chords tab, the Theory tab, and the Identify tab of the Dictionary page.

**Architecture:** One new A-shape voicing template per quality is added to `guitarData.ts`'s `shapes` array (auto-transposed to all 12 roots by the existing generation loop). `Dictionary.tsx`'s `getNavigationChords()` gets a slash-split regex fix plus five new `switch` cases so the Identify tab can locate these chords from Tonal.js chord-detection output. `TheoryReference.tsx` gets a corrected `qualityPrefix` for the existing Dominant 7 entry (to stop it colliding with the new `7b9` prefix) plus a new "Sixths & Jazz" family of five `ChordTypeDef` entries, whose `qualityPrefix` values already match the string prefixes the new shape names produce — no changes needed to the generic `handleOpenInChords` / `handleExploreFromTheory` / `handleAddToProgressionFromTheory` handlers in `Dictionary.tsx`, since they already consume `qualityPrefix` generically.

**Tech Stack:** React 19 + TypeScript + Vite, `@tonaljs/tonal` (`Chord.detect`) for chord-name recognition, no test framework — verification is `npm run lint` plus manual dev-server click-through.

## Global Constraints

- No test suite exists in this repo. Every task's "verify" step is `npm run lint` (must show zero errors) plus a manual check against a running `npm run dev` server.
- `mMaj7`'s shape `nameStr` must use **lowercase** `"mmaj7"`, never `"Maj7"` — `src/data/musicTheory.ts`'s `chordsForQuality()` does a case-sensitive `c.name.includes('Maj7')` check for the diatonic Major-7 family; a capitalized name would wrongly pull the mMaj7 shape into that unrelated feature.
- Every new `qualityPrefix` / shape-name prefix must be checked against every existing one for accidental `startsWith` collisions (both directions) before being added — this bit the codebase already once (see Task 3 note on the Dominant 7 fix).
- Follow the existing single-shape "A Shape" precedent already used for `sus2`, `sus4`, `dim`, `aug`, `dim7`, `m7b5` in `guitarData.ts`: `baseRoot: 'A'`, `rootString: 1`, root muted-string-0 layout.
- One voicing per quality only. No new scale entries, no `ear-training`/`scale-positions`/`caged` page changes, no changes to `chordsForQuality()` beyond relying on its existing behavior.

---

### Task 1: Add the five new chord shape templates to `guitarData.ts`

**Files:**
- Modify: `src/data/guitarData.ts:48` (insert 5 new entries into the `shapes` array, right before its closing `];` on line 49)

**Interfaces:**
- Consumes: nothing new — reuses the existing `shapes` array shape (`{ baseRoot, nameStr, relFrets, fingers, rootString }`) and the existing generation loop at `src/data/guitarData.ts:61-86`, which transposes every entry across all 12 roots into `COMMON_CHORDS`.
- Produces: five new chord-name families reachable from `COMMON_CHORDS[root]` for every root, named `"<root> m6 (A Shape)"`, `"<root> 6 (A Shape)"`, `"<root> mmaj7 (A Shape)"`, `"<root> 6/9 (A Shape)"`, `"<root> 7b9 (A Shape)"`. Tasks 2 and 3 depend on these exact prefixes (`m6`, `6 (`, `mmaj7`, `6/9`, `7b9`).

- [ ] **Step 1: Insert the five new shape entries**

In `src/data/guitarData.ts`, replace line 48-49:

```ts
  { baseRoot: 'A', nameStr: 'm7b5 (A Shape)', relFrets: [-1, 0, 1, 0, 1, -1], fingers: [-1, 1, 2, 1, 3, -1], rootString: 1 },
];
```

with:

```ts
  { baseRoot: 'A', nameStr: 'm7b5 (A Shape)', relFrets: [-1, 0, 1, 0, 1, -1], fingers: [-1, 1, 2, 1, 3, -1], rootString: 1 },
  // Minor 6th: root, b3, 5, 6 — verified: A,C,E,F#
  { baseRoot: 'A', nameStr: 'm6 (A Shape)', relFrets: [-1, 0, 2, 2, 1, 2], fingers: [-1, 1, 2, 3, 1, 4], rootString: 1 },
  // Major 6th: root, 3, 5, 6 — verified: A,C#,E,F#
  { baseRoot: 'A', nameStr: '6 (A Shape)', relFrets: [-1, 0, 2, 2, 2, 2], fingers: [-1, 1, 3, 3, 3, 3], rootString: 1 },
  // Minor-Major 7: root, b3, 5, 7 — verified: A,C,E,G#
  { baseRoot: 'A', nameStr: 'mmaj7 (A Shape)', relFrets: [-1, 0, 2, 1, 1, 0], fingers: [-1, 1, 2, 1, 1, 1], rootString: 1 },
  // Six-Nine: root, 3, 5, 6, 9 — verified: A,C#,E,F#,B
  { baseRoot: 'A', nameStr: '6/9 (A Shape)', relFrets: [-1, 0, 2, 4, 2, 2], fingers: [-1, 1, 1, 4, 2, 3], rootString: 1 },
  // Dominant 7b9: root, 3, 5, b7, b9 — verified: A,C#,E,G,A#
  { baseRoot: 'A', nameStr: '7b9 (A Shape)', relFrets: [-1, 0, 2, 3, 2, 3], fingers: [-1, 1, 1, 3, 2, 4], rootString: 1 },
];
```

Note on the `fingers` arrays: `src/components/Fretboard.tsx` only ever renders a finger number for a string that is actually fretted (not open, not muted), so the values at open-string (`0`) positions in the arrays above are cosmetically unused — they're set to `1` purely to match the loose convention already used elsewhere in this file (e.g. the existing `aug`/`dim7` entries also reuse finger numbers across non-adjacent frets). Only the fretted-position values needed any real thought.

Known accepted edge case: the `6/9` shape's highest relative fret is 4 (on the G string). The generation loop three lines below (`if (Math.max(...finalFrets) > 14) continue;`) will silently skip this shape for the one root where `shift` reaches its maximum of 11 — **G#** — since `4 + 11 = 15 > 14`. Every other root (including all other roots reachable via this A-shape template) stays under the ceiling. This means `COMMON_CHORDS['G#']` will not contain a `6/9` voicing; the plain `6` and separate `9`-shell voicings remain available for G#. This is the same silent-skip mechanism already used elsewhere in this file (e.g. `DOMINANT_TENSIONS`'s `bestTensionVoicing` returning `null` for some roots), not a new failure mode — call it out during manual verification (Step 3) so it isn't mistaken for a bug.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev` (skip if already running), open `/dictionary`, go to the **Chords** tab, and:
- Select root **A**. Confirm the chord list/dropdown now includes `A m6 (A Shape)`, `A 6 (A Shape)`, `A mmaj7 (A Shape)`, `A 6/9 (A Shape)`, and `A 7b9 (A Shape)`, and that clicking each one renders a fretboard diagram with no console errors.
- Select root **G#**. Confirm `G# m6`, `G# 6`, `G# mmaj7`, and `G# 7b9` all appear, and that `G# 6/9` is the one quality **absent** from the list (expected, per the Step 1 note above — not a bug to fix).

- [ ] **Step 4: Commit**

```bash
git add src/data/guitarData.ts
git commit -m "feat: add m6, 6, 6/9, mMaj7, and 7b9 chord shapes"
```

---

### Task 2: Fix `getNavigationChords()`'s slash-split and add the five new switch cases

**Files:**
- Modify: `src/pages/Dictionary.tsx:64` (slash-split regex)
- Modify: `src/pages/Dictionary.tsx:100-102` (insert 5 new `switch` cases before `default`)

**Interfaces:**
- Consumes: `COMMON_CHORDS` shape names produced by Task 1 (`m6`, `6 (`, `mmaj7`, `6/9`, `7b9` prefixes after the `"<root> "` slice).
- Produces: nothing new for later tasks — this is the Identify tab's chord-name-to-shape lookup, exercised directly by manual testing in Step 4.

- [ ] **Step 1: Fix the slash-split so `Am/ma7`-style Tonal.js names survive intact**

In `src/pages/Dictionary.tsx`, replace line 64:

```ts
  const base = tonalName.split('/')[0];
```

with:

```ts
  const base = tonalName.split(/\/(?=[A-G])/)[0];
```

This only splits on a `/` that is immediately followed by an uppercase note letter (a real slash-chord inversion, e.g. `Am7/G` → `Am7`, `C7/E` → `C7`). Tonal.js's minor-major-7 detection result `Am/ma7` has a `/` followed by lowercase `m`, so it is left untouched and continues to `Am/ma7`.

- [ ] **Step 2: Add the five new switch cases**

In `src/pages/Dictionary.tsx`, replace lines 100-102:

```ts
    case 'aug': case '+':
      shapes = pool.filter(c => q(c).startsWith('aug')); break;
    default: return [];
```

with:

```ts
    case 'aug': case '+':
      shapes = pool.filter(c => q(c).startsWith('aug')); break;
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
    default: return [];
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Open `/dictionary`, go to the **Identify** tab, and for root **A**:
- Click fret positions matching `[-1, 0, 2, 1, 1, 0]` (the `mmaj7` shape). Confirm it identifies as `Am/ma7` (or equivalent Tonal.js label) and that the "explore"/navigation action correctly locates the `A mmaj7 (A Shape)` chord — this exercises the Step 1 regex fix directly, since the raw Tonal name contains a `/`.
- Click fret positions matching `[-1, 0, 2, 2, 1, 2]` (the `m6` shape) and confirm it identifies and navigates to `A m6 (A Shape)`.
- Click fret positions matching `[-1, 0, 2, 3, 2, 3]` (the `7b9` shape) and confirm it identifies and navigates to `A 7b9 (A Shape)`.
- No console errors in any case.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "fix: support Jazz Manouche chord names in Identify tab lookup"
```

---

### Task 3: Fix the Dominant 7 `qualityPrefix` and add the "Sixths & Jazz" Theory family

**Files:**
- Modify: `src/components/TheoryReference.tsx:38` (Dominant 7's `qualityPrefix`)
- Modify: `src/components/TheoryReference.tsx:50-51` (insert new family into `CHORD_FAMILIES`, before its closing `];`)

**Interfaces:**
- Consumes: `ChordTypeDef` (already defined at `src/components/TheoryReference.tsx:17-23`: `{ name, abbr, intervals, qualityPrefix, context }`), `CHORD_FAMILIES: { family: string; types: ChordTypeDef[] }[]` (note the field is `types`, not `chords`). Also consumes the shape-name prefixes produced by Task 1 (`m6`, `6 (`, `mmaj7`, `6/9`, `7b9`).
- Produces: nothing new for later tasks — `onOpenInChords`, `onExploreInIdentify`, `onAddToProgression` (props already wired at `src/pages/Dictionary.tsx:1476-1478` to `handleOpenInChords` / `handleExploreFromTheory` / `handleAddToProgressionFromTheory`) consume these `qualityPrefix` values generically; no changes to those three handler functions are needed.

- [ ] **Step 1: Fix the Dominant 7 `qualityPrefix` so it can't swallow the new `7b9` shapes**

In `src/components/TheoryReference.tsx`, replace line 38:

```ts
      { name: 'Dominant 7',      abbr: '7',    intervals: [0,4,7,10],  qualityPrefix: '7',    context: 'V7 in any major or minor key' },
```

with:

```ts
      { name: 'Dominant 7',      abbr: '7',    intervals: [0,4,7,10],  qualityPrefix: '7 (',  context: 'V7 in any major or minor key' },
```

Without this fix, `qualityPrefix: '7'` would match both `"7 (A7 Shape)"` (correct) and the new `"7b9 (A Shape)"` (wrong) via `startsWith`, since `'7b9...'.startsWith('7')` is `true`. `'7 ('` matches only the former.

- [ ] **Step 2: Add the "Sixths & Jazz" family**

In `src/components/TheoryReference.tsx`, replace lines 50-51:

```ts
      { name: 'Sus4', abbr: 'sus4', intervals: [0,5,7], qualityPrefix: 'sus4', context: 'V suspension that resolves down to major' },
    ],
  },
];
```

with:

```ts
      { name: 'Sus4', abbr: 'sus4', intervals: [0,5,7], qualityPrefix: 'sus4', context: 'V suspension that resolves down to major' },
    ],
  },
  {
    family: 'Sixths & Jazz',
    types: [
      { name: 'Major 6th',             abbr: '6',       intervals: [0,4,7,9],    qualityPrefix: '6 (',   context: 'Adds a 6th to a major triad — sweet, but a defining swing/Gypsy-jazz color.' },
      { name: 'Minor 6th',             abbr: 'm6',      intervals: [0,3,7,9],    qualityPrefix: 'm6',    context: 'The signature Jazz Manouche minor chord — minor triad plus a major 6th.' },
      { name: 'Six-Nine',              abbr: '6/9',     intervals: [0,4,7,9,14], qualityPrefix: '6/9',   context: 'Major 6th chord with an added 9th — lush, often used as a I-chord substitute.' },
      { name: 'Minor-Major 7',         abbr: 'm(maj7)', intervals: [0,3,7,11],   qualityPrefix: 'mmaj7', context: 'Minor triad with a major 7th — the dramatic "minor tonic" sound in minor-key jazz.' },
      { name: '7♭9 (Altered Dominant)', abbr: '7b9',     intervals: [0,4,7,10,13], qualityPrefix: '7b9',  context: 'Dominant 7th with a flat 9 — the tense, exotic Gypsy-jazz/bebop dominant sound.' },
    ],
  },
];
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Open `/dictionary`, go to the **Theory** tab, "Chord Types" view, root **A**:
- Confirm a new "Sixths & Jazz" family section renders with 5 cards (Major 6th, Minor 6th, Six-Nine, Minor-Major 7, 7♭9), each showing the correct note names for root A (e.g. Minor 6th → A, C, E, F#) and playing correctly on click.
- Click "Chords →" on the Minor 6th card; confirm it switches to the Chords tab with `A m6 (A Shape)` selected.
- Click "Explore →" on the 7♭9 card; confirm it switches to the Identify tab with the `7b9` shape's frets shown on the fretboard.
- Click "+ Prog" on the Six-Nine card; confirm either an "Added A 6/9 (A Shape)" toast or a "no progression saved yet" toast (both are correct depending on whether a progression exists) — not a crash.
- Regression check: repeat the "Chords →" / "Explore →" / "+ Prog" actions on the existing **Dominant 7** card and confirm it still correctly targets `A 7 (A7 Shape)` — this confirms Step 1's prefix fix didn't break the pre-existing behavior.
- No console errors in any case.

- [ ] **Step 5: Commit**

```bash
git add src/components/TheoryReference.tsx
git commit -m "feat: add Sixths & Jazz chord family to Theory tab"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-20-jazz-manouche-chords-design.md`):
- §1 five new shape templates in `guitarData.ts` — Task 1. ✅
- §2 `getNavigationChords()` slash-split fix + 5 switch cases — Task 2. ✅
- §3 Dominant-7 `qualityPrefix` fix + new Theory family — Task 3. ✅ (field name corrected from the spec's `chords:` to the actual `types:` field required by `CHORD_FAMILIES`'s type — a naming-only correction, no design change)
- Identify-tab discoverability requirement ("find and construct them in the identify tab") — covered by Task 2's switch cases plus Task 1's shapes existing in `COMMON_CHORDS` for `getNavigationChords` to search. ✅
- Theory-tab discoverability ("add minor 6th to the theory section along with any other reasonable additions for jazz") — Task 3's new family. ✅

**Placeholder scan:** no "TBD"/"TODO"/"add error handling" phrases; every step has complete, runnable code and concrete verification instructions. ✅

**Type consistency:** the five prefix strings (`m6`, `6 (`, `6/9`, `mmaj7`, `7b9`) are identical across Task 1 (shape `nameStr` values), Task 2 (`switch` case filters), and Task 3 (`qualityPrefix` values) — checked pairwise for `startsWith` collisions against each other and against every pre-existing prefix in both files (`Major`, `Minor`, `7 (` post-fix, `Maj7`, `m7`, `dim7`, `dim`, `m7b5`, `sus2`, `sus4`, `aug`). No collisions found in either direction. The pre-existing `m7`/`m7b5` prefix overlap in `TheoryReference.tsx`'s "7ths & Extended" family (both literal entries share the `m7` prefix) is untouched by this plan — it predates this feature, none of the five new prefixes interact with it, and `getNavigationChords()` already guards its own `m7` case against it (`s.startsWith('m7') && !s.startsWith('m7b5')`); fixing the Theory-tab consumer functions' lack of the same guard is out of scope here since it doesn't affect any of the new chords. ✅

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-20-jazz-manouche-chords.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
