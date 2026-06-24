# Sing-Then-Find — Design Spec

## Goal

Add a "Sing" sub-mode to fretboard ear training that forces the user to audiate and sing or hum the target note before they can interact with the fretboard. This builds the ear-to-hand connection by breaking the "hear → immediately click" reflex and replacing it with an internalize-first habit.

## Scope

- **Applies to:** Fretboard mode only.
- **Sub-mode:** `'sing'` is a third value alongside `'guess'` and `'hunt'` in `fretboardSubMode`.
- **Grading:** Identical to Guess mode — octave-precise, wrong answer triggers comparative playback.
- **Replay:** Available at all times, including while locked. The user can re-hear the note while audiating, then click Ready when ready to guess.
- **Drone:** All existing drone modes (Off / Continuous / Cue) work identically in Sing mode.

## Architecture

Two files change. No new files.

**`src/pages/EarTraining.tsx`:**
- `fretboardSubMode` type extended: `'guess' | 'hunt' | 'sing'`
- "Sing" button added to the Guess / Hunt button row in the settings panel
- `singMode={fretboardSubMode === 'sing'}` passed as a new boolean prop to `<FretboardTrainer>`

**`src/components/FretboardTrainer.tsx`:**
- New `singMode?: boolean` prop added to `FretboardTrainerProps`
- New local `locked` state (`boolean`, default `true`), reset to `true` on every round change via the existing `useEffect([round])`
- When `singMode && locked`: fret clicks blocked (early return in `handleFretClick` and `handleFretMouseDown`), locked overlay rendered over the fretboard
- When `locked` becomes `false`: fretboard behaves exactly like Guess mode

The `locked` state lives in `FretboardTrainer` because it is round-level interaction state that resets per round — the same reason `wrongPosition`, `isRevealing`, and `noteRevealed` live there.

## Round Flow

1. New round starts → `locked` resets to `true` → target note plays automatically (same as Guess)
2. Fretboard renders with locked overlay: "Sing or hum the note, then tap Ready"
3. Replay button is visible and functional during lock
4. User clicks **Ready** → `setLocked(false)` → overlay disappears
5. Fretboard is fully interactive — grading, comparative playback, and scoring are identical to Guess mode

## Locked Overlay

Rendered as a `div` with `absolute inset-0` positioned over the fretboard container. The fretboard's wrapping `div` in `FretboardTrainer` does not currently have `relative` — it must be added as part of this change. The overlay uses `bg-brand-bg/80` (semi-transparent brand background) and centers its content vertically and horizontally.

Overlay content:
```
Sing or hum the note, then tap Ready
        [ Ready ]
```

- Text: `text-sm text-brand-secondary`
- Ready button: same pill style as the Confirm button in Hunt mode — `bg-brand-primary text-white` active state, `px-6 py-2 rounded-lg font-medium`

## Settings Panel — Sing Button

The existing Guess / Hunt row:
```
[Guess]  [Hunt]
```
Becomes:
```
[Guess]  [Hunt]  [Sing]
```

Clicking Sing calls `setFretboardSubMode('sing')` then `advanceRound()` inline — the same pattern used by the existing Guess difficulty buttons. No difficulty is forced; the current difficulty remains. Difficulty and focus selectors are unchanged.

Active state styling matches the existing Guess and Hunt pills:
- Active (this sub-mode selected): `border-brand-primary text-brand-primary bg-brand-primary/10`
- Inactive: `border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary`

## Out of Scope

- Microphone input or pitch detection (no browser audio capture)
- A "sing-along" timer or countdown
- Applying the locked workflow to Hunt mode
- Persisting the Sing sub-mode selection across sessions
