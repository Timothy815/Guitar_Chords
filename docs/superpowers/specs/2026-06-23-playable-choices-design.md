# Playable Answer Choices Design

## Overview

Modify the ear training quiz so users can audition each answer option before committing. A two-phase cycle replaces the current single-tap-to-answer model: tap a card to hear it (audition), then tap Confirm to lock in the answer.

---

## Interaction Flow

### Audition phase
- Round starts and plays the question audio as today.
- Tapping any answer card plays that option's sound and marks it as the tentative pick.
- Tapping a different card plays that option and moves the tentative highlight.
- Re-tapping the current tentative card replays its sound without changing state.
- The Replay button continues to play the question sound, unchanged.

### Confirm phase
- Once a tentative pick exists, a **Confirm** button appears below the answer grid.
- Tapping Confirm locks in the tentative pick as the answer, scores the round, and reveals green/red feedback exactly as today.
- Next → then appears as usual.

No answer is ever committed without an explicit Confirm tap.

---

## Visual States

| State | Styling |
|-------|---------|
| Default (no tentative pick) | `border-brand-line`, full opacity |
| Tentative — this card | `border-brand-primary`, light primary tint background, full opacity |
| Tentative — other cards | `border-brand-line`, `opacity-60` |
| Answered — correct | green (unchanged) |
| Answered — wrong + was picked | red (unchanged) |
| Answered — other wrong | dimmed (unchanged) |

---

## State Changes (`EarTraining.tsx`)

Add one new state variable:

```typescript
const [tentative, setTentative] = useState<number | null>(null);
```

`selected` retains its existing role as the confirmed answer index.

| Event | Effect |
|-------|--------|
| Card tapped | `playOptionAudio(round, i)`, `setTentative(i)` |
| Confirm tapped | `handleConfirm()` — scores using `tentative`, sets `selected = tentative` |
| Next tapped / round advances | reset both `tentative` and `selected` to `null` |

---

## New Audio Helper (`earTraining.ts`)

```typescript
export async function playOptionAudio(round: Round, index: number): Promise<void>
```

- Calls `await initAudio()` before any playback.
- **Chord round:** `playStrum(chordToNotes(round.options[index].chord), '2n')`
- **Interval round:** `playNote(round.options[index].rootNote, '2n')` then after 400 ms `playNote(round.options[index].topNote, '2n')`
- Interval distractor options already carry `rootNote` and `topNote` — no data changes needed.

---

## Files

| File | Change |
|------|--------|
| `src/lib/earTraining.ts` | Add `playOptionAudio(round, index)` |
| `src/pages/EarTraining.tsx` | Add `tentative` state; replace `handleSelect` with `handleTentative` + `handleConfirm`; update card rendering and Confirm/Next button logic |
