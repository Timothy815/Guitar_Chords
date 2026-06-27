# Tuner Enhancements Design

**Goal:** Add a reference tone, three scaffolding modes, and an Hz-reveal toggle to the existing Tuner Simulator page.

---

## Reference Tone

When ▶ is pressed on any string row (or via Play All), the player hears two pitches simultaneously:
1. The **detuned pitch** — `baseHz × 2^(centsOffset/1200)`
2. The **reference pitch** — `baseHz` (exactly 0¢ offset)

The beating phenomenon (amplitude modulation between the two close frequencies) is audible and slows as the user tunes closer. This mirrors the real-world technique of using a pitch pipe, tuning fork, or adjacent string as a reference.

Implementation: call `playTunedString` twice in Tuner.tsx — once with `centsOffset` and once with `0`. The Tone.js Sampler handles polyphony; no changes to `audio.ts` needed.

A **Ref toggle** in the toolbar (default: on) lets the user disable the reference tone for detuned-only listening.

---

## Scaffolding Modes

Three modes selectable via a segmented control in the toolbar. Persisted to `localStorage`.

### Mode 1 — By Ear (`'ear'`)

Minimum visual feedback. The beating phenomenon is the only tuning signal.

**Visible per row:**
- Note label (e.g. "E4")
- Increment buttons (−20 −10 −5 −2 −0.5 / +0.5 +2 +5 +10 +20)
- ▶ Play button

**Hidden per row:**
- Hz display (unless Hz toggle is on — see below)
- Deviation meter
- Cent label (±X.X¢ SHARP/FLAT/IN TUNE)
- Row background color

The "all in tune" celebration (confetti + banner) still fires as end-state feedback.

### Mode 2 — Color + Arrow (`'color'`)

Directional hint without numbers.

**Visible per row:**
- Note label
- Row background tint: red (|offset| > 10¢) → yellow (|offset| 3–10¢) → green (|offset| ≤ 3¢); `dark:` variants required
- Directional indicator: ↑ (sharp, offset > 1.5¢) / ↓ (flat, offset < −1.5¢) / ✓ (in tune, |offset| ≤ 1.5¢)
- Increment buttons
- ▶ Play button

**Hidden per row:**
- Hz display (unless Hz toggle is on)
- Deviation meter bar
- Cent number (±X.X¢) and SHARP/FLAT/IN TUNE text

### Mode 3 — Cents (`'cents'`)

Current full display — unchanged from existing behavior.

**Visible per row (all of):**
- Note label
- Hz display (always shown in this mode regardless of Hz toggle)
- Deviation meter bar
- ±X.X¢ label + SHARP/FLAT/IN TUNE text
- Row background color (existing `getDetuneColors` logic)
- Increment buttons
- ▶ Play button

---

## Hz Toggle

An independent **Hz** button in the toolbar. Works in all three modes.

**When enabled, each row shows two values:**
```
329.6 Hz  →  330.0 Hz target
```
- Left: current detuned Hz (to 1 decimal)
- Right: target Hz at 0¢ (to 1 decimal)

**Default state:** hidden (false).

**In Mode 3 (Cents):** Hz is always shown regardless of toggle (it was already shown in the original design).

---

## Data Model Changes

### New type

```typescript
type ScaffoldMode = 'ear' | 'color' | 'cents';
```

### Updated TunerSettings

```typescript
interface TunerSettings {
  tuning: TuningName;
  detuneWindowCents: number;
  audioMode: 'simultaneous' | 'sequential';
  scaffoldMode: ScaffoldMode;   // NEW — default: 'cents'
  showHz: boolean;              // NEW — default: false
  playReference: boolean;       // NEW — default: true
}
```

### Updated DEFAULT_SETTINGS

```typescript
const DEFAULT_SETTINGS: TunerSettings = {
  tuning: 'Standard',
  detuneWindowCents: 30,
  audioMode: 'simultaneous',
  scaffoldMode: 'cents',
  showHz: false,
  playReference: true,
};
```

`scaffoldMode: 'cents'` ensures existing users see the same experience they already know.

---

## Toolbar Layout (updated)

Left to right:
1. Title — "Tuner Simulator"
2. Tuning dropdown
3. Window buttons — `Subtle | Moderate | Wild`
4. Audio mode toggle — `Simultaneous | Sequential`
5. **Scaffold mode** — `By Ear | Color | Cents` (segmented control)
6. **Ref toggle** — `Ref ●/○` button (on/off)
7. **Hz toggle** — `Hz ●/○` button (on/off)
8. Re-randomize button
9. Play All / Stop button

---

## Play Logic (updated)

```
function playSingleString(realIdx: number):
  playTunedString(strings[realIdx].targetHz, strings[realIdx].centsOffset, '1n')
  if (settings.playReference):
    playTunedString(strings[realIdx].targetHz, 0, '1n')

handlePlayAll (simultaneous mode):
  for each string idx 5→0 staggered ~20ms:
    playTunedString(strings[idx].targetHz, strings[idx].centsOffset, '1n')
    if (settings.playReference):
      playTunedString(strings[idx].targetHz, 0, '1n')

handlePlayAll (sequential mode):
  for each string idx 5→0, await 2000ms between:
    playSingleString(idx)
```

---

## Settings Persistence

`guitar_tuner_settings` in localStorage gains three new keys. Existing stored objects missing the new keys are merged with DEFAULT_SETTINGS on load (spread pattern: `{ ...DEFAULT_SETTINGS, ...parsed }`).

---

## Out of Scope

- Microphone input
- Custom scaffold colors
- Per-string Hz toggle
