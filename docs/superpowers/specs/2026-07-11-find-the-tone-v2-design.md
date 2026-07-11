# Find the Tone v2: Two-Phase Match-Then-Name Design

**Goal:** Redesign the "Find the Tone" interval ear-training sub-mode (shipped in commit `b52bcea`) from a single-phase "told the name, find the pitch" flow into a two-phase "match the sound by ear, then name it" flow, adding a direction setting and richer post-answer playback along the way.

**Why:** The v1 flow tells the learner the target interval's name before they search (e.g. "Find the Perfect 5th"), then presents 13 dots in fixed ascending semitone order. Anyone who knows interval-to-semitone mappings (Perfect 5th = 7 semitones) can count to the 8th dot and win without listening. The user's own proposed fix — hear the interval first, find/match the pitch with no name given, then separately name what was heard — eliminates the exploit as a side effect (nothing to count to, since no name precedes the search) while also correctly sequencing ear-skill before theory-skill as two distinct, separately trackable abilities.

**Architecture:** `IntervalPitchRound` (in `src/lib/earTraining.ts`) is extended with a `direction` field and loses its eager `correctNote` field (now derived on demand). A new local `phase: 'match' | 'name'` state in `EarTraining.tsx` drives which UI renders and how `handleConfirm`/`handleSelect` grade — the round object itself is generated once per round and does not change between phases. Two `IntervalHistoryEntry` appends happen per round (one per phase), distinguished by a new optional `skill` field. This is a modification of the existing Find the Tone sub-mode, not a new mode — Multiple Choice, Mixed mode, and Plan-mode skill ladders are unaffected.

**Tech Stack:** No new dependencies. Reuses `playNote`/`initAudio` (`src/lib/audio.ts`), `addSemitones`/`INTERVAL_DEFS`/`INTERVAL_ROOTS` (`src/lib/earTraining.ts`), and the existing tentative/Confirm selection pattern.

---

## Global Constraints

- Modified files only: `src/lib/earTraining.ts`, `src/lib/intervalHistory.ts`, `src/pages/EarTraining.tsx`. No new files.
- Find-the-Tone (both phases) applies **only to standalone Interval mode** with `intervalSubMode === 'findTone'`. Mixed mode and Plan-mode skill-ladder practice continue to use `generateIntervalRound` exclusively — do not thread `phase` or the new settings fields into `makeRound`'s mixed/plan branches.
- The candidate window remains the full chromatic octave: 13 candidates (semitones 0–12 from the root), now walked ascending or descending per `round.direction` instead of always ascending.
- Playing the root note, or previewing any candidate dot, must never play the target tone before the user confirms their Phase A pick. This is a correctness requirement carried over from v1.
- The post-confirm melodic/harmonic playback (new in v2) must always sound the *actual* correct target note, never the user's picked note — even when the pick was wrong, so the ear still gets trained on the right sound.
- `npm run lint` (`tsc --noEmit`) must pass with zero new errors (ignore the two pre-existing unrelated errors in untracked `src/pages/Caged 2.tsx`).

---

## Data Model (`src/lib/earTraining.ts`)

### `IntervalPitchRound` (modified)

```ts
export interface IntervalPitchRound {
  kind: 'intervalPitch';
  rootNote: string;
  direction: 'asc' | 'desc';  // NEW — concrete direction for this round
  correctSemitones: number;   // 0-12, index into the 13 candidate buttons
  correctLabel: string;       // e.g. "Perfect 5th"
  // correctNote REMOVED — derive via addSemitones(rootNote, direction === 'asc' ? correctSemitones : -correctSemitones)
}
```

### `generateIntervalPitchRound` (modified signature)

```ts
export function generateIntervalPitchRound(
  activeIntervals: string[],
  directionSetting: 'asc' | 'desc' | 'both',
): IntervalPitchRound {
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const correctDef = pickRandom(activeDefs);
  const rootNote = pickRandom(INTERVAL_ROOTS);
  const direction: 'asc' | 'desc' =
    directionSetting === 'both' ? (Math.random() < 0.5 ? 'asc' : 'desc') : directionSetting;

  return {
    kind: 'intervalPitch',
    rootNote,
    direction,
    correctSemitones: correctDef.semitones,
    correctLabel: correctDef.label,
  };
}
```

### Candidate tone lookup (direction-aware)

Candidate `i` (0–12) is `addSemitones(rootNote, round.direction === 'asc' ? i : -i)`. `addSemitones` already handles negative semitone counts correctly (verify during implementation; if it doesn't, this is the one place a fix is needed — it must wrap octaves down the same way it wraps up).

### `EarTrainingSettings` (modified)

```ts
export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study' | 'fretboard' | 'plan' | 'rhythm' | 'melody' | 'mixed' | 'count' | 'scaleDrill' | 'intervalFretboard';
  activeChordTypes: string[];
  activeIntervals: string[];
  settingsPanelOpen: boolean;
  melodySettings: MelodySettings;
  intervalDirection: 'asc' | 'desc' | 'both'; // NEW — default 'both'
  intervalPlayHarmonic: boolean;              // NEW — default false
}
```

`DEFAULT_SETTINGS` gains `intervalDirection: 'both'` and `intervalPlayHarmonic: false`. Both persist through the existing `loadSettings`/`saveSettings` (`localStorage` key `ear-training-settings`) — no changes needed to those functions, since they already spread `DEFAULT_SETTINGS` under parsed overrides.

### Audio helpers (`EarTraining.tsx` / `earTraining.ts`)

- `playRoundAudio`'s existing `intervalPitch` branch (plays only `rootNote`) is unchanged.
- `playOptionAudio`'s `intervalPitch` branch becomes direction-aware:
  ```ts
  } else if (round.kind === 'intervalPitch') {
    const pr = round as IntervalPitchRound;
    const semitones = pr.direction === 'asc' ? index : -index;
    playNote(addSemitones(pr.rootNote, semitones), '2n');
  }
  ```
- New helper in `EarTraining.tsx`, called on Phase A confirm:
  ```ts
  function playMatchReveal(pr: IntervalPitchRound, alsoHarmonic: boolean) {
    const semitones = pr.direction === 'asc' ? pr.correctSemitones : -pr.correctSemitones;
    const targetNote = addSemitones(pr.rootNote, semitones);
    playNote(pr.rootNote, '2n');
    setTimeout(() => {
      playNote(targetNote, '2n');
      if (alsoHarmonic) {
        setTimeout(() => {
          playNote(pr.rootNote, '2n');
          playNote(targetNote, '2n');
        }, 500);
      }
    }, 400);
  }
  ```
  (`addSemitones` is currently module-private to `earTraining.ts` — export it, since `EarTraining.tsx` needs it here.)

### History (`src/lib/intervalHistory.ts`, modified)

```ts
export interface IntervalHistoryEntry {
  date: string;
  label: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
  skill?: 'match' | 'name'; // NEW — optional so pre-v2 entries (undefined) still load
}
```

`exportIntervalToCsv`/`parseIntervalFromCsv` are unchanged (still the 5-column format) — `skill` is not exported to CSV. The CSV round-trip silently drops the match/name split; the `localStorage` JSON copy (read by `loadIntervalHistory`, the source of truth for on-screen stats) always retains it.

---

## Phase State & Round Flow (`src/pages/EarTraining.tsx`)

### New local state

```ts
const [phase, setPhase] = useState<'match' | 'name'>('match');
```

Reset to `'match'` every time `advanceRound()` generates a new round (alongside the existing `tentative`/`selected` resets). `intervalSubMode` (`'choice' | 'findTone'`) is unchanged and still local, non-persisted.

### `advanceRound` (modified call site)

```ts
} else if (s.mode === 'interval' && effectiveIntervalSubMode === 'findTone') {
  r = generateIntervalPitchRound(s.activeIntervals, s.intervalDirection);
```

### Phase A — pitch matching (`phase === 'match'`)

1. On round entry, `playRoundAudio` plays only the root (unchanged behavior).
2. 13 unlabeled dots render left-to-right in `round.direction` order (index 0 = root end, index 12 = octave end — visually always left-to-right regardless of ascending/descending, since "left-to-right" here means "in the order the candidates are laid out," not "in the order of increasing pitch").
3. Clicking a dot sets it tentative and plays that single tone (`handleTentative`, `playOptionAudio` — unchanged mechanism, direction-aware lookup as above).
4. Confirm (`handleConfirm` → `handleSelect`) grades: `isCorrect = tentative === round.correctSemitones`.
   - Appends `IntervalHistoryEntry` with `skill: 'match'`.
   - Updates `score.byType` under key `` `${round.correctLabel} (match)` ``.
   - Calls `playMatchReveal(round, settings.intervalPlayHarmonic)`.
   - Reveals note names on all 13 dots (see UI section).
   - Sets `phase = 'name'`. Does **not** call `advanceRound()`.
   - Resets `tentative`/`selected` to `null` so Phase B starts with a clean options grid.

### Phase B — naming (`phase === 'name'`)

1. Renders a multiple-choice grid of interval names, built the same way `generateIntervalRound`'s `options` are built: every def in `INTERVAL_DEFS` filtered by `settings.activeIntervals`, shuffled. This list is computed fresh each time Phase B renders (deterministic given `round` + `settings.activeIntervals`, so no need to store it on the round object).
2. Clicking an option sets it tentative (existing `handleTentative`/`playOptionAudio` pattern — clicking a Phase B option does not need to play audio, since the sound was already established in Phase A; `playOptionAudio` is simply not called for Phase B option clicks).
3. Confirm grades: `isCorrect = pickedLabel === round.correctLabel`.
   - Appends a second `IntervalHistoryEntry` with `skill: 'name'`.
   - Updates `score.byType` under key `` `${round.correctLabel} (name)` ``.
4. **Next** button calls `advanceRound()` as today, which generates a new round and resets `phase` to `'match'`.

### `handleSelect` / `isOptionCorrect` / `getOptionCount` / `getOptionLabel`

All four gain a `phase` check alongside the existing `round.kind === 'intervalPitch'` check, since `intervalPitch` rounds now render two different option sets depending on phase:

- `getOptionCount`: Phase A → `13`; Phase B → `activeIntervalDefs.length` (same count as the Multiple Choice `interval` round's option count for the same `activeIntervals`).
- `getOptionLabel`: Phase A → `''` (dots stay unlabeled until reveal, per the existing pattern); Phase B → the shuffled interval label at that index.
- `isOptionCorrect`: Phase A → `index === round.correctSemitones`; Phase B → `shuffledOptions[index].label === round.correctLabel`.
- `handleSelect`: branches on `round.kind === 'intervalPitch' && phase === 'match'` vs `round.kind === 'intervalPitch' && phase === 'name'` for grading, history-append, and score-bucketing, per the Phase A/B descriptions above.

---

## UI (`src/pages/EarTraining.tsx`)

### Phase A screen

- Prompt text replaces "Find the {label}": **"Listen, then find the matching tone"**.
- Root note name shown next to Replay, e.g. **"Root: A4"** (`round.rootNote` — safe to show pre-match since it's not the target).
- 13 unlabeled circular dots, same visual treatment as v1 (`w-9 h-9 rounded-full`), now ordered per `round.direction`.
- After Confirm: correct dot highlights green, wrong-selected dot highlights red (unchanged color scheme), and **all 13 dots get their note-name labels revealed** (replacing the old single-line "Correct answer: {note}" caption — the dot labels themselves now carry that information).
- No "Next" button yet — Phase A's Confirm transitions to Phase B in place, it doesn't advance the round.

### Phase B screen

- Prompt text: **"Now name it"**.
- Multiple-choice grid of interval-name buttons, visually matching the existing Multiple Choice `IntervalRound` options grid (`grid grid-cols-4 sm:grid-cols-5`, `p-2 text-xs` buttons) rather than the circular dot style.
- After Confirm: standard correct/wrong highlight (unchanged pattern).
- **Next** button appears, calls `advanceRound()`.

### Settings panel additions (Interval mode, Find the Tone sub-mode only)

- **Direction control:** three-way segmented control — Ascending / Descending / Both — visible only when `intervalSubMode === 'findTone'`. Wired to `settings.intervalDirection`, saved via the existing settings-update-and-persist pattern used by `activeIntervals`/`activeChordTypes`.
- **Harmonic playback toggle:** checkbox/switch labeled **"Also play harmonically"**, default off, wired to `settings.intervalPlayHarmonic`, same persistence path.

---

## Testing

No test framework in this repo (`npm run lint` is the only static check). Verification plan:
- `npm run lint` passes with zero new errors.
- Manual code-path check: confirm `playRoundAudio`/`playOptionAudio`/dot-click handlers never play `addSemitones(rootNote, ±correctSemitones)` before Phase A Confirm.
- Manual code-path check: confirm `playMatchReveal` always uses `round.correctSemitones`, not `tentative`, when computing the target note.
- If browser automation is available at implementation time, a live smoke test in Interval mode → Find the Tone: toggle direction settings and confirm dot order changes and survives a page reload (localStorage persistence); complete a full round and confirm melodic playback fires on Phase A confirm, optional harmonic playback fires when the toggle is on, note names reveal on all 13 dots, Phase B renders a name-options grid, and both phases each append one history entry (visible as two rows for one round in exported CSV or the stats view). If browser automation is unavailable, this must be reported explicitly rather than assumed.
