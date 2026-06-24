# Study Mode Design

## Overview

Add a third "Study" tab to the ear training page. Study mode is a flashcard-style exposure experience: the learner sees a chord or interval name, taps Play to hear its sound, and navigates through the deck at their own pace. No scoring, no guessing — pure exposure before recall.

---

## Access

Study mode is reached via a third tab alongside "Chord Recognition" and "Interval Recognition". Selecting the tab sets `settings.mode = 'study'` and immediately generates and displays the flashcard deck.

---

## Card Format

Each flashcard shows three elements:

| Element | Content |
|---------|---------|
| Category chip | Small badge — "CHORD" or "INTERVAL" |
| Name | Large centered text — e.g. "F# Minor" or "Perfect 5th" |
| Play button | Tapping plays the card's sound immediately |

- **Chord cards** strum the associated `ChordShape` (via `playStrum`)
- **Interval cards** play root note then top note 400 ms later (via `playNote`, same timing as `playOptionAudio`)

---

## Navigation & Progress

Below the card:

```
←   4 / 12   →
```

- Back arrow (←) is disabled on card 1
- Forward arrow (→) is disabled on the last card — no wrap-around
- Progress counter shows current position in the deck

The deck is shuffled once when the user switches to the Study tab. If the user changes any setting while in Study mode (active chord types, active intervals), the deck regenerates and resets to card 1.

---

## Deck Data

### `StudyCard` type

```typescript
export type StudyCard =
  | {
      kind: 'chord';
      displayLabel: string;   // e.g. "F# Minor"
      chord: ChordShape;
    }
  | {
      kind: 'interval';
      label: string;           // e.g. "Perfect 5th"
      rootNote: string;        // e.g. "E3"
      topNote: string;         // e.g. "B3"
    };
```

### `generateStudyDeck(activeChordTypes, activeIntervals): StudyCard[]`

New export in `src/lib/earTraining.ts`.

- For each active chord type, pick one random `ChordShape` per root across all 12 roots → up to `12 × activeChordTypes.length` chord cards
- For each active interval, pick one random root from `INTERVAL_ROOTS` and compute the top note → one card per active interval
- Combine chord cards and interval cards, shuffle the combined array, return

### Audio playback for study cards

New export in `src/lib/earTraining.ts`:

```typescript
export async function playStudyCard(card: StudyCard): Promise<void>
```

- Calls `await initAudio()` before any playback
- Chord: `playStrum(chordToNotes(card.chord), '2n')`
- Interval: `playNote(card.rootNote, '2n')`, then after 400 ms `playNote(card.topNote, '2n')`

---

## Settings Integration

`EarTrainingSettings.mode` widens from `'chord' | 'interval'` to `'chord' | 'interval' | 'study'`.

`DEFAULT_SETTINGS.mode` remains `'chord'` — study mode is opt-in.

When `settings.mode === 'study'`, `EarTraining.tsx` renders the study mode view instead of the quiz view.

---

## State (`EarTraining.tsx`)

Two new state variables added to the existing component:

```typescript
const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
const [studyIndex, setStudyIndex] = useState(0);
```

| Event | Effect |
|-------|--------|
| User switches to Study tab | `setSettings({...settings, mode: 'study'})`, `setStudyDeck(generateStudyDeck(...))`, `setStudyIndex(0)` |
| Active chord types or active intervals change while in study mode | `setStudyDeck(generateStudyDeck(...))`, `setStudyIndex(0)` |
| Forward arrow tapped | `setStudyIndex(i => i + 1)` (guarded: no-op if at last card) |
| Back arrow tapped | `setStudyIndex(i => i - 1)` (guarded: no-op if at card 0) |
| Play button tapped | `playStudyCard(studyDeck[studyIndex]).catch(() => {})` |

---

## Files

| File | Change |
|------|--------|
| `src/lib/earTraining.ts` | Add `StudyCard` type; add `generateStudyDeck`; add `playStudyCard` |
| `src/pages/EarTraining.tsx` | Widen `mode` type; add Study tab; add `studyDeck` / `studyIndex` state; render study mode view |
