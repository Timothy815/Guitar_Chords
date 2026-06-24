# Study Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Study tab to the ear training page that shows flashcards (chord or interval name + Play button) the user navigates at their own pace, building sound recognition through exposure before recall.

**Architecture:** Two-task split: Task 1 adds the data/audio types and functions to `earTraining.ts` (pure logic, no UI); Task 2 wires them into `EarTraining.tsx` (tabs, state, rendering). Task 2 depends on Task 1's exports.

**Tech Stack:** React 19, TypeScript, Tone.js (via `src/lib/audio.ts`), Tailwind CSS v4.

## Global Constraints

- No test framework — verification is `npm run lint` (tsc --noEmit) + manual browser check only
- `initAudio()` must be awaited before every audio call (browser autoplay policy)
- Tailwind v4 — no config file; use brand CSS variable tokens: `brand-primary`, `brand-line`, `brand-ink`, `brand-secondary`, `brand-sidebar`, `brand-surface`
- `@` alias resolves to project root — use relative imports inside `src/` (e.g. `../lib/earTraining`)
- Do not change `handleSelect`, `handleTentative`, or `handleConfirm` — quiz flow is untouched
- Minimum active chord types: 2; minimum active intervals: 2 (enforced by existing toggle handlers — do not weaken)
- `COMMON_CHORDS`, `INTERVAL_DEFS`, `INTERVAL_ROOTS`, `buildChordPool`, `shuffle`, `pickRandom`, `addSemitones` are already defined in `earTraining.ts` — reuse them, do not duplicate

---

### Task 1: Add StudyCard type, generateStudyDeck, and playStudyCard to earTraining.ts

**Files:**
- Modify: `src/lib/earTraining.ts`

**Interfaces:**
- Consumes: `buildChordPool`, `shuffle`, `pickRandom`, `INTERVAL_DEFS`, `INTERVAL_ROOTS`, `addSemitones`, `chordToNotes`, `initAudio`, `playStrum`, `playNote` — all already in this file
- Produces (consumed by Task 2):
  - `StudyCard` — exported union type
  - `generateStudyDeck(activeChordTypes: string[], activeIntervals: string[]): StudyCard[]` — exported function
  - `playStudyCard(card: StudyCard): Promise<void>` — exported function
  - `EarTrainingSettings.mode` widened to `'chord' | 'interval' | 'study'`

- [ ] **Step 1: Widen the mode type in EarTrainingSettings**

In `src/lib/earTraining.ts`, find:

```typescript
export interface EarTrainingSettings {
  mode: 'chord' | 'interval';
```

Replace with:

```typescript
export interface EarTrainingSettings {
  mode: 'chord' | 'interval' | 'study';
```

- [ ] **Step 2: Add the StudyCard type**

After the `IntervalAnswer` interface (around line 35), add:

```typescript
export type StudyCard =
  | {
      kind: 'chord';
      displayLabel: string;
      chord: ChordShape;
    }
  | {
      kind: 'interval';
      label: string;
      rootNote: string;
      topNote: string;
    };
```

- [ ] **Step 3: Add generateStudyDeck at the end of the file**

Append after `playOptionAudio`:

```typescript
export function generateStudyDeck(activeChordTypes: string[], activeIntervals: string[]): StudyCard[] {
  // One randomly-picked shape per root+type combo across all 12 roots.
  const chordCards: StudyCard[] = [];
  const seen = new Set<string>();
  for (const entry of shuffle(buildChordPool(activeChordTypes))) {
    const key = `${entry.root}-${entry.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      chordCards.push({ kind: 'chord', displayLabel: `${entry.root} ${entry.typeLabel}`, chord: entry.chord });
    }
  }

  // One card per active interval, random root note each time.
  const activeDefs = INTERVAL_DEFS.filter(d => activeIntervals.includes(d.label));
  const intervalCards: StudyCard[] = activeDefs.map(def => {
    const rootNote = pickRandom(INTERVAL_ROOTS);
    return { kind: 'interval', label: def.label, rootNote, topNote: addSemitones(rootNote, def.semitones) };
  });

  return shuffle([...chordCards, ...intervalCards]);
}
```

- [ ] **Step 4: Add playStudyCard at the end of the file**

Append after `generateStudyDeck`:

```typescript
export async function playStudyCard(card: StudyCard): Promise<void> {
  await initAudio();
  if (card.kind === 'chord') {
    playStrum(chordToNotes(card.chord), '2n');
  } else {
    playNote(card.rootNote, '2n');
    setTimeout(() => playNote(card.topNote, '2n'), 400);
  }
}
```

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/lib/earTraining.ts
git commit -m "feat: add StudyCard type, generateStudyDeck, and playStudyCard to earTraining module"
```

---

### Task 2: Wire study mode into EarTraining.tsx

**Files:**
- Modify: `src/pages/EarTraining.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `StudyCard` type
  - `generateStudyDeck(activeChordTypes: string[], activeIntervals: string[]): StudyCard[]`
  - `playStudyCard(card: StudyCard): Promise<void>`
  - `EarTrainingSettings.mode` now accepts `'study'`

- [ ] **Step 1: Update the import from earTraining**

Find the existing import block at the top of `EarTraining.tsx`:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, chordToNotes, playOptionAudio,
} from '../lib/earTraining';
```

Replace with:

```typescript
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
```

- [ ] **Step 2: Add studyDeck and studyIndex state**

Find the existing state declarations near the top of `EarTraining()`:

```typescript
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
  const [selected, setSelected] = useState<number | null>(null);
  const [tentative, setTentative] = useState<number | null>(null);
  const [score, setScore] = useState<SessionScore>(initialScore);
  const [showSummary, setShowSummary] = useState(false);
  const audioUnlocked = useRef(false);
```

Replace with:

```typescript
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
  const [selected, setSelected] = useState<number | null>(null);
  const [tentative, setTentative] = useState<number | null>(null);
  const [score, setScore] = useState<SessionScore>(initialScore);
  const [showSummary, setShowSummary] = useState(false);
  const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const audioUnlocked = useRef(false);
```

- [ ] **Step 3: Add useEffect to generate/regenerate the study deck**

Find the existing `useEffect` for saving settings:

```typescript
  useEffect(() => { saveSettings(settings); }, [settings]);
```

Add a new `useEffect` directly after it:

```typescript
  useEffect(() => {
    if (settings.mode === 'study') {
      setStudyDeck(generateStudyDeck(settings.activeChordTypes, settings.activeIntervals));
      setStudyIndex(0);
    }
  }, [settings.mode, settings.activeChordTypes, settings.activeIntervals]);
```

- [ ] **Step 4: Add handleStudyMode and guard handleDifficulty**

Find `handleModeChange`:

```typescript
  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }
```

Add `handleStudyMode` immediately after it:

```typescript
  function handleStudyMode() {
    setSettings(s => ({ ...s, mode: 'study' }));
  }
```

Then find `handleDifficulty`:

```typescript
  function handleDifficulty(level: DifficultyLevel) {
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    advanceRound(next);
  }
```

Replace with:

```typescript
  function handleDifficulty(level: DifficultyLevel) {
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    if (next.mode !== 'study') advanceRound(next);
  }
```

- [ ] **Step 5: Update the mode tabs to include a Study tab**

Find the mode tabs block:

```tsx
      {/* Mode tabs */}
      <div className="flex rounded-lg border border-brand-line overflow-hidden">
        {(['chord', 'interval'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              settings.mode === mode
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar'
            )}
          >
            {mode === 'chord' ? 'Chord Recognition' : 'Interval Recognition'}
          </button>
        ))}
      </div>
```

Replace with:

```tsx
      {/* Mode tabs */}
      <div className="flex rounded-lg border border-brand-line overflow-hidden">
        {(['chord', 'interval'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              settings.mode === mode
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar'
            )}
          >
            {mode === 'chord' ? 'Chord Recognition' : 'Interval Recognition'}
          </button>
        ))}
        <button
          onClick={handleStudyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'study'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Study
        </button>
      </div>
```

- [ ] **Step 6: Update the settings panel to show both sections in study mode**

Find the settings panel's type/interval checkboxes section:

```tsx
            {/* Type / interval checkboxes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">
                {settings.mode === 'chord' ? 'Chord Types' : 'Intervals'}
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.mode === 'chord'
                  ? CHORD_TYPE_DEFS.map(def => {
                      const checked = settings.activeChordTypes.includes(def.id);
                      const disabled = checked && settings.activeChordTypes.length <= 2;
                      return (
                        <label
                          key={def.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleChordType(def.id)}
                          />
                          {def.label}
                        </label>
                      );
                    })
                  : INTERVAL_DEFS.map(def => {
                      const checked = settings.activeIntervals.includes(def.label);
                      const disabled = checked && settings.activeIntervals.length <= 2;
                      return (
                        <label
                          key={def.label}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleInterval(def.label)}
                          />
                          {def.label}
                        </label>
                      );
                    })}
              </div>
            </div>
```

Replace with:

```tsx
            {/* Type / interval checkboxes */}
            {settings.mode === 'study' ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Chord Types</p>
                  <div className="flex flex-wrap gap-2">
                    {CHORD_TYPE_DEFS.map(def => {
                      const checked = settings.activeChordTypes.includes(def.id);
                      const disabled = checked && settings.activeChordTypes.length <= 2;
                      return (
                        <label
                          key={def.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleChordType(def.id)} />
                          {def.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Intervals</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERVAL_DEFS.map(def => {
                      const checked = settings.activeIntervals.includes(def.label);
                      const disabled = checked && settings.activeIntervals.length <= 2;
                      return (
                        <label
                          key={def.label}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleInterval(def.label)} />
                          {def.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">
                  {settings.mode === 'chord' ? 'Chord Types' : 'Intervals'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {settings.mode === 'chord'
                    ? CHORD_TYPE_DEFS.map(def => {
                        const checked = settings.activeChordTypes.includes(def.id);
                        const disabled = checked && settings.activeChordTypes.length <= 2;
                        return (
                          <label
                            key={def.id}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                              checked
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                              disabled && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleChordType(def.id)} />
                            {def.label}
                          </label>
                        );
                      })
                    : INTERVAL_DEFS.map(def => {
                        const checked = settings.activeIntervals.includes(def.label);
                        const disabled = checked && settings.activeIntervals.length <= 2;
                        return (
                          <label
                            key={def.label}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                              checked
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                              disabled && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleInterval(def.label)} />
                            {def.label}
                          </label>
                        );
                      })}
                </div>
              </div>
            )}
```

- [ ] **Step 7: Replace the round area with a conditional that shows either the quiz or the study view**

Find the round area opening tag and everything through its closing tag:

```tsx
      {/* Round area */}
      <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
```

(This block runs from that comment down to the closing `</div>` of the round area — the one before the `{/* Fixed score bar */}` comment.)

Replace the entire round area block with:

```tsx
      {/* Round area / Study view */}
      {settings.mode === 'study' ? (
        studyDeck.length === 0 ? (
          <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-center text-brand-secondary text-sm">
            No cards — enable at least one chord type or interval in Settings.
          </div>
        ) : (
          <div className="rounded-lg border border-brand-line bg-brand-surface p-8 flex flex-col items-center gap-6">
            {/* Category chip */}
            <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-line text-brand-secondary">
              {studyDeck[studyIndex].kind === 'chord' ? 'Chord' : 'Interval'}
            </span>

            {/* Name */}
            <p className="text-3xl font-serif font-bold text-brand-ink text-center">
              {studyDeck[studyIndex].kind === 'chord'
                ? studyDeck[studyIndex].displayLabel
                : studyDeck[studyIndex].label}
            </p>

            {/* Play button */}
            <button
              onClick={() => playStudyCard(studyDeck[studyIndex]).catch(() => {})}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
            >
              <Volume2 size={18} /> Play
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => setStudyIndex(i => i - 1)}
                disabled={studyIndex === 0}
                className="p-2 rounded-lg border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous card"
              >
                ←
              </button>
              <span className="text-sm text-brand-secondary tabular-nums">
                {studyIndex + 1} / {studyDeck.length}
              </span>
              <button
                onClick={() => setStudyIndex(i => i + 1)}
                disabled={studyIndex === studyDeck.length - 1}
                className="p-2 rounded-lg border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next card"
              >
                →
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
          {/* Replay button — also serves as the first user gesture to unlock audio */}
          <div className="flex justify-center">
            <button
              onClick={() => playRoundAudio(round)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
            >
              <Volume2 size={18} /> Replay
            </button>
          </div>

          {/* Answer options — 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => {
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
                    !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
                    !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
                    !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
                    answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                    answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                    answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
                  )}
                >
                  {getOptionLabel(i)}
                </button>
              );
            })}
          </div>

          {/* Confirm button — appears after tentative pick */}
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

          {/* Next button — appears after answering */}
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
        </div>
      )}
```

- [ ] **Step 8: Hide the score bar and session summary in study mode**

Find the fixed score bar:

```tsx
      {/* Fixed score bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-line px-6 py-3 flex items-center justify-between z-10 print:hidden">
```

Wrap it in a conditional — replace just that opening div tag line with:

```tsx
      {/* Fixed score bar */}
      {settings.mode !== 'study' && (
      <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-line px-6 py-3 flex items-center justify-between z-10 print:hidden">
```

Then find the closing tag of the score bar div (the `</div>` just before the session summary modal comment) and add a closing paren for the conditional:

```tsx
      </div>
      )}
```

Find the session summary modal:

```tsx
      {/* Session summary modal */}
      {showSummary && (
```

Replace with:

```tsx
      {/* Session summary modal */}
      {showSummary && settings.mode !== 'study' && (
```

- [ ] **Step 9: Verify lint passes**

```bash
npm run lint
```

Expected: no output (exit 0). Fix any TypeScript errors before proceeding.

- [ ] **Step 10: Manual browser check**

Start the dev server:

```bash
npm run dev
```

Navigate to `http://localhost:3000/Guitar_Chords/ear-training`.

Verify:
1. Three tabs appear: "Chord Recognition", "Interval Recognition", "Study". The active tab is highlighted in brand-primary.
2. Clicking "Study" switches to the study view: a category chip, a large name, and a Play button appear. The score bar is hidden.
3. The progress counter shows "1 / N" where N is the total deck size (roughly 12 × active chord types + active intervals count).
4. Clicking Play plays the sound for the current card (chord strums, intervals play two notes 400 ms apart).
5. The ← button is disabled on card 1; the → button is disabled on the last card.
6. Navigating forward and back updates the card content and the counter correctly.
7. Opening Settings while in Study mode shows both Chord Types and Intervals sections. Toggling any option regenerates the deck and resets to card 1.
8. Clicking a Difficulty preset while in Study mode updates the active types but does NOT start a quiz round.
9. Switching back to "Chord Recognition" or "Interval Recognition" restores the quiz view and score bar.
10. The quiz flow (tentative → Confirm → Next) still works correctly in Chord Recognition and Interval Recognition modes.

- [ ] **Step 11: Commit**

```bash
git add src/pages/EarTraining.tsx
git commit -m "feat: add Study mode tab and flashcard view to ear training"
```
