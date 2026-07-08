# Triad Explorer — Design Spec
**Date:** 2026-07-07

## Overview

A new dedicated page (`/triads`) for exploring chord tones across the neck, linked to a chord progression for live improvisation practice. The core pedagogical concept is chord-tone targeting: knowing exactly where the root, 3rd, 5th, and 7th of any chord live on the neck so a player can target those tones while soloing rather than running scales blindly.

---

## Route & Navigation

- **Route:** `/triads` → `src/pages/Triads.tsx`
- **Nav icon:** `Target` from lucide-react, added to the header in `App.tsx`
- **localStorage key prefix:** `triads_` for all persisted state

---

## Page Layout

Three vertical zones, stacked top to bottom (Layout A):

### 1. Toolbar (top strip)
Left to right:
- **Key selector** — chromatic root picker (A through G#, 12 notes)
- **Quality selector** — dropdown with all 15 qualities grouped (see Data Layer)
- **String group filter** — pill buttons: All · E·A·D · A·D·G · D·G·B · G·B·E
- **Scale toggle** — ON/OFF button; when ON, shows a scale selector (root + scale type using `COMMON_SCALES` from `guitarData.ts`)

### 2. Fretboard (main area)
- Full neck, `fretsNum=15`
- Chord tone dots rendered via `drillDots` prop (extended with optional `color` field)
- Scale overlay rendered via `scalePositions` prop with dimmed/low-opacity styling when scale is ON
- No `chord` or `scale` props used — all rendering is driven by computed `drillDots` and `scalePositions`
- String group filter hides chord tone dots on non-selected strings; scale overlay on those strings dims further

### 3. Progression strip (bottom dock)
- Always visible horizontal row of chord cards
- Play controls on the far left: Play/Stop button, BPM input, beats-per-chord selector (1/2/4/8, default 4), loop toggle
- Import button pulls from saved progressions in `localStorage`
- Add (+) button appends a new chord card
- Active chord card highlighted with a pulsing border during playback

---

## Data Layer — `src/data/triadData.ts`

### Chord qualities (15 total)

```ts
export const CHORD_TONE_QUALITIES: Record<string, { label: string; intervals: number[] }> = {
  // Triads
  major:   { label: 'Major',    intervals: [0, 4, 7] },
  minor:   { label: 'Minor',    intervals: [0, 3, 7] },
  dim:     { label: 'Dim',      intervals: [0, 3, 6] },
  aug:     { label: 'Aug',      intervals: [0, 4, 8] },
  // 7ths
  dom7:    { label: 'Dom 7',    intervals: [0, 4, 7, 10] },
  maj7:    { label: 'Maj 7',    intervals: [0, 4, 7, 11] },
  min7:    { label: 'Min 7',    intervals: [0, 3, 7, 10] },
  minmaj7: { label: 'Min Maj7', intervals: [0, 3, 7, 11] },
  m7b5:    { label: 'm7b5',     intervals: [0, 3, 6, 10] },
  dim7:    { label: 'Dim 7',    intervals: [0, 3, 6, 9]  },
  aug7:    { label: 'Aug 7',    intervals: [0, 4, 8, 10] },
  augmaj7: { label: 'Aug Maj7', intervals: [0, 4, 8, 11] },
  // Sus
  sus2:    { label: 'Sus 2',    intervals: [0, 2, 7] },
  sus4:    { label: 'Sus 4',    intervals: [0, 5, 7] },
  sus4dom7:{ label: '7sus4',    intervals: [0, 5, 7, 10] },
};
```

### Tone role labels

Each interval maps to a display label:

| Interval | Label |
|---|---|
| 0 | R |
| 2 | 2 |
| 3 | b3 |
| 4 | 3 |
| 5 | 4 |
| 6 | b5 |
| 7 | 5 |
| 8 | #5 |
| 9 | bb7 |
| 10 | b7 |
| 11 | maj7 |

### Tone role colors

| Role | Color |
|---|---|
| Root (interval 0) | Red (`#e74c3c`) |
| 3rd (intervals 3, 4) | Blue (`#2980b9`) |
| 5th (intervals 6, 7, 8) | Green (`#27ae60`) |
| 7th (intervals 9, 10, 11) | Purple (`#8e44ad`) |
| Sus tones (intervals 2, 5) | Orange (`#e67e22`) |

### Chord tone computation

`generateChordToneDots(root: Note, qualityKey: string, stringGroupFilter: StringGroup): ChordToneDot[]`

- Standard tuning open pitches: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
- For each string (0–5) × fret (0–15): compute `(openPitch + fret - rootMidi) % 12`
- If it matches an interval in the quality, emit a dot: `{ stringIdx, fret, label, color }`
- If `stringGroupFilter !== 'all'`, exclude dots whose `stringIdx` is outside the active group's 3 strings
- String groups: E·A·D = [0,1,2], A·D·G = [1,2,3], D·G·B = [2,3,4], G·B·E = [3,4,5]

### Scale overlay computation

`generateScalePositions(root: Note, scaleDef: ScaleDef): Set<string>`

Calls the existing `generateScalePattern(root, scaleDef)` from `guitarData.ts`, then iterates its `positions` array to build a `Set<string>` of `"stringIdx-fret"` strings — the same format Fretboard's `scalePositions` prop expects. The scale root can differ from the chord root (e.g. C Major scale over an Am chord).

---

## Fretboard Component Change

`src/components/Fretboard.tsx` — minimal targeted change:

```ts
// drillDots entry — add optional color field
drillDots?: { stringIdx: number; fret: number; label: string; highlight?: boolean; color?: string }[];
```

In the render: if `dot.color` is present, use it as the circle fill instead of the default highlight color. This is the only change to `Fretboard.tsx`.

---

## Progression Builder

### Inline builder
Each chord card contains:
- Root selector (chromatic dropdown, A–G#)
- Quality selector (same 15-quality dropdown)
- Remove (×) button

Cards are stored as `{ root: Note; qualityKey: string }[]` in state, persisted to `localStorage`.

### Import from Progressions
- Import button opens a modal listing all progressions saved in `localStorage` under the Progressions page key
- Each saved progression is a `ChordShape[]` — root is taken directly from `ChordShape.root`, quality is inferred by matching the chord name string against the 15 quality labels (e.g. `"C Minor"` → `minor`, `"G Dom 7"` → `dom7`)
- Unrecognised qualities default to `major`
- Imported chords populate the strip and become fully editable

### Playback
- Calls `initAudio()` on first play (browser autoplay policy)
- Looks up each chord's voicing via `COMMON_CHORDS[root]`, matching by quality keyword in the chord name (e.g. `dom7` → prefers a shape whose name contains "7"); falls back to the nearest triad (Major/Minor/dim) when an exact match isn't found — provides harmonic context while soloing
- Calls `playProgressionWithPatterns` with `onChordChange` callback
- `onChordChange(idx)` → sets `activeChordIdx` state → toolbar key/quality and fretboard re-render instantly with the new chord's dots
- BPM and beats-per-chord determine slot duration: `60 / bpm * beatsPerChord` seconds per chord
- Loop toggle passes `loop: true` to `playProgressionWithPatterns`
- Stop calls the cleanup function returned by `playProgressionWithPatterns`

### Scale during playback
The scale overlay is fixed for the entire progression — it does not auto-change per chord. The player sets it once to match their intended tonal center (e.g. C Major for a I-vi-IV-V in C).

---

## State & Persistence

All state persisted to `localStorage`:

| Key | Value |
|---|---|
| `triads_progression` | `{ root, qualityKey }[]` |
| `triads_bpm` | number (default 80) |
| `triads_beatsPerChord` | 1 \| 2 \| 4 \| 8 (default 4) |
| `triads_loop` | boolean (default true) |
| `triads_key` | Note (default 'C') |
| `triads_quality` | qualityKey string (default 'major') |
| `triads_scaleOn` | boolean (default false) |
| `triads_scaleRoot` | Note (default 'C') |
| `triads_scaleType` | scale name string (default 'Major') |
| `triads_stringGroup` | 'all' \| 'EAD' \| 'ADG' \| 'DGB' \| 'GBE' (default 'all') |

---

## Out of Scope

- Per-chord scale auto-suggestion (e.g. Dorian over min7) — user sets scale manually
- Inversion-specific highlighting (root position vs 1st vs 2nd inversion) — color is by tone role, not inversion
- Audio playback of individual chord tone dots on click (could be a future enhancement)
- Mobile-specific layout (follows existing app responsive conventions)
