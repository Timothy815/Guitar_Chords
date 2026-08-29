# Identify Mode: Slide Across Strings — Design Spec

## Goal

The Dictionary → Identify tab already lets you slide a fretted cluster **horizontally** (same strings, ±1 fret, via the existing "Slide shape" control). Add a matching control that slides the cluster **vertically** (same relative shape, ±1 string), so you can see, for example, what a shell voicing on E-A-D looks like moved onto A-D-G, or D-G-B, etc. — including safely crossing the B string, which is tuned a major third from G instead of the perfect fourth used everywhere else on the neck.

A naive "same fret number, new string" shift breaks the chord the moment it crosses the B string. Instead, the shift must preserve the semitone intervals between the fretted notes, recomputing correct fret positions per string — the same technique `ShellVoicingsTab.computeShellVoicings` already uses to *generate* shell voicings, generalized here to *translate* an existing arbitrary cluster.

## Architecture

- Add a new pure function, `shiftFretsAcrossStrings`, to `src/lib/utils.ts` next to the existing (currently unexported) `OPEN_STRING_PITCHES` constant it depends on.
- Add a new "Slide across strings" control block to the Identify sidebar in `src/pages/Dictionary.tsx`, directly below the existing "Slide shape" block, following the same visual pattern.
- No changes to `Fretboard.tsx`, `ShellVoicingsTab.tsx`, or the chord-identification logic (`TonalChord.detect`, `detectShellVoicings`) — this feature only ever produces a new `identifiedFrets` array, which flows through the existing identification pipeline unchanged.

**Tech stack:** React 19, TypeScript, existing `Dictionary.tsx` / `lib/utils.ts`. No new dependencies.

---

## 1. `src/lib/utils.ts` — `shiftFretsAcrossStrings`

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

Note for the implementer: `OPEN_STRING_PITCHES` is currently a module-local `const` in `utils.ts` (not exported) — no change needed there, `shiftFretsAcrossStrings` is defined in the same module and can reference it directly.

**Contract:**
- Input: `frets` — 6-element array, index 0 = low E, `-1` = muted/unfretted (same convention used everywhere else in the app).
- Input: `delta` — `-1` shifts every fretted note one string toward the bass (low E); `1` shifts toward the treble (high E).
- Output: a new 6-element `frets` array. The lowest-pitched surviving note (the anchor) keeps its fret number and simply moves to its new string; every other surviving note is placed at the same semitone offset from the anchor it had before the shift, nudged by whole octaves only when needed to stay within fret 0–15. Notes that ran off either edge of the fretboard are `-1`.
- Pure function, no side effects, safe to call on every render.

---

## 2. `src/pages/Dictionary.tsx` — wiring and UI

### New handler, next to `shiftFrets` (~line 1061)

```typescript
function shiftStrings(delta: 1 | -1) {
  setIdentifiedFrets(prev => shiftFretsAcrossStrings(prev, delta));
}
```

### New derived state, next to `canShiftDown`/`canShiftUp` (~line 1058)

```typescript
const frettedStrings = identifiedFrets
  .map((f, s) => (f !== -1 ? s : -1))
  .filter(s => s !== -1);
const canShiftStringDown = frettedStrings.some(s => s - 1 >= 0);
const canShiftStringUp = frettedStrings.some(s => s + 1 <= 5);

const OPEN_STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
const currentStringLabel = frettedStrings.length > 0
  ? frettedStrings.map(s => OPEN_STRING_NAMES[s]).join(' · ')
  : '';
```

`canShiftStringDown`/`canShiftStringUp` are `true` as long as **at least one** fretted note survives the shift — a direction only disables when it would drop every remaining note (a dead click with nothing left to show). This intentionally allows partial drops (e.g. a 3-note shell shrinking to a dyad) without disabling anything.

### New UI block, immediately after the "Slide shape" block (~line 1848, before the "Show all notes toggle")

```tsx
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
```

`shiftFretsAcrossStrings` must be imported from `../lib/utils` alongside the existing `cn` import in this file.

---

## Edge cases

- **Cluster crosses the B string in either direction:** handled correctly by construction — every note's fret is recomputed from its semitone offset to the anchor, not copied from the old string, so the major-third tuning gap is automatically compensated for.
- **Shift would drop every fretted note:** direction button is disabled (`canShiftStringDown`/`canShiftStringUp` false); nothing happens.
- **Shift drops some but not all notes:** allowed with no confirmation — the surviving notes are recomputed and drawn immediately; this is the intended "shape runs off the edge of the strings" behavior.
- **Single remaining fretted note:** still shiftable — with nothing else in the cluster, that note is its own anchor and simply keeps the same fret number on the new string (its pitch transposes by whatever interval separates the two strings, exactly like the general case).
- **Zero fretted notes:** whole block hidden, matching "Slide shape."
- **Octave adjustment needed** (a non-anchor note's recomputed fret falls outside 0–15): that note alone is nudged by whole octaves until it lands in range; the anchor's fret never moves. Because the offset from the anchor is preserved exactly (just relocated by a multiple of 12 semitones), the note keeps its harmonic identity (still "the third," still "the seventh") — only its specific octave register can shift, which is an unavoidable and expected trade-off of the fretboard's limited range, not an inversion-scrambling bug.
- **No octave adjustment can fit a survivor within fret 0–15** (not expected in practice — a 16-fret window always contains a representative of every pitch class — but handled defensively): that note is dropped, same as running off the string edge.

## Testing

No automated test suite exists (`npm run lint` is TypeScript-only). Manual verification:

1. Fret a 3-note shell on E-A-D (e.g. root/3rd/7th of a maj7 shape) in Identify mode; confirm the chord name shown is correct.
2. Click "Treble ▲" repeatedly and confirm the identified chord name stays correct as the cluster crosses A-D-G → D-G-B (the B-string seam) → G-B-E.
3. Continue clicking "Treble ▲" past G-B-E; confirm the top note is dropped (cluster becomes a 2-note dyad) rather than the button doing nothing or crashing.
4. Click "▼ Bass" from a low position (e.g. already on E-A-D) enough times to confirm the button disables once no notes would survive.
5. Fret a single note, confirm both string-shift buttons work and simply relocate that one note.
6. Fret a cluster near the top of the neck (e.g. fret 13+) and shift across strings; confirm an octave jump occurs when needed and the resulting chord is still identified correctly.
7. Confirm "Slide shape" (horizontal) and "Slide across strings" (vertical) can be used in combination with no interference.

## Out of scope

- Any change to the "Other positions" Prev/Next navigator (`navChords`/`navIdx`) — unrelated existing feature for cycling through alternate voicings of an already-identified chord.
- Any change to `ShellVoicingsTab.tsx` or its `computeShellVoicings` algorithm — this is a separate, analogous implementation for a different data shape (translating an existing arbitrary cluster vs. generating fresh 3-note voicings from scratch).
- Diagonal/drag-based interaction for the shift (arrow buttons only, matching "Slide shape").
- Persisting shift state across navigation or sessions.
