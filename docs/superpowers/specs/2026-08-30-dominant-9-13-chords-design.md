# Dominant 9 & 13 Chords + Tension-Voicing Playability Fix — Design Spec

## Goal

Two changes, delivered together because the second is a prerequisite for the first:

1. **Fix a playability bug in the tension-voicing algorithm** (`src/components/voicings/tensions.ts`): it hardcodes the tension note (9th/11th/13th/etc.) to exactly one fixed string above the shell, and silently drops the whole voicing if that one string can't hold the tension pitch within fret 0–15 — even when a different, higher string could hold it comfortably. This forces unnecessarily large stretches (e.g. a G13 voicing jumping to fret 12 on the high E when a nearby, compact alternative exists) or drops good voicings outright.
2. **Surface dominant 9 and 13 as real, selectable chord qualities** in the Dictionary's Chords tab, backed by the fixed algorithm — today a "G13" from a jazz chart isn't findable in the app at all; the closest equivalent is buried, unlabeled, in the separate Voicings → Tensions tab.

The playability fix applies to **both** the existing Tensions tab and the new 9/13 chord entries — one shared, corrected algorithm.

## Architecture

- Relocate the tension-voicing math from `src/components/voicings/tensions.ts` to a new `src/lib/tensionVoicings.ts`. It's data/logic, not a component, and `src/data/guitarData.ts` needs to call into it to generate the new chord entries — importing from `components/` into `data/` would be a backwards layering dependency.
- While relocating, remove the module's dependency on `src/lib/audio.ts` (see §1.3) — keeping it would create a circular import, since `audio.ts` itself imports `ALL_NOTES` from `src/data/guitarData.ts`.
- Fix the tension-string selection to try each string above the shell in ascending order instead of exactly one fixed string.
- Add `bestTensionVoicing()`, a thin wrapper that picks one representative (most compact) voicing from `computeTensionVoicings()`'s results, for use where only a single voicing is needed (the chord browser) as opposed to the Tensions tab's "show every option" UI.
- Add two new `COMMON_CHORDS` entries per root — `"<Root> 9 (Shell)"` and `"<Root> 13 (Shell)"` — generated at module load via `bestTensionVoicing()`, alongside the existing CAGED-shape generation loop in `guitarData.ts`.
- Add `'9'` and `'13'` cases to `Dictionary.tsx`'s `getNavigationChords()` so jumping in from Theory/Identify/Piano with a `G13` or `G9` chord name resolves to these new entries.

**Tech stack:** existing TypeScript modules only. No new dependencies.

---

## 1. `src/lib/tensionVoicings.ts` (new file)

Move the full contents of `src/components/voicings/tensions.ts` here, with the changes below. `TENSION_QUALITIES` (all 5 qualities, all tensions) and the `TensionDef`/`TensionQuality`/`TensionVoicing` interfaces move over unchanged.

### 1.1 Shell-set table: drop the hardcoded single tension string

Replace `SHELL_WITH_TENSION` with `SHELL_SETS`, dropping the unused `setLabel` field (dead data — `TensionsTab.tsx` already has its own `SET_CONFIG` labels and never read `setLabel`) and the single fixed `tension` string:

```typescript
const SHELL_SETS: { shell: [number, number, number]; setKey: string }[] = [
  { shell: [0, 1, 2], setKey: '6-3' },
  { shell: [1, 2, 3], setKey: '5-2' },
  { shell: [2, 3, 4], setKey: '4-1' },
];
```

### 1.2 `computeTensionVoicings`: try each string above the shell, closest first

```typescript
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

      let thirdMidi = rootMidi + thirdSt;
      let thirdFret = thirdMidi - OPEN_MIDI[s1];
      if (thirdFret < 0) { thirdFret += 12; thirdMidi += 12; }

      let seventhMidi = rootMidi + seventhSt;
      while (seventhMidi <= thirdMidi) seventhMidi += 12;
      let seventhFret = seventhMidi - OPEN_MIDI[s2];
      while (seventhFret < 0) { seventhFret += 12; seventhMidi += 12; }

      if (seventhMidi - rootMidi > 12) continue;
      if (thirdFret > 15 || seventhFret > 15) continue;

      let tensionMidi = rootMidi + tensionSt;
      while (tensionMidi <= seventhMidi) tensionMidi += 12;

      // Try the string immediately above the shell first, then each string
      // further up the neck. OPEN_MIDI is monotonically increasing, so for
      // a fixed target pitch, higher-index strings always yield a lower
      // (or equal) fret -- the old code tried only the first candidate and
      // dropped the whole voicing if it didn't fit in fret 0-15, even when
      // a higher string could hold the same pitch comfortably.
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
```

Worked example confirming the fix (from the user's own manually-found voicing): root G on the A string at fret 10 (shell `[1,2,3]`), 3rd on D at fret 9, 7th on G at fret 10, target 13th pitch class at MIDI 76. The old code only tried string 4 (B, open MIDI 59): fret `76-59=17`, out of range, so the *entire* voicing was silently dropped. The fixed loop tries string 4 first (still 17, rejected), then string 5 (high E, open MIDI 64): fret `76-64=12` — in range, accepted. Result: R(A/10)-3(D/9)-7(G/10)-13(E/12), a compact voicing matching what the user found by hand.

### 1.3 Remove the `lib/audio.ts` dependency

The original file imports `getFretNote` from `../../lib/audio` purely to build octave-qualified note labels (e.g. `"G3"`) for display. Two problems with keeping that import after the move:

- **Circular import:** `audio.ts` imports `ALL_NOTES` from `src/data/guitarData.ts`. If `guitarData.ts` also imports (transitively, via this module) from `audio.ts`, that's a cycle: `guitarData.ts` → `tensionVoicings.ts` → `audio.ts` → `guitarData.ts`.
- **Latent tuning inconsistency:** `getFretNote` labels notes using the live `currentAudioTuning` state, but this module's actual pitch math (`OPEN_MIDI`) is hardcoded to standard tuning regardless. If a user had selected an alternate tuning elsewhere in the app, the Tensions tab's note *labels* could silently disagree with the *frets* actually being shown.

Fix: compute the label locally from the MIDI number, using the module's own `NOTE_NAMES` table (already present and used by `noteNameFromMidi`). `OPEN_MIDI` values are already true MIDI numbers (verified: `OPEN_MIDI[0] = 40` = E2, matching `(2+1)*12 + 4`), so the octave falls out of `Math.floor(midi / 12) - 1`:

```typescript
function noteLabelFromMidi(midi: number): string {
  const name = noteNameFromMidi(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
```

This produces identical output to the old `getFretNote` calls under standard tuning (the only tuning this module's math ever assumed), removes the circular-import risk, and fixes the tuning-desync edge case as a side effect. Delete the `import { getFretNote } from '../../lib/audio';` line entirely — nothing else in the file needs it.

### 1.4 New export: `bestTensionVoicing`

For callers that want a single representative voicing (the chord browser) rather than every option (the Tensions tab). Picks the most compact voicing (smallest fret span among fretted notes), tie-broken by lowest neck position:

```typescript
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

### 1.5 Delete the old file

Delete `src/components/voicings/tensions.ts` once the move is complete. A repo-wide check confirms `src/components/voicings/TensionsTab.tsx` is the only importer (`grep -rn "voicings/tensions" src` / `grep -rn "from '\./tensions'" src`).

---

## 2. `src/components/voicings/TensionsTab.tsx` — update the import

Line 8 changes from:

```typescript
import { computeTensionVoicings, TENSION_QUALITIES } from './tensions';
```

to:

```typescript
import { computeTensionVoicings, TENSION_QUALITIES } from '../../lib/tensionVoicings';
```

No other change — the function signatures and `TensionVoicing` shape are unchanged, so the rest of the component (grouping by `setKey`, `SET_CONFIG` coloring, `sendToProgressions`) works as-is. Voicing *results* will differ in some cases (more voicings survive per root/tension, since fewer are dropped by the old single-string limitation) — this is the intended playability fix, visible directly in the Tensions tab.

---

## 3. `src/data/guitarData.ts` — new `COMMON_CHORDS` entries

Add near the top, alongside the existing imports:

```typescript
import { bestTensionVoicing } from '../lib/tensionVoicings';
```

After the existing shape-generation `for (const note of ALL_NOTES) { ... }` loop (currently ending at line 85, just before `export type ScaleCategory`), append a second loop:

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

Notes:
- `thirdSt: 4, seventhSt: 10` are the dominant-7 shell intervals already defined for the `'dom7'` entry in `TENSION_QUALITIES` — duplicated here as local constants rather than importing `TENSION_QUALITIES` and searching it, since only these two fixed numbers are needed and it keeps this loop simple to read.
- `fingers: v.frets.map(f => (f === -1 ? -1 : 0))` matches the existing convention established in `TensionsTab.tsx`'s `sendToProgressions` handler for tension voicings with no defined fingering — `Fretboard.tsx` and `ChordCard.tsx` render off `frets`, and finger numbers only affect the (currently unused for the "Shell" style) finger-number overlay.
- No `baseFret`/`barre` set (both optional and unused by rendering, confirmed unused elsewhere in the codebase) — these voicings aren't barre shapes.
- `bestTensionVoicing` can return `null` in principle (empty result set); the `if (!v) continue;` guard skips that root/tension combination rather than pushing a broken entry. In practice this shouldn't happen for any of the 12 roots given the algorithm fix, but the guard costs nothing.

This produces, per root, two new browsable entries: e.g. for G, `"G 9 (Shell)"` and `"G 13 (Shell)"`, appearing in the Chords tab's "Variations" list alongside the existing CAGED shapes.

---

## 4. `src/pages/Dictionary.tsx` — navigation lookup

`getNavigationChords()` (lines 63–99) parses a Tonal.js chord symbol like `"G13"` into `root = "G"`, `qual = "13"`, then filters `COMMON_CHORDS[root]` by matching the quality suffix of each chord's `name`. Add two cases, next to the existing `case '7':` (line 80–81):

```typescript
case '9':
  shapes = pool.filter(c => q(c).startsWith('9')); break;
case '13':
  shapes = pool.filter(c => q(c).startsWith('13')); break;
```

Verified non-collision: `q(c)` for the new entries is `"9 (Shell)"` / `"13 (Shell)"` (everything in `c.name` after `"<root> "`). Neither matches the existing `case '7'` filter (`s.startsWith('7 ') || s === '7' || s.startsWith('7(')`), and no other case's `startsWith` prefix overlaps `'9'` or `'13'`.

This makes `G13` and `G9` chord symbols — e.g. arriving via a URL query param or a jump-in handler from Theory/Identify/Piano — resolve to the new entries instead of returning an empty array.

---

## Edge cases

- **A root/tension combination where even the fixed-string-fallback loop can't fit the tension in fret 0–15 on any string:** falls through to `continue` in `computeTensionVoicings`, same as before, just far less likely now that multiple strings are tried. `bestTensionVoicing` returns `null` if this empties the whole result set for a root; `guitarData.ts`'s generation loop skips that entry via the `if (!v) continue;` guard rather than crashing or pushing a broken chord.
- **Existing Tensions tab users see different (better) voicings than before** for cases that previously got dropped or forced to a wide stretch — this is the intended fix, not a regression; no data persists across sessions that would need migrating (Tensions tab has no localStorage state).
- **`sendToProgressions` from the Tensions tab:** unaffected — it already builds a `ChordShape` from a `TensionVoicing` the same way the new `guitarData.ts` loop does, using the same "no defined fingering" convention.

## Testing

No automated test suite exists (`npm run lint` is TypeScript-only). Manual verification:

1. `npm run lint` passes after the file move and both edits (catches any missed import path or type mismatch).
2. Voicings → Tensions tab: select `G`, `7`, `13`. Confirm the previously-missing compact voicing (root on A/fret 10, 3rd on D/fret 9, 7th on G/fret 10, 13th on high E/fret 12) now appears, and no existing valid voicing disappeared.
3. Dictionary → Chords tab: select root `G`. Confirm `"G 9 (Shell)"` and `"G 13 (Shell)"` appear in the Variations list and render a sensible, compact fretboard diagram.
4. Repeat step 3 for a few other roots (e.g. `C`, `F#`, `B`) to confirm the generation loop works across the full 12-root cycle, including roots that push root-fret search past the open position.
5. From Identify or Theory, trigger a lookup for a `G13` chord symbol (however that page currently constructs `tonalName` for a detected/typed chord) and confirm it resolves to the new `"G 13 (Shell)"` entry instead of an empty result.
6. Confirm the Tensions tab's on-screen note labels (e.g. `"G3"`, `"B3"`) look the same as before the `noteLabelFromMidi` swap — spot-check a couple of roots/qualities.

## Out of scope

- Dominant 11 chords (rare in practice; not requested).
- Note-doubling (playing the same pitch class on two strings, as in the user's original manually-built example with both B and E fretted at 12) — the fallback-string fix alone recovers an equivalently compact single-tension-note voicing without the added complexity of doubling logic.
- Any UI change to `TensionsTab.tsx` beyond the import path — its behavior changes only in *which voicings appear*, not how they're displayed.
- Any change to `ShellVoicingsTab.tsx` or the plain (non-tension) shell-voicing algorithm.
- Adding a quality *filter* UI to the Chords tab (it currently has no filter, just an unfiltered per-root list) — the new entries simply appear in that existing list.
