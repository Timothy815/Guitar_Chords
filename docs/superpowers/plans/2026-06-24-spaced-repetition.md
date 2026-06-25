# Spaced Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weight the fretboard note deck so notes the user has missed appear more often in the next cycle, and display weak notes in the score bar and session summary modal.

**Architecture:** One file changes — `src/pages/EarTraining.tsx`. Task 1 modifies `nextFretboardNote` to build a weighted pool on deck rebuild. Task 2 adds a `weakNotes` derived const and surfaces it in the score bar and summary modal. No new state is introduced: wrong counts are derived from the existing `score.byType` record, which already stores `{ correct, total }` keyed by `targetNote` in fretboard mode.

**Tech Stack:** React 19, TypeScript, Tailwind v4.

## Global Constraints

- No new npm dependencies.
- `npm run lint` (runs `tsc --noEmit`) must pass with zero errors at the end of each task.
- No automated test suite — verification is lint + manual browser check.
- Tailwind v4 — no `tailwind.config.js`; use only brand token classes (`brand-primary`, `brand-line`, `brand-secondary`, `brand-surface`, `brand-ink`, `brand-bg`). Exception: `text-red-500` for wrong counts (consistent with existing `text-green-600` for correct counts in the modal).
- Wrong count per note: `total - correct` from `score.byType[note]`. Never go below 0.
- Copies formula: `Math.min(wrongCount + 1, 4)` — cap at 4.
- Note names displayed without octave: `note.replace(/\d$/, '')` — e.g. `"F#4"` → `"F#"`.
- Weak notes sorted: wrong count descending, then `localeCompare` alphabetically for ties.
- Only notes where `wrong > 0` are shown as weak.

---

### Task 1: Weighted deck rebuild in `nextFretboardNote`

**Files:**
- Modify: `src/pages/EarTraining.tsx` (lines 46–60, the `nextFretboardNote` function)

**Interfaces:**
- Consumes: `score.byType` (already in scope via closure — `Record<string, { correct: number; total: number }>`)
- Produces: nothing new — same return type `string`, same call sites unchanged

- [ ] **Step 1: Locate `nextFretboardNote`**

Open `src/pages/EarTraining.tsx`. Find `nextFretboardNote` (around line 46). The current function looks exactly like this:

```typescript
  function nextFretboardNote(diff: DifficultyLevel, focus: FretboardFocus): string {
    const key = `${diff}|${JSON.stringify(focus)}`;
    if (deckKeyRef.current !== key || deckRef.current.length === 0) {
      const pool = buildFretboardNotePool(diff, focus);
      // Fisher-Yates shuffle
      const a = [...pool];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      deckRef.current = a;
      deckKeyRef.current = key;
    }
    return deckRef.current.pop()!;
  }
```

- [ ] **Step 2: Replace the pool-building block**

Replace the entire `nextFretboardNote` function with the weighted version below. The only change is how array `a` is built: instead of one copy per note (`[...pool]`), each note gets `Math.min(wrongCount + 1, 4)` copies. The Fisher-Yates shuffle and everything else is identical.

```typescript
  function nextFretboardNote(diff: DifficultyLevel, focus: FretboardFocus): string {
    const key = `${diff}|${JSON.stringify(focus)}`;
    if (deckKeyRef.current !== key || deckRef.current.length === 0) {
      const pool = buildFretboardNotePool(diff, focus);
      const a: string[] = [];
      for (const note of pool) {
        const wrong = (score.byType[note]?.total ?? 0) - (score.byType[note]?.correct ?? 0);
        const copies = Math.min(wrong + 1, 4);
        for (let c = 0; c < copies; c++) a.push(note);
      }
      // Fisher-Yates shuffle
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      deckRef.current = a;
      deckKeyRef.current = key;
    }
    return deckRef.current.pop()!;
  }
```

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

1. Open Ear Training → Fretboard tab, Beginner difficulty.
2. Play several rounds. Deliberately click the wrong fret a few times for the same note.
3. After the current deck cycle completes (all unique notes seen once), verify the missed note appears noticeably more often in the next cycle. Exact frequency isn't verifiable by eye but a heavily-missed note should recur quickly.
4. Verify no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: weight fretboard deck by wrong-answer count"
```

---

### Task 2: Weak note display — score bar and summary modal

**Files:**
- Modify: `src/pages/EarTraining.tsx` (lines 263–265 for new const; lines 657–676 for score bar; lines 695–714 for modal table)

**Interfaces:**
- Consumes from Task 1: nothing new — `score.byType` and `settings.mode` are already in scope
- Produces: nothing exported — all changes are internal JSX

- [ ] **Step 1: Add `weakNotes` derived const**

Find the `accuracy` const (around line 263):

```typescript
  const accuracy = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 0;
```

Add `weakNotes` immediately after it:

```typescript
  const accuracy = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 0;

  const weakNotes = settings.mode === 'fretboard'
    ? Object.entries(score.byType)
        .map(([note, data]) => ({ note, wrong: data.total - data.correct, total: data.total }))
        .filter(e => e.wrong > 0)
        .sort((a, b) => b.wrong - a.wrong || a.note.localeCompare(b.note))
    : [];
```

`weakNotes` is used in both the score bar (top 3) and the modal (all). Computing it once here avoids duplication.

- [ ] **Step 2: Update the score bar**

Find the fixed score bar left-side div (around line 660). It currently looks like this:

```tsx
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-brand-ink">
              {score.correct}
              <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
            </span>
            {score.streak >= 2 && (
              <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
            )}
          </div>
```

Replace with (adds weak notes indicator after streak):

```tsx
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-brand-ink">
              {score.correct}
              <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
            </span>
            {score.streak >= 2 && (
              <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
            )}
            {weakNotes.length > 0 && (
              <span className="text-brand-secondary">
                Weak: <span className="text-brand-ink font-medium">
                  {weakNotes.slice(0, 3).map(e => e.note.replace(/\d$/, '')).join(' · ')}
                </span>
              </span>
            )}
          </div>
```

- [ ] **Step 3: Update the session summary modal table**

Find the existing `score.byType` table block in the modal (around line 695). It currently looks like this:

```tsx
            {Object.keys(score.byType).length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brand-line text-left">
                    <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                    <th className="pb-1.5 font-medium text-brand-secondary text-right">Correct</th>
                    <th className="pb-1.5 font-medium text-brand-secondary text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(score.byType).map(([type, data]: [string, { correct: number; total: number }]) => (
                    <tr key={type} className="border-b border-brand-line/40">
                      <td className="py-1.5 text-brand-ink">{type}</td>
                      <td className="py-1.5 text-right text-green-600 font-medium">{data.correct}</td>
                      <td className="py-1.5 text-right text-brand-secondary">{data.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
```

Replace with (fretboard mode shows weak notes table; all other modes show the existing byType table unchanged):

```tsx
            {settings.mode === 'fretboard' ? (
              weakNotes.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-line text-left">
                      <th className="pb-1.5 font-medium text-brand-secondary">Note</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Wrong</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Attempted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weakNotes.map(({ note, wrong, total }) => (
                      <tr key={note} className="border-b border-brand-line/40">
                        <td className="py-1.5 text-brand-ink">{note.replace(/\d$/, '')}</td>
                        <td className="py-1.5 text-right text-red-500 font-medium">{wrong}</td>
                        <td className="py-1.5 text-right text-brand-secondary">{total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              Object.keys(score.byType).length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-line text-left">
                      <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Correct</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(score.byType).map(([type, data]: [string, { correct: number; total: number }]) => (
                      <tr key={type} className="border-b border-brand-line/40">
                        <td className="py-1.5 text-brand-ink">{type}</td>
                        <td className="py-1.5 text-right text-green-600 font-medium">{data.correct}</td>
                        <td className="py-1.5 text-right text-brand-secondary">{data.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 5: Manual browser test**

```bash
npm run dev
```

1. Open Ear Training → Fretboard tab.
2. Deliberately click wrong frets for two or three different notes (e.g., miss F# twice, miss Bb once).
3. Verify the score bar shows `Weak: F# · Bb` (most wrong first, stripped of octave, at most 3).
4. Click **End Session**.
5. Verify the modal shows a "Note | Wrong | Attempted" table with F# and Bb (sorted by wrong count descending). Correct answers do not appear.
6. Switch to Chord or Interval mode. Click **End Session**. Verify the original "Type | Correct | Total" table appears (no regression).
7. Return to Fretboard, play only correct answers. Click **End Session**. Verify the weak notes section is absent (perfect session = clean modal).

- [ ] **Step 6: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: show weak notes in score bar and session summary for fretboard mode"
```
