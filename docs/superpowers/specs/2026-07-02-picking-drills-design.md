# Picking Drills Design

**Goal:** Extend the Technique page with right-hand picking and fingerpicking drills — alternate picking, economy picking, PIMA, and Travis picking — using the same BPM ladder + self-report trainer model as the existing fretting-hand drills.

---

## Global Constraints

- Modified files: `src/data/drillData.ts`, `src/pages/Technique.tsx`
- No new files, no new dependencies
- `npm run lint` (tsc --noEmit) must pass with zero errors
- All new drills use the same localStorage persistence key: `guitarmaster_drill_bests`
- No audio detection — progression is self-reported via "Got it clean"
- Fretting-hand drills (existing 15) are unchanged except for the addition of `hand: 'fretting'`

---

## Data Model Changes

### DrillStep — finger becomes optional, pick is added

```ts
export interface DrillStep {
  stringIdx: number;
  fret: number;
  finger?: 1 | 2 | 3 | 4;                              // optional — absent on open-string picking drills
  pick?: 'down' | 'up' | 'p' | 'i' | 'm' | 'a';       // picking annotation — absent on fretting-only drills
}
```

Making `finger` optional is backward-compatible — all existing values (`1 | 2 | 3 | 4`) still satisfy `finger?: 1 | 2 | 3 | 4`.

### Drill — hand field and extended category union

```ts
export interface Drill {
  id: string;
  hand: 'fretting' | 'picking';
  category: 'chromatic' | 'spider' | 'legato' | 'stretch'
           | 'alternate' | 'economy' | 'pima' | 'travis';
  name: string;
  description: string;
  safetyNote?: string;
  steps: DrillStep[];
  startFret: number;
  bpmStart: number;
  bpmTarget: number;
  bpmStep: number;
}
```

All 15 existing drills receive `hand: 'fretting'` added to their object literals. No other changes.

---

## Page Structure Changes (`Technique.tsx`)

### Tab type split

```ts
type FrettingCategory = 'chromatic' | 'spider' | 'legato' | 'stretch';
type PickingCategory  = 'alternate' | 'economy' | 'pima' | 'travis';
type Category = FrettingCategory | PickingCategory;

const FRETTING_CATEGORIES: FrettingCategory[] = ['chromatic', 'spider', 'legato', 'stretch'];
const PICKING_CATEGORIES:  PickingCategory[]  = ['alternate', 'economy', 'pima', 'travis'];
```

### Two-row tab layout

Replace the single tab row with two labeled rows. Each row has a left-aligned group label and its own tab set. Active tab styling (border-b-2, brand-primary) is identical to today.

```
Fretting Hand  [ Chromatic ] [ Spider ] [ Legato ] [ Stretch ]
Picking Hand   [ Alternate ] [ Economy ] [ PIMA ] [ Travis ]
```

The `activeTab` state type changes from `Category` restricted to the old 4 to the full new `Category` union. Switching any tab (either row) still clears `selectedDrillId` and stops the click track.

### Category labels and descriptions

```ts
const CATEGORY_LABELS: Record<Category, string> = {
  chromatic: 'Chromatic',
  spider: 'Spider',
  legato: 'Legato',
  stretch: 'Stretch',
  alternate: 'Alternate',
  economy: 'Economy',
  pima: 'PIMA',
  travis: 'Travis',
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  chromatic: 'Finger independence across all strings',
  spider: 'Cross-string coordination and string crossing',
  legato: 'Hammer-on and pull-off strength',
  stretch: 'Reach and fret-span conditioning',
  alternate: 'Strict down-up pick alternation',
  economy: 'Sweep through string changes — no wasted motion',
  pima: 'Classical right-hand fingerpicking patterns',
  travis: 'Alternating thumb bass with melody fingers',
};
```

### drillDots mapping — finger becomes optional

```ts
const drillDots = selectedDrill
  ? selectedDrill.steps.map(s => ({
      stringIdx: s.stringIdx,
      fret: s.fret,
      label: s.finger ? String(s.finger) : '',   // empty label = unlabeled filled dot
    }))
  : [];
```

### Picking annotation strip

Rendered above the `<Fretboard>` inside the trainer panel when the selected drill has any `pick` annotations. Shows each step's pick symbol in sequence as a horizontal scrollable row of badges.

```tsx
{selectedDrill.steps.some(s => s.pick) && (
  <div className="overflow-x-auto">
    <div className="flex gap-1 pb-1 min-w-max">
      {selectedDrill.steps.map((s, i) =>
        s.pick ? (
          <span
            key={i}
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0',
              s.pick === 'down' || s.pick === 'up'
                ? 'bg-brand-surface border border-brand-line text-brand-ink'
                : 'bg-brand-primary/10 text-brand-primary',
            )}
          >
            {s.pick === 'down' ? '↓' : s.pick === 'up' ? '↑' : s.pick}
          </span>
        ) : null
      )}
    </div>
  </div>
)}
```

`↓` / `↑` badges: neutral (brand-surface background, brand-ink text) — indicates pick strokes.
`p` / `i` / `m` / `a` badges: brand-primary tint — indicates right-hand finger.

The strip only appears for picking drills. For fretting drills (no `pick` fields), `steps.some(s => s.pick)` is false and the strip is absent.

---

## Drill Content

### Alternate Picking (4 drills) — `hand: 'picking'`, `startFret: 5`, `bpmStart: 50`, `bpmTarget: 120`, `bpmStep: 5`

#### `alt-single-string` — Single-String Alternate
Description: Down-up on one string. The foundational alternate picking drill.
Steps (4 steps, D string):
```ts
[
  { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 2, fret: 6, finger: 2, pick: 'up' },
  { stringIdx: 2, fret: 7, finger: 3, pick: 'down' },
  { stringIdx: 2, fret: 8, finger: 4, pick: 'up' },
]
```

#### `alt-crossing-asc` — String Crossing Ascending
Description: One note per string from low E to high E. Pick direction never resets at string changes.
Steps (6 steps):
```ts
[
  { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
]
```

#### `alt-crossing-desc` — String Crossing Descending
Description: One note per string from high e to low E. Descending direction exposes reverse-pick weakness.
Steps (6 steps):
```ts
[
  { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
]
```

#### `alt-3nps` — Three Notes Per String
Description: Three fretted notes per string before crossing — the hardest alternate-picking coordination challenge. Pick direction alternates continuously; the starting direction on each new string depends on total note count.
bpmStart: 40, bpmTarget: 100.
Steps (18 steps — 3 per string × 6 strings):
```ts
// pick alternates ↓↑↓ | ↑↓↑ | ↓↑↓ | ↑↓↑ | ↓↑↓ | ↑↓↑
const picks: Array<'down'|'up'> = ['down','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up'];
[
  { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 0, fret: 6, finger: 2, pick: 'up' },
  { stringIdx: 0, fret: 7, finger: 3, pick: 'down' },
  { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 1, fret: 6, finger: 2, pick: 'down' },
  { stringIdx: 1, fret: 7, finger: 3, pick: 'up' },
  { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 2, fret: 6, finger: 2, pick: 'up' },
  { stringIdx: 2, fret: 7, finger: 3, pick: 'down' },
  { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 3, fret: 6, finger: 2, pick: 'down' },
  { stringIdx: 3, fret: 7, finger: 3, pick: 'up' },
  { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 4, fret: 6, finger: 2, pick: 'up' },
  { stringIdx: 4, fret: 7, finger: 3, pick: 'down' },
  { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 5, fret: 6, finger: 2, pick: 'down' },
  { stringIdx: 5, fret: 7, finger: 3, pick: 'up' },
]
```

---

### Economy Picking (3 drills) — `hand: 'picking'`, `startFret: 5`, `bpmStart: 40`, `bpmTarget: 100`, `bpmStep: 5`

#### `eco-ascending` — Ascending Economy
Description: One note per string ascending. No direction reversal on string change — consecutive ↓↓ when moving to a higher string.
Steps (6 steps):
```ts
[
  { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
  { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
]
```

#### `eco-descending` — Descending Economy
Description: One note per string descending. Consecutive ↑↑ on string changes going down.
Steps (6 steps):
```ts
[
  { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
  { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
]
```

#### `eco-sweep-3` — 3-String Sweep
Description: Continuous sweep across 3 adjacent strings in one direction. The foundation of sweep picking.
bpmStart: 30, bpmTarget: 80.
Steps (3 steps):
```ts
[
  { stringIdx: 0, fret: 7, finger: 1, pick: 'down' },
  { stringIdx: 1, fret: 7, finger: 1, pick: 'down' },
  { stringIdx: 2, fret: 7, finger: 1, pick: 'down' },
]
```

---

### PIMA Fingerpicking (6 drills) — `hand: 'picking'`, `startFret: 0`, `bpmStart: 40`, `bpmTarget: 100`, `bpmStep: 5`

All open-string drills: `finger` absent on all steps, `fret: 0` on all steps.
All chord drills: use G chord shape — stringIdx 0 fret 3 finger 2, stringIdx 1 fret 2 finger 1, stringIdx 2 fret 0, stringIdx 3 fret 0, stringIdx 4 fret 0, stringIdx 5 fret 3 finger 3.

#### `pima-open-pima` — p-i-m-a Open Strings
Description: Classical ascending arpeggio — thumb on bass, then three treble fingers in sequence. The entry point for classical fingerpicking.
Steps (8 steps — 2 cycles with alternating bass):
```ts
[
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 5, fret: 0, pick: 'a' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 5, fret: 0, pick: 'a' },
]
```

#### `pima-open-pami` — p-a-m-i Open Strings
Description: Descending arpeggio from high e back down. Builds reverse independence.
Steps (8 steps — 2 cycles):
```ts
[
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'a' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'a' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 3, fret: 0, pick: 'i' },
]
```

#### `pima-open-pimi` — p-i-m-i Open Strings
Description: Middle finger returns between each note — a common classical pattern that builds middle-finger agility.
Steps (8 steps — 2 cycles):
```ts
[
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 3, fret: 0, pick: 'i' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 3, fret: 0, pick: 'i' },
]
```

#### `pima-chord-pima` — p-i-m-a Over G Chord
Description: Same ascending arpeggio pattern over a G chord shape. Builds pattern muscle memory with real chord context.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
]
```

#### `pima-chord-pami` — p-a-m-i Over G Chord
Description: Descending arpeggio over G chord.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
]
```

#### `pima-chord-pimi` — p-i-m-i Over G Chord
Description: Alternating middle pattern over G chord.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 3, fret: 0,            pick: 'i' },
]
```

---

### Travis Picking (4 drills) — `hand: 'picking'`, `startFret: 0`, `bpmStart: 40`, `bpmTarget: 100`, `bpmStep: 5`

Travis picking: thumb alternates between two bass strings on every beat; index and middle fill melody notes on the off-beats.

#### `travis-open-basic` — Travis Basic Open Strings
Description: Alternating thumb bass (low E / A) plus index on the off-beat. The core Travis mechanic on open strings.
Steps (8 steps — 2 measures):
```ts
[
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'i' },
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 5, fret: 0, pick: 'i' },
]
```

#### `travis-open-full` — Travis Full Pattern Open Strings
Description: Full p-i-p-m pattern — thumb alternates bass while index and middle alternate melody. Open strings only.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 4, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 4, fret: 0, pick: 'm' },
  { stringIdx: 0, fret: 0, pick: 'p' },
  { stringIdx: 4, fret: 0, pick: 'i' },
  { stringIdx: 1, fret: 0, pick: 'p' },
  { stringIdx: 4, fret: 0, pick: 'm' },
]
```

#### `travis-chord-basic` — Travis Basic Over G Chord
Description: Same alternating bass + index pattern, now holding a G chord. Both hands active simultaneously.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
]
```

#### `travis-chord-full` — Travis Full Pattern Over G Chord
Description: Full p-i-p-m pattern over G chord. The complete Travis picking technique in a real musical context.
Steps (8 steps):
```ts
[
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 4, fret: 0,            pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
  { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
  { stringIdx: 4, fret: 0,            pick: 'i' },
  { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
  { stringIdx: 4, fret: 0,            pick: 'm' },
]
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/data/drillData.ts` | `DrillStep.finger` optional; add `DrillStep.pick`; add `Drill.hand`; extend `Drill.category`; add `hand:'fretting'` to all 15 existing drills; add 17 new picking drills |
| `src/pages/Technique.tsx` | Split `Category` into `FrettingCategory` / `PickingCategory`; two-row tab layout; update `drillDots` mapping for optional finger; add picking annotation strip above fretboard |

**New drill totals:** 15 fretting + 17 picking = 32 drills total
- Alternate: 4
- Economy: 3
- PIMA: 6 (3 open + 3 chord)
- Travis: 4 (2 open + 2 chord)

---

## Out of Scope

- Hybrid picking (pick + fingers)
- Chord progression drills (multiple chord changes)
- Audio detection of right-hand technique
- Video guidance
