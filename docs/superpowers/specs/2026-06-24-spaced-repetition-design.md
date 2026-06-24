# Spaced Repetition — Design Spec

## Goal

Surface notes the user gets wrong more often within a practice session so weak spots get targeted drilling. Wrong notes appear proportionally more in the next deck cycle; the user can see which notes are weak both during the session and in the summary.

## Scope

- **Applies to:** Fretboard mode only (Guess, Hunt, and Sing sub-modes all benefit automatically).
- **Session-only:** Wrong counts reset when the page is refreshed or the mode is switched. No localStorage persistence.
- **No new state:** Wrong counts are derived from the existing `score.byType` record, which already stores `{ correct, total }` keyed by `targetNote` in fretboard mode.

## Architecture

One file changes: `src/pages/EarTraining.tsx`. No new files, no new imports beyond what is already present.

## Deck Weighting

`nextFretboardNote` (lines 46–60 of `EarTraining.tsx`) rebuilds the deck array whenever it is exhausted. The change is in how the pool array is built before the Fisher-Yates shuffle.

**Before:** Each unique note in the pool contributes exactly one slot.

**After:** Each note contributes `min(wrongCount + 1, 4)` slots, where `wrongCount = (score.byType[note]?.total ?? 0) - (score.byType[note]?.correct ?? 0)`.

| Wrong count | Copies in deck |
|-------------|----------------|
| 0           | 1              |
| 1           | 2              |
| 2           | 3              |
| 3+          | 4 (cap)        |

The cap of 4 prevents any single note from dominating even after repeated misses. A note missed twice appears roughly 3× as often as a note never missed.

**Timing note:** If a wrong answer happens to exhaust the deck, the rebuild runs before React has batched the score update for that round — so that note's wrong count is off by one in the rebuild. This is a rare edge case (one in pool-size rounds) and self-corrects by the next rebuild. Not worth working around.

**Cache key:** The existing `deckKeyRef` caches by `diff|focus`. When the deck rebuilds on exhaustion, it naturally reads the latest `score.byType` via closure — no cache key change needed.

## Weak Note Display

### During the session — score bar

The fixed bottom score bar (`lines 657–676`) currently shows `"X / Y correct"` and a streak. When at least one note has `wrongCount > 0` and the mode is `'fretboard'`, append a compact weak-notes indicator to the left side of the bar:

```
3 / 10 correct   Weak: F# · Bb · C#   [End Session]
```

- Show the top 3 notes by wrong count (most wrong first), stripped of octave number (`F#4` → `F#`).
- If two notes have the same wrong count, sort alphabetically.
- Separator between note names: ` · ` (middle dot with spaces).
- Label: `Weak:` in `text-brand-secondary`, note names in `text-brand-ink font-medium`.
- Only rendered when `settings.mode === 'fretboard'` and at least one note has been missed.

### In the session summary modal

For fretboard mode, the existing `score.byType` table (lines 695–714) shows all attempted notes. Replace this block with a fretboard-specific "Weak Notes" section:

- Only shown when `settings.mode === 'fretboard'` and at least one note has `wrongCount > 0`.
- If no notes were missed, the section is omitted entirely (clean summary for a perfect session).
- Sorted by wrong count descending; alphabetical tiebreak.
- Columns: **Note | Wrong | Attempted**
- Note names stripped of octave (`F#4` → `F#`).

Example:

| Note | Wrong | Attempted |
|------|-------|-----------|
| F#   | 3     | 5         |
| Bb   | 2     | 3         |
| C#   | 1     | 4         |

The existing `score.byType` table (chord/interval mode) remains unchanged — it is only hidden in fretboard mode, replaced by the weak notes table above.

## Out of Scope

- Persistence across sessions (localStorage / backend)
- Weighting for chord or interval modes
- Visual fretboard highlighting of weak-note positions
- Configurable cap or weighting formula
- Weak note display in non-fretboard modes
