import React from 'react';
import { FretboardFocus } from '../lib/earTraining';
import { cn } from '../lib/utils';

interface FretboardFocusSelectorProps {
  focus: FretboardFocus;
  fretsNum: number;
  onChange: (focus: FretboardFocus) => void;
}

// stringIdx 0 = low E (E2) … 5 = high E (E4)
const STRING_LABELS: [number, string][] = [
  [0, 'E₂'], [1, 'A'], [2, 'D'], [3, 'G'], [4, 'B'], [5, 'E₄'],
];

const FRET_ZONES = [
  { label: 'Open', fretMin: 0, fretMax: 0 },
  { label: '1–4', fretMin: 1, fretMax: 4 },
  { label: '5–8', fretMin: 5, fretMax: 8 },
  { label: '9–12', fretMin: 9, fretMax: 12 },
];

function pillCls(active: boolean) {
  return cn(
    'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
    active
      ? 'bg-brand-primary text-white border-brand-primary'
      : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary',
  );
}

export function FretboardFocusSelector({ focus, fretsNum, onChange }: FretboardFocusSelectorProps) {
  const stringIdxs = focus.stringIdxs ?? [];

  const activeZone =
    FRET_ZONES.find(z => z.fretMin === focus.fretMin && z.fretMax === focus.fretMax) ?? null;
  const isSpecificFret =
    focus.fretMin !== undefined &&
    focus.fretMin === focus.fretMax &&
    activeZone === null;
  const specificFretVal = isSpecificFret ? (focus.fretMin ?? '') : '';

  function toggleString(idx: number) {
    const next = stringIdxs.includes(idx)
      ? stringIdxs.filter(i => i !== idx)
      : [...stringIdxs, idx];
    onChange({ ...focus, stringIdxs: next });
  }

  return (
    <div className="space-y-1.5 text-xs pb-2">
      {/* String row — multi-select */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">String:</span>
        <button
          className={pillCls(stringIdxs.length === 0)}
          onClick={() => onChange({ ...focus, stringIdxs: [] })}
        >
          All
        </button>
        {STRING_LABELS.map(([idx, label]) => (
          <button
            key={idx}
            className={pillCls(stringIdxs.includes(idx))}
            onClick={() => toggleString(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fret row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-brand-secondary w-12 shrink-0">Frets:</span>
        <button
          className={pillCls(focus.fretMin === undefined && focus.fretMax === undefined)}
          onClick={() => onChange({ ...focus, fretMin: undefined, fretMax: undefined })}
        >
          All
        </button>
        {FRET_ZONES.map(zone => (
          <button
            key={zone.label}
            className={pillCls(activeZone?.label === zone.label)}
            onClick={() =>
              onChange({
                ...focus,
                fretMin: zone.fretMin,
                fretMax: Math.min(zone.fretMax, fretsNum),
              })
            }
          >
            {zone.label}
          </button>
        ))}
        <span className="text-brand-secondary ml-1 shrink-0">Fret:</span>
        <input
          type="number"
          min={1}
          max={fretsNum}
          value={specificFretVal}
          placeholder="—"
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= fretsNum) {
              onChange({ ...focus, fretMin: v, fretMax: v });
            } else if (e.target.value === '') {
              onChange({ ...focus, fretMin: undefined, fretMax: undefined });
            }
          }}
          className="w-12 text-center rounded border border-brand-line text-xs py-0.5 bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
        />
      </div>
    </div>
  );
}
