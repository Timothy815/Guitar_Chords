# Hunt Mode Scoring Redesign — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

## Overview

Improve the Hunt mode experience by persisting round-level data across sessions, surfacing it in a note×octave heatmap grid, adding a cross-session sparkline, and providing a readiness signal that tells the student when to expand their fret range. Add CSV export/import so data survives cache clears and transfers between machines.

---

## 1. Data Layer

### 1.1 Storage key

`hunt_history` in `localStorage`.

### 1.2 Entry shape

```typescript
interface HuntHistoryEntry {
  date: string;          // ISO date string, e.g. "2026-06-24"
  note: string;          // pitch class, e.g. "C", "F#"
  octave: number;        // 2, 3, or 4
  firstTapSemitones: number;  // absolute semitone distance from first tap to target
  tapCount: number;           // total fret taps before Confirm
  fretMin: number;            // inclusive fret range lower bound at time of round
  fretMax: number;            // inclusive fret range upper bound at time of round
}
```

`date` is the calendar date the round was played (not timestamp). Multiple rounds on the same date share the same `date` string.

### 1.3 Persistence module

New file `src/lib/huntHistory.ts` exports:

```typescript
export function loadHuntHistory(): HuntHistoryEntry[]
export function appendHuntEntries(entries: HuntHistoryEntry[]): void
export function mergeHuntEntries(incoming: HuntHistoryEntry[]): void  // import path; deduplicates by matching all seven fields
export function exportToCsv(entries: HuntHistoryEntry[]): string      // returns CSV string
export function parseFromCsv(csv: string): HuntHistoryEntry[]         // parses CSV, skips malformed rows
```

### 1.4 CSV format

Header row required. Columns in order:

```
date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max
```

Example row: `2026-06-24,C,3,1.0,2,0,5`

`mergeHuntEntries` deduplicates by matching all seven fields (identical row = skip). On import, new rows are appended; existing identical rows are ignored. No destructive replacement.

---

## 2. Round Recording

At the end of each successful Hunt round (inside `FretboardTrainer`, when `onComplete(true, huntResult)` fires), the caller in `EarTraining.tsx` records one `HuntHistoryEntry`:

- `date`: `new Date().toISOString().slice(0, 10)`
- `note` + `octave`: parsed from `round.targetNote` (e.g. `"C4"` → note `"C"`, octave `4`)
- `firstTapSemitones`: from `huntResult.firstSelectionSemitones`
- `tapCount`: from `huntResult.selectionCount`
- `fretMin` / `fretMax`: from the active `FretboardFocus` (`focus.fretMin ?? 0`, `focus.fretMax ?? round.fretsNum`)

Entries are batched per session (collected in a local array while playing) and flushed to localStorage via `appendHuntEntries` at each round completion.

---

## 3. Live Indicator

During a Hunt session, a compact one-line stats bar is shown directly below the Confirm button row inside `FretboardTrainer`:

```
Session avg:  2.1 semi · 1.4 taps   [colored dot]
```

- Only shown once at least 3 rounds have been played in the current session.
- Color logic (applied to the dot and the numbers):
  - **Green** (`#27ae60`): avg semitones ≤ 1.5 AND avg taps ≤ 1.5
  - **Yellow** (`#f1c40f`): avg semitones ≤ 3.0 AND avg taps ≤ 2.5
  - **Red** (`#c0392b`): otherwise
- Values are computed from the current session's rounds only (not history).

---

## 4. Session Summary — Note×Octave Grid

Shown in the score/summary area of `EarTraining.tsx` after a Hunt session ends (i.e., when the user has completed rounds and the score bar is visible). It is rendered in a collapsible panel below the existing score line, open by default after each session.

### 4.1 Grid layout

- **Y axis (rows)**: all 12 pitch classes in ascending order: `C C# D Eb E F F# G Ab A Bb B`
- **X axis (columns)**: octaves present in the history filtered to the current fret range: `Oct 2`, `Oct 3`, `Oct 4`
- Row label: pitch class name (monospace, right-aligned, 40px)
- Column header: `Oct N`

### 4.2 Cell content

Each cell shows data aggregated from **all history** matching that note+octave combination within the current fret range (fretMin/fretMax). The displayed value is the mean `firstTapSemitones` across all matching entries.

- Occupied cell: colored background, number showing `avgSemitones.toFixed(1)`, dark text
- Empty cell (note+octave not reachable in current fret range): dark dimmed background, no content
- Cell with no data yet (reachable but never played): dimmed background with `—`

Color thresholds (same as live indicator):
- ≤ 1.5: `#27ae60` (dark green)
- ≤ 2.5: `#2ecc71` (light green)  
- ≤ 3.5: `#e67e22` (orange)
- ≤ 5.0: `#c0392b` (red)
- > 5.0: `#922b21` (dark red)

### 4.3 Current fret range filtering

"Reachable" notes are determined by calling `buildFretboardNotePool(difficulty, focus)` from `earTraining.ts` — the same pool used to generate rounds. Only notes returned by that function are shown as occupied/data cells. All other cells are dimmed.

---

## 5. Sparkline

Shown above the note grid in the summary panel. A small SVG line chart (width: full container, height: 48px) plotting the **mean `firstTapSemitones`** per calendar date, using the last 8 distinct dates in `hunt_history` that have at least 5 entries on that date.

- X axis: dates, evenly spaced
- Y axis: 0 to 6 semitones (clamped)
- Line: single stroke, color matching current performance tier
- Dots at each data point: 4px radius
- No axis labels; tooltip on hover is not required (out of scope)
- If fewer than 2 dates with data exist: sparkline is hidden

---

## 6. Readiness Message

Shown below the note grid in the summary panel.

**Readiness criteria** (checked after each session completes):

1. The last 3 calendar dates in history (within the current `fretMin`/`fretMax` range) each have ≥ 15 entries.
2. Across those 3 dates, the overall mean `firstTapSemitones` ≤ 2.0.
3. Across those 3 dates, the overall mean `tapCount` ≤ 1.5.

All three conditions must hold simultaneously.

**Message variants:**

- **Ready to expand** (all criteria met): green banner — "You've nailed this range. Try adding more frets to your focus."
- **Getting there** (2 of 3 criteria met, or criteria met for only 1–2 sessions): yellow — "Solid progress. Keep at it — 3 consistent sessions and you're ready to expand."
- **Keep practicing** (fewer than 2 criteria met): neutral — "Keep hunting. Focus on the red cells — those notes need more reps."

---

## 7. Export / Import CSV

Two small buttons rendered in the Hunt settings area (alongside the existing focus selector) inside `FretboardTrainer`, visible only when `isHuntMode` is true:

- **"Export CSV"**: calls `exportToCsv(loadHuntHistory())`, creates a `Blob`, triggers a `<a download="guitar-hunt-stats.csv">` click
- **"Import CSV"**: `<input type="file" accept=".csv">` hidden, triggered by button click; on file select, reads file text, calls `parseFromCsv(text)`, then `mergeHuntEntries(parsed)`, then shows a brief inline confirmation: "Imported N rows"

Import errors (unparseable file, wrong columns) show inline: "Import failed — check file format."

---

## 8. What Does Not Change

- Stars grading thresholds (0/2/5 semitones)
- The Confirm button and its behavior
- Per-round feedback text
- `HuntResult` interface
- `SessionScore` interface
- The `mouseDownFiredRef` double-fire guard

---

## 9. Affected Files

| File | Change |
|------|--------|
| `src/lib/huntHistory.ts` | **New** — persistence, CSV export/import |
| `src/components/FretboardTrainer.tsx` | Add live indicator; add export/import buttons |
| `src/pages/EarTraining.tsx` | Call `appendHuntEntries` on each successful hunt round in `handleFretboardComplete`; pass fret focus to trainer; render session summary panel (grid + sparkline + readiness) |

No other files change.
