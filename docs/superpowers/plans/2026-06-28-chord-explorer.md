# Chord Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users send any chord to the Dictionary's Identify tab for fret-by-fret experimentation, and add prev/next position navigation in the Identify tab to cycle through all standard neck voicings of the identified chord.

**Architecture:** Task 1 adds an "Explore →" button in two places — Dictionary (sets state directly, same page) and Circle.tsx (navigates to `/dictionary?mode=identify&frets=...`); Dictionary reads those URL params on mount to seed `identifiedFrets`. Task 2 adds `getNavigationChords()` at module level to parse a tonal.js chord name back to matching `ChordShape[]` from COMMON_CHORDS (sorted by neck position), then wires prev/next buttons in the Identify sidebar.

**Tech Stack:** React 19, TypeScript, React Router v7 (`useSearchParams`, `useNavigate`), `@tonaljs/tonal`, Tailwind v4

## Global Constraints

- No test suite — `npm run lint` (`tsc --noEmit`) is the only static check; verify behavior by manual browser test
- All conditional classes use `cn()` from `@/src/lib/utils`
- Brand CSS variables only: `brand-primary`, `brand-active`, `brand-line`, `brand-secondary`, `brand-ink`, `brand-surface`, `brand-sidebar`, `brand-bg`
- Path alias: `@` = project root; use `@/src/...` for aliased imports
- BrowserRouter basename=`"/Guitar_Chords"` — navigate with root-relative paths like `"/dictionary"`
- COMMON_CHORDS chord names follow `"<Root> <QualityStr> (<ShapeName>)"` where QualityStr is one of: `Major`, `Minor`, `7`, `Maj7`, `m7`, `sus2`, `sus4`, `dim`, `aug`, `dim7`, `m7b5`
- `ChordShape.frets` is a 6-element array of **absolute** fret numbers (−1 = muted, 0 = open, ≥1 = fretted); baseFret is display-only

---

### Task 1: "Explore →" buttons + URL seeding of Identify tab

**Files:**
- Modify: `src/pages/Dictionary.tsx`
- Modify: `src/pages/Circle.tsx`

**Interfaces:**
- Consumes: `ChordShape.frets` (6-element number array of absolute frets, ready to use as `identifiedFrets`)
- Produces: `identifiedFrets` state seeded with the incoming chord; used by Task 2

- [ ] **Step 1: Add `useSearchParams` to the react-router-dom import in Dictionary.tsx**

Line 2 of `src/pages/Dictionary.tsx` currently reads:
```typescript
import { useNavigate } from 'react-router-dom';
```

Change it to:
```typescript
import { useNavigate, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Add the hook and mount-only seeding effect in Dictionary.tsx**

Inside the `Dictionary()` component, after `const navigate = useNavigate();` (currently line 32), add:

```typescript
const [searchParams] = useSearchParams();

// Seed identifiedFrets from URL params when navigated here from another page.
// Runs once on mount only; no cleanup needed.
useEffect(() => {
  const fretsParam = searchParams.get('frets');
  if (searchParams.get('mode') === 'identify' && fretsParam) {
    const parsed = fretsParam.split(',').map(Number);
    if (parsed.length === 6 && parsed.every(f => Number.isFinite(f))) {
      setMode('identify');
      setIdentifiedFrets(parsed);
    }
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Add "Explore →" button in Dictionary chords-mode action area**

In `src/pages/Dictionary.tsx`, find the block that starts:
```tsx
{mode === 'chords' && activeChord && (
  <>
    <button
      onClick={() => handleAddToProgression(activeChord)}
```
(around line 878). This block ends with the "Ear Train →" button and a closing `</>`. Add a third button immediately after "Ear Train →" and before the closing `</>`:

```tsx
<button
  onClick={() => {
    setMode('identify');
    setIdentifiedFrets([...activeChord.frets]);
  }}
  className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  title="Load into Identifier to experiment"
>
  Explore →
</button>
```

- [ ] **Step 4: Add "Explore →" button in Circle.tsx chord panel**

In `src/pages/Circle.tsx`, find the `+ Progression` button (around line 207):
```tsx
<button
  onClick={() => handleAddToProgression(activeChord)}
  className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  title="Add to active progression"
>
  + Progression
</button>
```

Add a second button immediately after it:
```tsx
<button
  onClick={() =>
    navigate(`/dictionary?mode=identify&frets=${activeChord.frets.join(',')}`)
  }
  className="text-xs px-2 py-1 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
  title="Load into Identifier to experiment"
>
  Explore →
</button>
```

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 6: Manual smoke tests**

Run `npm run dev`. Open `http://localhost:3000/Guitar_Chords`:

1. **Dictionary → Chords**: Select root C, select "C Major (E Shape)" from the sidebar. Action buttons should include "Explore →". Click it — the tab should switch to "Identify" and the fretboard should show C Major fret positions pre-loaded (string 0 = 0, string 1 = 3, string 2 = 2, string 3 = 0, string 4 = 1, string 5 = 0).

2. **Circle → Identifier handoff**: Navigate to Circle of Fifths. Click key "C". Click the "I" (tonic) degree button. The chord panel should show a C Major shape. Click "Explore →". Browser should navigate to Dictionary with the Identify tab active and C Major frets pre-loaded. Press the browser Back button — you return to Circle.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dictionary.tsx src/pages/Circle.tsx
git commit -m "feat: add Explore button to send chords to the Identifier tab"
```

---

### Task 2: Position navigator in Identify tab

**Files:**
- Modify: `src/pages/Dictionary.tsx`

**Interfaces:**
- Consumes: `identifiedChordNames[0]` — tonal.js chord name string (e.g. `"CM"`, `"Cm"`, `"C7"`, `"CM7"`, `"Cm7"`, `"Cdim"`, `"Cdim7"`, `"Cm7b5"`)
- Consumes: `identifiedFrets` — current 6-element fret array
- Consumes: `COMMON_CHORDS` and `Note` (both already imported)
- Produces: prev/next navigation that calls `setIdentifiedFrets(shape.frets)`

- [ ] **Step 1: Add `getNavigationChords` module-level function to Dictionary.tsx**

Add this function before the `Dictionary` component (after the `INTERVALS` constant at the top of the file):

```typescript
// Returns COMMON_CHORDS shapes matching the root+quality of a tonal.js chord name,
// sorted ascending by lowest fretted (non-open, non-muted) fret = neck position order.
// Returns [] when the chord type is unrecognised or has no standard shapes.
function getNavigationChords(tonalName: string): ChordShape[] {
  const base = tonalName.split('/')[0]; // strip inversion suffix like "/E"
  // Try 2-char root first (e.g. "C#", "Bb"), then 1-char
  const m = base.match(/^([A-G][#b])(.*)/) ?? base.match(/^([A-G])(.*)/);
  if (!m) return [];
  const flatToSharp: Record<string, string> = {
    Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B',
  };
  const root = (flatToSharp[m[1]] ?? m[1]) as Note;
  const qual = m[2];
  const pool = COMMON_CHORDS[root] ?? [];
  // Helper: quality substring of a chord's name (everything after "<Root> ")
  const q = (c: ChordShape) => c.name.slice(root.length + 1);
  let shapes: ChordShape[];
  switch (qual) {
    case 'M': case '': case 'maj': case 'major':
      shapes = pool.filter(c => q(c).startsWith('Major'));
      break;
    case 'm': case 'min': case 'minor':
      shapes = pool.filter(c => q(c).startsWith('Minor'));
      break;
    case '7':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('7 ') || s === '7' || s.startsWith('7('); });
      break;
    case 'M7': case 'maj7': case 'Maj7':
      shapes = pool.filter(c => q(c).startsWith('Maj7'));
      break;
    case 'm7': case 'min7':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('m7') && !s.startsWith('m7b5'); });
      break;
    case 'dim7': case 'o7':
      shapes = pool.filter(c => q(c).startsWith('dim7'));
      break;
    case 'dim': case 'o':
      shapes = pool.filter(c => { const s = q(c); return s.startsWith('dim ') && !s.startsWith('dim7'); });
      break;
    case 'm7b5': case 'ø': case 'ø7': case 'half-dim':
      shapes = pool.filter(c => q(c).startsWith('m7b5'));
      break;
    case 'sus2':
      shapes = pool.filter(c => q(c).startsWith('sus2'));
      break;
    case 'sus4': case 'sus':
      shapes = pool.filter(c => q(c).startsWith('sus4'));
      break;
    case 'aug': case '+':
      shapes = pool.filter(c => q(c).startsWith('aug'));
      break;
    default:
      return [];
  }
  // Sort by lowest fretted (>0) fret — open-position shapes come first
  return shapes.sort((a, b) => {
    const lo = (frets: number[]) => Math.min(...frets.filter(f => f > 0).concat([999]));
    return lo(a.frets) - lo(b.frets);
  });
}
```

- [ ] **Step 2: Compute `navChords` and `navIdx` inside the Dictionary component**

In the `Dictionary` component, after the line that computes `identifiedChordNames` (currently around line 169), add two derived values:

```typescript
const navChords: ChordShape[] =
  mode === 'identify' && identifiedChordNames.length > 0
    ? getNavigationChords(identifiedChordNames[0])
    : [];

// -1 means the current frets don't match any standard shape (custom voicing).
const navIdx = navChords.findIndex(c =>
  c.frets.every((f, i) => f === identifiedFrets[i])
);
```

- [ ] **Step 3: Replace the Identify sidebar block with one that includes navigation**

Find the existing Identify sidebar block (around line 693):
```tsx
{mode === 'identify' && (
  <>
    <div>
       <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-2">Chord Identifier</h3>
       <p className="text-xs text-brand-secondary mb-4">Click on the fretboard dots to select notes. We will identify the chord being formed.</p>
       <button
         onClick={() => setIdentifiedFrets([-1,-1,-1,-1,-1,-1])}
         className="w-full py-2 bg-brand-surface border border-brand-line text-brand-ink rounded-md hover:border-brand-primary text-sm font-medium transition-colors"
       >
         Clear Fretboard
       </button>
    </div>
  </>
)}
```

Replace it with:
```tsx
{mode === 'identify' && (
  <>
    <div>
       <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-2">Chord Identifier</h3>
       <p className="text-xs text-brand-secondary mb-4">Click on the fretboard dots to select notes. We will identify the chord being formed.</p>
       <button
         onClick={() => setIdentifiedFrets([-1,-1,-1,-1,-1,-1])}
         className="w-full py-2 bg-brand-surface border border-brand-line text-brand-ink rounded-md hover:border-brand-primary text-sm font-medium transition-colors"
       >
         Clear Fretboard
       </button>
       {navChords.length > 1 && (
         <div className="mt-3 space-y-1">
           <p className="text-xs font-medium text-brand-secondary">Other positions</p>
           <div className="flex items-center gap-2">
             <button
               onClick={() => {
                 const prev = navIdx <= 0 ? navChords.length - 1 : navIdx - 1;
                 setIdentifiedFrets([...navChords[prev].frets]);
               }}
               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors"
             >
               ◀ Prev
             </button>
             <span className="text-xs tabular-nums text-brand-secondary min-w-[36px] text-center">
               {navIdx >= 0 ? `${navIdx + 1}/${navChords.length}` : `—/${navChords.length}`}
             </span>
             <button
               onClick={() => {
                 const next = navIdx < 0 || navIdx >= navChords.length - 1 ? 0 : navIdx + 1;
                 setIdentifiedFrets([...navChords[next].frets]);
               }}
               className="flex-1 py-1.5 rounded border border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink text-xs font-medium transition-colors"
             >
               Next ▶
             </button>
           </div>
         </div>
       )}
    </div>
  </>
)}
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Manual smoke tests**

1. **Via "Explore →" in Dictionary**: Go to Chords tab, select C Major (E Shape), click "Explore →". Sidebar shows "Other positions" with `1/3` (or the actual count of C Major shapes). Click "Next ▶" → fretboard loads the next C Major voicing, indicator updates to `2/3`. Click "◀ Prev" → returns to `1/3`. Chord identifier still shows CM throughout.

2. **Manual frets**: Manually click frets for open G Major (string 0 fret 3, string 1 fret 2, strings 2–4 open, string 5 fret 3). Identifier should label it. "Other positions" should appear with multiple G Major shapes. Verify navigating cycles through them.

3. **Via Circle "Explore →"**: Select B chord in Circle, click Explore →. Land in Identify with B chord loaded. Sidebar shows positions for B Major shapes. Navigate through them.

4. **Custom voicing**: Click an unusual set of frets that identifies as a named chord. If the tonal.js chord type is recognised, navigation appears. If not (rare types), navigation is absent — that's expected.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dictionary.tsx
git commit -m "feat: add position navigator to Identify tab"
```
