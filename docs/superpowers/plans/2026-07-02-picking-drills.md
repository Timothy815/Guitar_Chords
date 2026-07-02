# Picking Drills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Technique page with 17 right-hand picking and fingerpicking drills across four new categories (Alternate, Economy, PIMA, Travis), using the same BPM ladder + self-report trainer model as the 15 existing fretting-hand drills.

**Architecture:** Two tasks: first extend the data layer (`drillData.ts`) with updated types and 17 new drill objects, then update the UI (`Technique.tsx`) with a two-row tab layout, optional-finger drillDots mapping, and a picking annotation strip above the fretboard.

**Tech Stack:** React 19, TypeScript, Tailwind v4, existing `drillData.ts` data layer, existing `Fretboard` component with `drillDots` prop.

## Global Constraints

- Modified files only: `src/data/drillData.ts`, `src/pages/Technique.tsx`
- No new files, no new dependencies
- `npm run lint` (tsc --noEmit) must pass with zero errors after each task
- Existing 15 fretting drills are unchanged except for the addition of `hand: 'fretting'`
- String indexing: `stringIdx 0` = low E (E2), `stringIdx 5` = high e (E4)
- `@` alias resolves to project root; use relative imports within `src/` (e.g. `'../data/drillData'`)
- No unit tests exist in this project — `npm run lint` is the only static check

---

## Task 1: Extend data layer (`drillData.ts`)

**Files:**
- Modify: `src/data/drillData.ts`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: updated `DrillStep`, `Drill` interfaces; `DRILLS` array extended with 17 new picking drills; all 15 existing drills gain `hand: 'fretting'`

- [ ] **Step 1: Update `DrillStep` and `Drill` interfaces**

Replace lines 1–18 of `src/data/drillData.ts` with:

```ts
export interface DrillStep {
  stringIdx: number;
  fret: number;
  finger?: 1 | 2 | 3 | 4;
  pick?: 'down' | 'up' | 'p' | 'i' | 'm' | 'a';
}

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

- [ ] **Step 2: Add `hand: 'fretting'` to all 15 existing drill objects**

In `src/data/drillData.ts`, find each of the 15 drill objects in the `DRILLS` array and insert `hand: 'fretting'` immediately after the `id` field. The 15 drill IDs are:

`chromatic-1234`, `chromatic-1324`, `chromatic-1423`, `chromatic-4321`, `spider-ascending`, `spider-descending`, `spider-skip`, `legato-ho-chain`, `legato-po-chain`, `legato-alt`, `legato-2string`, `stretch-124`, `stretch-134`, `stretch-1235`, `stretch-shift`

For each drill, change e.g.:
```ts
{
  id: 'chromatic-1234',
  category: 'chromatic',
```
to:
```ts
{
  id: 'chromatic-1234',
  hand: 'fretting',
  category: 'chromatic',
```

- [ ] **Step 3: Append 17 new picking drills to the `DRILLS` array**

After the last existing drill (`stretch-shift`), add a closing `]` to the array only after all new drills are appended. Insert these 17 drill objects:

```ts
  // ── Alternate ──────────────────────────────────────────────────────────────
  {
    id: 'alt-single-string',
    hand: 'picking',
    category: 'alternate',
    name: 'Single-String Alternate',
    description: 'Down-up on one string. The foundational alternate picking drill.',
    steps: [
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 6, finger: 2, pick: 'up' },
      { stringIdx: 2, fret: 7, finger: 3, pick: 'down' },
      { stringIdx: 2, fret: 8, finger: 4, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-crossing-asc',
    hand: 'picking',
    category: 'alternate',
    name: 'String Crossing Ascending',
    description: 'One note per string from low E to high E. Pick direction never resets at string changes.',
    steps: [
      { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-crossing-desc',
    hand: 'picking',
    category: 'alternate',
    name: 'String Crossing Descending',
    description: 'One note per string from high e to low E. Descending direction exposes reverse-pick weakness.',
    steps: [
      { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 50,
    bpmTarget: 120,
    bpmStep: 5,
  },
  {
    id: 'alt-3nps',
    hand: 'picking',
    category: 'alternate',
    name: 'Three Notes Per String',
    description: 'Three fretted notes per string before crossing. Pick alternates continuously; starting direction shifts each string.',
    steps: [
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
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },

  // ── Economy ────────────────────────────────────────────────────────────────
  {
    id: 'eco-ascending',
    hand: 'picking',
    category: 'economy',
    name: 'Ascending Economy',
    description: 'One note per string ascending. No direction reversal on string change — all downstrokes.',
    steps: [
      { stringIdx: 0, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'down' },
      { stringIdx: 5, fret: 5, finger: 1, pick: 'down' },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'eco-descending',
    hand: 'picking',
    category: 'economy',
    name: 'Descending Economy',
    description: 'One note per string descending. All upstrokes — no reversal when crossing down.',
    steps: [
      { stringIdx: 5, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 4, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 3, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 2, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 1, fret: 5, finger: 1, pick: 'up' },
      { stringIdx: 0, fret: 5, finger: 1, pick: 'up' },
    ],
    startFret: 5,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'eco-sweep-3',
    hand: 'picking',
    category: 'economy',
    name: '3-String Sweep',
    description: 'Continuous sweep across 3 adjacent strings in one direction. The foundation of sweep picking.',
    steps: [
      { stringIdx: 0, fret: 7, finger: 1, pick: 'down' },
      { stringIdx: 1, fret: 7, finger: 1, pick: 'down' },
      { stringIdx: 2, fret: 7, finger: 1, pick: 'down' },
    ],
    startFret: 7,
    bpmStart: 30,
    bpmTarget: 80,
    bpmStep: 5,
  },

  // ── PIMA ───────────────────────────────────────────────────────────────────
  {
    id: 'pima-open-pima',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-a Open Strings',
    description: 'Classical ascending arpeggio — thumb on bass, then three treble fingers in sequence. Entry point for classical fingerpicking.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 0, pick: 'a' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-open-pami',
    hand: 'picking',
    category: 'pima',
    name: 'p-a-m-i Open Strings',
    description: 'Descending arpeggio from high e back down. Builds reverse finger independence.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-open-pimi',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-i Open Strings',
    description: 'Middle finger returns between each note — a common classical pattern that builds middle-finger agility.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-chord-pima',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-a Over G Chord',
    description: 'Same ascending arpeggio over a G chord shape. Builds pattern muscle memory with real chord context.',
    steps: [
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-chord-pami',
    hand: 'picking',
    category: 'pima',
    name: 'p-a-m-i Over G Chord',
    description: 'Descending arpeggio over G chord.',
    steps: [
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'a' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'pima-chord-pimi',
    hand: 'picking',
    category: 'pima',
    name: 'p-i-m-i Over G Chord',
    description: 'Alternating middle pattern over G chord.',
    steps: [
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 3, fret: 0, pick: 'i' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 3, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },

  // ── Travis ─────────────────────────────────────────────────────────────────
  {
    id: 'travis-open-basic',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Basic Open Strings',
    description: 'Alternating thumb bass (low E / A) plus index on the off-beat. The core Travis mechanic on open strings.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 5, fret: 0, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'travis-open-full',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Full Pattern Open Strings',
    description: 'Full p-i-p-m pattern — thumb alternates bass while index and middle alternate melody. Open strings only.',
    steps: [
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 0, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 0, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'travis-chord-basic',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Basic Over G Chord',
    description: 'Alternating bass + index pattern over G chord. Both hands active simultaneously.',
    steps: [
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 5, fret: 3, finger: 3, pick: 'i' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
  {
    id: 'travis-chord-full',
    hand: 'picking',
    category: 'travis',
    name: 'Travis Full Pattern Over G Chord',
    description: 'Full p-i-p-m pattern over G chord. The complete Travis picking technique in a real musical context.',
    steps: [
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
      { stringIdx: 0, fret: 3, finger: 2, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'i' },
      { stringIdx: 1, fret: 2, finger: 1, pick: 'p' },
      { stringIdx: 4, fret: 0, pick: 'm' },
    ],
    startFret: 0,
    bpmStart: 40,
    bpmTarget: 100,
    bpmStep: 5,
  },
```

- [ ] **Step 4: Verify lint passes**

```bash
npm run lint
```

Expected: zero errors. The only permitted output is the TypeScript version banner and "Found 0 errors."

- [ ] **Step 5: Commit**

```bash
git add src/data/drillData.ts
git commit -m "feat: extend drillData with picking drills types and 17 new drills"
```

---

## Task 2: Update UI (`Technique.tsx`)

**Files:**
- Modify: `src/pages/Technique.tsx`

**Interfaces:**
- Consumes: `Drill` interface (from Task 1) — now has `hand`, extended `category`, optional `DrillStep.finger`, new `DrillStep.pick`
- Produces: two-row tab UI, optional-finger drillDots mapping, picking annotation strip

- [ ] **Step 1: Replace the `Category` type and category constants**

Replace lines 9–25 of `src/pages/Technique.tsx` (the `Category` type, `CATEGORIES` array, `CATEGORY_LABELS`, `CATEGORY_DESCRIPTIONS`) with:

```ts
type FrettingCategory = 'chromatic' | 'spider' | 'legato' | 'stretch';
type PickingCategory  = 'alternate' | 'economy' | 'pima' | 'travis';
type Category = FrettingCategory | PickingCategory;

const FRETTING_CATEGORIES: FrettingCategory[] = ['chromatic', 'spider', 'legato', 'stretch'];
const PICKING_CATEGORIES:  PickingCategory[]  = ['alternate', 'economy', 'pima', 'travis'];

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

- [ ] **Step 2: Fix the `drillDots` mapping to handle optional `finger`**

Replace lines 102–108 (the `drillDots` constant) with:

```ts
  const drillDots = selectedDrill
    ? selectedDrill.steps.map(s => ({
        stringIdx: s.stringIdx,
        fret: s.fret,
        label: s.finger ? String(s.finger) : '',
      }))
    : [];
```

- [ ] **Step 3: Update the header subtitle**

Replace the subtitle paragraph at line 119:

```tsx
<p className="text-sm text-brand-secondary">Fretting hand dexterity drills. Slow and accurate builds speed.</p>
```

with:

```tsx
<p className="text-sm text-brand-secondary">Fretting and picking technique drills. Slow and accurate builds speed.</p>
```

- [ ] **Step 4: Replace the tab row with two labeled rows**

Replace the entire tab row section (lines 141–159 — the `{/* Tab row */}` div through its closing `</div>`) with:

```tsx
      {/* Tab rows — Fretting Hand and Picking Hand */}
      <div>
        <div className="flex items-center border-b border-brand-line">
          <span className="text-xs font-medium text-brand-secondary w-28 shrink-0 pl-1 pb-1">Fretting Hand</span>
          <div className="flex">
            {FRETTING_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleTabChange(cat)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === cat
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-brand-secondary hover:text-brand-ink hover:border-brand-line',
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center border-b border-brand-line">
          <span className="text-xs font-medium text-brand-secondary w-28 shrink-0 pl-1 pb-1">Picking Hand</span>
          <div className="flex">
            {PICKING_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleTabChange(cat)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === cat
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-brand-secondary hover:text-brand-ink hover:border-brand-line',
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>
```

- [ ] **Step 5: Add the picking annotation strip to the trainer panel**

Inside the trainer panel `{selectedDrill && (...)}`, find the `{/* Fretboard */}` section (lines ~206–213). Insert the annotation strip **between** the drill title block and the fretboard block:

```tsx
          {/* Picking annotation strip — rendered only for drills with pick annotations */}
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

The annotation strip renders a horizontal row of badge-sized boxes showing `↓`, `↑`, `p`, `i`, `m`, or `a` for each step. Stroke/pick symbols (`↓`/`↑`) use a neutral badge style; finger symbols (`p`/`i`/`m`/`a`) use a brand-primary tint. The strip is absent for fretting drills (no `pick` fields on any step).

- [ ] **Step 6: Verify lint passes**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Technique.tsx
git commit -m "feat: add picking drill UI — two-row tabs and annotation strip"
```
