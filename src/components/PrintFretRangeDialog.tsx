import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PrintFretRangeDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (start: number, end: number) => void;
  defaultStart?: number;
  defaultEnd?: number;
  maxFret?: number;
  maxSpan?: number;
}

export function PrintFretRangeDialog({
  isOpen,
  onCancel,
  onConfirm,
  defaultStart = 0,
  defaultEnd = 12,
  maxFret = 22,
  maxSpan = 15,
}: PrintFretRangeDialogProps) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  if (!isOpen) return null;

  const errors: string[] = [];
  if (Number.isNaN(start) || start < 0 || start > maxFret) {
    errors.push(`Start fret must be between 0 and ${maxFret}.`);
  }
  if (Number.isNaN(end) || end <= start || end > maxFret) {
    errors.push(`End fret must be greater than start and no more than ${maxFret}.`);
  }
  if (!Number.isNaN(start) && !Number.isNaN(end) && end - start > maxSpan) {
    errors.push(`Range can't exceed ${maxSpan} frets (so labels stay legible on one page).`);
  }
  const isValid = errors.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-brand-surface rounded-xl border border-brand-line shadow-xl w-full max-w-sm space-y-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">Print Fret Range</h2>
          <button onClick={onCancel} className="text-brand-secondary hover:text-brand-ink">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-brand-secondary">
          Choose the fret range to print. Up to {maxSpan} frets fit legibly on one page.
        </p>

        <div className="flex items-center gap-3">
          <label className="flex-1 text-sm text-brand-ink">
            Start Fret
            <input
              type="number"
              value={start}
              min={0}
              max={maxFret}
              onChange={e => setStart(parseInt(e.target.value, 10))}
              className="mt-1 w-full font-mono text-sm p-2 rounded-lg border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
            />
          </label>
          <label className="flex-1 text-sm text-brand-ink">
            End Fret
            <input
              type="number"
              value={end}
              min={0}
              max={maxFret}
              onChange={e => setEnd(parseInt(e.target.value, 10))}
              className="mt-1 w-full font-mono text-sm p-2 rounded-lg border border-brand-line bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-primary"
            />
          </label>
        </div>

        {errors.length > 0 && (
          <p className="text-xs text-red-500">{errors[0]}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-brand-line text-brand-ink hover:border-brand-primary/60 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => isValid && onConfirm(start, end)}
            disabled={!isValid}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
              isValid
                ? 'bg-brand-primary text-white hover:opacity-90'
                : 'bg-brand-line text-brand-secondary cursor-not-allowed'
            )}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
