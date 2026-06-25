# Chord & Interval Recognition Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every Chord Recognition and Interval Recognition round to localStorage and surface cross-session accuracy trends, weakest types, and sparklines in the session summary and Settings panel.

**Architecture:** Two new sibling modules (`chordHistory.ts`, `intervalHistory.ts`) mirror the existing `huntHistory.ts` pattern — each owns its own localStorage key, entry shape, and CSV export/import. `EarTraining.tsx` timestamps each round start, records an entry on every answered question, and renders the cross-session panel in the summary modal and a weakest-types hint in Settings.

**Tech Stack:** TypeScript, React 19, localStorage, inline SVG sparklines (no new dependencies).

## Global Constraints

- No new npm dependencies — all UI built with inline SVG and Tailwind classes already in use.
- `npm run lint` (`tsc --noEmit`) must pass after every task — this is the only static check.
- localStorage keys: `chord_history` for chords, `interval_history` for intervals.
- CSV headers (exact): `date,type_label,root_note,correct,response_time_ms` (chord); `date,label,root_note,correct,response_time_ms` (interval).
- No changes to `SessionScore`, `ChordRound`, `IntervalRound`, `HuntHistoryEntry`, or Hunt mode behavior.
- All new code follows the patterns in `src/lib/huntHistory.ts` and `src/pages/EarTraining.tsx`.

---

### Task 1: Create chordHistory.ts and intervalHistory.ts

**Files:**
- Create: `src/lib/chordHistory.ts`
- Create: `src/lib/intervalHistory.ts`

**Interfaces:**
- Produces:
  - `ChordHistoryEntry { date: string; typeLabel: string; rootNote: string; correct: boolean; responseTimeMs: number }`
  - `appendChordEntries(entries: ChordHistoryEntry[]): void`
  - `loadChordHistory(): ChordHistoryEntry[]`
  - `mergeChordEntries(incoming: ChordHistoryEntry[]): void`
  - `exportChordToCsv(entries: ChordHistoryEntry[]): string`
  - `parseChordFromCsv(csv: string): ChordHistoryEntry[]`
  - `IntervalHistoryEntry { date: string; label: string; rootNote: string; correct: boolean; responseTimeMs: number }`
  - `appendIntervalEntries(entries: IntervalHistoryEntry[]): void`
  - `loadIntervalHistory(): IntervalHistoryEntry[]`
  - `mergeIntervalEntries(incoming: IntervalHistoryEntry[]): void`
  - `exportIntervalToCsv(entries: IntervalHistoryEntry[]): string`
  - `parseIntervalFromCsv(csv: string): IntervalHistoryEntry[]`

- [ ] **Step 1: Create `src/lib/chordHistory.ts`**

```typescript
const STORAGE_KEY = 'chord_history';

export interface ChordHistoryEntry {
  date: string;
  typeLabel: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
}

export function loadChordHistory(): ChordHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChordHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveChordHistory(entries: ChordHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendChordEntries(entries: ChordHistoryEntry[]): void {
  saveChordHistory([...loadChordHistory(), ...entries]);
}

export function mergeChordEntries(incoming: ChordHistoryEntry[]): void {
  const existing = loadChordHistory();
  const rowKey = (e: ChordHistoryEntry) =>
    `${e.date}|${e.typeLabel}|${e.rootNote}|${e.correct}|${e.responseTimeMs}`;
  const existingKeys = new Set(existing.map(rowKey));
  const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
  saveChordHistory([...existing, ...newEntries]);
}

export function exportChordToCsv(entries: ChordHistoryEntry[]): string {
  const header = 'date,type_label,root_note,correct,response_time_ms';
  const rows = entries.map(e =>
    `${e.date},${e.typeLabel},${e.rootNote},${e.correct},${e.responseTimeMs}`,
  );
  return [header, ...rows].join('\n');
}

export function parseChordFromCsv(csv: string): ChordHistoryEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  if (header !== 'date,type_label,root_note,correct,response_time_ms') return [];
  const entries: ChordHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;
    const [date, typeLabel, rootNote, correctStr, rtStr] = parts;
    const responseTimeMs = parseInt(rtStr, 10);
    if (!date || !typeLabel || !rootNote || isNaN(responseTimeMs)) continue;
    entries.push({ date, typeLabel, rootNote, correct: correctStr === 'true', responseTimeMs });
  }
  return entries;
}
```

- [ ] **Step 2: Create `src/lib/intervalHistory.ts`**

```typescript
const STORAGE_KEY = 'interval_history';

export interface IntervalHistoryEntry {
  date: string;
  label: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
}

export function loadIntervalHistory(): IntervalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntervalHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveIntervalHistory(entries: IntervalHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendIntervalEntries(entries: IntervalHistoryEntry[]): void {
  saveIntervalHistory([...loadIntervalHistory(), ...entries]);
}

export function mergeIntervalEntries(incoming: IntervalHistoryEntry[]): void {
  const existing = loadIntervalHistory();
  const rowKey = (e: IntervalHistoryEntry) =>
    `${e.date}|${e.label}|${e.rootNote}|${e.correct}|${e.responseTimeMs}`;
  const existingKeys = new Set(existing.map(rowKey));
  const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
  saveIntervalHistory([...existing, ...newEntries]);
}

export function exportIntervalToCsv(entries: IntervalHistoryEntry[]): string {
  const header = 'date,label,root_note,correct,response_time_ms';
  const rows = entries.map(e =>
    `${e.date},${e.label},${e.rootNote},${e.correct},${e.responseTimeMs}`,
  );
  return [header, ...rows].join('\n');
}

export function parseIntervalFromCsv(csv: string): IntervalHistoryEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  if (header !== 'date,label,root_note,correct,response_time_ms') return [];
  const entries: IntervalHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;
    const [date, label, rootNote, correctStr, rtStr] = parts;
    const responseTimeMs = parseInt(rtStr, 10);
    if (!date || !label || !rootNote || isNaN(responseTimeMs)) continue;
    entries.push({ date, label, rootNote, correct: correctStr === 'true', responseTimeMs });
  }
  return entries;
}
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/chordHistory.ts src/lib/intervalHistory.ts
git commit -m "feat: add chord and interval history persistence modules"
```

---

### Task 2: Record entries in EarTraining.tsx

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `ChordHistoryEntry`, `appendChordEntries`, `loadChordHistory`, `mergeChordEntries`, `exportChordToCsv`, `parseChordFromCsv` from `../lib/chordHistory`; same set for intervals from `../lib/intervalHistory`
- Consumes existing: `ChordRound`, `IntervalRound` (already imported); `advanceRound` function (line 122); `handleSelect` function (line 318)

- [ ] **Step 1: Add imports at the top of `src/pages/EarTraining.tsx`**

After the existing import on line 16:
```typescript
import { HuntHistoryEntry, appendHuntEntries, loadHuntHistory } from '../lib/huntHistory';
```

Add:
```typescript
import {
  ChordHistoryEntry,
  appendChordEntries,
  loadChordHistory,
  mergeChordEntries,
  exportChordToCsv,
  parseChordFromCsv,
} from '../lib/chordHistory';
import {
  IntervalHistoryEntry,
  appendIntervalEntries,
  loadIntervalHistory,
  mergeIntervalEntries,
  exportIntervalToCsv,
  parseIntervalFromCsv,
} from '../lib/intervalHistory';
```

- [ ] **Step 2: Add `roundStartTimeRef` inside the `EarTraining` component**

After the existing `useRef` hooks (find the last `useRef` call near the top of the component body — around line 53), add:

```typescript
const roundStartTimeRef = useRef<number>(Date.now());
```

- [ ] **Step 3: Set `roundStartTimeRef` when a new round starts**

In `advanceRound` (line 122), after `setRound(r)` on line 136, add:

```typescript
roundStartTimeRef.current = Date.now();
```

The function should look like:
```typescript
function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus) {
  const activeFocus = focusOverride ?? fretboardFocus;
  const effectiveMode = s.mode === 'plan'
    ? PLAN_STAGES[planProgress.stageIndex].mode
    : s.mode;
  let r: Round;
  if (effectiveMode === 'fretboard') {
    const note = nextFretboardNote(difficulty, activeFocus);
    r = makeFretboardRound(note, FRETS_FOR[difficulty]);
  } else {
    r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
  }
  setSelected(null);
  setTentative(null);
  setRound(r);
  roundStartTimeRef.current = Date.now();
}
```

- [ ] **Step 4: Record entry in `handleSelect`**

In `handleSelect` (line 318), after the `setScore(prev => ...)` call (which ends around line 344), add the history recording block. Insert it before the `if (settings.mode === 'plan' && ...)` check at line 346:

```typescript
// Record to persistent history
const responseTimeMs = Date.now() - roundStartTimeRef.current;
if (round.kind === 'chord') {
  const cr = round as ChordRound;
  appendChordEntries([{
    date: new Date().toISOString().slice(0, 10),
    typeLabel: cr.correct.typeLabel,
    rootNote: cr.correct.root,
    correct: isCorrect,
    responseTimeMs,
  }]);
} else if (round.kind === 'interval') {
  const ir = round as IntervalRound;
  appendIntervalEntries([{
    date: new Date().toISOString().slice(0, 10),
    label: ir.correct.label,
    rootNote: ir.correct.rootNote,
    correct: isCorrect,
    responseTimeMs,
  }]);
}
```

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Smoke-test in dev server**

```bash
npm run dev
```

Open the app, switch to Chord Recognition, play 3 rounds. Open browser DevTools → Application → Local Storage → look for `chord_history` key. Should contain a JSON array with 3 entries, each with `date`, `typeLabel`, `rootNote`, `correct`, `responseTimeMs` fields. Repeat for Interval Recognition and verify `interval_history` key.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: record chord/interval rounds to localStorage with response time"
```

---

### Task 3: Session summary stats panel

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `loadChordHistory`, `loadIntervalHistory`, `ChordHistoryEntry`, `IntervalHistoryEntry` (imported in Task 2); `score.byType` (existing state); `settings.mode` (existing state)

Context: The session summary modal starts at line 1035. The block to replace is:

```tsx
{settings.mode === 'fretboard' ? (
  weakNotes.length > 0 && (
    <table>...</table>   {/* lines 1054-1071 */}
  )
) : (
  Object.keys(score.byType).length > 0 && (
    <table>...</table>   {/* lines 1075-1093 — THIS is what gets replaced */}
  )
)}
```

Replace only the `: (Object.keys(score.byType)...` else-branch. The fretboard branch is unchanged.

- [ ] **Step 1: Replace the else-branch of the fretboard ternary in the summary modal**

Find the block starting at approximately line 1073:
```tsx
            ) : (
              Object.keys(score.byType).length > 0 && (
                <table className="w-full text-sm border-collapse">
```
and ending at approximately line 1094:
```tsx
              )
            )}
```

Replace that entire else-branch (from `) : (` through the closing `)}`) with:

```tsx
            ) : (
              Object.keys(score.byType).length > 0 && (() => {
                // Normalize to common shape for easier processing
                const typeEntries: Array<{ date: string; type: string; correct: boolean; responseTimeMs: number }> =
                  settings.mode === 'chord'
                    ? loadChordHistory().map(e => ({ date: e.date, type: e.typeLabel, correct: e.correct, responseTimeMs: e.responseTimeMs }))
                    : loadIntervalHistory().map(e => ({ date: e.date, type: e.label, correct: e.correct, responseTimeMs: e.responseTimeMs }));

                // All-time stats per type
                const allTime: Record<string, { correct: number; total: number; totalRtMs: number }> = {};
                for (const e of typeEntries) {
                  if (!allTime[e.type]) allTime[e.type] = { correct: 0, total: 0, totalRtMs: 0 };
                  if (e.correct) allTime[e.type].correct++;
                  allTime[e.type].total++;
                  allTime[e.type].totalRtMs += e.responseTimeMs;
                }

                // Rows: types from this session, sorted weakest first
                const rows = Object.keys(score.byType)
                  .map(type => {
                    const d = allTime[type] ?? { correct: 0, total: 0, totalRtMs: 0 };
                    return {
                      type,
                      acc: d.total > 0 ? d.correct / d.total : 0,
                      avgRtS: d.total > 0 ? d.totalRtMs / d.total / 1000 : 0,
                      hasData: d.total > 0,
                    };
                  })
                  .sort((a, b) => a.acc - b.acc);

                // Sparkline: overall accuracy per calendar date, last 8 dates with ≥3 entries
                const byDate: Record<string, { correct: number; total: number }> = {};
                for (const e of typeEntries) {
                  if (!byDate[e.date]) byDate[e.date] = { correct: 0, total: 0 };
                  if (e.correct) byDate[e.date].correct++;
                  byDate[e.date].total++;
                }
                const sparkDates = Object.entries(byDate)
                  .filter(([, d]) => d.total >= 3)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-8);
                const sparkPoints = sparkDates.map(([, d]) => (d.correct / d.total) * 100);

                // Weakest types: ≥5 attempts, bottom 3 by accuracy
                const weakest = Object.entries(allTime)
                  .filter(([, d]) => d.total >= 5)
                  .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
                  .slice(0, 3)
                  .map(([type, d]) => `${type} (${Math.round((d.correct / d.total) * 100)}%)`);

                const accColor = (acc: number) =>
                  acc >= 0.8 ? '#27ae60' : acc >= 0.6 ? '#f1c40f' : '#c0392b';

                return (
                  <div className="space-y-3">
                    {/* Per-type accuracy table */}
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-brand-line text-left">
                          <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                          <th className="pb-1.5 font-medium text-brand-secondary text-right">All-time</th>
                          <th className="pb-1.5 font-medium text-brand-secondary text-right">Avg time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ type, acc, avgRtS, hasData }) => (
                          <tr key={type} className="border-b border-brand-line/40">
                            <td className="py-1.5 text-brand-ink">{type}</td>
                            <td
                              className="py-1.5 text-right font-medium"
                              style={{ color: hasData ? accColor(acc) : undefined }}
                            >
                              {hasData ? `${Math.round(acc * 100)}%` : '—'}
                            </td>
                            <td className="py-1.5 text-right text-brand-secondary">
                              {hasData ? `${avgRtS.toFixed(1)}s` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Sparkline */}
                    {sparkPoints.length >= 2 && (() => {
                      const W = 300, H = 48, PAD = 6;
                      const plotW = W - 2 * PAD;
                      const plotH = H - 2 * PAD;
                      const pts = sparkPoints.map((v, i) => ({
                        x: PAD + (i / (sparkPoints.length - 1)) * plotW,
                        y: PAD + (1 - v / 100) * plotH,
                      }));
                      const last = sparkPoints[sparkPoints.length - 1];
                      const lineColor = last >= 80 ? '#27ae60' : last >= 60 ? '#f1c40f' : '#c0392b';
                      return (
                        <div>
                          <p className="text-xs text-brand-secondary mb-1">
                            Accuracy trend (last {sparkPoints.length} sessions)
                          </p>
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

                    {/* Weakest types */}
                    {weakest.length >= 3 && (
                      <p className="text-xs text-brand-secondary">
                        Focus on: {weakest.join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })()
            )}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Smoke-test in dev server**

```bash
npm run dev
```

Play 5+ Chord Recognition rounds, let the session complete (20 rounds or click Start Over to trigger the summary). Verify:
- Summary modal shows a table with "Type", "All-time", "Avg time" columns
- Accuracy values are colored green/yellow/red
- After 2+ calendar-date sessions, the sparkline appears
- After 3+ types hit ≥5 attempts, "Focus on:" line appears

- [ ] **Step 4: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add cross-session accuracy panel to chord/interval session summary"
```

---

### Task 4: Settings panel — weakest types hint and Export/Import CSV

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: all history imports from Task 2; `settings.mode`; `settings.settingsPanelOpen`

- [ ] **Step 1: Add state and refs for import in the component body**

After the existing `importInputRef` and `importMsg` refs/state (around line 53-54 — the ones used by FretboardTrainer), add:

```typescript
const practiceImportRef = useRef<HTMLInputElement>(null);
const [practiceImportMsg, setPracticeImportMsg] = useState<string | null>(null);
```

- [ ] **Step 2: Add export and import handler functions**

After the `handleStartOver` function (around line 351), add:

```typescript
function handlePracticeExport() {
  const [csv, filename] = settings.mode === 'chord'
    ? [exportChordToCsv(loadChordHistory()), 'guitar-chord-stats.csv']
    : [exportIntervalToCsv(loadIntervalHistory()), 'guitar-interval-stats.csv'];
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function handlePracticeImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target?.result as string;
      if (settings.mode === 'chord') {
        const parsed = parseChordFromCsv(text);
        mergeChordEntries(parsed);
        setPracticeImportMsg(`Imported ${parsed.length} rows`);
      } else {
        const parsed = parseIntervalFromCsv(text);
        mergeIntervalEntries(parsed);
        setPracticeImportMsg(`Imported ${parsed.length} rows`);
      }
    } catch {
      setPracticeImportMsg('Import failed — check file format');
    }
    if (practiceImportRef.current) practiceImportRef.current.value = '';
  };
  reader.readAsText(file);
}
```

- [ ] **Step 3: Add the weakest hint + Export/Import JSX in the Settings panel**

In the Settings panel, find the line that closes the `{settings.mode === 'study' ? ... : ...}` ternary (around line 672 — it looks like `            )}`). Directly after that closing `)}`, before the `          </div>` that closes the `px-4 pb-4 space-y-4` panel content div, insert:

```tsx
            {/* Weakest types hint + Export/Import — chord/interval only */}
            {(settings.mode === 'chord' || settings.mode === 'interval') && (() => {
              const history: Array<{ correct: boolean; [k: string]: unknown }> =
                settings.mode === 'chord' ? loadChordHistory() : loadIntervalHistory();
              const stats: Record<string, { correct: number; total: number }> = {};
              for (const e of history) {
                const k = settings.mode === 'chord'
                  ? (e as ChordHistoryEntry).typeLabel
                  : (e as IntervalHistoryEntry).label;
                if (!stats[k]) stats[k] = { correct: 0, total: 0 };
                if (e.correct) stats[k].correct++;
                stats[k].total++;
              }
              const weakest = Object.entries(stats)
                .filter(([, d]) => d.total >= 5)
                .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
                .slice(0, 3)
                .map(([type, d]) => `${type} (${Math.round((d.correct / d.total) * 100)}%)`);
              return (
                <div className="space-y-2 pt-1">
                  {weakest.length >= 3 && (
                    <p className="text-xs text-brand-secondary">
                      Weakest: {weakest.join(' · ')}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={handlePracticeExport}
                      className="px-2.5 py-1 text-xs border border-brand-line text-brand-secondary rounded hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => practiceImportRef.current?.click()}
                      className="px-2.5 py-1 text-xs border border-brand-line text-brand-secondary rounded hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Import CSV
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={practiceImportRef}
                      className="hidden"
                      onChange={handlePracticeImport}
                    />
                    {practiceImportMsg && (
                      <p className={`text-xs ${practiceImportMsg.startsWith('Import failed') ? 'text-red-500' : 'text-green-600'}`}>
                        {practiceImportMsg}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
```

- [ ] **Step 4: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Smoke-test in dev server**

```bash
npm run dev
```

1. Switch to Chord Recognition. Open Settings panel. Verify Export CSV and Import CSV buttons appear.
2. Play enough rounds so 3+ chord types have ≥5 all-time attempts. Reopen Settings. Verify "Weakest: ..." hint appears.
3. Click Export CSV. Verify a `.csv` file downloads. Open it — confirm header is `date,type_label,root_note,correct,response_time_ms` and rows contain real data.
4. Delete `chord_history` from DevTools localStorage. Click Import CSV, select the file just downloaded. Verify "Imported N rows" message and `chord_history` repopulated in DevTools.
5. Switch to Interval Recognition. Verify Export/Import buttons swap to interval mode (different filename on export). Verify "Weakest: ..." hint is hidden until 3 intervals reach 5 attempts.

- [ ] **Step 6: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add weakest types hint and CSV export/import to Settings panel"
```

---

### Final step: push

```bash
git push
```
