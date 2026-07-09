# Voicings Hub + Drop 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Shell Voicings into a tabbed Voicings hub at `/voicings`, add a Drop 2 voicings tab as the second tab.

**Architecture:** `Voicings.tsx` hub owns a tab bar and renders `ShellVoicingsTab` (extracted from current `ShellVoicings.tsx`) or `Drop2Tab`. `drop2.ts` owns the pure algorithm. App route + nav updated from `/shell-voicings` to `/voicings`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Tone.js, existing `Fretboard` SVG component.

## Global Constraints

- `OPEN_MIDI = [40, 45, 50, 55, 59, 64]` — indices 0 (low E) to 5 (high E)
- `@` resolves to project root; imports use `@/src/...`
- No new npm dependencies
- `npm run lint` (tsc --noEmit) must pass after every task
- Fret range: 0–15 (hard cap on all generated voicings)
- `drillDots` prop shape: `{ stringIdx: number; fret: number; label: string; color?: string }[]`
- `sendToProgressions` pattern: inline localStorage — see ShellVoicings.tsx:148–157 for exact code

---

## Task 1: Voicings hub + extract ShellVoicingsTab

**Files:**
- Create: `src/components/voicings/ShellVoicingsTab.tsx`
- Create: `src/pages/Voicings.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `export function ShellVoicingsTab()` (no props), `export function Voicings()` (no props), route `/voicings`

- [ ] **Step 1: Create `src/components/voicings/ShellVoicingsTab.tsx`**

Copy the full contents of `src/pages/ShellVoicings.tsx` into this new file. Change only the export name from `ShellVoicings` to `ShellVoicingsTab`. Fix the import paths — all `../` paths become `../../` (e.g. `'../types'` → `'../../types'`, `'../data/guitarData'` → `'../../data/guitarData'`, etc.).

The file should start with:
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum, getFretNote } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Search } from 'lucide-react';
```

And end with:
```typescript
export function ShellVoicingsTab() {
  // ... (identical body to ShellVoicings)
}
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
      {tab === 'drop2' && <div className="text-brand-secondary text-sm py-4">Drop 2 loading…</div>}
    </div>
  );
}
```

- [ ] **Step 3: Update `src/App.tsx`**

Replace the ShellVoicings import and route. Read the file first to find exact lines.

Remove:
```typescript
import { ShellVoicings } from './pages/ShellVoicings';
```
Add:
```typescript
import { Voicings } from './pages/Voicings';
```

Replace route:
```tsx
// Remove:
<Route path="/shell-voicings" element={<ShellVoicings />} />
// Add:
<Route path="/voicings" element={<Voicings />} />
```

Update NavLink:
```tsx
// Change to="/shell-voicings" → to="/voicings"
// Change title="Shell Voicings" → title="Voicings"
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/components/voicings/ShellVoicingsTab.tsx src/pages/Voicings.tsx src/App.tsx
git commit -m "refactor: migrate Shell Voicings into tabbed Voicings hub"
```

---

## Task 2: Drop 2 algorithm

**Files:**
- Create: `src/components/voicings/drop2.ts`

**Interfaces:**
- Consumes: `getFretNote(stringIdx: number, fret: number): string` from `../../lib/audio`
- Produces:
  ```typescript
  export interface Drop2Quality { key: string; label: string; thirdSt: number; fifthSt: number; seventhSt: number; }
  export const DROP2_QUALITIES: Drop2Quality[]
  export interface Drop2Voicing { frets: number[]; strings: readonly [number,number,number,number]; setKey: string; setLabel: string; openNames: string; inversionKey: string; inversionLabel: string; bassRole: string; notes: { role: string; name: string }[]; }
  export function computeDrop2Voicings(root: string, quality: Drop2Quality): Drop2Voicing[]
  ```

- [ ] **Step 1: Create `src/components/voicings/drop2.ts`**

```typescript
import { getFretNote } from '../../lib/audio';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
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

// Drop 2 inversion patterns: semitone offsets from root for each of [s0,s1,s2,s3].
// Derived from close-position inversions by dropping the 2nd-highest note an octave.
// inv0 (root-pos drop2):  5th-12,  R,      3rd,    7th       → bass = 5th
// inv1 (1st-inv drop2):   7th-12,  3rd,    5th,    R+12      → bass = 7th
// inv2 (2nd-inv drop2):   R,       5th,    7th,    3rd+12    → bass = R
// inv3 (3rd-inv drop2):   3rd,     7th,    R+12,   5th+12    → bass = 3rd
interface InversionDef {
  key: string;
  label: string;
  bassRole: string;
  offsets: (q: Drop2Quality) => [number, number, number, number];
}

const INVERSIONS: InversionDef[] = [
  { key: 'inv0', label: '5th in bass', bassRole: '5',
    offsets: q => [q.fifthSt - 12, 0, q.thirdSt, q.seventhSt] },
  { key: 'inv1', label: '7th in bass', bassRole: '7',
    offsets: q => [q.seventhSt - 12, q.thirdSt, q.fifthSt, 12] },
  { key: 'inv2', label: 'Root in bass', bassRole: 'R',
    offsets: q => [0, q.fifthSt, q.seventhSt, q.thirdSt + 12] },
  { key: 'inv3', label: '3rd in bass', bassRole: '3',
    offsets: q => [q.thirdSt, q.seventhSt, 12, q.fifthSt + 12] },
];

const ROLE_OFFSETS_KEYS = ['R', '3', '5', '7'] as const;

export function computeDrop2Voicings(root: string, quality: Drop2Quality): Drop2Voicing[] {
  const results: Drop2Voicing[] = [];

  for (const { strings, setKey, setLabel, openNames } of STRING_SETS) {
    for (const inv of INVERSIONS) {
      const offsets = inv.offsets(quality);
      const roleOffsets = [0, quality.thirdSt, quality.fifthSt, quality.seventhSt];

      // Scan all root MIDI values covering the guitar's playable range
      for (let rootMidi = 36; rootMidi <= 80; rootMidi++) {
        if (noteNameFromMidi(rootMidi) !== root) continue;

        const noteMidis = offsets.map(o => rootMidi + o);
        const fretValues = strings.map((si, i) => noteMidis[i] - OPEN_MIDI[si]);

        if (fretValues.some(f => f < 0 || f > 15)) continue;

        const frets: number[] = [-1, -1, -1, -1, -1, -1];
        strings.forEach((si, i) => { frets[si] = fretValues[i]; });

        const notes = strings.map((si, i) => {
          const interval = ((noteMidis[i] - rootMidi) % 12 + 12) % 12;
          const roleIdx = roleOffsets.indexOf(interval);
          return {
            role: roleIdx >= 0 ? ROLE_OFFSETS_KEYS[roleIdx] : '?',
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
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/voicings/drop2.ts
git commit -m "feat: add Drop 2 voicing algorithm"
```

---

## Task 3: Drop 2 tab UI

**Files:**
- Create: `src/components/voicings/Drop2Tab.tsx`
- Modify: `src/pages/Voicings.tsx` (replace placeholder with `<Drop2Tab />`)

**Interfaces:**
- Consumes from `./drop2`: `computeDrop2Voicings`, `DROP2_QUALITIES`, `Drop2Voicing`, `Drop2Quality`
- Consumes: `Fretboard` from `../Fretboard` — prop `drillDots` shape: `{ stringIdx: number; fret: number; label: string; color?: string }[]`
- Consumes: `initAudio`, `playStrum` from `../../lib/audio`
- Consumes: `ALL_NOTES` from `../../data/guitarData`
- localStorage pattern for + Progression (copy from ShellVoicingsTab — key `guitar_progressions`, active id key `guitar_active_prog_id`, slot shape `{ chord }`)

- [ ] **Step 1: Create `src/components/voicings/Drop2Tab.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { Note, ChordShape, Finger } from '../../types';
import { ALL_NOTES } from '../../data/guitarData';
import { Fretboard } from '../Fretboard';
import { initAudio, playStrum } from '../../lib/audio';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { computeDrop2Voicings, DROP2_QUALITIES, Drop2Voicing, Drop2Quality } from './drop2';

const SET_CONFIG: Record<string, { hex: string }> = {
  '6-3': { hex: '#f59e0b' }, // amber
  '5-2': { hex: '#14b8a6' }, // teal
  '4-1': { hex: '#8b5cf6' }, // violet
};

const INV_COLORS: Record<string, string> = {
  inv0: '#f59e0b',
  inv1: '#14b8a6',
  inv2: '#8b5cf6',
  inv3: '#ec4899',
};

const MUTED_CHORD: ChordShape = {
  name: '',
  frets: [-1,-1,-1,-1,-1,-1],
  fingers: [-1,-1,-1,-1,-1,-1] as Finger[],
};

const INV_LABELS = ['5th in bass', '7th in bass', 'Root in bass', '3rd in bass'];
const INV_KEYS = ['inv0', 'inv1', 'inv2', 'inv3'] as const;

export function Drop2Tab() {
  const [root, setRoot] = useState<Note>('G');
  const [qualityKey, setQualityKey] = useState('maj7');
  const [activeInversions, setActiveInversions] = useState<Set<string>>(
    new Set(INV_KEYS)
  );
  const [activeStringSets, setActiveStringSets] = useState<Set<string>>(
    new Set(['6-3', '5-2', '4-1'])
  );
  const [playingNotes, setPlayingNotes] = useState<Set<string>>(new Set());
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const quality = DROP2_QUALITIES.find(q => q.key === qualityKey) as Drop2Quality;

  const allVoicings = useMemo(
    () => computeDrop2Voicings(root, quality),
    [root, quality]
  );

  const voicings = useMemo(
    () => allVoicings.filter(v =>
      activeInversions.has(v.inversionKey) && activeStringSets.has(v.setKey)
    ),
    [allVoicings, activeInversions, activeStringSets]
  );

  const drillDots = useMemo(() =>
    voicings.flatMap(v =>
      v.strings.map((si, i) => ({
        stringIdx: si,
        fret: v.frets[si],
        label: v.notes[i].role,
        color: SET_CONFIG[v.setKey].hex,
      }))
    ),
    [voicings]
  );

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
      frets: v.frets,
      fingers: v.frets.map(f => (f === -1 ? -1 : 0)) as Finger[],
    };
    try {
      const raw = localStorage.getItem('guitar_progressions');
      const activeId = localStorage.getItem('guitar_active_prog_id');
      if (raw && activeId) {
        const progs = JSON.parse(raw);
        const updated = progs.map((p: any) =>
          p.id === activeId ? { ...p, slots: [...p.slots, { chord }] } : p
        );
        localStorage.setItem('guitar_progressions', JSON.stringify(updated));
        window.dispatchEvent(new Event('guitar_progressions_updated'));
      }
    } catch { /* ignore */ }
    setAddedIndices(prev => new Set(prev).add(index));
    setTimeout(() => setAddedIndices(prev => {
      const next = new Set(prev); next.delete(index); return next;
    }), 1500);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-brand-secondary">
        Four-note voicings derived by dropping the second-highest note of a close-position chord down an octave. Produces open, resonant shapes used throughout jazz comping.
      </p>

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

      {/* Inversion filter */}
      <div>
        <p className="text-xs font-semibold text-brand-secondary uppercase tracking-wider mb-2">Inversions</p>
        <div className="flex flex-wrap gap-1.5">
          {INV_KEYS.map((key, i) => {
            const active = activeInversions.has(key);
            return (
              <button key={key} onClick={() => toggleInversion(key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  active ? 'text-white border-transparent' : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink'
                )}
                style={active ? { backgroundColor: INV_COLORS[key] } : undefined}>
                {INV_LABELS[i]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-neck fretboard */}
      <div onMouseEnter={initAudio}>
        <Fretboard
          fretsNum={15}
          chord={MUTED_CHORD}
          drillDots={drillDots}
          playingNotes={playingNotes}
          showNoteNames={false}
          compact
        />
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

                {/* Fret map — 4 cells */}
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {v.strings.map((si, ri) => (
                    <div key={si} className="bg-brand-bg rounded px-1 py-1.5 border border-brand-line">
                      <div className="text-brand-secondary">str {6 - si}</div>
                      <div className="font-bold text-brand-ink tabular-nums">
                        {v.notes[ri].role}={v.frets[si] === 0 ? 'open' : v.frets[si]}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => handlePlay(v)} onMouseEnter={initAudio}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:opacity-90"
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

In `src/pages/Voicings.tsx`, add the import and replace the placeholder:

```typescript
// Add at top with other imports:
import { Drop2Tab } from '../components/voicings/Drop2Tab';

// Replace:
{tab === 'drop2' && <div className="text-brand-secondary text-sm py-4">Drop 2 loading…</div>}
// With:
{tab === 'drop2' && <Drop2Tab />}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/components/voicings/Drop2Tab.tsx src/pages/Voicings.tsx
git commit -m "feat: add Drop 2 voicings tab"
```

- [ ] **Step 5: Push**

```bash
git push
```
