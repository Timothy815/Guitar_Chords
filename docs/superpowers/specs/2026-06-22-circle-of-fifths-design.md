# Circle of Fifths — Design Spec

## Goal

Add a `/circle` page to GuitarMaster that lets users explore the Circle of Fifths interactively: click any key to see its diatonic chords, hear them played, and view fretboard diagrams — all in one place.

## User Flow

1. User navigates to `/circle` via the sidebar nav.
2. The SVG Circle of Fifths is shown. Each of the 12 wedges shows the major key, relative minor, and key signature count.
3. Clicking a wedge selects that key. The wedge highlights.
4. A diatonic chord panel appears below with 7 Roman numeral buttons (I–vii°).
5. Clicking a button plays the chord, highlights the button, and shows a Fretboard diagram for the first matching shape from `COMMON_CHORDS`.
6. A "View all [key] chords in Dictionary →" link at the bottom navigates to `/dictionary`.

---

## Architecture

### New files

- `src/components/CircleOfFifths.tsx` — self-contained SVG circle component
- `src/pages/Circle.tsx` — page that composes the circle, chord panel, and routing

### Modified files

- `src/App.tsx` — add `/circle` route
- `src/components/Layout.tsx` — add "Circle" nav entry

### No new dependencies required

Uses existing: React state, SVG, `COMMON_CHORDS` from `guitarData.ts`, `Fretboard` component, `playStrum`/`initAudio` from `audio.ts`, `ALL_NOTES`, `useNavigate` from React Router.

---

## CircleOfFifths Component

**Props:**
```typescript
interface CircleOfFifthsProps {
  selectedKey: Note | null;
  onKeySelect: (key: Note) => void;
  className?: string;
}
```

**SVG layout:**
- `viewBox="0 0 400 400"`, center `(200, 200)`
- Outer ring radius: 60–175px (wedge bodies, major key labels)
- Inner ring radius: 30–60px (relative minor + key sig labels)
- Center circle radius: 30px (decorative, no interaction)

**12 wedge segments** — clockwise from top, 30° each:

| Position | Major | Relative Minor | Key Sig |
|----------|-------|----------------|---------|
| 0 (top)  | C     | Am             | 0       |
| 1        | G     | Em             | 1♯      |
| 2        | D     | Bm             | 2♯      |
| 3        | A     | F#m            | 3♯      |
| 4        | E     | C#m            | 4♯      |
| 5        | B     | G#m            | 5♯      |
| 6        | F#    | D#m            | 6♯/6♭  |
| 7        | Db    | Bbm            | 5♭      |
| 8        | Ab    | Fm             | 4♭      |
| 9        | Eb    | Cm             | 3♭      |
| 10       | Bb    | Gm             | 2♭      |
| 11       | F     | Dm             | 1♭      |

**Wedge geometry** (SVG arc path per segment):
- `startAngle = i * 30 - 90` degrees (so C lands at top)
- Outer arc at r=175, inner arc at r=60
- Path: `M outer-start A outer-arc outer-end L inner-end A inner-arc(reversed) inner-start Z`

**Colors:**
- Selected: `fill="var(--color-brand-active)"`, text `fill="white"`
- Unselected: `fill="var(--color-brand-surface)"`, text `fill="var(--color-brand-ink)"`
- Hover: `fill="var(--color-brand-sidebar)"`
- Stroke: `stroke="var(--color-brand-line)"`, `strokeWidth={1}`

**Text in each wedge:**
- Major key name: large (~14px bold), placed at r≈135 from center at wedge midpoint angle
- Relative minor: smaller (~9px), at r≈105
- Key signature: tiny (~8px), at r≈80

**Inner ring** (r=30–60): solid `var(--color-brand-fretborder)` fill, no interaction, decorative.

---

## Circle.tsx Page

**State:**
```typescript
const [selectedKey, setSelectedKey] = useState<Note>('C');
const [selectedDegree, setSelectedDegree] = useState<number | null>(null);
```

**Diatonic chord data:**

Major scale intervals and chord qualities:
```typescript
const DIATONIC_DEGREES = [
  { roman: 'I',    interval: 0,  quality: 'Major',     label: (root: Note) => `${root} Major`   },
  { roman: 'ii',   interval: 2,  quality: 'Minor',     label: (root: Note) => `${noteAt(root,2)} Minor` },
  { roman: 'iii',  interval: 4,  quality: 'Minor',     label: (root: Note) => `${noteAt(root,4)} Minor` },
  { roman: 'IV',   interval: 5,  quality: 'Major',     label: (root: Note) => `${noteAt(root,5)} Major` },
  { roman: 'V',    interval: 7,  quality: 'Major',     label: (root: Note) => `${noteAt(root,7)} Major` },
  { roman: 'vi',   interval: 9,  quality: 'Minor',     label: (root: Note) => `${noteAt(root,9)} Minor` },
  { roman: 'vii°', interval: 11, quality: 'dim',       label: (root: Note) => `${noteAt(root,11)}°`    },
];
```

Where `noteAt(root, semitones) = ALL_NOTES[(ALL_NOTES.indexOf(root) + semitones) % 12]`.

**Chord lookup:**
```typescript
function getDiatonicChord(key: Note, degreeInterval: number, quality: string): ChordShape | null {
  const degreeRoot = ALL_NOTES[(ALL_NOTES.indexOf(key) + degreeInterval) % 12];
  const chords = COMMON_CHORDS[degreeRoot] ?? [];
  if (quality === 'Major') return chords.find(c => c.name.includes('Major')) ?? null;
  if (quality === 'Minor') return chords.find(c => c.name.includes('Minor')) ?? null;
  return null; // dim: no shape available
}
```

**Layout (top to bottom):**
1. Page heading: "Circle of Fifths" (h1, serif)
2. Subtitle explaining key relationships
3. `<CircleOfFifths>` (centered, max-w-sm mx-auto)
4. Selected key heading: "{key} Major — Diatonic Chords"
5. 7 Roman numeral buttons in a flex-wrap row
6. Selected degree chord: `<Fretboard>` diagram (below buttons)
7. "View all {key} chords in Dictionary →" link (`useNavigate('/dictionary')`)

**Roman numeral button styling:**
- Major degrees (I, IV, V): `bg-brand-active text-white` when selected, `bg-brand-surface border` when not
- Minor degrees (ii, iii, vi): `bg-brand-secondary/20 text-brand-ink border` style
- dim (vii°): disabled, `opacity-40 cursor-not-allowed`
- Button shows roman numeral + note name on two lines: `I` / `C Maj`

**Audio:** `await initAudio()` then `playStrum(notes, 2, 'down')` on degree button click. Notes derived from `activeChord.frets` via `getFretNote`.

---

## Routing & Navigation

**`src/App.tsx`** — add route:
```tsx
import { Circle } from './pages/Circle';
// ...
<Route path="/circle" element={<Circle />} />
```

**`src/components/Layout.tsx`** — add nav item alongside existing Dictionary/CAGED/Progressions entries. Icon: use `CircleDot` or `Music` from `lucide-react`. Label: "Circle of 5ths".

---

## Enharmonic Mapping

The circle displays flat-side keys using conventional flat spellings (`Db`, `Ab`, `Eb`, `Bb`, `F#/Gb`), but `COMMON_CHORDS` and `ALL_NOTES` use sharp spellings exclusively (`C#`, `G#`, `D#`, `A#`, `F#`). Chord lookups must convert display labels to `Note` type before indexing into `COMMON_CHORDS`:

```typescript
const ENHARMONIC: Partial<Record<string, Note>> = {
  'Db': 'C#', 'Ab': 'G#', 'Eb': 'D#', 'Bb': 'A#', 'Gb': 'F#',
};
function toNote(display: string): Note {
  return (ENHARMONIC[display] ?? display) as Note;
}
```

`selectedKey` state stores the `Note` (sharp) spelling. The circle wedge data maps position → display label (e.g. `'Db'`) and the `Note` value (e.g. `'C#'`) separately.

---

## Constraints

- No new dependencies
- `@` alias resolves to project root; use relative imports inside `src/`
- Tailwind v4 — brand CSS variables only (no `tailwind.config.js`)
- `BrowserRouter basename="/Guitar_Chords"` — all `useNavigate` calls use paths without the basename (e.g. `'/dictionary'`, not `'/Guitar_Chords/dictionary'`)
- `initAudio()` must be awaited on every user gesture before any `playStrum` call
- `COMMON_CHORDS` keys are `Note` type (chromatic pitch class, e.g. `'C'`, `'C#'`, not `'Db'`) — use `ALL_NOTES` array for lookups, not enharmonic strings
- No test suite — verification is `npm run lint` + visual browser check
- The vii° button is always disabled (no diminished shapes in `COMMON_CHORDS`); it is shown so users understand the full diatonic system
