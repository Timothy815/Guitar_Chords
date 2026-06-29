# Scale Interval Drill Design

## Goal

Add an Interval Drill mode to the Scale Drill section of Ear Training, teaching interval identification and navigation within a chosen scale and fret position.

## Architecture

A new `IntervalDrillTrainer` component (sibling to `ScaleDrillTrainer`) is rendered via a `Note Name | Interval` tab row in `EarTraining.tsx`. A new `ScaleIntervalRound` type and generator function live in `earTraining.ts`. The existing Note Name drill is untouched.

## Tech Stack

React 19, TypeScript, Tailwind v4, `@tonaljs/tonal` (not used directly — interval math done via `INTERVAL_DEFS` and semitone arithmetic), existing `Fretboard` component, existing `audio.ts`.

---

## Global Constraints

- No changes to `ScaleDrillTrainer.tsx` — the Note Name drill must remain exactly as-is.
- `IntervalDrillTrainer` props: `{ score: SessionScore; onComplete: (wasCorrect: boolean) => void }` — identical shape to `ScaleDrillTrainer`.
- Interval labels use full names from `INTERVAL_DEFS`: "Minor 3rd", "Perfect 5th", etc. — never scale-degree numbers.
- Intervals are always computed ascending (mod 12, so never larger than an octave). Unison (0 semitones) is excluded from the pool — the two dots are always different notes.
- Answer options (4 choices) are drawn from the set of intervals that actually appear in the scale being drilled — never from the full chromatic set.
- Valid positions for Advanced mode are all fret/string positions of the target pitch class that fall within the active fret window.
- Streak tracking is keyed by `${root}|${scaleName}`, same pattern as `ScaleDrillTrainer`. Shown when ≥ 3.
- Picker changes reset to study mode (same behavior as `ScaleDrillTrainer`).
- `initAudio()` must be awaited before any playback.
- Tailwind v4 — no `tailwind.config.js`. Use brand CSS variables (`brand-primary`, `brand-ink`, etc.) and `cn()` for conditional classes.
- Path alias: `@` resolves to project root; use `@/src/...` for imports.

---

## Data Layer (`src/lib/earTraining.ts`)

### New type: `ScaleIntervalRound`

```ts
export interface ScaleIntervalRound {
  kind: 'scaleInterval';
  scaleName: string;
  root: Note;
  anchorStringIdx: number;
  anchorFret: number;
  anchorNote: Note;
  targetStringIdx: number;
  targetFret: number;
  targetNote: Note;
  intervalSemitones: number;   // 1–12, always ascending
  intervalLabel: string;       // e.g. "Perfect 5th"
  options: string[];           // 4 interval label strings, includes correct answer
  validPositions: { stringIdx: number; fret: number }[];  // all positions of targetNote in fret window
}
```

Add `ScaleIntervalRound` to the `Round` union type.

### New generator: `generateScaleIntervalRound`

```ts
export function generateScaleIntervalRound(opts: {
  scaleName: string;
  root: Note;
  fretRange: [number, number];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}): ScaleIntervalRound
```

Algorithm:

1. Generate the scale pattern via `generateScalePattern(root, scaleDef)`.
2. Collect all `{ stringIdx, fret, note }` positions where the note is in the scale AND `fret` is within `fretRange`. This is the **position pool**.
3. If the position pool has fewer than 2 entries, fall back to `fretRange: [0, 12]`.
4. **Pick anchor and target:**
   - Beginner: anchor = any position of the root note in the pool; target = random other position with a different note.
   - Intermediate/Advanced: anchor = random position; target = random other position with a different note (different fret or string).
5. Compute `intervalSemitones`: `(ALL_NOTES.indexOf(targetNote) - ALL_NOTES.indexOf(anchorNote) + 12) % 12`. If result is 0 (enharmonic same pitch class), re-pick — the two notes must be different pitch classes.
6. Map `intervalSemitones` to `intervalLabel` via `INTERVAL_DEFS`.
7. **Build `options`:** Compute all unique intervals (semitones 1–11) that appear between any two scale notes (ascending, mod 12). Map to labels. Pick 3 distractors from this pool (excluding the correct interval). Shuffle to get 4 options.
8. **Build `validPositions`:** All positions in `fretRange` where `note === targetNote`.
9. Return the round.

---

## Component (`src/components/IntervalDrillTrainer.tsx`)

### Props

```ts
interface IntervalDrillTrainerProps {
  score: SessionScore;
  onComplete: (wasCorrect: boolean) => void;
}
```

### State

```ts
const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
const [scaleName, setScaleName] = useState<string>(COMMON_SCALES[0].name);
const [root, setRoot] = useState<Note>('A');
const [position, setPosition] = useState<Position>('full');
const [studyMode, setStudyMode] = useState(true);
const [round, setRound] = useState<ScaleIntervalRound>(() => generateScaleIntervalRound(...));
const [selected, setSelected] = useState<string | null>(null);      // interval label or null
const [flashCorrect, setFlashCorrect] = useState(false);
const [streaks, setStreaks] = useState<Record<string, number>>({});
```

`Difficulty` and `Position` types are the same as in `ScaleDrillTrainer` — redeclare locally (do not import from there).

### Pickers row

Identical layout to `ScaleDrillTrainer`: Root picker, Scale picker (grouped by category), Position picker, Difficulty pills. `handlePickerChange` resets to study mode and generates a fresh round.

### Study mode

Identical to `ScaleDrillTrainer`: full labeled fretboard (`fretsNum={12}`, `showNoteNames={true}`), Play Scale button (same `handlePlayScale` logic), "Start Drilling →" button. The study phase teaches the scale before any interval questions begin.

### Drill mode — Beginner and Intermediate

**Fretboard:** Shows the scale pattern with `fretRange` applied. Two dots are specially rendered:
- Anchor dot: labeled with its note name (use `labeledDots` prop).
- Target dot: starred (use `highlightNote` prop). `flashHighlight={flashCorrect}` on wrong answer.
- `showNoteNames={false}`.

**Prompt text:**
- Beginner: *"What interval is ★ above the root ([anchorNote])?"*
- Intermediate: *"What is the interval from [anchorNote] to ★?"*

**Answer buttons:** 4 buttons, one per `round.options` entry. Same green/red/disabled feedback pattern as `ScaleDrillTrainer`.

**On correct:** increment streak, call `onComplete(true)`, after 600ms generate new round.

**On wrong:** reset streak to 0, `setFlashCorrect(true)`, show correct answer highlighted, after 1500ms call `onComplete(false)` and generate new round.

### Drill mode — Advanced ("Find the Note")

**Fretboard:** Shows the scale pattern with `fretRange` applied. Anchor dot labeled with its note name. No target starred. `showNoteNames={false}`. The fretboard must be **clickable** — pass `onDotClick`.

**Prompt text:** *"Find the [round.intervalLabel] above [round.anchorNote]."*

**No answer buttons.** The student clicks a scale dot directly.

**`onDotClick` handler:** Receives `{ stringIdx, fret }`. Check if it matches any entry in `round.validPositions`. If yes → correct (same feedback flow as other modes). If no → wrong (same feedback flow). After the answer is locked in, disable further clicks until the next round.

**Answer state:** Add a separate `advancedResult: 'correct' | 'wrong' | null` state (reset to null on each new round). The fretboard should visually confirm the click: on correct, `flashHighlight` pulses the clicked position; on wrong, `flashHighlight` pulses the correct `validPositions`.

### Back to Study button

Present in drill mode, same as `ScaleDrillTrainer`: resets to study mode without resetting streak.

---

## Integration (`src/pages/EarTraining.tsx`)

When `settings.mode === 'scaleDrill'`, render a tab row above the trainer:

```tsx
const [scaleDrillTab, setScaleDrillTab] = useState<'noteName' | 'interval'>('noteName');
```

Tab row:
```tsx
<div className="flex gap-1 mb-3">
  {(['noteName', 'interval'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setScaleDrillTab(tab)}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
        scaleDrillTab === tab
          ? 'bg-brand-primary text-white border-brand-primary'
          : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
      )}
    >
      {tab === 'noteName' ? 'Note Name' : 'Interval'}
    </button>
  ))}
</div>
```

Below the tab row, render `<ScaleDrillTrainer>` when `scaleDrillTab === 'noteName'`, `<IntervalDrillTrainer>` when `scaleDrillTab === 'interval'`. Both receive the existing `score` and `onComplete` props.

Reset `scaleDrillTab` to `'noteName'` when the user switches away from Scale Drill mode (add to the existing mode-switch handler).

---

## Pedagogical Ladder

| Difficulty | Question type | Anchor | Answer mechanism |
|---|---|---|---|
| Beginner | Name the interval | Root (labeled) | 4 buttons |
| Intermediate | Name the interval | Any scale note (labeled) | 4 buttons |
| Advanced | Find the note | Any scale note (labeled) | Click fretboard dot |

Interval options always drawn from intervals present in the chosen scale — no artificial filtering, no chromatic intervals outside the scale.
