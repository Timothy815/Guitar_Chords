# Sing-Then-Find Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sing" sub-mode to fretboard ear training that locks the fretboard behind a Ready button, forcing the user to audiate the note before they can guess.

**Architecture:** Two files change. `FretboardTrainer.tsx` gains a `singMode` prop and a local `locked` state that resets on each new round; when locked it renders a semi-transparent overlay with a Ready button and blocks fret interaction. `EarTraining.tsx` extends the `fretboardSubMode` type to `'guess' | 'hunt' | 'sing'`, adds the Sing button to the settings panel, and passes `singMode` to `FretboardTrainer`.

**Tech Stack:** React 19, TypeScript, Tailwind v4.

## Global Constraints

- No new npm dependencies.
- `npm run lint` (runs `tsc --noEmit`) must pass with zero errors at the end of each task.
- There is no automated test suite — verification is lint + manual browser check.
- Tailwind v4 — no `tailwind.config.js`; use only brand token classes (`brand-primary`, `brand-line`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-ink`, `brand-bg`).
- Grading in Sing mode is identical to Guess mode — octave-precise, wrong answers trigger comparative playback.
- Replay button remains visible and functional while the fretboard is locked.
- Difficulty buttons remain active (highlighted) for the current difficulty level when Sing mode is selected.

---

### Task 1: FretboardTrainer — singMode prop, locked state, and overlay

**Files:**
- Modify: `src/components/FretboardTrainer.tsx`

**Interfaces:**
- Produces (consumed by Task 2):
  ```typescript
  // New optional prop on FretboardTrainerProps:
  singMode?: boolean;
  ```

- [ ] **Step 1: Add `singMode` to the props interface**

Find `FretboardTrainerProps` (lines 11–21). Add `singMode?: boolean` after `droneMode`:

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
  onComplete: (wasCorrect: boolean, huntResult?: HuntResult) => void;
}
```

- [ ] **Step 2: Destructure `singMode` in the function signature**

Find the function signature (lines 23–28):

```typescript
export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  droneNote, droneMode,
  onComplete,
}: FretboardTrainerProps) {
```

Replace with:

```typescript
export function FretboardTrainer({
  round, score, isHuntMode,
  focus = {}, onFocusChange,
  droneNote, droneMode,
  singMode,
  onComplete,
}: FretboardTrainerProps) {
```

- [ ] **Step 3: Add `locked` state**

Find the state declarations block (around line 29, after the opening brace of the function). After the line `const [noteRevealed, setNoteRevealed] = useState(false);`, add:

```typescript
const [locked, setLocked] = useState(true);
```

- [ ] **Step 4: Reset `locked` on each new round**

Find the round-change `useEffect` (lines 45–71). Add `if (singMode) setLocked(true);` as the first line inside the effect body, right after the opening brace:

```typescript
useEffect(() => {
  if (singMode) setLocked(true);
  setCorrectPositions(new Set());
  setWrongPosition(null);
  // ... rest unchanged
```

Full updated effect:

```typescript
useEffect(() => {
  if (singMode) setLocked(true);
  setCorrectPositions(new Set());
  setWrongPosition(null);
  setIsRevealing(false);
  setNoteRevealed(false);
  setSelectedPosition(null);
  setSelectedNote(null);
  setAttemptCount(0);
  setSelectionCount(0);
  setFirstSelectionSemitones(null);
  setFirstSelectionDirection(null);
  setWrongConfirmFlash(false);
  setRoundFeedback(null);

  if (droneMode === 'cue' && droneNote) {
    initAudio()
      .then(() => {
        playNote(droneNote, '2n');
        setTimeout(() => playFretboardRound(round).catch(() => {}), 600);
      })
      .catch(() => {});
  } else {
    playFretboardRound(round).catch(() => {});
  }
  // droneMode and droneNote intentionally omitted from deps: effect must only
  // fire when a new round starts, not when the user adjusts drone settings mid-round.
}, [round]);
```

- [ ] **Step 5: Block fret clicks when locked**

Find `handleFretClick` (line 97). It currently starts with:

```typescript
  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
```

Add the locked guard immediately after the `isRevealing` check:

```typescript
  const handleFretClick = useCallback((stringIdx: number, fretIdx: number) => {
    if (isRevealing) return;
    if (singMode && locked) return;
```

Add `locked` and `singMode` to `handleFretClick`'s dependency array. The current deps are:
```typescript
  }, [isRevealing, isHuntMode, round, onComplete]);
```
Update to:
```typescript
  }, [isRevealing, isHuntMode, round, onComplete, singMode, locked]);
```

- [ ] **Step 6: Add `relative` to the outer container and render the locked overlay**

Find the `return` statement (line 197). The outer container currently is:

```typescript
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
```

Replace with (adds `relative` for overlay positioning):

```typescript
    <div className="relative rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
```

Then find the header row (the `<div className="flex items-center justify-between">` block that contains the "Find the note" text and the Replay button). After the closing `</div>` of that header row, add the Fretboard JSX line. Then after the Fretboard, add the overlay. The full updated JSX block from the outer `<div>` through the first `</div>` below the Fretboard:

```tsx
    <div className="relative rounded-lg border border-brand-line bg-brand-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-secondary">
          {isHuntMode ? 'Hunt the note' : singMode ? 'Sing the note' : 'Find the note'}
          {noteRevealed && (
            <span className="ml-1 text-brand-ink font-bold">→ {round.targetNote.replace(/\d$/, '')}</span>
          )}
        </p>
        <button
          onClick={() => playFretboardRound(round).catch(() => {})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Volume2 size={16} /> Replay
        </button>
      </div>

      {isHuntMode && onFocusChange && (
        <FretboardFocusSelector
          focus={focus}
          fretsNum={round.fretsNum}
          onChange={onFocusChange}
        />
      )}

      <Fretboard
        fretsNum={round.fretsNum}
        onFretClick={handleFretClick}
        onFretMouseDown={isHuntMode ? handleFretMouseDown : undefined}
        showNoteNames={false}
        correctPositions={correctPositions}
        wrongPosition={isHuntMode && wrongConfirmFlash ? selectedPosition : wrongPosition}
        previewPosition={isHuntMode && !wrongConfirmFlash ? selectedPosition : null}
        focusZone={isHuntMode ? focus : undefined}
        compact
      />

      {singMode && locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-bg/80 rounded-lg z-10">
          <p className="text-sm text-brand-secondary text-center px-4">
            Sing or hum the note, then tap Ready
          </p>
          <button
            onClick={() => setLocked(false)}
            className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            Ready
          </button>
        </div>
      )}
```

- [ ] **Step 7: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 8: Manual smoke test**

```bash
npm run dev
```

No UI change visible yet (Task 2 wires the prop). Verify lint is clean. The `singMode` prop defaults to `undefined` (falsy), so existing Guess and Hunt behaviour is identical to before.

- [ ] **Step 9: Commit**

```bash
git add src/components/FretboardTrainer.tsx
git commit -m "feat: add singMode prop and locked overlay to FretboardTrainer"
```

---

### Task 2: EarTraining — Sing button and singMode prop wiring

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1:
  ```typescript
  // FretboardTrainer now accepts:
  singMode?: boolean;
  ```

- [ ] **Step 1: Extend the `fretboardSubMode` type**

Find line 28:

```typescript
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt'>('guess');
```

Replace with:

```typescript
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt' | 'sing'>('guess');
```

- [ ] **Step 2: Add Sing button to the settings panel**

Find the Hunt button block (lines 347–359):

```tsx
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => handleFretboardDifficulty('Hunt')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'hunt'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Hunt
                  </button>
                )}
```

Replace with (adds Sing button immediately after Hunt):

```tsx
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => handleFretboardDifficulty('Hunt')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'hunt'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Hunt
                  </button>
                )}
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => { setFretboardSubMode('sing'); advanceRound(); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'sing'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Sing
                  </button>
                )}
```

- [ ] **Step 3: Update difficulty button active condition to include Sing**

Find the active-state condition for difficulty buttons (line 339):

```typescript
                      settings.mode === 'fretboard' && fretboardSubMode === 'guess' && difficulty === level
```

Replace with:

```typescript
                      settings.mode === 'fretboard' && (fretboardSubMode === 'guess' || fretboardSubMode === 'sing') && difficulty === level
```

- [ ] **Step 4: Pass `singMode` prop to `FretboardTrainer`**

Find the `<FretboardTrainer ... />` JSX (lines 514–524):

```tsx
        <FretboardTrainer
          round={round as FretboardRound}
          difficulty={difficulty}
          score={score}
          isHuntMode={fretboardSubMode === 'hunt'}
          focus={fretboardFocus}
          onFocusChange={handleFocusChange}
          droneNote={droneNote}
          droneMode={droneMode}
          onComplete={handleFretboardComplete}
        />
```

Replace with:

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
          onComplete={handleFretboardComplete}
        />
```

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: no errors (exit 0).

- [ ] **Step 6: Manual browser test — Sing mode**

```bash
npm run dev
```

1. Open `http://localhost:3000/Guitar_Chords`
2. Go to **Ear Training** → **Fretboard** tab
3. Open Settings — confirm **Sing** button appears next to Hunt
4. Click **Sing** — a new round starts, fretboard is covered by the overlay "Sing or hum the note, then tap Ready"
5. Click **Replay** — the note plays (overlay stays up); confirm Replay works while locked
6. Click **Ready** — overlay disappears, fretboard is fully interactive
7. Click a wrong fret — comparative playback fires (guess note then correct note), same as Guess mode
8. Click a correct fret — round advances normally
9. Confirm next round starts locked again automatically
10. Switch back to **Guess** mode — confirm no overlay, behaviour identical to before
11. Switch to **Hunt** mode — confirm no overlay, Hunt behaviour identical to before

- [ ] **Step 7: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add Sing sub-mode to fretboard ear training"
```
