# Chord Sheet Export Design

## Goal

Add a printable chord sheet to the Progressions page that shows a chord diagram grid (fretboard + standard notation + tab) and/or a bar-by-bar lead chart, with a toggle to control which sections print.

## Architecture

A new `ChordSheet` component owns all chord sheet rendering. `Progressions.tsx` passes the active progression and its key into `ChordSheet` and renders it inside the existing `print-area` div. VexFlow renders staff + tab notation for each unique chord. The lead chart is pure HTML/CSS.

## Tech Stack

- **VexFlow** (`vexflow` npm package) — staff and tab notation rendering into SVG via `useEffect` + `ref`
- **React 19 + TypeScript** — existing stack
- **Tailwind CSS v4** — existing styling
- **`handlePrint('print-area')`** — existing print utility, unchanged

---

## Global Constraints

- No new routes; all rendering stays within the Progressions page print-area
- VexFlow renders into a `div` ref; no server-side rendering
- Key signature auto-derived from the progression's `key` field — no user picker
- Time signature: fixed 4/4, no UI to change it
- Lead chart: one chord per bar, 4 bars per line
- Chord cards: deduplicated — each unique chord name appears once
- All chord sheet UI (toggles, preview modal) is `print:hidden`; only the sheet itself prints
- Existing `Print` button and `handlePrint` call are unchanged
- `Progressions.tsx` must not grow significantly — chord sheet logic lives in `ChordSheet.tsx`

---

## Components & Files

### Modified: `src/types.ts`

Add `key` field to the `Progression` interface:

```typescript
export interface Progression {
  id: string;
  name: string;
  bpm: number;
  key: string;    // root note, e.g. "C", "G", "F#" — defaults to "C" for existing progressions
  slots: ChordSlot[];
}
```

`Progressions.tsx` already has a key selector (used for diatonic chord suggestions). That selector value is written to `progression.key` on change and read back on load. Existing saved progressions without a `key` field default to `"C"` at load time.

### New: `src/components/ChordSheet.tsx`

The entire chord sheet rendering component. Receives:

```typescript
interface ChordSheetProps {
  progression: Progression;        // from types.ts — has .slots[], .name, .key
  showDiagrams: boolean;
  showChart: boolean;
}
```

Renders two sections (each conditional on its toggle):

1. **Diagram grid** — `ChordCard` subcomponent per unique chord
2. **Lead chart** — bar grid with chord names

### New: `src/components/ChordCard.tsx`

Renders a single chord card:
- Chord name heading
- `<Fretboard>` component (existing, `showNoteNames={false}`, `pointer-events-none`)
- VexFlow staff + tab div (rendered via `useEffect`)

```typescript
interface ChordCardProps {
  chord: ChordShape;
  progressionKey: string;   // from progression.key
}
```

### Modified: `src/pages/Progressions.tsx`

- Add `showDiagrams`, `showChart` boolean state (both default `true`)
- Add `showChordSheetModal` boolean state
- Add **"Chord Sheet"** button next to existing Print button — opens the modal
- Add `ChordSheetModal` inline component (toggle switches + live preview + Print button)
- Render `<ChordSheet>` inside `print-area` div below the existing chord card row, controlled by `showDiagrams`/`showChart` props
- The existing progression chord card row gets `print:hidden` when chord sheet mode is active (to avoid double-printing)

---

## Feature Details

### Chord Sheet Modal

Triggered by a new "Chord Sheet" button (outline style, `FileText` icon from lucide-react).

Modal contents:
- Title: "Print Chord Sheet"
- Toggle row: **Chord Diagrams** (on/off) | **Lead Chart** (on/off) — at least one must be on
- Live preview: renders `<ChordSheet>` at reduced scale (`scale-75 origin-top`) inside a scrollable preview area
- Bottom row: Cancel button | Print button (calls `handlePrint('print-area')`)

### VexFlow Staff + Tab Rendering

Each `ChordCard` derives the chord's notes from `chord.frets` + `STANDARD_TUNING` using the existing `getFretNote` utility, filters out muted strings (`fret === -1`), and passes the resulting note array to VexFlow.

VexFlow render target: a `<div ref={vexRef}>` inside ChordCard. Rendered in `useEffect` on mount (and when `chord` changes).

VexFlow output: one `Stave` (treble clef + key signature) with a single `StaveNote` (chord voicing, all notes stacked), followed by one `TabStave` with a `TabNote` encoding string/fret pairs.

Key signature string is derived from `progressionKey` (e.g. `"G"` → `"G"` in VexFlow's key signature notation). Flat roots use VexFlow's flat key notation (`"Bb"` → `"Bb"`).

Muted strings are excluded from both the staff note and the tab note. Open strings (fret 0) are included.

### Lead Chart

Rendered as a CSS grid. Each cell is one bar:
- Top: chord name in bold (`font-serif`, large)
- Bottom: bar line on the right edge (CSS border)
- Lines of 4 bars, wrapping naturally

First bar of the first line prepends a key signature label (e.g. "Key of G") as small text above the chord name.

Header row above the chart shows: progression name (left) + "4/4" time signature glyph (right).

### Print Layout

When printed:
- Sheet title (progression name) at top
- If `showDiagrams`: chord card grid — 3 cards per row, `break-inside-avoid` on each card
- If `showChart`: lead chart below diagrams (or alone if diagrams off)
- All interactive UI (`print:hidden`) disappears

---

## Data Flow

```
Progressions.tsx
  → activeProgression (Progression)
  → showDiagrams, showChart (boolean toggles)
  ↓
ChordSheet.tsx
  → deduplicates slots by chord.name
  → renders ChordCard[] for diagram section
  → renders bar grid for chart section
  ↓
ChordCard.tsx
  → Fretboard component (existing)
  → VexFlow render (useEffect)
    → getFretNote() per string
    → StaveNote (treble clef)
    → TabNote (tab staff)
```

---

## Out of Scope

- Lyrics/melody lines above the chart
- Tempo or dynamic markings
- Export to PDF (browser print-to-PDF covers this)
- Multiple time signatures
- Manual key signature override
- Sharing or saving the sheet as an image
