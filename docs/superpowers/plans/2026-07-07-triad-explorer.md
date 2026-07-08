# Triad Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/triads` page where users explore all chord tones (R/3/5/7) across the guitar neck for any root + quality, linked to a playable chord progression that auto-updates the fretboard view as each chord plays.

**Architecture:** A full-neck Fretboard driven entirely by computed `drillDots` (chord tones with custom colors) and an optional `scale` + `scalePositions` overlay (scale notes that are not chord tones). State is persisted to `localStorage` with a `triads_` prefix. Playback uses the existing `playProgressionWithPatterns` audio function with an `onChordChange` callback that updates which chord's tones the Fretboard displays.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tone.js (via `src/lib/audio.ts`), React Router v7

## Global Constraints

- No test framework exists — `npm run lint` (tsc --noEmit) is the only static check; manual browser verification replaces automated tests.
- Route must work under `basename="/Guitar_Chords"` — add via React Router `<Route>` in `App.tsx`.
- All localStorage keys prefixed `triads_`.
- Guitar string indexing: 0 = low E (E2/MIDI 40), 5 = high E (E4/MIDI 64). Open MIDI pitches: `[40, 45, 50, 55, 59, 64]`.
- Do NOT import from `audio.ts` inside `triadData.ts` — keep the data layer pure; audio imports belong in page components.
- Scale overlay uses Fretboard's existing `scale` + `scalePositions` props — no new Fretboard props required beyond `color` on `drillDots`.

---

### Task 1: Data layer — `src/data/triadData.ts`

**Files:**
- Create: `src/data/triadData.ts`

**Interfaces:**
- Produces: `StringGroup` type, `ChordToneDot` interface, `CHORD_TONE_QUALITIES` constant, `generateChordToneDots(root, qualityKey, stringGroup)`, `generateScalePositions(root, scaleDef)`

- [ ] **Step 1: Create `src/data/triadData.ts`**

```typescript
import { Note } from '../types';
import { ALL_NOTES, generateScalePattern } from './guitarData';

export type StringGroup = 'all' | 'EAD' | 'ADG' | 'DGB' | 'GBE';

export interface ChordToneDot {
  stringIdx: number;
  fret: number;
  label: string;
  color: string;
}

export const CHORD_TONE_QUALITIES: Record<string, { label: string; intervals: number[] }> = {
  major:    { label: 'Major',    intervals: [0, 4, 7] },
  minor:    { label: 'Minor',    intervals: [0, 3, 7] },
  dim:      { label: 'Dim',      intervals: [0, 3, 6] },
  aug:      { label: 'Aug',      intervals: [0, 4, 8] },
  dom7:     { label: 'Dom 7',    intervals: [0, 4, 7, 10] },
  maj7:     { label: 'Maj 7',    intervals: [0, 4, 7, 11] },
  min7:     { label: 'Min 7',    intervals: [0, 3, 7, 10] },
  minmaj7:  { label: 'Min Maj7', intervals: [0, 3, 7, 11] },
  m7b5:     { label: 'm7b5',     intervals: [0, 3, 6, 10] },
  dim7:     { label: 'Dim 7',    intervals: [0, 3, 6, 9] },
  aug7:     { label: 'Aug 7',    intervals: [0, 4, 8, 10] },
  augmaj7:  { label: 'Aug Maj7', intervals: [0, 4, 8, 11] },
  sus2:     { label: 'Sus 2',    intervals: [0, 2, 7] },
  sus4:     { label: 'Sus 4',    intervals: [0, 5, 7] },
  sus4dom7: { label: '7sus4',    intervals: [0, 5, 7, 10] },
};

const INTERVAL_LABELS: Record<number, string> = {
  0: 'R', 2: '2', 3: 'b3', 4: '3', 5: '4',
  6: 'b5', 7: '5', 8: '#5', 9: 'bb7', 10: 'b7', 11: 'maj7',
};

function intervalColor(interval: number): string {
  if (interval === 0) return '#e74c3c';                      // Root — red
  if (interval === 3 || interval === 4) return '#2980b9';   // 3rd — blue
  if (interval >= 6 && interval <= 8) return '#27ae60';     // 5th — green
  if (interval >= 9 && interval <= 11) return '#8e44ad';    // 7th — purple
  return '#e67e22';                                          // Sus (2, 5) — orange
}

const OPEN_PITCHES = [40, 45, 50, 55, 59, 64]; // low E → high E

const STRING_GROUP_STRINGS: Record<StringGroup, number[]> = {
  all: [0, 1, 2, 3, 4, 5],
  EAD: [0, 1, 2],
  ADG: [1, 2, 3],
  DGB: [2, 3, 4],
  GBE: [3, 4, 5],
};

export function generateChordToneDots(
  root: Note,
  qualityKey: string,
  stringGroup: StringGroup,
): ChordToneDot[] {
  const quality = CHORD_TONE_QUALITIES[qualityKey];
  if (!quality) return [];
  const rootMidi = ALL_NOTES.indexOf(root);
  const allowed = new Set(STRING_GROUP_STRINGS[stringGroup] ?? STRING_GROUP_STRINGS.all);
  const dots: ChordToneDot[] = [];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    if (!allowed.has(sIdx)) continue;
    for (let fret = 0; fret <= 15; fret++) {
      const interval = (OPEN_PITCHES[sIdx] + fret - rootMidi + 120) % 12;
      if (quality.intervals.includes(interval)) {
        dots.push({
          stringIdx: sIdx,
          fret,
          label: INTERVAL_LABELS[interval] ?? String(interval),
          color: intervalColor(interval),
        });
      }
    }
  }
  return dots;
}

export function generateScalePositions(
  root: Note,
  scaleDef: { name: string; intervals: number[] },
): Set<string> {
  const pattern = generateScalePattern(root, scaleDef);
  const scaleIndices = new Set(pattern.notes.map(n => ALL_NOTES.indexOf(n as Note)));
  const positions = new Set<string>();
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    for (let fret = 0; fret <= 15; fret++) {
      if (scaleIndices.has((OPEN_PITCHES[sIdx] + fret) % 12)) {
        positions.add(`${sIdx}-${fret}`);
      }
    }
  }
  return positions;
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/triadData.ts
git commit -m "feat: add triadData — chord tone qualities, dot computation, scale positions"
```

---

### Task 2: Fretboard — `color` support on `drillDots`

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: existing `drillDots` type at line 52, drillDot render block around line 164, circle element around line 207
- Produces: updated drillDots type with `color?: string`; inline `style` applied to circle when `dot.color` is set

- [ ] **Step 1: Extend the drillDots type (line 52)**

In `src/components/Fretboard.tsx`, change line 52 from:
```typescript
  drillDots?: { stringIdx: number; fret: number; label: string; highlight?: boolean }[];
```
to:
```typescript
  drillDots?: { stringIdx: number; fret: number; label: string; highlight?: boolean; color?: string }[];
```

- [ ] **Step 2: Skip Tailwind fill class when `dot.color` is present (around line 164)**

Change the drillDot render block from:
```typescript
    if (drillDot) {
      show = true;
      text = drillDot.label;
      bgColor = drillDot.highlight ? 'fill-amber-400' : 'fill-brand-primary';
      textColor = drillDot.highlight ? 'fill-white' : 'fill-white';
    }
```
to:
```typescript
    if (drillDot) {
      show = true;
      text = drillDot.label;
      bgColor = drillDot.color ? '' : (drillDot.highlight ? 'fill-amber-400' : 'fill-brand-primary');
      textColor = 'fill-white';
    }
```

- [ ] **Step 3: Apply inline `style` on the circle (around line 207)**

Change the circle element from:
```tsx
        <circle cx={x} cy={y} r={fretIdx === 0 ? 10 : 14} className={cn("stroke-2 shadow-lg", fretIdx === 0 ? openStringBase : "stroke-white/20 print:stroke-black print:fill-white", bgColor)} />
```
to:
```tsx
        <circle cx={x} cy={y} r={fretIdx === 0 ? 10 : 14} className={cn("stroke-2 shadow-lg", fretIdx === 0 ? openStringBase : "stroke-white/20 print:stroke-black print:fill-white", bgColor)} style={drillDot?.color ? { fill: drillDot.color } : undefined} />
```

Inline SVG `style.fill` has higher specificity than CSS classes, so it overrides any Tailwind `fill-*` class (which is now `''` when `color` is set).

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Fretboard.tsx
git commit -m "feat: add optional color field to Fretboard drillDots for custom SVG fill"
```

---

### Task 3: `src/pages/Triads.tsx` — toolbar + static fretboard

**Files:**
- Create: `src/pages/Triads.tsx`

**Interfaces:**
- Consumes: `generateChordToneDots`, `generateScalePositions`, `StringGroup`, `ChordToneDot`, `CHORD_TONE_QUALITIES` from `src/data/triadData.ts`; `Fretboard` from `src/components/Fretboard.tsx`; `COMMON_SCALES`, `generateScalePattern`, `ALL_NOTES` from `src/data/guitarData.ts`; `Note` from `src/types.ts`
- Produces: `default export Triads` React component

- [ ] **Step 1: Create `src/pages/Triads.tsx` with state, toolbar, legend, and fretboard**

```tsx
import { useState, useMemo } from 'react';
import { Note } from '../types';
import { ALL_NOTES, COMMON_SCALES, generateScalePattern } from '../data/guitarData';
import {
  CHORD_TONE_QUALITIES, StringGroup, ChordToneDot,
  generateChordToneDots, generateScalePositions,
} from '../data/triadData';
import { Fretboard } from '../components/Fretboard';

// --- LocalStorage helpers ---
function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`triads_${key}`);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(`triads_${key}`, JSON.stringify(value)); } catch { /* quota */ }
}

// --- Constants ---
const STRING_GROUP_LABELS: { key: StringGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'EAD', label: 'E·A·D' },
  { key: 'ADG', label: 'A·D·G' },
  { key: 'DGB', label: 'D·G·B' },
  { key: 'GBE', label: 'G·B·E' },
];

const QUALITY_GROUPS = [
  { group: 'Triads', keys: ['major', 'minor', 'dim', 'aug'] },
  { group: '7ths',   keys: ['dom7', 'maj7', 'min7', 'minmaj7', 'm7b5', 'dim7', 'aug7', 'augmaj7'] },
  { group: 'Sus',    keys: ['sus2', 'sus4', 'sus4dom7'] },
];

const LEGEND = [
  { color: '#e74c3c', label: 'Root' },
  { color: '#2980b9', label: '3rd' },
  { color: '#27ae60', label: '5th' },
  { color: '#8e44ad', label: '7th' },
  { color: '#e67e22', label: 'Sus' },
];

// --- Component ---
export default function Triads() {
  const [selectedKey, setSelectedKey]         = useState<Note>(() => lsGet('key', 'C'));
  const [selectedQuality, setSelectedQuality] = useState<string>(() => lsGet('quality', 'major'));
  const [stringGroup, setStringGroup]         = useState<StringGroup>(() => lsGet('stringGroup', 'all'));
  const [scaleOn, setScaleOn]                 = useState<boolean>(() => lsGet('scaleOn', false));
  const [scaleRoot, setScaleRoot]             = useState<Note>(() => lsGet('scaleRoot', 'C'));
  const [scaleType, setScaleType]             = useState<string>(() => lsGet('scaleType', 'Major (Ionian)'));

  // Wrapped setters that persist to localStorage
  const setKey = (v: Note) => { setSelectedKey(v); lsSet('key', v); };
  const setQuality = (v: string) => { setSelectedQuality(v); lsSet('quality', v); };
  const setGroup = (v: StringGroup) => { setStringGroup(v); lsSet('stringGroup', v); };
  const setScale = (v: boolean) => { setScaleOn(v); lsSet('scaleOn', v); };
  const setSRoot = (v: Note) => { setScaleRoot(v); lsSet('scaleRoot', v); };
  const setSType = (v: string) => { setScaleType(v); lsSet('scaleType', v); };

  // These are overridden during playback (Task 4 will add displayKey/displayQuality)
  const displayKey = selectedKey;
  const displayQuality = selectedQuality;

  const chordToneDots: ChordToneDot[] = useMemo(
    () => generateChordToneDots(displayKey, displayQuality, stringGroup),
    [displayKey, displayQuality, stringGroup],
  );

  const { activeScalePattern, scaleOnlyPositions } = useMemo(() => {
    if (!scaleOn) return { activeScalePattern: undefined, scaleOnlyPositions: undefined };
    const scaleDef = COMMON_SCALES.find(s => s.name === scaleType);
    if (!scaleDef) return { activeScalePattern: undefined, scaleOnlyPositions: undefined };
    const pattern = generateScalePattern(scaleRoot, scaleDef);
    const allPos = generateScalePositions(scaleRoot, scaleDef);
    const ctKeys = new Set(chordToneDots.map(d => `${d.stringIdx}-${d.fret}`));
    const onlyPos = new Set([...allPos].filter(k => !ctKeys.has(k)));
    return { activeScalePattern: pattern, scaleOnlyPositions: onlyPos };
  }, [scaleOn, scaleRoot, scaleType, chordToneDots]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-brand-surface rounded-xl p-3 border border-brand-line">
        {/* Key selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-brand-secondary">Key</span>
          <select
            value={selectedKey}
            onChange={e => setKey(e.target.value as Note)}
            className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
          >
            {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-brand-secondary">Quality</span>
          <select
            value={selectedQuality}
            onChange={e => setQuality(e.target.value)}
            className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
          >
            {QUALITY_GROUPS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.keys.map(k => (
                  <option key={k} value={k}>{CHORD_TONE_QUALITIES[k]?.label ?? k}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* String group filter */}
        <div className="flex items-center gap-1">
          {STRING_GROUP_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGroup(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                stringGroup === key
                  ? 'bg-brand-active text-white'
                  : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scale toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setScale(!scaleOn)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              scaleOn
                ? 'bg-brand-primary text-white'
                : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
            }`}
          >
            Scale {scaleOn ? 'ON' : 'OFF'}
          </button>
          {scaleOn && (
            <>
              <select
                value={scaleRoot}
                onChange={e => setSRoot(e.target.value as Note)}
                className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
              >
                {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select
                value={scaleType}
                onChange={e => setSType(e.target.value)}
                className="bg-brand-bg border border-brand-line rounded-lg px-2 py-1 text-sm text-brand-ink"
              >
                {COMMON_SCALES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap px-1">
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            <span className="text-xs text-brand-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Fretboard */}
      <Fretboard
        fretsNum={15}
        drillDots={chordToneDots}
        scale={activeScalePattern}
        scalePositions={scaleOnlyPositions}
        showNoteNames={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No errors.

---

### Task 4: `src/pages/Triads.tsx` — progression strip + playback

**Files:**
- Modify: `src/pages/Triads.tsx` (add imports, helpers, state, strip JSX, import modal)

**Interfaces:**
- Consumes: `playProgressionWithPatterns`, `initAudio`, `getFretNote` from `src/lib/audio.ts`; `COMMON_CHORDS` from `src/data/guitarData.ts`; `ChordShape` from `src/types.ts`

- [ ] **Step 1: Add new imports at top of `src/pages/Triads.tsx`**

Add to the existing imports:
```tsx
import { useRef } from 'react';
import { ChordShape } from '../types';
import { COMMON_CHORDS } from '../data/guitarData';
import { initAudio, playProgressionWithPatterns, getFretNote } from '../lib/audio';
```

(Also add `useRef` to the existing `{ useState, useMemo }` import from 'react'.)

- [ ] **Step 2: Add module-level helper functions (before the `Triads` component)**

```typescript
function inferQuality(chordName: string): string {
  if (/m7b5/i.test(chordName))     return 'm7b5';
  if (/dim7/i.test(chordName))     return 'dim7';
  if (/aug7/i.test(chordName))     return 'aug7';
  if (/augmaj7/i.test(chordName))  return 'augmaj7';
  if (/minmaj7/i.test(chordName))  return 'minmaj7';
  if (/maj7/i.test(chordName))     return 'maj7';
  if (/ m7[\s(]/i.test(chordName)) return 'min7';
  if (/sus4dom7/i.test(chordName)) return 'sus4dom7';
  if (/sus4/i.test(chordName))     return 'sus4';
  if (/sus2/i.test(chordName))     return 'sus2';
  if (/ 7[\s(]/i.test(chordName))  return 'dom7';
  if (/\baug\b/i.test(chordName))  return 'aug';
  if (/dim/i.test(chordName))      return 'dim';
  if (/minor/i.test(chordName))    return 'minor';
  return 'major';
}

function findBestChordShape(root: Note, qualityKey: string): ChordShape | undefined {
  const shapes = COMMON_CHORDS[root] ?? [];
  if (!shapes.length) return undefined;
  const n = (s: ChordShape) => s.name.toLowerCase();
  const match = (() => {
    switch (qualityKey) {
      case 'major':   return shapes.find(s => n(s).includes('major'));
      case 'minor':   return shapes.find(s => n(s).includes('minor') && !n(s).includes('minmaj'));
      case 'dom7':    return shapes.find(s => / 7[\s(]/i.test(s.name) && !/(maj7|m7b5|dim7)/i.test(s.name));
      case 'maj7':    return shapes.find(s => /maj7/i.test(s.name));
      case 'min7':    return shapes.find(s => / m7[\s(]/i.test(s.name) && !/m7b5/i.test(s.name));
      case 'm7b5':    return shapes.find(s => /m7b5/i.test(s.name));
      case 'dim7':    return shapes.find(s => /dim7/i.test(s.name));
      case 'dim':     return shapes.find(s => /dim/i.test(s.name) && !/dim7/i.test(s.name));
      case 'aug':     return shapes.find(s => /\baug\b/i.test(s.name) && !/aug7|augmaj7/i.test(s.name));
      case 'sus2':    return shapes.find(s => /sus2/i.test(s.name));
      case 'sus4':    return shapes.find(s => /sus4/i.test(s.name) && !/sus4dom7/i.test(s.name));
      default:        return undefined;
    }
  })();
  return match ?? shapes[0];
}
```

- [ ] **Step 3: Add progression + playback state inside the `Triads` component**

Inside `Triads()`, after the existing state declarations, add:

```tsx
  type ProgChord = { root: Note; qualityKey: string };

  const [progression, setProgression] = useState<ProgChord[]>(
    () => lsGet<ProgChord[]>('progression', [])
  );
  const [bpm, setBpmState]                = useState<number>(() => lsGet('bpm', 80));
  const [beatsPerChord, setBpcState]      = useState<1|2|4|8>(() => lsGet('beatsPerChord', 4));
  const [loop, setLoopState]              = useState<boolean>(() => lsGet('loop', true));
  const [isPlaying, setIsPlaying]         = useState(false);
  const [activeChordIdx, setActiveChordIdx] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [savedProgressions, setSavedProgressions] = useState<
    Array<{ name: string; slots: Array<{ chord: { name: string } }> }>
  >([]);
  const stopRef = useRef<(() => void) | null>(null);

  const setBpm  = (v: number)    => { setBpmState(v);  lsSet('bpm', v); };
  const setBpc  = (v: 1|2|4|8)  => { setBpcState(v);  lsSet('beatsPerChord', v); };
  const setLoop = (v: boolean)   => { setLoopState(v); lsSet('loop', v); };
  const setProg = (v: ProgChord[]) => { setProgression(v); lsSet('progression', v); };
```

- [ ] **Step 4: Replace the `displayKey`/`displayQuality` placeholders**

Replace:
```tsx
  // These are overridden during playback (Task 4 will add displayKey/displayQuality)
  const displayKey = selectedKey;
  const displayQuality = selectedQuality;
```
with:
```tsx
  const displayKey = (isPlaying && activeChordIdx !== null && progression[activeChordIdx])
    ? progression[activeChordIdx].root
    : selectedKey;
  const displayQuality = (isPlaying && activeChordIdx !== null && progression[activeChordIdx])
    ? progression[activeChordIdx].qualityKey
    : selectedQuality;
```

- [ ] **Step 5: Add playback handlers inside the component**

```tsx
  async function handlePlay() {
    if (progression.length === 0) return;
    await initAudio();
    const adjustedBpm = bpm * 4 / beatsPerChord;
    const slots = progression.map(({ root, qualityKey }) => {
      const shape = findBestChordShape(root, qualityKey);
      if (!shape) return { notesByString: Array<string | null>(6).fill(null) };
      return {
        notesByString: shape.frets.map((f, sIdx) =>
          f === -1 ? null : getFretNote(sIdx, f)
        ),
      };
    });
    stopRef.current?.();
    setActiveChordIdx(0);
    setIsPlaying(true);
    stopRef.current = playProgressionWithPatterns(
      slots, adjustedBpm, loop,
      idx => setActiveChordIdx(idx),
    );
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setIsPlaying(false);
    setActiveChordIdx(null);
  }
```

The `adjustedBpm` formula maps beats-per-chord onto the function's fixed 4-beat-per-slot behaviour:
- `beatsPerChord=4` → `adjustedBpm = bpm` (no change)
- `beatsPerChord=2` → `adjustedBpm = 2×bpm` (slot passes in half the real time)
- `beatsPerChord=8` → `adjustedBpm = bpm/2` (slot takes twice the real time)

- [ ] **Step 6: Add import modal handlers**

```tsx
  function openImportModal() {
    try {
      const raw = localStorage.getItem('guitar_progressions');
      if (!raw) return;
      const progs = JSON.parse(raw) as Array<{
        name: string;
        slots: Array<{ chord: { name: string } }>;
      }>;
      setSavedProgressions(progs);
      setShowImportModal(true);
    } catch { /* ignore */ }
  }

  function applyImport(prog: { slots: Array<{ chord: { name: string } }> }) {
    const chords: ProgChord[] = prog.slots.map(slot => ({
      root: slot.chord.name.split(' ')[0] as Note,
      qualityKey: inferQuality(slot.chord.name),
    }));
    setProg(chords);
    setShowImportModal(false);
  }
```

- [ ] **Step 7: Add progression strip + import modal to the JSX `return`**

In the component's `return`, AFTER the `<Fretboard .../>` element and BEFORE the closing `</div>`, add:

```tsx
      {/* Progression strip */}
      <div className="bg-brand-surface rounded-xl p-3 border border-brand-line">
        {/* Play controls row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            onClick={isPlaying ? handleStop : handlePlay}
            disabled={progression.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium disabled:opacity-40"
          >
            {isPlaying ? '⏹ Stop' : '▶ Play'}
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary">BPM</span>
            <input
              type="number"
              min={40} max={240}
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              className="w-16 bg-brand-bg border border-brand-line rounded px-2 py-1 text-sm text-brand-ink text-center"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-secondary">Beats</span>
            {([1, 2, 4, 8] as const).map(b => (
              <button
                key={b}
                onClick={() => setBpc(b)}
                className={`w-8 h-7 rounded text-xs font-medium transition-colors ${
                  beatsPerChord === b
                    ? 'bg-brand-active text-white'
                    : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLoop(!loop)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              loop
                ? 'bg-brand-active text-white'
                : 'bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink'
            }`}
          >
            Loop {loop ? 'ON' : 'OFF'}
          </button>

          <div className="ml-auto flex gap-2">
            <button
              onClick={openImportModal}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink"
            >
              Import
            </button>
            <button
              onClick={() => setProg([...progression, { root: 'C', qualityKey: 'major' }])}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-bg border border-brand-line text-brand-secondary hover:text-brand-ink"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Chord cards */}
        <div className="flex gap-2 flex-wrap">
          {progression.length === 0 && (
            <p className="text-xs text-brand-secondary italic">
              Add chords below or import from Progressions
            </p>
          )}
          {progression.map((chord, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1 p-2 rounded-lg border transition-colors ${
                isPlaying && activeChordIdx === idx
                  ? 'border-brand-active bg-brand-active/10 shadow-sm'
                  : 'border-brand-line bg-brand-bg'
              }`}
            >
              <select
                value={chord.root}
                onChange={e => {
                  const next = [...progression];
                  next[idx] = { ...chord, root: e.target.value as Note };
                  setProg(next);
                }}
                className="bg-transparent text-sm text-brand-ink border-none outline-none"
              >
                {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select
                value={chord.qualityKey}
                onChange={e => {
                  const next = [...progression];
                  next[idx] = { ...chord, qualityKey: e.target.value };
                  setProg(next);
                }}
                className="bg-transparent text-xs text-brand-secondary border-none outline-none"
              >
                {QUALITY_GROUPS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.keys.map(k => (
                      <option key={k} value={k}>{CHORD_TONE_QUALITIES[k]?.label ?? k}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => setProg(progression.filter((_, i) => i !== idx))}
                className="text-brand-secondary hover:text-red-500 text-xs ml-1 leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-brand-surface rounded-xl p-6 max-w-sm w-full mx-4 border border-brand-line shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-brand-ink mb-3">Import from Progressions</h3>
            {savedProgressions.length === 0 ? (
              <p className="text-sm text-brand-secondary">No saved progressions found.</p>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {savedProgressions.map((prog, i) => (
                  <li key={i}>
                    <button
                      onClick={() => applyImport(prog)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-ink hover:bg-brand-bg border border-transparent hover:border-brand-line"
                    >
                      <span className="font-medium">{prog.name || `Progression ${i + 1}`}</span>
                      <span className="text-brand-secondary ml-2">
                        ({prog.slots?.length ?? 0} chords)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowImportModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-brand-bg border border-brand-line text-sm text-brand-secondary hover:text-brand-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 8: Lint check**

Run: `npm run lint`
Expected: No errors. Common issues to look for:
- If `lsGet<ProgChord[]>('progression', [])` causes a type error, annotate: `lsGet('progression', [] as ProgChord[])`.
- If `COMMON_CHORDS[root]` produces a type error because `root` could be a string not in `ALL_NOTES`, add `as Note`.
- If `Array<string | null>(6).fill(null)` type errors, change to `(Array(6) as (string | null)[]).fill(null)`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Triads.tsx
git commit -m "feat: add Triads page — chord tone explorer with progression builder and playback"
```

---

### Task 5: App.tsx — route + nav

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Triads` default export from `src/pages/Triads.tsx`
- Produces: `/triads` route in `<Routes>`, `Target` icon in navigation

- [ ] **Step 1: Read `src/App.tsx` to locate the Routes block and nav pattern**

Look for:
1. Where other page imports are (top of file, e.g. `import Dictionary from './pages/Dictionary'`)
2. Where `<Route>` elements are added inside `<Routes>`
3. The pattern used for nav links (e.g. `<NavLink to="...">`, a custom `NavItem` component, or `<Link>`)
4. Where the other nav icons (`BookOpen`, `Music`, etc.) from lucide-react are listed

- [ ] **Step 2: Add import for `Triads` and `Target`**

At the top of `src/App.tsx`, alongside the other page imports add:
```tsx
import Triads from './pages/Triads';
```

And to the lucide-react import line, add `Target`:
```tsx
import { ..., Target } from 'lucide-react';
```

- [ ] **Step 3: Add the `/triads` route**

Inside the `<Routes>` block, alongside the other `<Route>` elements, add:
```tsx
<Route path="/triads" element={<Triads />} />
```

- [ ] **Step 4: Add the nav link**

Using the same pattern as the other nav links in `App.tsx`, add a Triad Explorer link with the `Target` icon. For example, if the existing pattern is:
```tsx
<NavLink to="/dictionary" title="Dictionary"><BookOpen size={20} /></NavLink>
```
then add:
```tsx
<NavLink to="/triads" title="Triad Explorer"><Target size={20} /></NavLink>
```

Place it logically near the other guitar-learning tools (after Dictionary or Scale Positions).

- [ ] **Step 5: Lint check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 6: Start dev server and verify in browser**

Run: `npm run dev`

Manual verification checklist:
- Target icon appears in the navigation bar
- Clicking it navigates to `/Guitar_Chords/triads`
- Changing root → chord tone dots update immediately
- Changing quality → dots update (try Major vs Minor vs Dom7 — note the 3rd changes)
- String group filter (EAD) → only low 3 strings show dots
- Scale toggle ON → scale overlay appears as softer background dots
- Scale root/type selectors appear when scale is ON
- Adding 3 chords to progression strip → cards appear
- Play button is disabled when strip is empty
- Clicking Play → fretboard updates to first chord's tones, active card highlighted
- Chord changes fire and fretboard re-renders each time
- Stop → fretboard reverts to manually-selected key/quality
- BPM and Beats-per-chord controls affect playback tempo
- Import button → modal shows saved progressions (if any in Progressions page)
- Page refresh → all state restored from localStorage

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /triads route and Target nav icon for Triad Explorer"
```

---

## Self-Review

**Spec coverage:**
- ✓ Route `/triads` → Task 5
- ✓ Nav icon `Target` from lucide-react → Task 5
- ✓ localStorage prefix `triads_` (all 10 keys) → Tasks 3 + 4
- ✓ 15 chord qualities in 3 groups → Task 1
- ✓ Tone role colors (Root/3rd/5th/7th/Sus) → Task 1
- ✓ `generateChordToneDots` with string group filtering → Task 1
- ✓ `generateScalePositions` (chord-tone positions excluded) → Task 1
- ✓ String group pills (All/E·A·D/A·D·G/D·G·B/G·B·E) → Task 3
- ✓ Scale toggle + root/type selectors → Task 3
- ✓ Scale overlay via `scale` + `scalePositions` props → Task 3
- ✓ `drillDots.color` Fretboard extension → Task 2
- ✓ Fretboard `fretsNum=15` → Task 3
- ✓ Legend (R/3/5/7/Sus) → Task 3
- ✓ Progression inline builder (add, root+quality, remove) → Task 4
- ✓ Import from `guitar_progressions` localStorage → Task 4
- ✓ `inferQuality` maps chord names to quality keys → Task 4
- ✓ `findBestChordShape` for playback voicing lookup → Task 4
- ✓ Playback via `playProgressionWithPatterns` → Task 4
- ✓ `onChordChange` → `activeChordIdx` → fretboard update → Task 4
- ✓ BPM + beats-per-chord (1/2/4/8) → Task 4
- ✓ Loop toggle → Task 4
- ✓ Active chord card highlighted during playback → Task 4
- ✓ Scale overlay fixed during playback (not per-chord) → follows from scale state not changing during play

**Placeholder scan:** None.

**Type consistency:**
- `ChordToneDot` produced in Task 1, consumed in Task 3 ✓
- `StringGroup` produced in Task 1, used in Task 3 ✓
- `generateChordToneDots(root: Note, qualityKey: string, stringGroup: StringGroup): ChordToneDot[]` matches usage in Task 3 ✓
- `generateScalePositions(root: Note, scaleDef: {name: string; intervals: number[]}): Set<string>` matches `COMMON_SCALES` entry type and usage in Task 3 ✓
- `drillDots?: { ...; color?: string }[]` added in Task 2, passed in Task 3 ✓
- `playProgressionWithPatterns(slots, adjustedBpm, loop, onChordChange)` matches `audio.ts` line 436 signature ✓
- `getFretNote(sIdx, f)` from `audio.ts` returns `"C4"` format required by playback slots ✓
- `COMMON_CHORDS[root]` returns `ChordShape[]`; `ChordShape.frets` is `number[]` (length 6) ✓
