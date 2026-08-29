# Identify Mode: Slide Across Strings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Slide across strings" control to the Dictionary → Identify tab that moves a fretted cluster ±1 string while preserving its interval structure (correctly handling the B-string tuning anomaly), complementing the existing horizontal "Slide shape" control.

**Architecture:** One new pure function, `shiftFretsAcrossStrings(frets, delta)`, added to `src/lib/utils.ts`. It anchors on the lowest-pitched fretted note (keeps that note's fret number unchanged on its new string) and derives every other note from its fixed semitone offset to the anchor, correcting only that note's fret — with octave nudges only where needed to stay in range 0–15. `src/pages/Dictionary.tsx` gets a new handler, two derived booleans, and a UI block mirroring "Slide shape," wired directly below it.

**Tech Stack:** React 19, TypeScript, existing `Dictionary.tsx` / `lib/utils.ts`. No new dependencies. No test framework exists in this repo (`npm run lint` = `tsc --noEmit` only) — verification of the pure function uses a throwaway script run via `npx tsx` (already a devDependency), deleted after it passes; UI verification is manual in the browser.

## Global Constraints

- No automated test suite exists; do not add one. `npm run lint` (TypeScript compile check) and `npm run build` are the only automated checks — both must pass at the end.
- `frets`/`identifiedFrets` convention: 6-element array, index 0 = low E, `-1` = muted/unfretted. Never deviate from this.
- `OPEN_STRING_PITCHES = [40, 45, 50, 55, 59, 64]` (E2 A2 D3 G3 B3 E4) is an existing module-local `const` in `src/lib/utils.ts` — do not duplicate it, do not export it (only the new function needs exporting).
- Fret cap for this feature is 15 (matches the existing "Slide shape" cap in the same file), not the 22-fret full-neck cap used elsewhere.
- Follow the exact code in `docs/superpowers/specs/2026-08-29-identify-string-shift-design.md` (already corrected — anchor-relative algorithm, not the earlier absolute-pitch draft).

---

### Task 1: `shiftFretsAcrossStrings` in `src/lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts` (add and export the new function; no changes to existing exports)

**Interfaces:**
- Produces: `export function shiftFretsAcrossStrings(frets: number[], delta: 1 | -1): number[]` — pure function. Input/output both 6-element arrays using the `-1`-muted convention. This is the only symbol Task 2 consumes from this task.

- [ ] **Step 1: Write a throwaway verification script**

Create `/tmp/verify-shift.ts` (outside the repo, never committed) with these exact contents:

```typescript
import { shiftFretsAcrossStrings } from '/Users/timothykoerner/Desktop/Music/Guitar_Master/.claude/worktrees/scale-print-fret-range/src/lib/utils';

function assertEqual(actual: number[], expected: number[], label: string) {
  const ok = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — got [${actual}] expected [${expected}]`);
  if (!ok) process.exitCode = 1;
}

// 1. Pure-fourths shift (E-A-D -> A-D-G), no B-string involved: frets unchanged.
assertEqual(
  shiftFretsAcrossStrings([3, 5, 4, -1, -1, -1], 1),
  [-1, 3, 5, 4, -1, -1],
  'pure-fourths shift preserves frets'
);

// 2. Crossing the B string (D-G-B -> G-B-E): the note landing on the far
// side of the seam gets a +1 correction relative to the naive same-fret copy.
assertEqual(
  shiftFretsAcrossStrings([-1, -1, 5, 4, 7, -1], 1),
  [-1, -1, -1, 5, 5, 7],
  'B-string crossing applies +1 correction on the seam note'
);

// 3. Shift toward treble past the top string drops the highest note; the
// remaining pair (G-B -> B-E) no longer spans the seam, so the survivor's
// fret is recomputed relative to the new anchor, not just copied.
assertEqual(
  shiftFretsAcrossStrings([-1, -1, -1, 5, 4, 7], 1),
  [-1, -1, -1, -1, 5, 3],
  'shift off the treble edge drops the top note and recomputes the survivor'
);

// 4. Shift toward bass: the note already on low E is dropped, the other
// two survive and are recomputed relative to the new anchor.
assertEqual(
  shiftFretsAcrossStrings([3, 5, 4, -1, -1, -1], -1),
  [5, 4, -1, -1, -1, -1],
  'shift off the bass edge drops only the note that runs off the neck'
);

// 5. Single note just relocates keeping the same fret (it's its own anchor).
assertEqual(
  shiftFretsAcrossStrings([-1, 5, -1, -1, -1, -1], 1),
  [-1, -1, 5, -1, -1, -1],
  'single note keeps its fret as its own anchor'
);

// 6. Zero fretted notes: unchanged.
assertEqual(
  shiftFretsAcrossStrings([-1, -1, -1, -1, -1, -1], 1),
  [-1, -1, -1, -1, -1, -1],
  'no fretted notes is a no-op'
);

// 7. Simple two-note shift toward bass, no seam involved: sanity check.
assertEqual(
  shiftFretsAcrossStrings([-1, -1, 2, 1, -1, -1], -1),
  [-1, 2, 1, -1, -1, -1],
  'sanity: simple two-note shift toward bass'
);
```

- [ ] **Step 2: Run it to confirm it fails (function doesn't exist yet)**

Run: `npx tsx /tmp/verify-shift.ts`
Expected: an error that `shiftFretsAcrossStrings` is not exported from `src/lib/utils` (e.g. `SyntaxError: The requested module '...' does not provide an export named 'shiftFretsAcrossStrings'` or a TypeScript error to the same effect).

- [ ] **Step 3: Implement the function**

In `src/lib/utils.ts`, add this directly after the existing `OPEN_STRING_PITCHES` constant (line 6) and before `avgChordPitch`:

```typescript
export function shiftFretsAcrossStrings(frets: number[], delta: 1 | -1): number[] {
  const fretted = frets
    .map((fret, str) => ({ str, fret }))
    .filter((n): n is { str: number; fret: number } => frets[n.str] !== -1);

  if (fretted.length === 0) return frets;

  const withMidi = fretted.map(n => ({ ...n, midi: OPEN_STRING_PITCHES[n.str] + n.fret }));

  // Notes whose new string index falls off the neck are dropped.
  const survivors = withMidi
    .map(n => ({ ...n, newStr: n.str + delta }))
    .filter(n => n.newStr >= 0 && n.newStr <= 5);

  const result = frets.map(() => -1);
  if (survivors.length === 0) return result;

  // The anchor is the lowest-pitched surviving note. It keeps its fret
  // number unchanged on its new string — that's what "sliding the shape
  // over" means when consecutive strings are a uniform interval apart
  // (e.g. E-A-D -> A-D-G with the same frets reproduces the same chord,
  // just a fourth higher in pitch, which is correct and expected).
  // Every other note is placed at the same semitone offset from the
  // anchor's NEW pitch that it had from the anchor's OLD pitch. This is
  // where the B-string correction falls out for free: wherever the
  // major-third seam sits differently relative to the anchor after the
  // move, the recomputed fret differs from the naive "same fret, new
  // string" value by exactly the right amount.
  const anchor = survivors.reduce((a, b) => (a.midi <= b.midi ? a : b));
  const anchorNewMidi = OPEN_STRING_PITCHES[anchor.newStr] + anchor.fret;

  const FRET_CAP = 15;
  for (const n of survivors) {
    const offset = n.midi - anchor.midi; // 0 for the anchor itself
    let targetMidi = anchorNewMidi + offset;
    let newFret = targetMidi - OPEN_STRING_PITCHES[n.newStr];
    // Nudge by whole octaves to land in the playable range. A 16-fret
    // window (0-15) always contains a representative of every pitch
    // class, so this always terminates with a valid fret in practice;
    // the "else" below is a defensive fallback only.
    while (newFret < 0) { newFret += 12; targetMidi += 12; }
    while (newFret > FRET_CAP) { newFret -= 12; targetMidi -= 12; }
    if (newFret >= 0 && newFret <= FRET_CAP) {
      result[n.newStr] = newFret;
    }
    // else: dropped — unplayable even after the octave search
  }

  return result;
}
```

- [ ] **Step 4: Run it again to confirm all 7 assertions pass**

Run: `npx tsx /tmp/verify-shift.ts`
Expected: 7 lines, all starting with `PASS`, exit code 0.

- [ ] **Step 5: Run the repo's type check and delete the scratch script**

Run: `npm run lint`
Expected: no errors.

Run: `rm /tmp/verify-shift.ts` (never commit this file — it isn't part of the repo's source tree).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts
git commit -m "$(cat <<'EOF'
feat: add shiftFretsAcrossStrings for cross-string interval-preserving shift

Anchors on the lowest-pitched fretted note (keeps its fret unchanged on
the new string) and derives every other note from its fixed semitone
offset to the anchor, so shifting a fretted cluster to a different set of
strings preserves the chord — including correctly across the B-string's
major-third tuning gap.
EOF
)"
```

---

### Task 2: Wire the "Slide across strings" UI into `src/pages/Dictionary.tsx`

**Files:**
- Modify: `src/pages/Dictionary.tsx:12` (import)
- Modify: `src/pages/Dictionary.tsx:1055-1063` (add derived state + handler next to the existing `shiftFrets`/`canShiftDown`/`canShiftUp`)
- Modify: `src/pages/Dictionary.tsx:1819-1848` (add new UI block immediately after the existing "Slide shape" block, before the "Show all notes toggle" comment at line 1850)

**Interfaces:**
- Consumes: `shiftFretsAcrossStrings(frets: number[], delta: 1 | -1): number[]` from Task 1 (`src/lib/utils.ts`).
- Consumes existing in-file state: `identifiedFrets: number[]`, `setIdentifiedFrets: React.Dispatch<React.SetStateAction<number[]>>`, `frettedNotes: number[]` (already defined at line 1055).
- Produces: no new exports — this task only adds local handler `shiftStrings`, local derived consts `frettedStrings`, `canShiftStringDown`, `canShiftStringUp`, `currentStringLabel`, and a JSX block. Nothing here is consumed by another task.

- [ ] **Step 1: Add the import**

In `src/pages/Dictionary.tsx`, change line 12 from:

```typescript
import { handlePrint, cn, avgChordPitch, chordPositionBucket, PositionBucket, POSITION_LABELS } from '../lib/utils';
```

to:

```typescript
import { handlePrint, cn, avgChordPitch, chordPositionBucket, PositionBucket, POSITION_LABELS, shiftFretsAcrossStrings } from '../lib/utils';
```

- [ ] **Step 2: Add derived state and the handler**

Immediately after the existing block at lines 1055-1063 (after the closing `}` of `shiftFrets`), i.e. replace:

```typescript
  const frettedNotes = identifiedFrets.filter(f => f !== -1);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : -1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : -1;
  const canShiftDown = minFret > 0;
  const canShiftUp   = maxFret >= 0 && maxFret < 15;

  function shiftFrets(delta: number) {
    setIdentifiedFrets(prev => prev.map(f => f === -1 ? -1 : Math.max(0, f + delta)));
  }
```

with:

```typescript
  const frettedNotes = identifiedFrets.filter(f => f !== -1);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : -1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : -1;
  const canShiftDown = minFret > 0;
  const canShiftUp   = maxFret >= 0 && maxFret < 15;

  function shiftFrets(delta: number) {
    setIdentifiedFrets(prev => prev.map(f => f === -1 ? -1 : Math.max(0, f + delta)));
  }

  const frettedStrings = identifiedFrets
    .map((f, s) => (f !== -1 ? s : -1))
    .filter(s => s !== -1);
  const canShiftStringDown = frettedStrings.some(s => s - 1 >= 0);
  const canShiftStringUp = frettedStrings.some(s => s + 1 <= 5);

  const OPEN_STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
  const currentStringLabel = frettedStrings.length > 0
    ? frettedStrings.map(s => OPEN_STRING_NAMES[s]).join(' · ')
    : '';

  function shiftStrings(delta: 1 | -1) {
    setIdentifiedFrets(prev => shiftFretsAcrossStrings(prev, delta));
  }
```

- [ ] **Step 3: Add the UI block**

Immediately after the existing "Slide shape" block's closing `)}` (line 1848) and before the `{/* Show all notes toggle */}` comment (line 1850), i.e. replace:

```tsx
                           <p className="text-[10px] text-brand-secondary/60 leading-tight">
                             Moves all fretted notes together — same shape, new chord
                           </p>
                         </div>
                       )}

                       {/* Show all notes toggle */}
```

with:

```tsx
                           <p className="text-[10px] text-brand-secondary/60 leading-tight">
                             Moves all fretted notes together — same shape, new chord
                           </p>
                         </div>
                       )}

                       {/* String shift — slide the fretted cluster up/down across strings, preserving intervals */}
                       {frettedNotes.length > 0 && (
                         <div className="mt-3 space-y-1">
                           <p className="text-xs font-medium text-brand-secondary">Slide across strings</p>
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => shiftStrings(-1)}
                               disabled={!canShiftStringDown}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                               title="Shift cluster one string toward the bass"
                             >
                               ▼ Bass
                             </button>
                             <span className="text-xs tabular-nums text-brand-secondary min-w-[56px] text-center">
                               {currentStringLabel}
                             </span>
                             <button
                               onClick={() => shiftStrings(1)}
                               disabled={!canShiftStringUp}
                               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                               title="Shift cluster one string toward the treble"
                             >
                               Treble ▲
                             </button>
                           </div>
                           <p className="text-[10px] text-brand-secondary/60 leading-tight">
                             Same intervals, new strings — notes that run off the edge are dropped
                           </p>
                         </div>
                       )}

                       {/* Show all notes toggle */}
```

- [ ] **Step 4: Type-check and build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open the app, navigate to Dictionary → Identify tab.

1. Fret a 3-note shell on E-A-D strings (e.g. frets that form a recognizable maj7 shell — root on low E, major 3rd and major 7th above on A and D). Confirm the identified chord name is correct and the new "Slide across strings" block appears below "Slide shape" with both arrow buttons enabled and a string label (e.g. `E · A · D`) shown between them.
2. Click "Treble ▲" once: cluster moves to A-D-G, label updates, chord name stays correct (no B string involved yet, frets unchanged per the algorithm).
3. Click "Treble ▲" again: cluster moves to D-G-B (crosses the B-string seam), chord name stays correct — this is the key case the interval correction exists for.
4. Click "Treble ▲" again: cluster moves to G-B-E (top of the neck); chord name stays correct.
5. Click "Treble ▲" once more: the top note drops (2-note dyad remains), the button does not crash, and the label shows only the two remaining strings.
6. Click "▼ Bass" repeatedly: watch notes drop one at a time as the cluster runs off the low E string; confirm the button disables once no fretted note would survive a further bass-ward shift.
7. Clear and fret a single note; confirm both string-shift buttons are enabled and each click relocates the single note to the adjacent string.
8. Fret a cluster high on the neck (fret 13+) and shift it across strings; confirm any resulting fret stays within 0–15 and the chord is still identified correctly.
9. Combine "Slide shape" (horizontal) and "Slide across strings" (vertical) in sequence; confirm no interference between the two controls.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "$(cat <<'EOF'
feat: add Slide across strings control to Identify mode

Lets a fretted cluster move vertically (±1 string) while preserving its
chord, using shiftFretsAcrossStrings. Mirrors the existing horizontal
Slide shape control; notes that run off either edge of the fretboard are
dropped rather than blocking the whole shift.
EOF
)"
```

---

## Self-Review

**Spec coverage:** `shiftFretsAcrossStrings` (Task 1) matches the corrected spec algorithm exactly, including the anchor-relative derivation and per-note octave nudge. The UI block (Task 2) matches the spec's exact JSX, derived state, and handler. The spec's "Testing" section's 7 manual steps are folded into Task 2 Step 5 (expanded to 9 steps to also cover the initial appearance/label state and the single-note case explicitly). All "Edge cases" in the spec (B-string crossing, full drop disabling the button, partial drop, single note, zero notes hiding the block, octave nudge, defensive unreachable fallback) are exercised by either the Task 1 assertions or the Task 2 manual steps. "Out of scope" items (navigator, `ShellVoicingsTab.tsx`, drag interaction, persistence) are untouched by both tasks.

**Placeholder scan:** No TBD/TODO markers; every step shows exact code or an exact command with an exact expected result.

**Type consistency:** `shiftFretsAcrossStrings(frets: number[], delta: 1 | -1): number[]` is declared once in Task 1 and consumed with that exact name and signature in Task 2's `shiftStrings` handler. `frettedNotes`, `identifiedFrets`, `setIdentifiedFrets` are pre-existing symbols in `Dictionary.tsx`, referenced identically to their current declarations. No naming drift between tasks.
