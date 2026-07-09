# Voicings Hub + Drop 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing Shell Voicings page into a tabbed Voicings hub, then add a Drop 2 voicings tab as the second tab — establishing the pattern for future tabs (Dyads, Quartal, Tensions).

**Architecture:** A new `Voicings.tsx` hub page owns the tab bar and renders one of several tab components. Shell Voicings content is extracted into `ShellVoicingsTab.tsx` unchanged. `Drop2Tab.tsx` is new. The `/shell-voicings` route and nav link become `/voicings`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Tone.js (audio), existing `Fretboard` SVG component, `@/src/lib/audio` (`initAudio`, `playStrum`, `getFretNote`), `@/src/lib/progressionUtils` (`addChordToActiveProgression`).

## Global Constraints

- `OPEN_MIDI = [40, 45, 50, 55, 59, 64]` — string indices 0 (low E) to 5 (high E)
- `@` resolves to project root; use `@/src/...` for aliased imports
- No new dependencies
- `npm run lint` (tsc --noEmit) must pass after every task
- Fretboard cap: fret 0–15 (existing convention)
- Nav icon for Voicings hub: keep the existing `Piano` icon from Shell Voicings

---

## Task 1: Extract ShellVoicingsTab and create Voicings hub

**Files:**
- Create: `src/components/voicings/ShellVoicingsTab.tsx`
- Create: `src/pages/Voicings.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `<ShellVoicingsTab />` (no props), `<Voicings />` (no props), route `/voicings`

- [ ] **Step 1: Create `src/components/voicings/ShellVoicingsTab.tsx`**

Copy the entire body of `src/pages/ShellVoicings.tsx` into this new file. Change the export name from `ShellVoicings` to `ShellVoicingsTab`. No other changes.

```typescript
// src/components/voicings/ShellVoicingsTab.tsx
// (full contents of ShellVoicings.tsx with export renamed to ShellVoicingsTab)
export function ShellVoicingsTab() { ... }
```

- [ ] **Step 2: Create `src/pages/Voicings.tsx`**

```typescript
import React, { useState } from 'react';
import { ShellVoicingsTab } from '../components/voicings/ShellVoicingsTab';

type Tab = 'shell' | 'drop2';

const TABS: { key: Tab; label: string }[] = [
  { key: 'shell', label: 'Shell Voicings' },
  { key: 'drop2', label: 'Drop 2' },
];

export function Voicings() {
  const [tab, setTab] = useState<Tab>('shell');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Voicings</h1>
        <p className="text-sm text-brand-secondary mt-1">
          Chord voicing techniques — from stripped-down shells to full four-note drop voicings.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-brand-line">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-secondary hover:text-brand-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shell' && <ShellVoicingsTab />}
      {tab === 'drop2' && <div className="text-brand-secondary text-sm">Drop 2 coming soon…</div>}
    </div>
  );
}
```

- [ ] **Step 3: Update `src/App.tsx`**

Replace the `ShellVoicings` import and route:
```typescript
// Remove:
import { ShellVoicings } from './pages/ShellVoicings';
// Add:
import { Voicings } from './pages/Voicings';

// Remove route:
<Route path="/shell-voicings" element={<ShellVoicings />} />
// Add route:
<Route path="/voicings" element={<Voicings />} />
```

Replace the nav link href:
```tsx
// Was:
<NavLink title="Shell Voicings" to="/shell-voicings" ...>
// Becomes:
<NavLink title="Voicings" to="/voicings" ...>
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Smoke-test in browser**

```bash
npm run dev
```
Navigate to `/voicings`. Confirm Shell Voicings tab renders identically to the old `/shell-voicings` page. Confirm Drop 2 tab shows the placeholder. Confirm the nav Piano icon links to `/voicings`.

- [ ] **Step 6: Commit**

```bash
git add src/components/voicings/ShellVoicingsTab.tsx src/pages/Voicings.tsx src/App.tsx
git commit -m "refactor: migrate Shell Voicings into tabbed Voicings hub"
```

---

## Task 2: Drop 2 algorithm

**Files:**
- Create: `src/components/voicings/drop2.ts`

**Interfaces:**
- Consumes: `OPEN_MIDI: number[]`, `Note` type, `getFretNote(stringIdx, fret): string` from `@/src/lib/audio`
- Produces: `computeDrop2Voicings(root: Note, quality: Drop2Quality): Drop2Voicing[]`

```typescript
export interface Drop2Quality {
  key: string;
  label: string;
  thirdSt: number;   // semitones: 3 (minor) or 4 (major)
  fifthSt: number;   // semitones: 6 (dim) or 7 (perfect)
  seventhSt: number; // semitones: 9 (dim7), 10 (min7), or 11 (maj7)
}

export const DROP2_QUALITIES: Drop2Quality[] = [
  { key: 'maj7',  label: 'maj7',   thirdSt: 4, fifthSt: 7, seventhSt: 11 },
  { key: 'm7',    label: 'm7',     thirdSt: 3, fifthSt: 7, seventhSt: 10 },
  { key: 'dom7',  label: '7',      thirdSt: 4, fifthSt: 7, seventhSt: 10 },
  { key: 'm7b5',  label: 'm7♭5',  thirdSt: 3, fifthSt: 6, seventhSt: 10 },
  { key: 'dim7',  label: 'dim7',   thirdSt: 3, fifthSt: 6, seventhSt:  9 },
];

export interface Drop2Voicing {
  frets: number[];              // 6-element array, -1 = muted
  strings: readonly [number, number, number, number]; // string indices [s0,s1,s2,s3]
  setKey: string;               // e.g. '6-3'
  setLabel: string;             // e.g. 'Strings 6–3'
  openNames: string;            // e.g. 'E · A · D · G'
  inversionKey: string;         // 'root' | 'first' | 'second' | 'third'
  inversionLabel: string;       // e.g. '5th in bass'
  bassRole: string;             // 'R' | '3' | '5' | '7'
  notes: { role: string; name: string }[]; // [{role:'5',name:'G'}, ...] low→high
}
```

- [ ] **Step 1: Create `src/components/voicings/drop2.ts`**

```typescript
import { Note } from '../../types';
import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

function noteNameFromMidi(midi: number): string {
  const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return NAMES[((midi % 12) + 12) % 12];
}

export interface Drop2Quality {
  key: string;
  label: string;
  thirdSt: number;
  fifthSt: number;
  seventhSt: number;
}

export const DROP2_QUALITIES: Drop2Quality[] = [
  { key: 'maj7',  label: 'maj7',  thirdSt: 4, fifthSt: 7, seventhSt: 11 },
  { key: 'm7',    label: 'm7',    thirdSt: 3, fifthSt: 7, seventhSt: 10 },
  { key: 'dom7',  label: '7',     thirdSt: 4, fifthSt: 7, seventhSt: 10 },
  { key: 'm7b5',  label: 'm7♭5', thirdSt: 3, fifthSt: 6, seventhSt: 10 },
  { key: 'dim7',  label: 'dim7',  thirdSt: 3, fifthSt: 6, seventhSt:  9 },
];

export interface Drop2Voicing {
  frets: number[];
  strings: readonly [number, number, number, number];
  setKey: string;
  setLabel: string;
  openNames: string;
  inversionKey: string;
  inversionLabel: string;
  bassRole: string;
  notes: { role: string; name: string }[];
}

const STRING_SETS: Array<{
  strings: readonly [number, number, number, number];
  setKey: string;
  setLabel: string;
  openNames: string;
}> = [
  { strings: [0,1,2,3], setKey: '6-3', setLabel: 'Strings 6–3', openNames: 'E · A · D · G' },
  { strings: [1,2,3,4], setKey: '5-2', setLabel: 'Strings 5–2', openNames: 'A · D · G · B' },
  { strings: [2,3,4,5], setKey: '4-1', setLabel: 'Strings 4–1', openNames: 'D · G · B · E' },
];

// The 4 drop-2 inversions as semitone offsets from root [s0, s1, s2, s3].
// Derived by taking each close-position inversion and dropping the 2nd-highest note an octave.
// Each pattern is expressed as offsets relative to root at s1 (the "anchor"):
// We iterate over rootMidi directly and compute note MIDIs for each string.
//
// Pattern note stacks (low→high, intervals from root):
//   inv0 (root pos):  5th-12,  R,      3rd,    7th
//   inv1 (1st inv):   7th-12,  3rd,    5th,    R+12
//   inv2 (2nd inv):   R,       5th,    7th,    3rd+12
//   inv3 (3rd inv):   3rd,     7th,    R+12,   5th+12

interface InversionPattern {
  key: string;
  label: string;
  bassRole: string;
  // offsets[i] = semitones from root for string i in the set
  offsets: (q: Drop2Quality) => [number, number, number, number];
}

const INVERSIONS: InversionPattern[] = [
  {
    key: 'inv0', label: '5th in bass', bassRole: '5',
    offsets: q => [q.fifthSt - 12, 0, q.thirdSt, q.seventhSt],
  },
  {
    key: 'inv1', label: '7th in bass', bassRole: '7',
    offsets: q => [q.seventhSt - 12, q.thirdSt, q.fifthSt, 12],
  },
  {
    key: 'inv2', label: 'Root in bass', bassRole: 'R',
    offsets: q => [0, q.fifthSt, q.seventhSt, q.thirdSt + 12],
  },
  {
    key: 'inv3', label: '3rd in bass', bassRole: '3',
    offsets: q => [q.thirdSt, q.seventhSt, 12, q.fifthSt + 12],
  },
];

const ROLES = ['R', '3', '5', '7'] as const;

export function computeDrop2Voicings(root: Note, quality: Drop2Quality): Drop2Voicing[] {
  const results: Drop2Voicing[] = [];

  for (const { strings, setKey, setLabel, openNames } of STRING_SETS) {
    for (const inv of INVERSIONS) {
      const offsets = inv.offsets(quality);

      // Scan by anchoring rootMidi and checking all 4 frets
      for (let rootMidi = 36; rootMidi <= 80; rootMidi++) {
        if (noteNameFromMidi(rootMidi) !== root) continue;

        const noteMidis = offsets.map(o => rootMidi + o);
        const fretValues = strings.map((si, i) => noteMidis[i] - OPEN_MIDI[si]);

        if (fretValues.some(f => f < 0 || f > 15)) continue;

        const frets: number[] = [-1, -1, -1, -1, -1, -1];
        strings.forEach((si, i) => { frets[si] = fretValues[i]; });

        // Role ordering by offset value
        const roleOffsets = [0, quality.thirdSt, quality.fifthSt, quality.seventhSt];
        const notes = strings.map((si, i) => {
          const noteOffset = ((noteMidis[i] - rootMidi) % 12 + 12) % 12;
          const roleIdx = roleOffsets.indexOf(noteOffset);
          return {
            role: roleIdx >= 0 ? ROLES[roleIdx] : '?',
            name: getFretNote(si, fretValues[i]),
          };
        });

        results.push({
          frets, strings, setKey, setLabel, openNames,
          inversionKey: inv.key,
          inversionLabel: inv.label,
          bassRole: inv.bassRole,
          notes,
        });
      }
    }
  }

  return results;
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/voicings/drop2.ts
git commit -m "feat: add Drop 2 voicing algorithm"
```

---

## Task 3: Drop 2 tab UI

**Files:**
- Create: `src/components/voicings/Drop2Tab.tsx`
- Modify: `src/pages/Voicings.tsx` (swap placeholder for `<Drop2Tab />`)

**Interfaces:**
- Consumes: `computeDrop2Voicings`, `DROP2_QUALITIES`, `Drop2Voicing` from `./drop2`
- Consumes: `Fretboard` from `@/src/components/Fretboard`
- Consumes: `initAudio`, `playStrum` from `@/src/lib/audio`
- Consumes: `addChordToActiveProgression` from `@/src/lib/progressionUtils`
- Consumes: `ALL_NOTES` from `@/src/data/guitarData`

- [ ] **Step 1: Create `src/components/voicings/Drop2Tab.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { Note, ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { computeDrop2Voicings, DROP2_QUALITIES, Drop2Voicing } from './drop2';
import { addChordToActiveProgression } from '../../lib/progressionUtils';

// Color per string set
const SET_CONFIG: Record<string, { hex: string }> = {
  '6-3': { hex: '#f59e0b' }, // amber
  '5-2': { hex: '#14b8a6' }, // teal
  '4-1': { hex: '#8b5cf6' }, // violet
};

// Color per inversion
const INV_CONFIG: Record<string, { hex: string }> = {
  inv0: { hex: '#f59e0b' },
  inv1: { hex: '#14b8a6' },
  inv2: { hex: '#8b5cf6' },
  inv3: { hex: '#ec4899' },
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1,-1,-1,-1,-1,-1],
  fingers: [-1,-1,-1,-1,-1,-1] as Finger[],
};

export function Drop2Tab() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState('maj7');
  const [activeInversions, setActiveInversions] = useState<Set<string>>(
    new Set(['inv0','inv1','inv2','inv3'])
  );
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(
    new Set(['6-3','5-2','4-1'])
  );
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const quality = DROP2_QUALITIES.find(q => q.key === qualityKey)!;

  const voicings = useMemo(
    () => computeDrop2Voicings(root, quality)
      .filter(v => activeInversions.has(v.inversionKey) && activeStringSets.has(v.setKey)),
    [root, quality, activeInversions, activeStringSets]
  );

  // Fretboard drill dots — one per voicing position
  const drillDots = useMemo(() =>
    voicings.flatMap(v =>
      v.strings.map((si, i) => ({
        string: si,
        fret: v.frets[si],
        color: SET_CONFIG[v.setKey].hex,
        label: v.notes[i].role,
      }))
    ), [voicings]);

  const toggleInversion = (key: string) =>
    setActiveInversions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleSet = (key: string) =>
    setActiveStringSets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePlay = async (v: Drop2Voicing) => {
    await initAudio();
    const notes = v.notes.map(n => n.name);
    setPlayingNotes(new Set(notes));
    playStrum(notes, 2.5, 'down');
    setTimeout(() => setPlayingNotes(new Set()), 3000);
  };

  const sendToProgressions = (v: Drop2Voicing, index: number) => {
    const chord: ChordShape = {
      name: `${root}${quality.label}`,
      frets: v.frets as number[],
      fingers: v.frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
    };
    try {
      addChordToActiveProgression(chord);
    } catch { /* ignore */ }
    setAddedIndices(prev => new Set(prev).add(index));
    setTimeout(() => setAddedIndices(prev => {
      const next = new Set(prev); next.delete(index); return next;
    }), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-brand-secondary">
          Four-note voicings derived by dropping the second-highest note of a close-position chord down an octave. Produces open, resonant shapes used throughout jazz comping.
        </p>
      </div>

      {/* Root */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Root</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_NOTES.map(note => (
            <button key={note} onClick={() => setRoot(note as Note)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                root === note
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}>
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Quality</p>
        <div className="flex flex-wrap gap-1.5">
          {DROP2_QUALITIES.map(q => (
            <button key={q.key} onClick={() => setQualityKey(q.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                qualityKey === q.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
              )}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inversions */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Inversions</p>
        <div className="flex flex-wrap gap-1.5">
          {(['inv0','inv1','inv2','inv3'] as const).map((key, i) => {
            const labels = ['5th in bass','7th in bass','Root in bass','3rd in bass'];
            const active = activeInversions.has(key);
            return (
              <button key={key} onClick={() => toggleInversion(key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink'
                )}
                style={active ? { backgroundColor: INV_CONFIG[key].hex } : undefined}>
                {labels[i]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-neck fretboard */}
      <div onMouseEnter={initAudio}>
        <Fretboard fretsNum={15} chord={MUTED_CHORD} drillDots={drillDots} playingNotes={playingNotes} showNoteNames={false} compact />
      </div>

      {/* Cards */}
      {voicings.length === 0 ? (
        <p className="text-brand-secondary text-sm">No Drop 2 voicings found for this combination.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voicings.map((v, i) => {
            const color = SET_CONFIG[v.setKey].hex;
            const isSetActive = activeStringSets.has(v.setKey);
            return (
              <div key={i}
                className={cn('bg-brand-surface border border-brand-line rounded-xl p-4 space-y-3 transition-opacity duration-200',
                  !isSetActive && 'opacity-40'
                )}
                style={{ borderLeft: `4px solid ${color}` }}>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-bold text-brand-ink">{v.setLabel}</h3>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5 pl-4">{v.openNames}</p>
                    <p className="text-xs font-medium mt-1 pl-4" style={{ color }}>{v.inversionLabel}</p>
                  </div>
                  <button onClick={() => toggleSet(v.setKey)}
                    className="p-0.5 rounded text-brand-secondary hover:text-brand-ink transition-colors mt-0.5"
                    title={isSetActive ? 'Hide on fretboard' : 'Show on fretboard'}>
                    {isSetActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>

                {/* Note roles */}
                <div className="flex items-center gap-3">
                  {v.notes.map(({ role, name }) => (
                    <div key={role} className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}>
                        {role}
                      </span>
                      <span className="text-sm font-semibold text-brand-ink">{name}</span>
                    </div>
                  ))}
                </div>

                {/* Fret map */}
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-1.5 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - si}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {v.notes[ri].role}={v.frets[si] === 0 ? 'open' : v.frets[si]}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => handlePlay(v)} onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors"
                  style={{ backgroundColor: color }}>
                  ▶ Play
                </button>

                <button onClick={() => sendToProgressions(v, i)}
                  className={cn('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    addedIndices.has(i)
                      ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-brand-line text-brand-secondary hover:text-brand-ink hover:border-brand-primary/50'
                  )}>
                  <Plus size={12} /> {addedIndices.has(i) ? 'Added ✓' : '+ Progression'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire Drop2Tab into Voicings.tsx**

Replace the placeholder line in `src/pages/Voicings.tsx`:
```typescript
// Add import at top:
import { Drop2Tab } from '../components/voicings/Drop2Tab';

// Replace placeholder:
{tab === 'drop2' && <div className="text-brand-secondary text-sm">Drop 2 coming soon…</div>}
// With:
{tab === 'drop2' && <Drop2Tab />}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Test in browser**

```bash
npm run dev
```

Verify:
1. Navigate to `/voicings` → Shell Voicings tab renders as before
2. Click "Drop 2" tab → cards appear for Gmaj7
3. Change root to C → cards update
4. Change quality to m7 → cards update
5. Toggle an inversion button → those cards disappear from grid and dots disappear from fretboard
6. Click Play on a card → chord sounds
7. Click + Progression → navigates to progressions with chord added

- [ ] **Step 5: Commit**

```bash
git add src/components/voicings/Drop2Tab.tsx src/pages/Voicings.tsx
git commit -m "feat: add Drop 2 voicings tab to Voicings hub"
```
