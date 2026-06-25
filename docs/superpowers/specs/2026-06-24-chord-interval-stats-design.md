# Chord & Interval Recognition Stats — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

## Overview

Extend cross-session stats tracking to Chord Recognition and Interval Recognition modes. Persist round results (correct/incorrect + response time) to localStorage, surface accuracy trends and weak spots in the session summary modal, and provide a weakest-types hint in the Settings panel. CSV export/import for data portability.

Study mode is explicitly excluded — no right/wrong signal to record.

---

## 1. Data Layer

### 1.1 Entry shapes

```typescript
interface ChordHistoryEntry {
  date: string;           // ISO date, e.g. "2026-06-24"
  typeLabel: string;      // e.g. "Major 7th", "Minor"
  rootNote: string;       // e.g. "C", "F#"
  correct: boolean;
  responseTimeMs: number; // ms from round start to answer click
}

interface IntervalHistoryEntry {
  date: string;           // ISO date, e.g. "2026-06-24"
  label: string;          // e.g. "Perfect 5th", "Tritone"
  rootNote: string;       // e.g. "C4", "F#3"
  correct: boolean;
  responseTimeMs: number; // ms from round start to answer click
}
```

### 1.2 Storage keys

- `chord_history` — localStorage key for chord entries
- `interval_history` — localStorage key for interval entries

### 1.3 New files

**`src/lib/chordHistory.ts`**

```typescript
export function loadChordHistory(): ChordHistoryEntry[]
export function appendChordEntries(entries: ChordHistoryEntry[]): void
export function mergeChordEntries(incoming: ChordHistoryEntry[]): void  // deduplicates by all five fields
export function exportToCsv(entries: ChordHistoryEntry[]): string
export function parseFromCsv(csv: string): ChordHistoryEntry[]
```

**`src/lib/intervalHistory.ts`**

```typescript
export function loadIntervalHistory(): IntervalHistoryEntry[]
export function appendIntervalEntries(entries: IntervalHistoryEntry[]): void
export function mergeIntervalEntries(incoming: IntervalHistoryEntry[]): void  // deduplicates by all five fields
export function exportToCsv(entries: IntervalHistoryEntry[]): string
export function parseFromCsv(csv: string): IntervalHistoryEntry[]
```

### 1.4 CSV formats

**Chord:** `date,type_label,root_note,correct,response_time_ms`  
Example row: `2026-06-24,Major 7th,C,true,1240`

**Interval:** `date,label,root_note,correct,response_time_ms`  
Example row: `2026-06-24,Perfect 5th,C4,true,980`

`mergeChordEntries` / `mergeIntervalEntries` deduplicate by matching all five fields. Identical rows are skipped; new rows are appended. No destructive replacement.

---

## 2. Round Recording

### 2.1 Response time measurement

In `EarTraining.tsx`:

- Add a `roundStartTimeRef = useRef<number>(Date.now())` 
- Set `roundStartTimeRef.current = Date.now()` inside `advanceRound()` each time a new round is prepared
- In `handleAnswer`, compute `responseTimeMs = Date.now() - roundStartTimeRef.current`

### 2.2 Where to record

Inside `handleAnswer` in `EarTraining.tsx`, immediately after determining `isCorrect`, append one entry to the appropriate history:

**Chord round:**
```typescript
appendChordEntries([{
  date: new Date().toISOString().slice(0, 10),
  typeLabel: (round as ChordRound).correct.typeLabel,
  rootNote: (round as ChordRound).correct.rootNote,
  correct: isCorrect,
  responseTimeMs,
}]);
```

**Interval round:**
```typescript
appendIntervalEntries([{
  date: new Date().toISOString().slice(0, 10),
  label: (round as IntervalRound).correct.label,
  rootNote: (round as IntervalRound).correct.rootNote,
  correct: isCorrect,
  responseTimeMs,
}]);
```

Entries are flushed to localStorage immediately (one per round) so data is not lost if the session is abandoned mid-way.

---

## 3. Session Summary UI

Shown in the score/summary area of `EarTraining.tsx` after a Chord Recognition or Interval Recognition session ends. Rendered as a panel below the existing score line, open by default.

### 3.1 Per-type accuracy table

One row per type practiced this session. Columns:

| Type | All-time accuracy | Avg response time |
|------|-------------------|-------------------|
| Major 7th | 78% | 1.4s |
| Tritone | 48% | 2.1s |

- **All-time accuracy**: `correct / total` across all history (not just today's session)
- **Avg response time**: mean `responseTimeMs` across all history for that type, shown as `X.Xs`
- Color coding applied to the accuracy value only:
  - ≥ 80% → `#27ae60` (green)
  - ≥ 60% → `#f1c40f` (yellow)
  - < 60% → `#c0392b` (red)
- Rows sorted by all-time accuracy ascending (weakest first)

### 3.2 Sparkline

A small SVG line chart (width: full container, height: 48px) showing **accuracy % per calendar date**, using the last 8 distinct dates in history that have at least 3 entries.

- X axis: dates, evenly spaced
- Y axis: 0% to 100%
- Line stroke color: green if latest point ≥ 80%, yellow if ≥ 60%, red otherwise
- Dots at each data point: 4px radius
- Hidden if fewer than 2 dates with qualifying data exist

### 3.3 Weakest types

A compact line below the table:

```
Focus on: Tritone · Aug 4th · Major 7th
```

- Shows the 3 chord types or intervals with the lowest all-time accuracy
- Only types with ≥ 5 all-time attempts are eligible
- Hidden if fewer than 3 types meet the 5-attempt threshold

---

## 4. Settings Panel

### 4.1 Weakest types hint

In the Settings panel, directly below the chord type / interval checkboxes, render a single dim line when history exists:

```
Weakest: Tritone (48%) · Aug 4th (52%) · Major 7th (55%)
```

- Only types with ≥ 5 all-time attempts are eligible
- Hidden if fewer than 3 types meet the threshold
- Updates each time the Settings panel opens (reads from localStorage on render)
- Styled as `text-xs text-brand-secondary`

### 4.2 Export / Import CSV

Two small buttons ("Export CSV" / "Import CSV") added to the Settings panel, each set visible only for the active mode:

- Shown when `settings.mode === 'chord'` → operates on `chord_history`
- Shown when `settings.mode === 'interval'` → operates on `interval_history`

**Export:** calls `exportToCsv(loadChordHistory())` or `exportToCsv(loadIntervalHistory())`, creates a Blob, triggers `<a download="guitar-chord-stats.csv">` or `<a download="guitar-interval-stats.csv">` click. `revokeObjectURL` deferred with `setTimeout(..., 100)`.

**Import:** hidden `<input type="file" accept=".csv">` triggered by button click. On file select, reads text, calls `parseFromCsv`, then `mergeChordEntries` / `mergeIntervalEntries`, shows inline confirmation: "Imported N rows". On parse error: "Import failed — check file format."

---

## 5. What Does Not Change

- `SessionScore` interface and `byType` in-session tracking
- `handleAnswer` answer-reveal behavior and option highlighting
- `ChordRound` / `IntervalRound` / `FretboardRound` types
- Hunt mode history (`hunt_history`, `huntHistory.ts`)
- Stars grading, streak tracking, 20-round session length

---

## 6. Affected Files

| File | Change |
|------|--------|
| `src/lib/chordHistory.ts` | **New** — persistence, CSV export/import |
| `src/lib/intervalHistory.ts` | **New** — persistence, CSV export/import |
| `src/pages/EarTraining.tsx` | Add `roundStartTimeRef`; record entry in `handleAnswer`; render summary panel; render weakest-types hint and Export/Import buttons in Settings |
