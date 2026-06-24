# Ear Training Design

## Overview

A dedicated `/ear-training` page that trains users to recognize chords and intervals by ear. Two modes, endless sessions with optional score summary, and a filterable chord/interval pool with preset difficulty levels.

---

## Route & Navigation

- New route: `/ear-training`
- New nav link: "Ear Training" added to the shared `Layout` sidebar alongside Dictionary, CAGED, Progressions
- `BrowserRouter` basename `/Guitar_Chords` already handles path prefixing — no config changes needed

---

## Page Structure

```
[ Chord Recognition | Interval Recognition ]   ← mode tabs

▼ Settings (collapsible)
  Difficulty: [ Beginner ] [ Intermediate ] [ Advanced ]
  Chord types: ☑ Major  ☑ Minor  ☐ Dom7  ☐ Maj7 …

┌─────────────────────────────────────────┐
│              ROUND AREA                 │
│                                         │
│   [ 🔊 Replay ]                         │
│                                         │
│   [ C Major ]  [ A Minor ]              │
│   [ G Dom7  ]  [ F Maj7  ]              │
│                                         │
│   ← feedback highlight after pick →    │
│                                         │
│              [ Next → ]                 │
└─────────────────────────────────────────┘

─────────────────────────────────────────
  7 / 10 correct   🔥 3 streak   [ End Session ]
─────────────────────────────────────────
```

---

## Modes

### Chord Recognition

- A chord is played (strummed via `playStrum`) at a random root note (guitar range: E2–B4)
- Voicing drawn from `COMMON_CHORDS[root]` filtered to the active chord types
- 4 multiple-choice options: 1 correct + 3 distractors drawn from the active pool (different roots and/or types)

**Difficulty presets (chord types checked by default):**

| Level | Chord types |
|-------|-------------|
| Beginner | major, minor |
| Intermediate | major, minor, dom7, maj7, m7 |
| Advanced | major, minor, dom7, maj7, m7, dim, aug, dim7, m7b5 |

### Interval Recognition

- Two notes played ascending with a 400 ms gap via `playNote`, root is random (guitar range)
- 4 multiple-choice options: 1 correct interval name + 3 distractors from the active pool

**Difficulty presets (intervals checked by default):**

| Level | Intervals |
|-------|-----------|
| Beginner | Unison, P4, P5, Octave |
| Intermediate | + M2, m3, M3, M6 |
| Advanced | All 13 intervals (P1 through P8 chromatically) |

**Interval names displayed:** Unison, Minor 2nd, Major 2nd, Minor 3rd, Major 3rd, Perfect 4th, Tritone, Perfect 5th, Minor 6th, Major 6th, Minor 7th, Major 7th, Octave

---

## Round Interaction

1. Round starts → audio plays automatically
2. **Replay button** always visible; replays the same chord/interval on click
3. **4 answer buttons** displayed in a 2×2 grid
4. User selects an answer:
   - Correct answer button turns **green**
   - If user picked wrong: their selection turns **red**, correct stays/turns green
   - Score and streak update immediately
5. **"Next →" button** appears (or becomes active) after a selection — user manually advances
6. No time limit

---

## Settings Panel

- Collapsible (open by default on first visit, remembers state in `localStorage`)
- Difficulty preset buttons: clicking one checks the preset chord/interval types
- Individual type checkboxes: manually override after selecting a preset
- At least 2 types must remain checked (disable unchecking the last one)
- Settings persisted to `localStorage` under key `ear-training-settings`

---

## Score Bar & Session Summary

**Score bar** (always visible at page bottom):
- `X / Y correct` — cumulative for the current session
- `🔥 N streak` — resets to 0 on wrong answer
- `[ End Session ]` button

**End Session modal:**
- Heading: "Session Complete"
- Total: `X / Y correct (Z%)`
- Breakdown table: one row per chord/interval type showing correct/total for that type
- Two actions: **Start Over** (reset score, same settings) | **Close** (back to settings panel)

---

## Data & Audio

- `COMMON_CHORDS` from `src/data/guitarData.ts` — provides chord shapes per root
- `ALL_NOTES` from `src/data/guitarData.ts` — 12 chromatic note names (`['C','C#',...,'B']`); combine with octave numbers to generate playable note strings
- `getNoteString(note, octave)` from `src/lib/audio.ts` — produces note strings like `"E2"` for playback
- `getFretNote(stringIdx, fret)` from `src/lib/audio.ts` — converts a ChordShape fret position to a note string
- `playStrum(notes: string[], duration, direction)` from `src/lib/audio.ts` — takes an array of note strings; implementation must convert ChordShape.frets to note strings via `getFretNote` before calling
- `playNote(noteInfo: string, duration)` from `src/lib/audio.ts` — interval note playback
- `initAudio()` must be called on first user gesture before any playback
- Root notes constrained to guitar range: roots are drawn from `ALL_NOTES`, octaves chosen so the root sits in E2–B4 range

---

## State Shape

```typescript
interface EarTrainingSettings {
  mode: 'chord' | 'interval';
  activeChordTypes: string[];   // e.g. ['major', 'minor']
  activeIntervals: string[];    // e.g. ['Unison', 'P4', 'P5', 'Octave']
  settingsPanelOpen: boolean;
}

interface RoundState {
  answer: ChordShape | IntervalOption;  // the correct answer
  options: (ChordShape | IntervalOption)[];  // 4 choices including correct
  selected: number | null;  // index into options, null = not yet answered
  audioReady: boolean;
}

interface SessionScore {
  correct: number;
  total: number;
  streak: number;
  byType: Record<string, { correct: number; total: number }>;
}
```

---

## Files

| File | Action |
|------|--------|
| `src/pages/EarTraining.tsx` | Create — full page component |
| `src/App.tsx` | Modify — add `/ear-training` route |
| `src/components/Layout.tsx` (or equivalent nav file) | Modify — add nav link |
