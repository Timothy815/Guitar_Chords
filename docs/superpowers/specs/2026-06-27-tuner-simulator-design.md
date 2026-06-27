# Tuner Simulator Design

**Goal:** A dedicated practice tool where the user tunes a randomly out-of-tune virtual guitar by ear, with real-time Hz/cent feedback, 5-level increment controls, and both simultaneous-beating and sequential audio modes.

---

## Architecture

**New files:**
- `src/pages/Tuner.tsx` — full page, self-contained

**Modified files:**
- `src/lib/audio.ts` — add `playTunedString(baseNote: string, centsOffset: number, duration?: string): Promise<void>`
- `src/App.tsx` — add `/tuner` route and nav icon

**Audio approach:** `playTunedString` calculates the detuned frequency as `baseHz × 2^(centsOffset / 1200)` and passes it directly to the existing Tone.js `Sampler.triggerAttack(detuned Hz)`. The sampler pitch-shifts the nearest sample, producing realistic guitar tones with no new audio infrastructure.

**Settings persistence:** Tuning selection, detuning window, and audio mode persist to `localStorage` under the key `guitar_tuner_settings`. Per-string cent offsets are session-only (re-randomized on load and on Re-randomize).

---

## Data Model

### Types

```typescript
type TuningName =
  | 'Standard'
  | 'Drop D'
  | 'Open G'
  | 'Open D'
  | 'DADGAD'
  | 'Half Step Down'
  | 'Full Step Down';

interface TuningDef {
  name: TuningName;
  notes: [string, string, string, string, string, string]; // low E → high E
}

interface StringState {
  targetNote: string;   // e.g. "E2"
  targetHz: number;     // base frequency at 440 Hz reference (A4=440)
  centsOffset: number;  // current user-adjusted offset, range −60 to +60
}

interface TunerSettings {
  tuning: TuningName;
  detuneWindowCents: number;   // 15, 30, or 50
  audioMode: 'simultaneous' | 'sequential';
}
```

`isInTune(s: StringState): boolean` → `Math.abs(s.centsOffset) <= 1.5`

Displayed Hz for each string: `s.targetHz * Math.pow(2, s.centsOffset / 1200)`, shown to 1 decimal place.

### Tunings

All note frequencies use A4 = 440 Hz. The `targetHz` value for each string is stored as a number (pre-calculated constant), not derived at runtime from the note name string, to avoid enharmonic spelling issues (e.g. `Gb3` vs `F#3`) with `Tone.Frequency`.

| Name | String 0 (low E) | 1 | 2 | 3 | 4 | 5 (high E) |
|---|---|---|---|---|---|---|
| Standard | E2 | A2 | D3 | G3 | B3 | E4 |
| Drop D | D2 | A2 | D3 | G3 | B3 | E4 |
| Open G | D2 | G2 | D3 | G3 | B3 | D4 |
| Open D | D2 | A2 | D3 | F#3 | A3 | D4 |
| DADGAD | D2 | A2 | D3 | G3 | A3 | D4 |
| Half Step Down | Eb2 | Ab2 | Db3 | Gb3 | Bb3 | Eb4 |
| Full Step Down | D2 | G2 | C3 | F3 | A3 | D4 |

### Detuning Windows

Three presets, selectable in the toolbar:
- **Subtle** — ±15 cents
- **Moderate** — ±30 cents
- **Wild** — ±50 cents

On randomization each string gets an independent random offset in `[−window, +window]`, clamped so `Math.abs(offset) >= 2` (no string starts accidentally in tune).

### Increment Steps

Five levels per direction: `±0.5`, `±2`, `±5`, `±10`, `±20` cents. All 10 buttons visible per string row. Clicking clamps the result to `[−60, +60]`.

---

## UI Layout

### Top Toolbar

Single row, left to right:
1. **Title** — "Tuner Simulator"
2. **Tuning dropdown** — 7 options
3. **Window buttons** — `Subtle | Moderate | Wild` (segmented control)
4. **Audio mode toggle** — `Simultaneous | Sequential`
5. **Re-randomize button** — reshuffles all string offsets
6. **Play All / Stop button** — plays all 6 strings per the current audio mode

### String Rows

Displayed high E at top, low E at bottom (matches how a guitar sits when held). Six rows, each containing:

| Column | Content |
|---|---|
| String label | Note name (e.g. "E4") and string number |
| Hz display | Current detuned Hz to 1 decimal (e.g. "332.1 Hz") |
| Deviation meter | Horizontal bar, center = 0¢. Left fill = flat, right fill = sharp. Colors: red → yellow → green as it nears ±1.5¢ |
| Cent label | e.g. "+8.3¢ SHARP" / "−11.2¢ FLAT" / "IN TUNE ✓" |
| Decrement buttons | `−20` `−10` `−5` `−2` `−0.5` (left group, larger for gross controls) |
| Increment buttons | `+0.5` `+2` `+5` `+10` `+20` (right group) |
| Play button | ▶ — in Sequential mode plays this string only; in Simultaneous mode plays all 6 |

The ±20 and ±10 buttons are visually heavier (wider, bolder) than ±2 and ±0.5 to reinforce the gross-to-fine ladder.

### In-Tune Celebration

When all 6 strings reach `|offset| <= 1.5¢`:
- All 6 rows turn green
- `canvas-confetti` burst fires
- Banner: "Guitar in tune!" with a **Tune Again** button that re-randomizes

---

## Audio Behavior

### Sequential Mode
The ▶ button on each row (or Play All, which plays string 5 → 0 with ~2000 ms gaps) plays a single string at its current detuned pitch. Duration: ~2 seconds (1n sustain). The 2000 ms gap ensures each note finishes before the next begins.

### Simultaneous Mode
Play All triggers all 6 strings at once (staggered by ~20 ms low→high to simulate a strum). The beating phenomenon — amplitude modulation between closely-tuned pitches — is audible and slows as the string approaches in-tune. A single ▶ button on any row triggers the full strum.

### `playTunedString` implementation

```typescript
export async function playTunedString(
  baseNote: string,
  centsOffset: number,
  duration = '2n'
): Promise<void> {
  await initAudio();
  const baseHz = Tone.Frequency(baseNote).toFrequency();
  const detunedHz = baseHz * Math.pow(2, centsOffset / 1200);
  sampler.triggerAttackRelease(detunedHz, duration);
}
```

---

## Settings Persistence

`guitar_tuner_settings` in `localStorage`:
```json
{
  "tuning": "Standard",
  "detuneWindowCents": 30,
  "audioMode": "simultaneous"
}
```

Loaded on mount; saved on any settings change. String offsets are not persisted.

---

## Navigation

- Route: `/tuner`
- Nav icon: `<Gauge>` from `lucide-react`
- Nav title tooltip: "Tuner"

---

## Out of Scope

- Microphone input / real guitar detection (future)
- Custom tunings beyond the 7 listed
- Scoring or session history
