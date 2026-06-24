# Playable Answer Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users tap each answer card to hear its sound before committing, replacing the current single-tap-to-answer model with a two-phase audition → confirm cycle.

**Architecture:** Add `playOptionAudio(round, index)` to the existing `earTraining.ts` logic module, then wire a `tentative` state variable and a Confirm button into `EarTraining.tsx`. No new files or components needed.

**Tech Stack:** React 19, TypeScript, Tone.js (via existing `src/lib/audio.ts` exports), Tailwind CSS v4.

## Global Constraints

- No test framework — verification is `npm run lint` (tsc --noEmit) + manual browser check
- `initAudio()` must be awaited before every audio call (browser autoplay policy)
- Tailwind v4 — no config file; use brand CSS variable tokens (`brand-primary`, `brand-line`, `brand-ink`, `brand-secondary`, `brand-sidebar`)
- `@` alias resolves to project root — use relative imports inside `src/` (e.g. `../lib/audio`)
- Do not change `handleSelect` — it remains the scoring function, called by `handleConfirm`

---

### Task 1: Add `playOptionAudio` to `src/lib/earTraining.ts`

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Consumes: `initAudio`, `playStrum`, `playNote` from `./audio`; `Round`, `ChordRound`, `IntervalRound`, `chordToNotes` — all already defined in this file
- Produces: `export async function playOptionAudio(round: Round, index: number): Promise<void>` — consumed by Task 2

- [ ] **Step 1: Update the audio import**

Open `src/lib/earTraining.ts`. The current import from `./audio` is:

```typescript
import { getFretNote } from './audio';
```

Replace it with:

```typescript
import { getFretNote, initAudio, playStrum, playNote } from './audio';
```

- [ ] **Step 2: Add `playOptionAudio` at the end of the file**

Append this function after `initialScore`:

```typescript
export async function playOptionAudio(round: Round, index: number): Promise<void> {
  await initAudio();
  if (round.kind === 'chord') {
    const cr = round as ChordRound;
    playStrum(chordToNotes(cr.options[index].chord), '2n');
  } else {
    const ir = round as IntervalRound;
    const opt = ir.options[index];
    playNote(opt.rootNote, '2n');
    setTimeout(() => playNote(opt.topNote, '2n'), 400);
  }
}
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add playOptionAudio helper to earTraining module"
```

---

### Task 2: Wire tentative state and Confirm button in `src/pages/EarTraining.tsx`

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes: `playOptionAudio(round: Round, index: number): Promise<void>` from `../lib/earTraining` (Task 1)

- [ ] **Step 1: Add `playOptionAudio` to the import**

Find the existing import block at the top of `EarTraining.tsx`:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, chordToNotes,
} from '../lib/earTraining';
```

Replace it with:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, chordToNotes, playOptionAudio,
} from '../lib/earTraining';
```

- [ ] **Step 2: Add the `tentative` state variable**

Find the existing state declarations near the top of `EarTraining()`:

```typescript
const [selected, setSelected] = useState<number | null>(null);
```

Add the new state directly after it:

```typescript
const [selected, setSelected] = useState<number | null>(null);
const [tentative, setTentative] = useState<number | null>(null);
```

- [ ] **Step 3: Add `handleTentative` and `handleConfirm`**

Find the existing `handleSelect` function:

```typescript
function handleSelect(index: number) {
  if (selected !== null) return;
  setSelected(index);
  // ... scoring logic
```

Add two new functions immediately before `handleSelect`:

```typescript
function handleTentative(i: number) {
  if (selected !== null) return;
  setTentative(i);
  playOptionAudio(round, i);
}

function handleConfirm() {
  if (tentative === null || selected !== null) return;
  handleSelect(tentative);
}
```

Leave `handleSelect` unchanged.

- [ ] **Step 4: Reset `tentative` in `advanceRound`**

Find `advanceRound`:

```typescript
function advanceRound(s: EarTrainingSettings = settings) {
  const r = makeRound(s);
  setSelected(null);
  setRound(r);
}
```

Replace it with:

```typescript
function advanceRound(s: EarTrainingSettings = settings) {
  const r = makeRound(s);
  setSelected(null);
  setTentative(null);
  setRound(r);
}
```

- [ ] **Step 5: Update the answer card rendering**

Find the answer grid inside the round area. The full body of the `Array.from` callback currently reads:

```tsx
const answered = selected !== null;
const correct = isOptionCorrect(i);
const isSelected = selected === i;
return (
  <button
    key={i}
    onClick={() => handleSelect(i)}
    disabled={answered}
    className={cn(
      'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
      !answered && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
      answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
      answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
    )}
  >
    {getOptionLabel(i)}
  </button>
);
```

Replace the entire callback body (all lines between the outer `{` and `}` of the arrow function) with:

```tsx
const answered = selected !== null;
const correct = isOptionCorrect(i);
const isSelected = selected === i;
const isTentative = tentative === i;
const hasTentative = tentative !== null;
return (
  <button
    key={i}
    onClick={() => handleTentative(i)}
    disabled={answered}
    className={cn(
      'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
      // Unanswered — no tentative pick yet
      !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
      // Unanswered — this card is the tentative pick
      !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
      // Unanswered — another card is the tentative pick
      !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
      // Answered states (unchanged)
      answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
      answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
    )}
  >
    {getOptionLabel(i)}
  </button>
);
```

- [ ] **Step 6: Replace the Next button area with Confirm + Next**

Find the current Next button block:

```tsx
{selected !== null && (
  <div className="flex justify-end">
    <button
      onClick={() => advanceRound()}
      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
    >
      Next →
    </button>
  </div>
)}
```

Replace it with:

```tsx
{tentative !== null && selected === null && (
  <div className="flex justify-end">
    <button
      onClick={handleConfirm}
      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
    >
      Confirm
    </button>
  </div>
)}
{selected !== null && (
  <div className="flex justify-end">
    <button
      onClick={() => advanceRound()}
      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
    >
      Next →
    </button>
  </div>
)}
```

- [ ] **Step 7: Verify lint passes**

```bash
npm run lint
```

Expected: no output (exit 0).

- [ ] **Step 8: Manual browser check**

Start the dev server:

```bash
npm run dev
```

Navigate to `http://localhost:3000/Guitar_Chords/ear-training`.

Verify:
1. Round starts, question audio plays automatically (or on first Replay tap).
2. Tapping a card plays that option's sound and highlights it with a primary border + tint; other cards dim to 60% opacity.
3. Tapping a different card moves the highlight and plays the new option.
4. Re-tapping the current tentative card replays its sound without visual change.
5. Confirm button appears only after a tentative pick; Next → is absent until Confirm is tapped.
6. Tapping Confirm locks in the answer: green/red feedback appears, score bar updates, Next → replaces Confirm.
7. Tapping Next → resets both tentative and selected; new round starts.
8. Replay button still plays the question sound at any point.
9. Test in both Chord Recognition and Interval Recognition modes.

- [ ] **Step 9: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add tentative-select and Confirm button to ear training quiz"
```
