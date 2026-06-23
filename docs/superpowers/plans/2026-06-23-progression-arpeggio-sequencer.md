# Progression Arpeggio Sequencer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-chord drum-machine step sequencer to the Progressions page so each chord slot can have a custom arpeggio pattern (6 string rows × N steps, each step with configurable duration), playable in sequence at a global BPM.

**Architecture:** Extend the data model with `ChordSlot` (wraps a chord + optional pattern), migrate `Progression` to use `slots`, add a `playProgressionWithPatterns` function to the audio module, and wire a collapsible sequencer panel into Progressions.tsx. All scheduling uses `Tone.Draw.schedule` with a `stopRequested` flag — no Tone.js Transport needed.

**Tech Stack:** React 19, TypeScript, Tone.js (`Tone.Draw.schedule`, `sampler.releaseAll`), Tailwind CSS v4, lucide-react icons.

## Global Constraints

- No Tone.js Transport — use `Tone.now()` + accumulated offsets, consistent with `playArpeggio`
- `@` alias resolves to project root — import as `@/src/...`
- No test framework — verify with `npm run lint` (tsc --noEmit)
- Tailwind v4 — no `tailwind.config.js`; use CSS variable tokens (`brand-primary`, `brand-ink`, etc.)
- localStorage key stays `'guitar_progressions'` — migrate old format on read
- Print styles on chord cards must be preserved (`print:hidden` on sequencer controls)

---

## File Map

| File | Change |
|---|---|
| `src/types.ts` | Add `ArpeggioStep`, `ArpeggioPattern`, `ChordSlot`; update `Progression` |
| `src/lib/audio.ts` | Add `playProgressionWithPatterns` |
| `src/pages/Progressions.tsx` | Migrate state; add sequencer panel, BPM slider, loop, stop |

---

## Task 1: Data Types

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `ArpeggioStep`, `ArpeggioPattern`, `ChordSlot`, updated `Progression` (consumed by Tasks 2 and 3)

- [ ] **Step 1: Add new types to `src/types.ts`**

Replace the existing `Progression` interface and add new types:

```ts
export interface ArpeggioStep {
  strings: number[];  // active string indices: 0 = low E, 5 = high e
  duration: '16n' | '8n' | '4n' | '2n' | '1n';
}

export interface ArpeggioPattern {
  steps: ArpeggioStep[];
}

export interface ChordSlot {
  chord: ChordShape;
  pattern?: ArpeggioPattern;  // absent = strum (legacy behaviour)
}

export interface Progression {
  id: string;
  name: string;
  bpm: number;    // default 80, range 40–200
  slots: ChordSlot[];  // replaces chords: ChordShape[]
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run lint`
Expected: 0 errors (Progressions.tsx will have errors until Task 3 — fix Task 3 before running lint again)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ArpeggioStep, ArpeggioPattern, ChordSlot types; update Progression"
```

---

## Task 2: Playback Engine

**Files:**
- Modify: `src/lib/audio.ts`

**Interfaces:**
- Consumes: `ArpeggioPattern` from `src/types.ts`
- Produces: `playProgressionWithPatterns(slots, bpm, onChordChange?) => stopFn`

- [ ] **Step 1: Add the duration multiplier map and helper at the bottom of `src/lib/audio.ts`**

```ts
const DURATION_MULTIPLIERS: Record<string, number> = {
  '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4,
};

function stepDurationSeconds(dur: string, bpm: number): number {
  return (60 / bpm) * (DURATION_MULTIPLIERS[dur] ?? 1);
}
```

- [ ] **Step 2: Add `playProgressionWithPatterns` to `src/lib/audio.ts`**

Also add the import at top of file: `import { ArpeggioPattern } from '../types';`

```ts
let _stopRequested = false;
let _loopTimeoutId: ReturnType<typeof setTimeout> | null = null;
const _chordChangeTimeouts: ReturnType<typeof setTimeout>[] = [];

export function playProgressionWithPatterns(
  slots: Array<{ notesByString: (string | null)[]; pattern?: ArpeggioPattern }>,
  bpm: number,
  loop: boolean,
  onChordChange?: (slotIndex: number) => void,
): () => void {
  if (!isInitialized || !sampler) return () => {};

  _stopRequested = false;
  // Clear any pending chord-change UI callbacks from previous playback
  _chordChangeTimeouts.forEach(clearTimeout);
  _chordChangeTimeouts.length = 0;
  if (_loopTimeoutId !== null) { clearTimeout(_loopTimeoutId); _loopTimeoutId = null; }

  const now = Tone.now();
  let offset = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotStart = offset;

    // Schedule UI highlight callback
    const delayMs = slotStart * 1000;
    _chordChangeTimeouts.push(
      setTimeout(() => {
        if (!_stopRequested) onChordChange?.(i);
      }, delayMs) as unknown as ReturnType<typeof setTimeout>
    );

    if (slot.pattern && slot.pattern.steps.length > 0) {
      for (const step of slot.pattern.steps) {
        const t = now + offset;
        const dur = step.duration;
        const notesToPlay = step.strings
          .map(sIdx => slot.notesByString[sIdx])
          .filter((n): n is string => n !== null);

        Tone.Draw.schedule(() => {
          if (_stopRequested) return;
          notesToPlay.forEach(note => {
            sampler!.triggerAttackRelease(note, dur, Tone.now());
          });
        }, t);

        offset += stepDurationSeconds(dur, bpm);
      }
    } else {
      // Strum fallback: play all non-muted strings, hold for 1 bar
      const t = now + offset;
      const strumNotes = slot.notesByString.filter((n): n is string => n !== null);
      Tone.Draw.schedule(() => {
        if (_stopRequested) return;
        strumNotes.forEach((note, idx) => {
          sampler!.triggerAttackRelease(note, '2n', Tone.now() + idx * 0.03);
        });
      }, t);
      offset += (60 / bpm) * 4; // 1 bar
    }
  }

  // Loop
  if (loop) {
    _loopTimeoutId = setTimeout(() => {
      if (!_stopRequested) {
        playProgressionWithPatterns(slots, bpm, loop, onChordChange);
      }
    }, offset * 1000) as unknown as ReturnType<typeof setTimeout>;
  }

  return () => {
    _stopRequested = true;
    _chordChangeTimeouts.forEach(clearTimeout);
    _chordChangeTimeouts.length = 0;
    if (_loopTimeoutId !== null) { clearTimeout(_loopTimeoutId); _loopTimeoutId = null; }
    if (sampler) sampler.releaseAll();
  };
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat: add playProgressionWithPatterns to audio engine"
```

---

## Task 3: Progressions Page UI

**Files:**
- Modify: `src/pages/Progressions.tsx`

**Interfaces:**
- Consumes: `ChordSlot`, `ArpeggioStep`, `ArpeggioPattern`, `Progression` (Task 1); `playProgressionWithPatterns`, `getFretNote` (Task 2 + existing audio.ts)
- Produces: Updated Progressions page with sequencer panel, BPM slider, loop toggle, stop button

### Substep A: Migrate state from `chords` to `slots`

- [ ] **Step 1: Update imports**

In `src/pages/Progressions.tsx`, change:
```ts
import { Progression, ChordShape, Note } from '../types';
```
to:
```ts
import { Progression, ChordShape, ChordSlot, ArpeggioStep, ArpeggioPattern, Note } from '../types';
```

And change:
```ts
import { playStrum, initAudio } from '../lib/audio';
```
to:
```ts
import { playStrum, initAudio, getFretNote, playProgressionWithPatterns } from '../lib/audio';
```

Add to lucide-react imports: `Square, RotateCcw, Pencil, ChevronDown, Sliders` (or whichever icon set fits):
```ts
import { Plus, Trash2, Save, Play, Printer, Disc, GripHorizontal, Square, RotateCcw, Pencil, X } from 'lucide-react';
```

- [ ] **Step 2: Add new state variables at the top of the component**

After existing state declarations, add:
```ts
const [isPlaying, setIsPlaying] = useState(false);
const [activeChordIdx, setActiveChordIdx] = useState<number | null>(null);
const [isLooping, setIsLooping] = useState(false);
const [openSequencerSlotIdx, setOpenSequencerSlotIdx] = useState<number | null>(null);
const stopFnRef = React.useRef<(() => void) | null>(null);
```

- [ ] **Step 3: Add localStorage migration in the `useEffect`**

Replace the existing `useEffect`:
```ts
useEffect(() => {
  const saved = localStorage.getItem('guitar_progressions');
  if (saved) {
    const parsed = JSON.parse(saved);
    // Migrate old format: { chords: ChordShape[] } → { slots: ChordSlot[], bpm: number }
    const migrated = parsed.map((p: any) => {
      if (p.chords && !p.slots) {
        return { ...p, slots: p.chords.map((chord: ChordShape) => ({ chord })), bpm: p.bpm ?? 80 };
      }
      return { ...p, bpm: p.bpm ?? 80 };
    });
    setProgressions(migrated);
  } else {
    const defaultProg: Progression = {
      id: '1',
      name: 'Classic I-V-vi-IV (C Major)',
      bpm: 80,
      slots: [
        COMMON_CHORDS['C'][0],
        COMMON_CHORDS['G'][0],
        COMMON_CHORDS['A'][1],
        COMMON_CHORDS['F'][1],
      ].filter(Boolean).map(chord => ({ chord }))
    };
    setProgressions([defaultProg]);
  }
}, []);
```

- [ ] **Step 4: Update all progression mutation functions to use `slots`**

`createProgression`:
```ts
const createProgression = () => {
  const newProg: Progression = {
    id: Date.now().toString() + Math.random().toString(),
    name: 'New Progression',
    bpm: 80,
    slots: []
  };
  saveProgressions([...progressions, newProg]);
  setActiveProgId(newProg.id);
};
```

`loadPreset` — replace `chords: presetChords.filter(Boolean)` with:
```ts
const newProg: Progression = {
  id: Date.now().toString() + Math.random().toString(),
  name: presetName,
  bpm: 80,
  slots: presetChords.filter(Boolean).map(chord => ({ chord }))
};
```

`addChordToProgression`:
```ts
const addChordToProgression = (chord: ChordShape) => {
  if (!activeProgression) return;
  const updated = progressions.map(p => {
    if (p.id === activeProgression.id) {
      return { ...p, slots: [...p.slots, { chord }] };
    }
    return p;
  });
  saveProgressions(updated);
};
```

Add helpers for updating BPM and slot patterns:
```ts
const updateBpm = (bpm: number) => {
  if (!activeProgression) return;
  saveProgressions(progressions.map(p => p.id === activeProgression.id ? { ...p, bpm } : p));
};

const updateSlotPattern = (slotIdx: number, pattern: ArpeggioPattern) => {
  if (!activeProgression) return;
  const newSlots = activeProgression.slots.map((s, i) => i === slotIdx ? { ...s, pattern } : s);
  saveProgressions(progressions.map(p => p.id === activeProgression.id ? { ...p, slots: newSlots } : p));
};
```

- [ ] **Step 5: Replace `playSequence` with new play handler**

```ts
const handlePlay = async () => {
  if (!activeProgression || activeProgression.slots.length === 0) return;
  await initAudio();

  // Build slot data for audio engine
  const audioSlots = activeProgression.slots.map(slot => ({
    notesByString: slot.chord.frets.map((f, sIdx) =>
      f === -1 ? null : getFretNote(sIdx, f)
    ) as (string | null)[],
    pattern: slot.pattern,
  }));

  setIsPlaying(true);
  setActiveChordIdx(0);

  const stop = playProgressionWithPatterns(
    audioSlots,
    activeProgression.bpm,
    isLooping,
    (idx) => setActiveChordIdx(idx),
  );

  stopFnRef.current = () => {
    stop();
    setIsPlaying(false);
    setActiveChordIdx(null);
  };

  // Auto-clear playing state when done (if not looping)
  if (!isLooping) {
    const totalDuration = audioSlots.reduce((sum, slot) => {
      if (slot.pattern && slot.pattern.steps.length > 0) {
        return sum + slot.pattern.steps.reduce((s, step) => {
          const MULT: Record<string, number> = { '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4 };
          return s + (60 / activeProgression.bpm) * (MULT[step.duration] ?? 1);
        }, 0);
      }
      return sum + (60 / activeProgression.bpm) * 4;
    }, 0);
    setTimeout(() => {
      setIsPlaying(false);
      setActiveChordIdx(null);
    }, totalDuration * 1000 + 200);
  }
};

const handleStop = () => {
  stopFnRef.current?.();
  stopFnRef.current = null;
  setIsPlaying(false);
  setActiveChordIdx(null);
};
```

### Substep B: Update the JSX

- [ ] **Step 6: Update sidebar chord count**

Change:
```tsx
<div className="text-xs text-brand-secondary mt-1">{p.chords.length} chords</div>
```
to:
```tsx
<div className="text-xs text-brand-secondary mt-1">{p.slots.length} chords</div>
```

- [ ] **Step 7: Update the progression header bar (BPM, Play/Stop, Loop)**

Replace the existing Play and Print buttons section:
```tsx
<div className="flex items-center gap-3 print:hidden">
  {/* BPM */}
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">BPM</span>
    <input
      type="range"
      min={40}
      max={200}
      value={activeProgression.bpm}
      onChange={(e) => updateBpm(Number(e.target.value))}
      className="w-24 accent-brand-primary"
    />
    <span className="text-sm font-mono font-bold text-brand-ink w-8">{activeProgression.bpm}</span>
  </div>
  {/* Loop */}
  <button
    onClick={() => setIsLooping(l => !l)}
    title={isLooping ? 'Loop on' : 'Loop off'}
    className={`p-2 rounded-md border transition-colors ${isLooping ? 'bg-brand-primary text-white border-brand-primary' : 'text-brand-secondary border-brand-line hover:text-brand-ink'}`}
  >
    <RotateCcw size={16} />
  </button>
  {/* Play / Stop */}
  {isPlaying ? (
    <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-medium rounded-md hover:bg-red-600 transition-colors">
      <Square size={16} fill="currentColor" /> Stop
    </button>
  ) : (
    <button onClick={handlePlay} onMouseEnter={initAudio} className="flex items-center gap-2 px-6 py-2 bg-[#F2F5F3] text-brand-primary font-medium border border-brand-primary/30 rounded-md hover:bg-brand-primary hover:text-white transition-colors dark:bg-brand-primary/20 dark:hover:bg-brand-primary dark:text-brand-ink">
      <Play size={18} fill="currentColor" /> Play
    </button>
  )}
  <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent text-brand-ink border border-brand-line font-medium rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors">
    <Printer size={18} /> Print
  </button>
  <button onClick={() => deleteProgression(activeProgression.id)} className="flex items-center gap-2 px-3 py-2 bg-transparent text-red-500 border border-brand-line font-medium rounded-md hover:border-red-500 hover:text-red-500 transition-colors" title="Delete Progression">
    <Trash2 size={18} />
  </button>
</div>
```

- [ ] **Step 8: Migrate the chord card Reorder.Group to use `slots`**

Change `values={activeProgression.chords}` → `values={activeProgression.slots}` and update the map and delete handler.

The full updated section:
```tsx
{activeProgression.slots.length > 0 ? (
  <Reorder.Group
    as="div"
    axis="x"
    values={activeProgression.slots}
    onReorder={(newOrder) => {
      const updated = { ...activeProgression, slots: newOrder };
      saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
    }}
    className="flex gap-4 print:gap-4 print:justify-start print:items-start overflow-x-auto pb-4 print:pb-0 print:flex-row print:flex-wrap print:overflow-hidden print:w-full"
  >
    {activeProgression.slots.map((slot, i) => {
      const chord = slot.chord;
      const maxFret = Math.max(...chord.frets);
      const displayFrets = Math.max(5, maxFret <= 5 ? 5 : maxFret + 1);
      const isActive = activeChordIdx === i;
      return (
        <Reorder.Item
          as="div"
          key={`${chord.name}-${i}`}
          value={slot}
          className={`flex-shrink-0 w-48 border rounded-lg p-4 relative group bg-brand-bg print:w-[360px] print:border-none print:shadow-none print:p-0 print:bg-transparent print:mb-8 print:break-inside-avoid cursor-grab active:cursor-grabbing select-none transition-all ${
            isActive ? 'border-brand-primary ring-2 ring-brand-primary shadow-md' : 'border-brand-line'
          }`}
          whileDrag={{ scale: 1.04, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 50 }}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-brand-line opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
            <GripHorizontal size={14} />
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              const updated = { ...activeProgression, slots: activeProgression.slots.filter((_, idx) => idx !== i) };
              saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
            }}
            className="absolute top-2 right-2 p-1.5 bg-brand-surface border border-brand-line rounded-full text-brand-active opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
          >
            <Trash2 size={14} />
          </button>
          {/* Pattern edit button */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpenSequencerSlotIdx(openSequencerSlotIdx === i ? null : i)}
            className={`absolute bottom-2 right-2 p-1.5 rounded-full border transition-all print:hidden ${
              openSequencerSlotIdx === i
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-brand-surface border-brand-line text-brand-secondary opacity-0 group-hover:opacity-100'
            }`}
            title="Edit arpeggio pattern"
          >
            <Pencil size={12} />
          </button>
          {slot.pattern && slot.pattern.steps.length > 0 && (
            <span className="absolute bottom-2 left-2 text-[10px] font-bold text-brand-primary print:hidden">
              {slot.pattern.steps.length} steps
            </span>
          )}
          <h4 className="text-center font-bold text-brand-ink mb-2 mt-3 print:mb-2 print:mt-0 print:text-xl">{chord.name}</h4>
          <Fretboard fretsNum={displayFrets} chord={chord} showNoteNames={false} className="pointer-events-none origin-top print:scale-100 scale-75" />
        </Reorder.Item>
      );
    })}
  </Reorder.Group>
) : (
  <div className="flex gap-4 pb-4">
    <div className="text-brand-secondary/70 p-8 border-2 border-dashed border-brand-line bg-brand-bg/50 rounded-lg w-full text-center">
      No chords yet. Add some from the dictionary below.
    </div>
  </div>
)}
```

- [ ] **Step 9: Add the sequencer panel below the chord cards**

Add this block immediately after the chord card Reorder.Group section and before the "Add Chords Palette" section:

```tsx
{/* Sequencer panel */}
{openSequencerSlotIdx !== null && activeProgression.slots[openSequencerSlotIdx] && (
  <SequencerPanel
    slot={activeProgression.slots[openSequencerSlotIdx]}
    slotIdx={openSequencerSlotIdx}
    bpm={activeProgression.bpm}
    onPatternChange={(pattern) => updateSlotPattern(openSequencerSlotIdx, pattern)}
    onClose={() => setOpenSequencerSlotIdx(null)}
  />
)}
```

- [ ] **Step 10: Implement `SequencerPanel` as a named function before the `Progressions` component**

Add this before the `export function Progressions()` definition:

```tsx
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // index 0 = high e (visual top), index 5 = low E
const VISUAL_TO_STRING_IDX = [5, 4, 3, 2, 1, 0]; // visual row → string index (0=low E)
const DURATION_SYMBOLS: Record<string, string> = {
  '16n': '𝅘𝅥𝅯', '8n': '𝅘𝅥𝅮', '4n': '♩', '2n': '𝅗𝅥', '1n': '𝅝',
};
const DURATION_CYCLE: ArpeggioStep['duration'][] = ['16n', '8n', '4n', '2n', '1n'];

function makePreset(name: string): ArpeggioStep[] {
  const MULT: Record<string, number[]> = {
    'Ascending':         [0, 1, 2, 3, 4, 5, 0, 1],
    'Descending':        [5, 4, 3, 2, 1, 0, 5, 4],
    'Alternating Bass':  [0, 3, 4, 3, 0, 3, 4, 3],
    'Travis Pick':       [0, 4, 2, 4, 0, 4, 2, 4],
  };
  const seq = MULT[name];
  if (!seq) return [];
  return seq.map(sIdx => ({ strings: [sIdx], duration: '4n' as const }));
}

interface SequencerPanelProps {
  slot: ChordSlot;
  slotIdx: number;
  bpm: number;
  onPatternChange: (pattern: ArpeggioPattern) => void;
  onClose: () => void;
}

function SequencerPanel({ slot, slotIdx, bpm, onPatternChange, onClose }: SequencerPanelProps) {
  const steps: ArpeggioStep[] = slot.pattern?.steps ?? [];

  const addStep = () => {
    onPatternChange({ steps: [...steps, { strings: [], duration: '4n' }] });
  };

  const removeStep = () => {
    if (steps.length === 0) return;
    onPatternChange({ steps: steps.slice(0, -1) });
  };

  const toggleCell = (stepIdx: number, stringIdx: number) => {
    const step = steps[stepIdx];
    const newStrings = step.strings.includes(stringIdx)
      ? step.strings.filter(s => s !== stringIdx)
      : [...step.strings, stringIdx].sort((a, b) => a - b);
    const newSteps = steps.map((s, i) => i === stepIdx ? { ...s, strings: newStrings } : s);
    onPatternChange({ steps: newSteps });
  };

  const cycleDuration = (stepIdx: number) => {
    const cur = steps[stepIdx].duration;
    const nextDur = DURATION_CYCLE[(DURATION_CYCLE.indexOf(cur) + 1) % DURATION_CYCLE.length];
    const newSteps = steps.map((s, i) => i === stepIdx ? { ...s, duration: nextDur } : s);
    onPatternChange({ steps: newSteps });
  };

  const loadPreset = (name: string) => {
    if (name === 'Clear') { onPatternChange({ steps: [] }); return; }
    onPatternChange({ steps: makePreset(name) });
  };

  const handlePreview = async () => {
    const { initAudio, getFretNote, playProgressionWithPatterns } = await import('@/src/lib/audio');
    await initAudio();
    const notesByString = slot.chord.frets.map((f, sIdx) =>
      f === -1 ? null : getFretNote(sIdx, f)
    ) as (string | null)[];
    playProgressionWithPatterns([{ notesByString, pattern: slot.pattern }], bpm, false);
  };

  return (
    <div className="border border-brand-primary/30 rounded-xl bg-brand-bg p-4 space-y-3 print:hidden">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-bold text-brand-ink">{slot.chord.name}</span>
        <select
          onChange={(e) => { if (e.target.value) { loadPreset(e.target.value); e.target.value = ''; } }}
          className="text-xs px-2 py-1 rounded border border-brand-line bg-brand-surface text-brand-ink"
        >
          <option value="">Preset…</option>
          <option>Ascending</option>
          <option>Descending</option>
          <option>Alternating Bass</option>
          <option>Travis Pick</option>
          <option>Clear</option>
        </select>
        <div className="flex items-center gap-1">
          <button onClick={removeStep} className="w-6 h-6 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-sm">−</button>
          <span className="text-xs font-mono text-brand-secondary w-14 text-center">{steps.length} steps</span>
          <button
            onClick={addStep}
            disabled={steps.length >= 16}
            className="w-6 h-6 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-sm disabled:opacity-40"
          >+</button>
        </div>
        <button onClick={onClose} className="ml-auto p-1 text-brand-secondary hover:text-brand-ink">
          <X size={16} />
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="text-xs text-brand-secondary/70 text-center py-4">No steps. Use + or a preset to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* String rows (visual: high e on top) */}
            {STRING_LABELS.map((label, visualRow) => {
              const stringIdx = VISUAL_TO_STRING_IDX[visualRow];
              return (
                <div key={visualRow} className="flex items-center gap-1 mb-1">
                  <span className="w-4 text-xs font-mono text-brand-secondary text-right shrink-0">{label}</span>
                  {steps.map((step, stepIdx) => {
                    const active = step.strings.includes(stringIdx);
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleCell(stepIdx, stringIdx)}
                        className={`w-8 h-8 rounded border transition-all text-xs ${
                          active
                            ? 'bg-brand-primary border-brand-primary text-white'
                            : 'bg-brand-surface border-brand-line text-brand-secondary hover:border-brand-primary/50'
                        }`}
                      />
                    );
                  })}
                </div>
              );
            })}
            {/* Duration row */}
            <div className="flex items-center gap-1 mt-2">
              <span className="w-4 shrink-0" />
              {steps.map((step, stepIdx) => (
                <button
                  key={stepIdx}
                  onClick={() => cycleDuration(stepIdx)}
                  className="w-8 h-6 rounded border border-brand-line bg-brand-surface text-brand-secondary hover:border-brand-primary text-[10px] transition-colors"
                  title={step.duration}
                >
                  {DURATION_SYMBOLS[step.duration]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handlePreview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-surface border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          <Play size={12} fill="currentColor" /> Preview
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 12: Test in browser**

Run: `npm run dev`
- Open Progressions page
- Verify existing progressions load (migration from old `chords` format works)
- Verify BPM slider appears and updates
- Verify Play button plays each chord in sequence with highlight
- Verify Stop button halts playback
- Verify Loop toggle restarts progression
- Hover a chord card → pencil icon appears → click to open sequencer panel
- Add steps with + button, toggle string cells, cycle duration
- Load a preset (Ascending) — grid populates
- Click Preview — pattern plays
- Close panel with ✕

- [ ] **Step 13: Commit**

```bash
git add src/pages/Progressions.tsx
git commit -m "feat: add per-chord arpeggio sequencer to Progressions page"
```

---

## Task 4: Push for Testing

- [ ] **Step 1: Final lint check**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 2: Push to GitHub**

```bash
git push
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Covered |
|---|---|
| `ArpeggioStep`, `ArpeggioPattern`, `ChordSlot` types | Task 1 |
| Updated `Progression` with `bpm` + `slots` | Task 1 |
| localStorage migration | Task 3, Step 3 |
| `playProgressionWithPatterns` with stop support | Task 2 |
| Loop | Task 2 + Task 3 Step 7 |
| `onChordChange` highlight | Task 2 + Task 3 Steps 5, 8 |
| BPM slider in header | Task 3 Step 7 |
| Play/Stop toggle | Task 3 Steps 5, 7 |
| Chord card pattern badge (`N steps`) | Task 3 Step 8 |
| Chord card pencil edit button | Task 3 Step 8 |
| Sequencer panel — chord name, preset, step count | Task 3 Step 10 |
| Sequencer panel — 6 string rows, N columns, toggle cells | Task 3 Step 10 |
| Sequencer panel — duration selector per column | Task 3 Step 10 |
| Sequencer panel — Preview button | Task 3 Step 10 |
| Pattern changes applied live (no Apply gate) | Implicit — `onPatternChange` saves immediately |
| Print styles preserved (`print:hidden`) | Task 3 Steps 8, 10 |

All spec requirements are covered.
