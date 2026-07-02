# Technique Drills Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/technique` page to GuitarMaster that provides interactive, BPM-progressive fretting-hand dexterity drills grounded in motor learning research — chromatic patterns, spider exercises, legato chains, and stretch drills — with personal best tracking persisted to localStorage.

**Architecture:** A new top-level page (`Technique.tsx`) with a four-tab layout mirroring the Ear Training page structure. Drill content is defined as static typed data in `drillData.ts`. The trainer renders the full drill pattern on the existing `Fretboard` component with finger-labeled dots, embeds a click track using the existing `playClick` audio function, and tracks personal bests in localStorage. No audio detection — progression is self-reported via a "Got it clean" button.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Tone.js (via existing `audio.ts`), existing `Fretboard` component.

---

## Global Constraints

- New files: `src/pages/Technique.tsx` and `src/data/drillData.ts`
- Modified files: `src/App.tsx` (route + nav link), `src/components/Fretboard.tsx` (labeledDots label extension)
- No new dependencies
- localStorage key: `guitarmaster_drill_bests` — `Record<string, number>` (drill ID → highest clean BPM)
- All audio via existing `playClick` and `initAudio` from `src/lib/audio.ts`
- Fretboard coordinate system: `stringIdx 0` = low E, `stringIdx 5` = high E; same as rest of app
- `npm run lint` (tsc --noEmit) must pass with zero errors
- Phase 1: fretting hand drills only. Phase 2 (future): picking + coordination drills added as new categories without structural changes

---

## Data Model

### DrillStep

```ts
interface DrillStep {
  stringIdx: number;  // 0 = low E, 5 = high E
  fret: number;
  finger: 1 | 2 | 3 | 4;
}
```

### Drill

```ts
interface Drill {
  id: string;
  category: 'chromatic' | 'spider' | 'legato' | 'stretch';
  name: string;
  description: string;
  safetyNote?: string;
  steps: DrillStep[];
  startFret: number;    // default fret position (most drills: 5)
  bpmStart: number;     // default starting BPM
  bpmTarget: number;    // mastery milestone BPM
  bpmStep: number;      // BPM increment per "Got it clean" tap
}
```

### Persistence helpers (in `drillData.ts`)

```ts
const STORAGE_KEY = 'guitarmaster_drill_bests';

export function getDrillBest(drillId: string): number | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored) as Record<string, number>;
  return parsed[drillId] ?? null;
}

export function saveDrillBest(drillId: string, bpm: number): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsed: Record<string, number> = stored ? JSON.parse(stored) : {};
  if ((parsed[drillId] ?? 0) < bpm) {
    parsed[drillId] = bpm;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  }
}
```

---

## Drill Content

All drills start at fret 5 unless noted. Stretch drills start at fret 7 (frets closer together, safer for larger spans).

### Chromatic (finger independence)

| id | name | description | bpmStart | bpmTarget | bpmStep |
|----|------|-------------|----------|-----------|---------|
| `chromatic-1234` | 1-2-3-4 Crawl | All four fingers in sequence across every string | 60 | 120 | 5 |
| `chromatic-1324` | 1-3-2-4 Permutation | Crossing pattern builds independence between fingers 2 and 3 | 50 | 100 | 5 |
| `chromatic-1423` | 1-4-2-3 Permutation | Challenges the index-pinky stretch while crossing | 50 | 100 | 5 |
| `chromatic-4321` | 4-3-2-1 Reverse Crawl | Reverse direction; pinky leads | 60 | 120 | 5 |

Pattern for `chromatic-1234`: steps cover all 6 strings × 4 frets (24 steps total), ascending string by string from low E to high E. Each string: frets startFret, startFret+1, startFret+2, startFret+3 with fingers 1, 2, 3, 4.

### Spider (cross-string coordination)

| id | name | description | bpmStart | bpmTarget | bpmStep |
|----|------|-------------|----------|-----------|---------|
| `spider-ascending` | Ascending Spider | Diagonal pattern staggered across adjacent strings, ascending | 50 | 100 | 5 |
| `spider-descending` | Descending Spider | Same diagonal pattern reversed | 50 | 100 | 5 |
| `spider-skip` | Skip-String Spider | Jumps one string per step; harder string-crossing control | 40 | 90 | 5 |

Spider ascending pattern (per pair of adjacent strings): string N fret 5 finger 1, string N+1 fret 6 finger 2, string N fret 7 finger 3, string N+1 fret 8 finger 4 — repeated across all string pairs.

### Legato (hammer-ons & pull-offs)

| id | name | description | safetyNote | bpmStart | bpmTarget | bpmStep |
|----|------|-------------|------------|----------|-----------|---------|
| `legato-ho-chain` | Hammer-On Chain | Single-string ascending hammers; only the first note is picked | None | 60 | 130 | 5 |
| `legato-po-chain` | Pull-Off Chain | Single-string descending pull-offs | None | 60 | 130 | 5 |
| `legato-alt` | Alternating Hammer/Pull | Ascending then descending on a single string without re-picking | None | 50 | 110 | 5 |
| `legato-2string` | Two-String Legato Roll | Hammers and pulls across two adjacent strings | None | 40 | 100 | 5 |

Legato drills operate on one or two strings. The `steps` array marks hammer-on notes with the same `{ stringIdx, fret, finger }` format — the fretboard renders them identically; the description explains the picking technique.

### Stretch (reach & span)

All stretch drills: `startFret: 7`, carry a `safetyNote`.

| id | name | description | safetyNote | bpmStart | bpmTarget | bpmStep |
|----|------|-------------|------------|----------|-----------|---------|
| `stretch-124` | 1-2-4 Stretch | Skips ring finger; index-to-pinky gap | Keep thumb behind neck. Stop if palm tightens. | 50 | 90 | 5 |
| `stretch-134` | 1-3-4 Stretch | Skips middle finger; builds ring-pinky independence | Keep thumb behind neck. Stop if palm tightens. | 50 | 90 | 5 |
| `stretch-1235` | Four-Fret Span | Frets 7-8-9-11; strong reach across four frets | Warm hands thoroughly first. Stop at any discomfort. | 40 | 80 | 5 |
| `stretch-shift` | Shift Stretch | Same 1-2-3-4 pattern, shift up one fret each repetition | Move slowly between positions. Never force the stretch. | 40 | 80 | 5 |

---

## Page Layout: `Technique.tsx`

### Top level

```
[ Chromatic ] [ Spider ] [ Legato ] [ Stretch ]   ← tab row

─────────────────────────────────────────────────
[ Drill card ]  [ Drill card ]  [ Drill card ]    ← drill selector grid
[ Drill card ]  ...

─────────────────────────────────────────────────
                  TRAINER PANEL                   ← shown when a drill is selected
```

### Session warm-up banner

Shown once at page load (dismissed state lives in component state only — reappears on every visit):

> "Warm up your hands for 2–3 minutes before drilling. Stop immediately if you feel any pain or tension."

A dismiss `×` button hides it for the rest of the session.

### Drill selector cards

Each card shows:
- Drill name (bold)
- One-line description
- Personal best badge: "Best: 85 BPM" (or "—" if never drilled)
- Highlighted border when selected (`brand-active`)

### Trainer panel

Rendered below the drill selector when a drill is selected. Contains:

1. **Drill name + safety note** (if present, shown in amber/warning color below the name)
2. **Fretboard** — full-width, renders all `steps` simultaneously as dots labeled with finger numbers 1–4. Uses existing `Fretboard` component with an extended `labeledDots` prop (see Fretboard extension below). `fretRange` set to `[startFret, startFret + 4]`.
3. **BPM controls row:**
   - `−` button (decrements by `bpmStep`, min 40)
   - Current BPM display (large, prominent)
   - `+` button (increments by `bpmStep`, max 200)
   - Play/Stop toggle — starts/stops click track. Implemented as a `useRef`-held `setInterval` that calls `playClick()` every `(60000 / bpm)` ms. Must clear the interval on stop, on BPM change while playing (restart at new tempo), and on component unmount.
4. **"Got it clean ✓" button** — on tap: saves personal best if current BPM exceeds stored value, increments BPM by `bpmStep`, shows a brief green flash on the personal best badge.
5. **Personal best badge** — "Personal best: 85 BPM" always visible beneath BPM controls.

---

## Fretboard Extension: `labeledDots` with custom labels

The existing `labeledDots` prop type is `{ stringIdx: number; fret: number }[]` and renders a ★ in each dot. For this feature, finger numbers (1–4) must appear inside the dots instead.

**Extend the type in `Fretboard.tsx`:**

```ts
// Before (in FretboardProps):
labeledDots?: { stringIdx: number; fret: number }[];

// After:
labeledDots?: { stringIdx: number; fret: number; label?: string }[];
```

**Render change:** When a dot in `labeledDots` has a `label`, render that string inside the dot SVG circle instead of ★. When `label` is absent, keep ★ as the fallback. This is backward-compatible — all existing callers (IntervalDrillTrainer) omit `label` and continue to see ★.

`Fretboard.tsx` is the only additional modified file for this extension.

---

## Routing & Nav

### `App.tsx` additions

```tsx
import { Technique } from './pages/Technique';

// Inside <Routes>:
<Route path="/technique" element={<Technique />} />

// Inside <nav>:
<NavLink title="Technique" to="/technique" className={...}>
  {/* dumbbell or hand icon from lucide-react */}
</NavLink>
```

Suggested lucide icon: `Dumbbell` (available in lucide-react, already in the project).

---

## Motor Learning Principles Applied

These principles are reflected in the design, and can be surfaced in the in-page teaching context (Phase 2 of the guidance layer):

- **Deliberate practice (Ericsson):** Drills are specific, focused, and progressively harder — not mindless repetition.
- **Graduated tempo (motor learning research):** BPM ladder enforces slow-accurate before fast-sloppy. `bpmStart` values are set conservatively so every player begins within their ability.
- **Distributed practice:** The warm-up reminder and short drill format encourage multiple short sessions over one long session.
- **Varied practice:** Four distinct categories target different physical skills, avoiding over-specialization.

---

## Future: Phase 2 — Coordination Drills (Both Hands)

When picking mechanics are added, two new categories slot in without structural changes:

- `'picking'` — alternate picking patterns, string crossing, economy picking
- `'coordination'` — combined fretting pattern + picking instruction

The `Drill` interface gains an optional `pickingPattern` field. The trainer panel gains a picking direction indicator row (↓ ↑ ↓ ↑) below the fretboard. No changes to the tab structure — two new tabs appear.

---

## Out of Scope

- Audio detection of correct notes (no mic input)
- Video technique guidance
- Session/workout assembly (Option C — future)
- Picking-hand drills (Phase 2)
- Accounts or cloud sync (localStorage only)
