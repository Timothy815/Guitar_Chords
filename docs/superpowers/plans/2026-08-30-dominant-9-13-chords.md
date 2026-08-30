# Dominant 9 & 13 Chords + Tension-Voicing Playability Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a playability bug in the tension-voicing algorithm (it drops good voicings because it only ever tries one fixed string for the tension note) and surface dominant 9/13 as real, selectable chord qualities in the Dictionary's Chords tab.

**Architecture:** Relocate `src/components/voicings/tensions.ts` to `src/lib/tensionVoicings.ts` (data/logic layer, not components), fixing the tension-string selection to try every string above the shell instead of one fixed string, and dropping its dependency on `lib/audio.ts` to avoid a circular import. Add a `bestTensionVoicing()` export that picks one representative voicing, used by a new generation loop in `src/data/guitarData.ts` to push `"<Root> 9 (Shell)"` / `"<Root> 13 (Shell)"` entries into `COMMON_CHORDS`. Wire `Dictionary.tsx`'s existing `getNavigationChords()` lookup to recognize `'9'`/`'13'` chord-symbol qualities.

**Tech Stack:** React 19, TypeScript, existing app modules only. No new dependencies. No automated test suite exists in this repo — `npm run lint` (TypeScript type-check) is the only static check; verification is manual via the dev server.

## Global Constraints

- No new npm dependencies.
- `npm run lint` (tsc --noEmit) must pass with zero errors after every task.
- `ChordShape.frets`: 6-element array, index 0 = low E, `-1` = muted, `0` = open — this convention is used everywhere and must not change.
- New tension-voicing chord entries use `fingers: v.frets.map(f => (f === -1 ? -1 : 0))` (no defined per-finger numbers) — the established convention from `TensionsTab.tsx`'s `sendToProgressions` handler, since `Fretboard.tsx`/`ChordCard.tsx` render off `frets`, not `fingers`.
- `OPEN_MIDI = [40, 45, 50, 55, 59, 64]` (low-E to high-E open-string MIDI values) is the fixed standard-tuning reference for all pitch math in the relocated module — do not parameterize it by the app's live tuning state (that's what caused the circular-import problem being fixed here).
- Full spec: `docs/superpowers/specs/2026-08-30-dominant-9-13-chords-design.md` — consult it for the worked-example arithmetic if anything here is unclear.

---

### Task 1: Relocate and fix the tension-voicing algorithm

**Files:**
- Create: `src/lib/tensionVoicings.ts`
- Delete: `src/components/voicings/tensions.ts`
- Modify: `src/components/voicings/TensionsTab.tsx:8`

**Interfaces:**
- Produces (for Task 2): `bestTensionVoicing(root: string, thirdSt: number, seventhSt: number, tensionSt: number, tensionLabel: string): TensionVoicing | null`, exported from `src/lib/tensionVoicings.ts`.
- Produces (for Task 2): `TensionVoicing` interface, shape unchanged from the original: `{ frets: number[]; strings: [number, number, number, number]; setKey: string; notes: { role: string; name: string }[]; rootFret: number }`.
- Unchanged export also present: `computeTensionVoicings(root, thirdSt, seventhSt, tensionSt, tensionLabel): TensionVoicing[]` and `TENSION_QUALITIES: TensionQuality[]` — both already consumed by `TensionsTab.tsx`, signatures unchanged from before this task.

This task combines the file move, the algorithm fix, and the importer update into one deliverable because none of the three can be independently verified: the old file must be deleted only once nothing imports it, and the fix only matters once it's reachable from `TensionsTab.tsx`.

- [ ] **Step 1: Read the current file to confirm nothing has drifted**

Run: `cat src/components/voicings/tensions.ts`

Confirm it still matches this shape: exports `TensionDef`, `TensionQuality`, `TENSION_QUALITIES` (5 entries: maj7, m7, dom7, m7b5, dim7), `TensionVoicing`, and `computeTensionVoicings`. It imports `getFretNote` from `'../../lib/audio'` and defines a local `SHELL_WITH_TENSION` array with one hardcoded `tension` string per shell. If anything here looks different from that description, stop and report it before proceeding — the rest of this task assumes this exact starting shape.

- [ ] **Step 2: Create the new file with the full relocated and fixed contents**

Create `src/lib/tensionVoicings.ts`:

```typescript
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

// Octave-qualified label (e.g. "G3"), computed from raw MIDI math so this
// module never depends on the live audio tuning state -- OPEN_MIDI always
// represents standard tuning, so the label must too.
function noteLabelFromMidi(midi: number): string {
  const name = noteNameFromMidi(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export interface TensionDef {
  key: string;
  label: string;
  semitones: number;
}

export interface TensionQuality {
  key: string;
  label: string;
  thirdSt: number;
  seventhSt: number;
  tensions: TensionDef[];
}

export const TENSION_QUALITIES: TensionQuality[] = [
  {
    key: 'maj7', label: 'maj7', thirdSt: 4, seventhSt: 11,
    tensions: [
      { key: '9',   label: '9',   semitones: 2 },
      { key: '#11', label: '♯11', semitones: 6 },
      { key: '13',  label: '13',  semitones: 9 },
    ],
  },
  {
    key: 'm7', label: 'm7', thirdSt: 3, seventhSt: 10,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
  {
    key: 'dom7', label: '7', thirdSt: 4, seventhSt: 10,
    tensions: [
      { key: '9',   label: '9',   semitones: 2 },
      { key: 'b9',  label: '♭9',  semitones: 1 },
      { key: '#9',  label: '♯9',  semitones: 3 },
      { key: '#11', label: '♯11', semitones: 6 },
      { key: '13',  label: '13',  semitones: 9 },
      { key: 'b13', label: '♭13', semitones: 8 },
    ],
  },
  {
    key: 'm7b5', label: 'm7♭5', thirdSt: 3, seventhSt: 10,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
  {
    key: 'dim7', label: 'dim7', thirdSt: 3, seventhSt: 9,
    tensions: [
      { key: '9',  label: '9',  semitones: 2 },
      { key: '11', label: '11', semitones: 5 },
    ],
  },
];

export interface TensionVoicing {
  frets: number[];
  strings: [number, number, number, number];
  setKey: string;
  notes: { role: string; name: string }[];
  rootFret: number;
}

// Shell (R-3-7) on 3 adjacent strings; tension goes on one of the strings above it.
const SHELL_SETS: { shell: [number, number, number]; setKey: string }[] = [
  { shell: [0, 1, 2], setKey: '6-3' },
  { shell: [1, 2, 3], setKey: '5-2' },
  { shell: [2, 3, 4], setKey: '4-1' },
];

export function computeTensionVoicings(
  root: string,
  thirdSt: number,
  seventhSt: number,
  tensionSt: number,
  tensionLabel: string,
): TensionVoicing[] {
  const results: TensionVoicing[] = [];

  for (const { shell: [s0, s1, s2], setKey } of SHELL_SETS) {
    for (let rootFret = 0; rootFret <= 15; rootFret++) {
      const rootMidi = OPEN_MIDI[s0] + rootFret;
      if (noteNameFromMidi(rootMidi) !== root) continue;

      // Build shell: same logic as ShellVoicingsTab
      let thirdMidi = rootMidi + thirdSt;
      let thirdFret = thirdMidi - OPEN_MIDI[s1];
      if (thirdFret < 0) { thirdFret += 12; thirdMidi += 12; }

      let seventhMidi = rootMidi + seventhSt;
      while (seventhMidi <= thirdMidi) seventhMidi += 12;
      let seventhFret = seventhMidi - OPEN_MIDI[s2];
      while (seventhFret < 0) { seventhFret += 12; seventhMidi += 12; }

      if (seventhMidi - rootMidi > 12) continue;
      if (thirdFret > 15 || seventhFret > 15) continue;

      // Tension goes above the seventh
      let tensionMidi = rootMidi + tensionSt;
      while (tensionMidi <= seventhMidi) tensionMidi += 12;

      // Try the string immediately above the shell first, then each string
      // further up the neck. OPEN_MIDI is monotonically increasing, so for
      // a fixed target pitch, higher-index strings always yield a lower
      // (or equal) fret -- trying only the first candidate (the old
      // behavior) silently dropped the whole voicing whenever that one
      // string couldn't hold the pitch within fret 0-15, even when a
      // higher string could hold it comfortably.
      let s3 = -1;
      let tensionFret = -1;
      for (let candidate = s2 + 1; candidate <= 5; candidate++) {
        const fret = tensionMidi - OPEN_MIDI[candidate];
        if (fret >= 0 && fret <= 15) {
          s3 = candidate;
          tensionFret = fret;
          break;
        }
      }
      if (s3 === -1) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      frets[s0] = rootFret;
      frets[s1] = thirdFret;
      frets[s2] = seventhFret;
      frets[s3] = tensionFret;

      results.push({
        frets,
        strings: [s0, s1, s2, s3],
        setKey,
        notes: [
          { role: 'R',          name: noteLabelFromMidi(rootMidi)    },
          { role: '3',          name: noteLabelFromMidi(thirdMidi)   },
          { role: '7',          name: noteLabelFromMidi(seventhMidi) },
          { role: tensionLabel, name: noteLabelFromMidi(tensionMidi) },
        ],
        rootFret,
      });
    }
  }

  return results;
}

// Picks a single representative voicing for contexts that need only one
// (e.g. the chord browser) -- the most compact voicing (smallest fret span
// among fretted notes), tie-broken by lowest neck position.
export function bestTensionVoicing(
  root: string,
  thirdSt: number,
  seventhSt: number,
  tensionSt: number,
  tensionLabel: string,
): TensionVoicing | null {
  const all = computeTensionVoicings(root, thirdSt, seventhSt, tensionSt, tensionLabel);
  if (all.length === 0) return null;

  const span = (v: TensionVoicing) => {
    const fretted = v.frets.filter(f => f > 0);
    return fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  };

  return all.reduce((best, v) => {
    const bestSpan = span(best);
    const vSpan = span(v);
    if (vSpan !== bestSpan) return vSpan < bestSpan ? v : best;
    return v.rootFret < best.rootFret ? v : best;
  });
}
```

- [ ] **Step 3: Update the importer**

In `src/components/voicings/TensionsTab.tsx`, change line 8 from:

```typescript
import { computeTensionVoicings, TENSION_QUALITIES } from './tensions';
```

to:

```typescript
import { computeTensionVoicings, TENSION_QUALITIES } from '../../lib/tensionVoicings';
```

Do not change anything else in this file — `TensionVoicing`'s shape, `computeTensionVoicings`'s signature, and `TENSION_QUALITIES`'s shape are all unchanged, so the rest of the component (grouping by `setKey`, `SET_CONFIG` coloring, `sendToProgressions`) needs no other edits.

- [ ] **Step 4: Confirm no other importer exists, then delete the old file**

Run: `grep -rn "voicings/tensions'" src/ ; grep -rn "from '\./tensions'" src/`

Expected: no output (the only importer was `TensionsTab.tsx`, already updated in Step 3). If this prints any match, stop and investigate before deleting — do not delete a file something still imports.

Then delete the old file:

```bash
rm src/components/voicings/tensions.ts
```

- [ ] **Step 5: Run the type checker**

Run: `npm run lint`

Expected: exits with no errors. If it reports an unresolved import or type mismatch, re-check Steps 2–3 against this task's code blocks verbatim before proceeding.

- [ ] **Step 6: Manual verification — the playability fix is visible in the UI**

Run: `npm run dev`

In a browser, navigate to the Dictionary's Voicings section (Tensions tab — same page reached via the app's Progressions/Voicings navigation for tension chords) and:
1. Select root `G`, quality `7`, tension `13`.
2. Confirm a voicing appears with: root G on the A string at fret 10, 3rd (B) on the D string at fret 9, 7th (F) on the G string at fret 10, and the 13th (E) on the high E string at fret 12. This voicing did not appear before this fix (it was silently dropped because the old code only tried the B string, which doesn't fit the 13th in range).
3. Confirm no previously-visible voicing for `G7/13` disappeared — spot check that the pre-existing voicings (e.g. any using string set `4-1`) still render.
4. Repeat for a second root (e.g. `C`, tension `13`) to confirm the fix isn't G-specific.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tensionVoicings.ts src/components/voicings/TensionsTab.tsx
git rm src/components/voicings/tensions.ts
git commit -m "fix: try every string above the shell for tension voicings, not just one"
```

---

### Task 2: Generate dominant 9 and 13 chord entries in COMMON_CHORDS

**Files:**
- Modify: `src/data/guitarData.ts`

**Interfaces:**
- Consumes: `bestTensionVoicing(root: string, thirdSt: number, seventhSt: number, tensionSt: number, tensionLabel: string): TensionVoicing | null` and the `TensionVoicing` shape `{ frets: number[]; ... }`, both from `src/lib/tensionVoicings.ts` (Task 1).
- Produces (for Task 3): two new entries per root pushed into `COMMON_CHORDS[note]`, named exactly `` `${note} 9 (Shell)` `` and `` `${note} 13 (Shell)` ``, each a `ChordShape` with `frets` (6-element array) and `fingers` (6-element array), no `baseFret`/`barre`.

- [ ] **Step 1: Read the current end of the generation loop to confirm the insertion point**

Run: `sed -n '1,90p' src/data/guitarData.ts`

Confirm the existing `for (const note of ALL_NOTES) { ... }` shape-generation loop (the one that pushes CAGED-shape chords) closes with a `}` immediately before the line `export type ScaleCategory = ...`. This plan's next step inserts new code between that closing `}` and the `export type ScaleCategory` line. If the file has diverged from this structure, stop and report before editing.

- [ ] **Step 2: Add the import**

At the top of `src/data/guitarData.ts`, alongside the existing `import { ChordShape, Finger, Note, ScalePattern } from '../types';` line, add:

```typescript
import { bestTensionVoicing } from '../lib/tensionVoicings';
```

- [ ] **Step 3: Add the generation loop**

Immediately after the existing shape-generation loop's closing `}` (right before `export type ScaleCategory`), insert:

```typescript
const DOMINANT_TENSIONS: { key: string; semitones: number }[] = [
  { key: '9', semitones: 2 },
  { key: '13', semitones: 9 },
];
const DOM7_THIRD_ST = 4;
const DOM7_SEVENTH_ST = 10;

for (const note of ALL_NOTES) {
  for (const t of DOMINANT_TENSIONS) {
    const v = bestTensionVoicing(note, DOM7_THIRD_ST, DOM7_SEVENTH_ST, t.semitones, t.key);
    if (!v) continue;

    COMMON_CHORDS[note].push({
      name: `${note} ${t.key} (Shell)`,
      frets: v.frets,
      fingers: v.frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
    });
  }
}
```

`thirdSt: 4, seventhSt: 10` are the dominant-7 shell intervals (matching the `'dom7'` entry in `TENSION_QUALITIES`) — written here as local constants rather than imported, since only these two fixed numbers are needed.

- [ ] **Step 4: Run the type checker**

Run: `npm run lint`

Expected: exits with no errors.

- [ ] **Step 5: Manual verification — new chords appear in the browser**

Run: `npm run dev` (if not already running from Task 1)

In the browser, navigate to Dictionary → Chords tab, select root `G`. Confirm the Variations list now includes `"G 9 (Shell)"` and `"G 13 (Shell)"`, and that clicking each renders a 4-note fretboard diagram (no muted-string artifacts, no notes above fret 15). Repeat for `C`, `F#`, and `B` to confirm the loop works across the 12-root cycle, including roots that push the root-fret search past the open position.

- [ ] **Step 6: Commit**

```bash
git add src/data/guitarData.ts
git commit -m "feat: add dominant 9 and 13 chord entries to the chord browser"
```

---

### Task 3: Recognize 9/13 chord symbols in the Dictionary's navigation lookup

**Files:**
- Modify: `src/pages/Dictionary.tsx:80-81` (insertion point, next to the existing `case '7':`)

**Interfaces:**
- Consumes: `COMMON_CHORDS` entries produced in Task 2, specifically names of the form `` `${root} 9 (Shell)` `` / `` `${root} 13 (Shell)` ``.
- No new exports — this task only extends the internal `switch (qual)` inside the existing `getNavigationChords(tonalName: string): ChordShape[]` function.

- [ ] **Step 1: Read the current switch to confirm the insertion point**

Run: `sed -n '63,99p' src/pages/Dictionary.tsx`

Confirm `case '7':` is still `shapes = pool.filter(c => { const s = q(c); return s.startsWith('7 ') || s === '7' || s.startsWith('7('); }); break;` and that `q` is defined as `const q = (c: ChordShape) => c.name.slice(root.length + 1);`. If either has changed, stop and report before editing — the new cases below assume this exact `q` definition.

- [ ] **Step 2: Add the two new cases**

In `src/pages/Dictionary.tsx`, immediately after the existing `case '7':` block (and before `case 'M7': case 'maj7': case 'Maj7':`), add:

```typescript
    case '9':
      shapes = pool.filter(c => q(c).startsWith('9')); break;
    case '13':
      shapes = pool.filter(c => q(c).startsWith('13')); break;
```

This matches Tonal.js chord-symbol parsing where `"G13"` splits into `root = "G"`, `qual = "13"` (and `"G9"` into `qual = "9"`) via the function's existing `base.match(/^([A-G])(.*)/)` regex. For a chord named `"G 13 (Shell)"`, `q(c)` evaluates to `"13 (Shell)"`, which `startsWith('13')` matches; it does not collide with the existing `case '7'` filter (which requires `s.startsWith('7 ')`, `s === '7'`, or `s.startsWith('7(')` — none match a string starting with `'9'` or `'13'`).

- [ ] **Step 3: Run the type checker**

Run: `npm run lint`

Expected: exits with no errors.

- [ ] **Step 4: Manual verification — the lookup returns the new entries**

`getNavigationChords` is a module-scope function, not exported, so verify it in place with a temporary debug line rather than a standalone script:

1. Temporarily add this line right after the `function getNavigationChords(tonalName: string): ChordShape[] {` opening brace:
   ```typescript
   if (tonalName === 'G13' || tonalName === 'G9') console.log('DEBUG', tonalName, /* will fill after switch */);
   ```
   Actually, simpler: temporarily add `console.log('DEBUG getNavigationChords', tonalName, shapes);` as the very last line before the function's final `return shapes;` (check the lines just after the switch block for the exact `return` statement and existing post-switch logic before placing this).
2. Run `npm run dev`, open the browser console, and open the Dictionary page (any tab — the module runs on load).
3. In the browser console, you cannot call the unexported function directly; instead, temporarily change the one call site at (originally) line 1049 from `getNavigationChords(identifiedChordNames[0])` to also log its result once, e.g. wrap it: `(() => { const r = getNavigationChords('G13'); console.log('DEBUG G13', r); return identifiedChordNames.length > 0 ? getNavigationChords(identifiedChordNames[0]) : []; })()`.
4. Reload the page. Confirm the console prints `DEBUG G13` with a non-empty array containing one `ChordShape` named `"G 13 (Shell)"`. Change `'G13'` to `'G9'` and repeat, confirming `"G 9 (Shell)"` comes back.
5. Remove every temporary debug line added in this step before committing — `git diff src/pages/Dictionary.tsx` must show only the two new `case` branches from Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: recognize 9 and 13 chord-symbol qualities in dictionary navigation"
```

---

## Self-Review Notes

- **Spec coverage:** All 4 spec sections have a task — §1 (algorithm fix + relocation) and §2 (TensionsTab import) are combined into Task 1 since they can't be independently verified (the fix isn't reachable until the import is updated); §3 (guitarData.ts) is Task 2; §4 (Dictionary.tsx) is Task 3.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact shell command.
- **Type consistency:** `bestTensionVoicing`'s signature and the `TensionVoicing` shape are identical between Task 1 (where they're defined) and Task 2 (where they're consumed). The `ChordShape.name` format `` `${note} ${t.key} (Shell)` `` in Task 2 matches the `q(c).startsWith('9'|'13')` check in Task 3 exactly (verified against the `q(c) = c.name.slice(root.length + 1)` definition, which strips `"G "` to leave `"9 (Shell)"` / `"13 (Shell)"`).
