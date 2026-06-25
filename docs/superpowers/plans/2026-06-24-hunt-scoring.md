# Hunt Mode Scoring Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist hunt-round results to localStorage, surface them in a cross-session note×octave heatmap, sparkline, and readiness message in the session summary modal, and add CSV export/import for portability.

**Architecture:** New `huntHistory.ts` module handles all persistence and CSV logic. `FretboardTrainer` receives two new optional props for the live session indicator and gains CSV buttons. `EarTraining` accumulates session entries, calls `appendHuntEntries` on each successful hunt round, passes averages down to `FretboardTrainer`, and renders the enhanced summary panel.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4, localStorage, native File API (no new dependencies)

## Global Constraints

- No new npm dependencies — use native browser APIs only
- `ALL_NOTES` from `src/data/guitarData.ts` = `['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']` — use this exact array for grid row order
- localStorage key: `hunt_history` (no other key name)
- CSV header row (exact): `date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max`
- Download filename: `guitar-hunt-stats.csv`
- Live indicator threshold values: green ≤ 1.5 semi AND ≤ 1.5 taps; yellow ≤ 3.0 semi AND ≤ 2.5 taps; red otherwise
- Cell color thresholds (avg semitones): ≤1.5 → `#27ae60`; ≤2.5 → `#2ecc71`; ≤3.5 → `#e67e22`; ≤5.0 → `#c0392b`; >5.0 → `#922b21`
- Readiness criteria: last 3 dates in range-filtered history, each ≥15 entries; overall mean firstTapSemitones ≤ 2.0; overall mean tapCount ≤ 1.5
- There are no automated tests. Use `npm run lint` (TypeScript type-check only) as the static gate after each task.

---

### Task 1: Data layer — `src/lib/huntHistory.ts`

**Files:**
- Create: `src/lib/huntHistory.ts`

**Interfaces:**
- Consumes: nothing (standalone module)
- Produces:
  ```typescript
  export interface HuntHistoryEntry {
    date: string;           // "YYYY-MM-DD"
    note: string;           // pitch class, e.g. "C", "F#"
    octave: number;         // 2 | 3 | 4
    firstTapSemitones: number;
    tapCount: number;
    fretMin: number;
    fretMax: number;
  }
  export function loadHuntHistory(): HuntHistoryEntry[]
  export function appendHuntEntries(entries: HuntHistoryEntry[]): void
  export function mergeHuntEntries(incoming: HuntHistoryEntry[]): void
  export function exportToCsv(entries: HuntHistoryEntry[]): string
  export function parseFromCsv(csv: string): HuntHistoryEntry[]
  ```

- [ ] **Step 1: Create `src/lib/huntHistory.ts` with the full implementation**

  ```typescript
  const STORAGE_KEY = 'hunt_history';

  export interface HuntHistoryEntry {
    date: string;
    note: string;
    octave: number;
    firstTapSemitones: number;
    tapCount: number;
    fretMin: number;
    fretMax: number;
  }

  export function loadHuntHistory(): HuntHistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as HuntHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  function saveHuntHistory(entries: HuntHistoryEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  export function appendHuntEntries(entries: HuntHistoryEntry[]): void {
    saveHuntHistory([...loadHuntHistory(), ...entries]);
  }

  export function mergeHuntEntries(incoming: HuntHistoryEntry[]): void {
    const existing = loadHuntHistory();
    const rowKey = (e: HuntHistoryEntry) =>
      `${e.date}|${e.note}|${e.octave}|${e.firstTapSemitones}|${e.tapCount}|${e.fretMin}|${e.fretMax}`;
    const existingKeys = new Set(existing.map(rowKey));
    const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
    saveHuntHistory([...existing, ...newEntries]);
  }

  export function exportToCsv(entries: HuntHistoryEntry[]): string {
    const header = 'date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max';
    const rows = entries.map(e =>
      `${e.date},${e.note},${e.octave},${e.firstTapSemitones},${e.tapCount},${e.fretMin},${e.fretMax}`,
    );
    return [header, ...rows].join('\n');
  }

  export function parseFromCsv(csv: string): HuntHistoryEntry[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().replace(/\s/g, '');
    if (header !== 'date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max') return [];
    const entries: HuntHistoryEntry[] = [];
    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length !== 7) continue;
      const [date, note, octaveStr, semStr, tapStr, fminStr, fmaxStr] = parts;
      const octave = parseInt(octaveStr, 10);
      const firstTapSemitones = parseFloat(semStr);
      const tapCount = parseInt(tapStr, 10);
      const fretMin = parseInt(fminStr, 10);
      const fretMax = parseInt(fmaxStr, 10);
      if (!date || !note || isNaN(octave) || isNaN(firstTapSemitones) || isNaN(tapCount) || isNaN(fretMin) || isNaN(fretMax)) continue;
      entries.push({ date, note, octave, firstTapSemitones, tapCount, fretMin, fretMax });
    }
    return entries;
  }
  ```

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```
  Expected: 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/huntHistory.ts
  git commit -m "feat: add hunt history persistence and CSV export/import module"
  ```

---

### Task 2: Live indicator + CSV buttons — `src/components/FretboardTrainer.tsx`

**Files:**
- Modify: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Consumes: `loadHuntHistory`, `exportToCsv`, `mergeHuntEntries`, `parseFromCsv`, `HuntHistoryEntry` from `../lib/huntHistory`
- Produces (new props on `FretboardTrainerProps`):
  ```typescript
  sessionAvgSemitones?: number;  // show live indicator when defined
  sessionAvgTaps?: number;
  ```

- [ ] **Step 1: Add imports at top of `FretboardTrainer.tsx`**

  Replace the existing import block (lines 1–9):
  ```typescript
  import React, { useState, useEffect, useCallback, useRef } from 'react';
  import { Volume2 } from 'lucide-react';
  import { Fretboard } from './Fretboard';
  import { FretboardFocusSelector } from './FretboardFocusSelector';
  import {
    FretboardRound, DifficultyLevel, SessionScore, HuntResult, FretboardFocus,
    getCorrectPositions, playFretboardRound, getAbsoluteSemitoneDistance, getAbsoluteDirection,
  } from '../lib/earTraining';
  import { getFretNote, initAudio, playNote, startNote, stopNote } from '../lib/audio';
  import {
    loadHuntHistory, exportToCsv, mergeHuntEntries, parseFromCsv,
  } from '../lib/huntHistory';
  ```

- [ ] **Step 2: Add `sessionAvgSemitones` and `sessionAvgTaps` to `FretboardTrainerProps`**

  The interface is at lines 11–22. Replace it:
  ```typescript
  interface FretboardTrainerProps {
    round: FretboardRound;
    difficulty: DifficultyLevel;
    score: SessionScore;
    isHuntMode: boolean;
    focus?: FretboardFocus;
    onFocusChange?: (focus: FretboardFocus) => void;
    droneNote?: string | null;
    droneMode?: 'off' | 'continuous' | 'cue';
    singMode?: boolean;
    sessionAvgSemitones?: number;
    sessionAvgTaps?: number;
    onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
  }
  ```

- [ ] **Step 3: Destructure the new props in the function signature**

  Replace the function signature starting at line 24:
  ```typescript
  export function FretboardTrainer({
    round, score, isHuntMode,
    focus = {}, onFocusChange,
    droneNote, droneMode,
    singMode,
    sessionAvgSemitones,
    sessionAvgTaps,
    onComplete,
  }: FretboardTrainerProps) {
  ```

- [ ] **Step 4: Add module-level helper and component-level state/ref for CSV**

  After the closing brace of `FretboardTrainerProps` (before the `export function`), add the helper:
  ```typescript
  function liveColor(semi: number, taps: number): string {
    if (semi <= 1.5 && taps <= 1.5) return '#27ae60';
    if (semi <= 3.0 && taps <= 2.5) return '#f1c40f';
    return '#c0392b';
  }
  ```

  Inside the component body, after the existing `mouseDownFiredRef` declaration (line 39), add:
  ```typescript
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  ```

- [ ] **Step 5: Add `handleExportCsv` and `handleImportCsv` callbacks inside the component**

  Add these two functions anywhere in the component body before the `return`:
  ```typescript
  const handleExportCsv = useCallback(() => {
    const csv = exportToCsv(loadHuntHistory());
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guitar-hunt-stats.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseFromCsv(text);
    if (parsed.length === 0) {
      setImportMsg('Import failed — check file format.');
    } else {
      mergeHuntEntries(parsed);
      setImportMsg(`Imported ${parsed.length} rows`);
    }
    e.target.value = '';
    setTimeout(() => setImportMsg(null), 3000);
  }, []);
  ```

- [ ] **Step 6: Replace the `FretboardFocusSelector` block with the expanded hunt controls**

  Find this block in the JSX (currently `{isHuntMode && onFocusChange && (...)}`) and replace it:
  ```tsx
  {isHuntMode && (
    <div className="space-y-2">
      {onFocusChange && (
        <FretboardFocusSelector
          focus={focus}
          fretsNum={round.fretsNum}
          onChange={onFocusChange}
        />
      )}
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleExportCsv}
          className="px-3 py-1 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          className="px-3 py-1 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          Import CSV
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImportCsv}
        />
      </div>
      {importMsg && (
        <p className={`text-xs ${importMsg.startsWith('Import failed') ? 'text-red-500' : 'text-green-600'}`}>
          {importMsg}
        </p>
      )}
    </div>
  )}
  ```

- [ ] **Step 7: Add the live indicator after the isHuntMode confirm/feedback row**

  Find the existing hunt confirm row block:
  ```tsx
  {isHuntMode && (
    <div className="flex items-center justify-between min-h-[36px]">
      {roundFeedback ? (
        <p className="text-sm text-brand-ink font-medium">{roundFeedback}</p>
      ) : (
        <span />
      )}
      <button
        onClick={handleConfirm}
        disabled={!selectedPosition || isRevealing}
        className="px-5 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Confirm
      </button>
    </div>
  )}
  ```

  Directly after this block (before `{score.total > 0 && ...}`), add:
  ```tsx
  {isHuntMode && sessionAvgSemitones !== undefined && (
    <p
      className="text-xs text-center tabular-nums"
      style={{ color: liveColor(sessionAvgSemitones, sessionAvgTaps ?? 0) }}
    >
      Session avg: {sessionAvgSemitones.toFixed(1)} semi · {(sessionAvgTaps ?? 0).toFixed(1)} taps
    </p>
  )}
  ```

- [ ] **Step 8: Run lint**

  ```bash
  npm run lint
  ```
  Expected: 0 errors.

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/FretboardTrainer.tsx
  git commit -m "feat: add live session indicator and CSV export/import to FretboardTrainer"
  ```

---

### Task 3: Round recording + session tracking — `src/pages/EarTraining.tsx` (part A)

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `HuntHistoryEntry`, `appendHuntEntries` from `../lib/huntHistory`; `sessionAvgSemitones`, `sessionAvgTaps` props (defined in Task 2) on `FretboardTrainer`
- Produces: `huntSessionRounds` state; `sessionAvgSemitones`, `sessionAvgTaps` computed values passed to `FretboardTrainer`

- [ ] **Step 1: Add import for `huntHistory` module**

  In `EarTraining.tsx`, add to the import block (after the `planProgress` import on line 15):
  ```typescript
  import { HuntHistoryEntry, appendHuntEntries } from '../lib/huntHistory';
  ```

- [ ] **Step 2: Add `huntSessionRounds` state inside `EarTraining`**

  After the `showPlanComplete` state declaration (line 47), add:
  ```typescript
  const [huntSessionRounds, setHuntSessionRounds] = useState<Array<{ firstTapSemitones: number; tapCount: number }>>([]);
  ```

- [ ] **Step 3: Record entries and accumulate session in `handleFretboardComplete`**

  Find `handleFretboardComplete` (line 208). Inside it, immediately after the `setBiasTally` block (lines 226–230), add the recording and accumulation logic:

  ```typescript
  if (huntResult && wasCorrect) {
    const fr = round as FretboardRound;
    const match = fr.targetNote.match(/^([A-G]#?)(\d)$/);
    if (match) {
      const entry: HuntHistoryEntry = {
        date: new Date().toISOString().slice(0, 10),
        note: match[1],
        octave: parseInt(match[2], 10),
        firstTapSemitones: huntResult.firstSelectionSemitones,
        tapCount: huntResult.selectionCount,
        fretMin: fretboardFocus.fretMin ?? 0,
        fretMax: fretboardFocus.fretMax ?? FRETS_FOR[difficulty],
      };
      appendHuntEntries([entry]);
    }
    setHuntSessionRounds(prev => [
      ...prev,
      { firstTapSemitones: huntResult.firstSelectionSemitones, tapCount: huntResult.selectionCount },
    ]);
  }
  ```

  The final `handleFretboardComplete` should look like:
  ```typescript
  function handleFretboardComplete(wasCorrect: boolean, huntResult?: HuntResult) {
    const typeKey = (round as FretboardRound).targetNote;
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(prev => ({
      correct: prev.correct + (wasCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: wasCorrect ? prev.streak + 1 : 0,
      byType: {
        ...prev.byType,
        [typeKey]: {
          correct: (prev.byType[typeKey]?.correct ?? 0) + (wasCorrect ? 1 : 0),
          total: (prev.byType[typeKey]?.total ?? 0) + 1,
        },
      },
      totalStars: huntResult ? (prev.totalStars ?? 0) + huntResult.stars : prev.totalStars,
      huntAttempts: huntResult ? [...(prev.huntAttempts ?? []), huntResult.attempts] : prev.huntAttempts,
    }));
    if (huntResult) {
      setBiasTally(prev => ({
        ...prev,
        [huntResult.direction]: prev[huntResult.direction] + 1,
      }));
    }
    if (huntResult && wasCorrect) {
      const fr = round as FretboardRound;
      const match = fr.targetNote.match(/^([A-G]#?)(\d)$/);
      if (match) {
        const entry: HuntHistoryEntry = {
          date: new Date().toISOString().slice(0, 10),
          note: match[1],
          octave: parseInt(match[2], 10),
          firstTapSemitones: huntResult.firstSelectionSemitones,
          tapCount: huntResult.selectionCount,
          fretMin: fretboardFocus.fretMin ?? 0,
          fretMax: fretboardFocus.fretMax ?? FRETS_FOR[difficulty],
        };
        appendHuntEntries([entry]);
      }
      setHuntSessionRounds(prev => [
        ...prev,
        { firstTapSemitones: huntResult.firstSelectionSemitones, tapCount: huntResult.selectionCount },
      ]);
    }
    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
      return;
    }
    advanceRound();
  }
  ```

- [ ] **Step 4: Reset `huntSessionRounds` in `handleStartOver`**

  Find `handleStartOver` (line 314). Add `setHuntSessionRounds([]);` inside it:
  ```typescript
  function handleStartOver() {
    deckRef.current = [];
    deckKeyRef.current = '';
    setScore(initialScore());
    setBiasTally({ sharp: 0, flat: 0, correct: 0 });
    setFretboardFocus({});
    setShowSummary(false);
    setHuntSessionRounds([]);
    advanceRound(settings, {});
  }
  ```

- [ ] **Step 5: Compute session averages and pass to both `FretboardTrainer` instances**

  After the `weakNotes` computation (lines 342–347), add:
  ```typescript
  const sessionAvgSemitones = huntSessionRounds.length >= 3
    ? huntSessionRounds.reduce((s, r) => s + r.firstTapSemitones, 0) / huntSessionRounds.length
    : undefined;
  const sessionAvgTaps = huntSessionRounds.length >= 3
    ? huntSessionRounds.reduce((s, r) => s + r.tapCount, 0) / huntSessionRounds.length
    : undefined;
  ```

  Then pass the new props to the **fretboard mode** `<FretboardTrainer>` (around line 771):
  ```tsx
  <FretboardTrainer
    round={round as FretboardRound}
    difficulty={difficulty}
    score={score}
    isHuntMode={fretboardSubMode === 'hunt'}
    singMode={fretboardSubMode === 'sing'}
    focus={fretboardFocus}
    onFocusChange={handleFocusChange}
    droneNote={droneNote}
    droneMode={droneMode}
    sessionAvgSemitones={fretboardSubMode === 'hunt' ? sessionAvgSemitones : undefined}
    sessionAvgTaps={fretboardSubMode === 'hunt' ? sessionAvgTaps : undefined}
    onComplete={handleFretboardComplete}
  />
  ```

  And to the **plan mode** `<FretboardTrainer>` (around line 691):
  ```tsx
  <FretboardTrainer
    round={round as FretboardRound}
    difficulty={difficulty}
    score={score}
    isHuntMode={fretboardSubMode === 'hunt'}
    singMode={fretboardSubMode === 'sing'}
    focus={fretboardFocus}
    onFocusChange={handleFocusChange}
    droneNote={droneNote}
    droneMode={droneMode}
    sessionAvgSemitones={fretboardSubMode === 'hunt' ? sessionAvgSemitones : undefined}
    sessionAvgTaps={fretboardSubMode === 'hunt' ? sessionAvgTaps : undefined}
    onComplete={handleFretboardComplete}
  />
  ```

- [ ] **Step 6: Run lint**

  ```bash
  npm run lint
  ```
  Expected: 0 errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/EarTraining.tsx
  git commit -m "feat: record hunt rounds to localStorage and wire session averages to FretboardTrainer"
  ```

---

### Task 4: Session summary panel — `src/pages/EarTraining.tsx` (part B)

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `loadHuntHistory`, `HuntHistoryEntry` from `../lib/huntHistory`; `buildFretboardNotePool` from `../lib/earTraining`; `ALL_NOTES` from `../data/guitarData`
- Produces: enhanced session summary modal with sparkline, note×octave heatmap, and readiness message — visible when `fretboardSubMode === 'hunt'`

- [ ] **Step 1: Add `ALL_NOTES` and `loadHuntHistory` to imports**

  Update the `guitarData` import line (line 1 of the file — actually check — it imports from earTraining not guitarData). Add a new import line:
  ```typescript
  import { ALL_NOTES } from '../data/guitarData';
  ```

  Update the `huntHistory` import (added in Task 3) to also export `loadHuntHistory`:
  ```typescript
  import { HuntHistoryEntry, appendHuntEntries, loadHuntHistory } from '../lib/huntHistory';
  ```

- [ ] **Step 2: Add a pure helper function above the `EarTraining` component for cell colors**

  Add after the `makeRound` function (before `export function EarTraining()`):
  ```typescript
  function huntCellColor(avg: number): string {
    if (avg <= 1.5) return '#27ae60';
    if (avg <= 2.5) return '#2ecc71';
    if (avg <= 3.5) return '#e67e22';
    if (avg <= 5.0) return '#c0392b';
    return '#922b21';
  }
  ```

- [ ] **Step 3: Build the hunt summary data inside the session summary modal**

  The session summary modal starts around line 974 with `{showSummary && settings.mode !== 'study' && (`. Inside the modal's `<div>` (after the outer container `div`), find the `{settings.mode === 'fretboard' ? (` block and extend the hunt section.

  The current hunt section (around lines 1034–1049) shows stars and bias. Replace that block with an expanded version that includes the grid, sparkline, and readiness message. The new complete `{score.huntAttempts && ...}` block (replacing lines 1034–1049):

  ```tsx
  {fretboardSubMode === 'hunt' && score.huntAttempts && score.huntAttempts.length > 0 && (() => {
    const huntHistory = loadHuntHistory();

    // Sparkline: last 8 calendar dates with ≥5 entries
    const byDate: Record<string, HuntHistoryEntry[]> = {};
    for (const e of huntHistory) {
      (byDate[e.date] ??= []).push(e);
    }
    const sparkDates = Object.entries(byDate)
      .filter(([, es]) => es.length >= 5)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8);
    const sparkPoints = sparkDates.map(([, es]) =>
      es.reduce((s, e) => s + e.firstTapSemitones, 0) / es.length,
    );

    // Grid: note×octave heatmap
    const OCTAVES = [2, 3, 4];
    const reachableSet = new Set(buildFretboardNotePool(difficulty, fretboardFocus));
    const cellData: Record<string, { sum: number; count: number }> = {};
    for (const e of huntHistory) {
      const key = `${e.note}${e.octave}`;
      if (!cellData[key]) cellData[key] = { sum: 0, count: 0 };
      cellData[key].sum += e.firstTapSemitones;
      cellData[key].count += 1;
    }

    // Readiness
    const fMin = fretboardFocus.fretMin ?? 0;
    const fMax = fretboardFocus.fretMax ?? FRETS_FOR[difficulty];
    const rangeEntries = huntHistory.filter(e => e.fretMin === fMin && e.fretMax === fMax);
    const rangeByDate: Record<string, HuntHistoryEntry[]> = {};
    for (const e of rangeEntries) {
      (rangeByDate[e.date] ??= []).push(e);
    }
    const last3 = Object.entries(rangeByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3);
    const qualDates = last3.filter(([, es]) => es.length >= 15);
    const allQual = qualDates.flatMap(([, es]) => es);
    const crit1 = qualDates.length === 3;
    const crit2 = allQual.length > 0 && allQual.reduce((s, e) => s + e.firstTapSemitones, 0) / allQual.length <= 2.0;
    const crit3 = allQual.length > 0 && allQual.reduce((s, e) => s + e.tapCount, 0) / allQual.length <= 1.5;
    const critCount = [crit1, crit2, crit3].filter(Boolean).length;
    const readinessMsg =
      critCount === 3
        ? { text: "You've nailed this range. Try adding more frets to your focus.", cls: 'text-green-600' }
        : critCount >= 2
          ? { text: "Solid progress. Keep at it — 3 consistent sessions and you're ready to expand.", cls: 'text-yellow-600' }
          : { text: "Keep hunting. Focus on the red cells — those notes need more reps.", cls: 'text-brand-secondary' };

    return (
      <div className="pt-2 border-t border-brand-line space-y-3">
        {/* Stars + bias summary */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-ink">Hunt Mode</p>
          <p className="text-xs text-brand-secondary">
            Avg stars: {((score.totalStars ?? 0) / score.huntAttempts.length).toFixed(1)} / 3
            &nbsp;·&nbsp;
            Avg attempts: {(score.huntAttempts.reduce((a, b) => a + b, 0) / score.huntAttempts.length).toFixed(1)}
          </p>
          {biasTally.sharp > biasTally.flat + 2 && (
            <p className="text-xs text-brand-secondary">Tendency: guessing sharp ↑</p>
          )}
          {biasTally.flat > biasTally.sharp + 2 && (
            <p className="text-xs text-brand-secondary">Tendency: guessing flat ↓</p>
          )}
        </div>

        {/* Sparkline */}
        {sparkPoints.length >= 2 && (() => {
          const W = 300, H = 48, PAD = 6;
          const plotW = W - 2 * PAD;
          const plotH = H - 2 * PAD;
          const maxY = 6;
          const pts = sparkPoints.map((v, i) => {
            const x = PAD + (i / (sparkPoints.length - 1)) * plotW;
            const y = PAD + (1 - Math.min(v, maxY) / maxY) * plotH;
            return { x, y };
          });
          const lineColor = (() => {
            const last = sparkPoints[sparkPoints.length - 1];
            if (last <= 1.5) return '#27ae60';
            if (last <= 3.0) return '#f1c40f';
            return '#c0392b';
          })();
          return (
            <div>
              <p className="text-xs text-brand-secondary mb-1">Trend (last {sparkPoints.length} sessions)</p>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
                <polyline
                  points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="2"
                />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} />
                ))}
              </svg>
            </div>
          );
        })()}

        {/* Note×octave grid */}
        <div>
          <p className="text-xs text-brand-secondary mb-1">Note accuracy (avg semitones off — all history)</p>
          <div className="overflow-x-auto">
            <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(3, 1fr)', gap: '2px', minWidth: '200px' }}>
              <div />
              {[2, 3, 4].map(o => (
                <div key={o} className="text-center text-xs text-brand-secondary py-1">Oct {o}</div>
              ))}
              {ALL_NOTES.map(note => (
                <React.Fragment key={note}>
                  <div className="text-right text-xs text-brand-secondary pr-1 flex items-center justify-end" style={{ fontSize: '10px' }}>
                    {note}
                  </div>
                  {OCTAVES.map(oct => {
                    const key = `${note}${oct}`;
                    const isReachable = reachableSet.has(key);
                    const data = cellData[key];
                    if (!isReachable) {
                      return (
                        <div
                          key={oct}
                          style={{ height: '22px', borderRadius: '3px', background: '#1e1e2e', border: '1px solid #2a2a3e' }}
                        />
                      );
                    }
                    if (!data) {
                      return (
                        <div
                          key={oct}
                          style={{ height: '22px', borderRadius: '3px', background: '#252535', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span style={{ fontSize: '9px', color: '#555' }}>—</span>
                        </div>
                      );
                    }
                    const avg = data.sum / data.count;
                    return (
                      <div
                        key={oct}
                        style={{
                          height: '22px', borderRadius: '3px',
                          background: huntCellColor(avg),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '600', color: 'rgba(0,0,0,0.8)',
                        }}
                      >
                        {avg.toFixed(1)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Readiness message */}
        <p className={`text-xs font-medium ${readinessMsg.cls}`}>{readinessMsg.text}</p>
      </div>
    );
  })()}
  ```

  Note: the `OCTAVES` constant used inside the grid map is `[2, 3, 4]` — it's declared inline above so add `const OCTAVES = [2, 3, 4];` inside the IIFE above the `return` (it's already there in the readiness block, but the grid map also references it — they share the same scope inside the IIFE, so the single declaration at the top serves both).

- [ ] **Step 4: Run lint**

  ```bash
  npm run lint
  ```
  Expected: 0 errors. If there are type errors about `React.Fragment`, ensure `import React` is at the top (it already is).

- [ ] **Step 5: Manual verification**

  Start the dev server (`npm run dev`), navigate to Ear Training → Fretboard → Hunt mode. Play 5+ rounds, then click "End Session". Verify:
  1. The summary modal shows a "Hunt Mode" section with stars + bias (unchanged from before)
  2. A sparkline appears (will be hidden until there are 2+ dates with ≥5 entries — play across 2 days or seed the data via Import CSV to verify)
  3. The note×octave grid appears with green/orange/red colored cells for notes you played, `—` for reachable but unplayed notes, and dark cells for notes outside fret range
  4. A readiness message appears at the bottom
  5. The live indicator ("Session avg: X semi · Y taps") appears below the Confirm button after 3+ rounds
  6. "Export CSV" button downloads a valid CSV file
  7. "Import CSV" button accepts the downloaded file and shows "Imported N rows"

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/EarTraining.tsx
  git commit -m "feat: add hunt session summary panel with heatmap grid, sparkline, and readiness message"
  ```
