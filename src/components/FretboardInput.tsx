// src/components/FretboardInput.tsx
import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { initAudio, playNote, getFretNote } from '../lib/audio';

interface FretboardInputProps {
  onNoteSelect: (pitch: string) => void;
  allowedPitches?: string[];
  disabled?: boolean;
}

const STRING_COUNT = 6;
const FRET_COUNT = 12; // frets 0 (open) through 12

// String labels (index 0 = low E, index 5 = high E) — displayed top-to-bottom as high E first
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

export function FretboardInput({ onNoteSelect, allowedPitches, disabled }: FretboardInputProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function handleFret(stringIdx: number, fret: number) {
    if (disabled) return;
    const fullNote = getFretNote(stringIdx, fret); // e.g. 'E2'
    if (!fullNote) return;
    const pitchClass = fullNote.replace(/\d$/, ''); // strip octave → 'E'
    initAudio().then(() => playNote(fullNote)).catch(() => {});
    onNoteSelect(pitchClass);
    setFlash(`${stringIdx}-${fret}`);
    setTimeout(() => setFlash(f => (f === `${stringIdx}-${fret}` ? null : f)), 150);
  }

  // Render strings top-to-bottom as high E first (visualStringIdx = 5 - stringIdx)
  const visualRows = Array.from({ length: STRING_COUNT }, (_, vi) => STRING_COUNT - 1 - vi); // [5,4,3,2,1,0]

  return (
    <div className="overflow-x-auto pb-1">
      <table className="border-collapse text-[10px] select-none">
        <thead>
          <tr>
            <th className="px-1 text-brand-secondary font-normal w-5" />
            {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
              <th key={f} className="px-0.5 text-center text-brand-secondary font-normal w-8">
                {f === 0 ? 'O' : f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visualRows.map(stringIdx => (
            <tr key={stringIdx}>
              {/* String label */}
              <td className="pr-1 text-right text-brand-secondary font-mono">
                {STRING_LABELS[stringIdx]}
              </td>
              {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                const fullNote = getFretNote(stringIdx, fret);
                const pitchClass = fullNote ? fullNote.replace(/\d$/, '') : '';
                const isAllowed = !allowedPitches || allowedPitches.includes(pitchClass);
                const isFlashing = flash === `${stringIdx}-${fret}`;

                return (
                  <td key={fret} className="p-0.5">
                    <button
                      onClick={() => handleFret(stringIdx, fret)}
                      disabled={disabled}
                      className={cn(
                        'w-8 h-7 rounded text-[9px] font-medium border transition-colors',
                        isFlashing
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : isAllowed
                            ? 'border-brand-line text-brand-ink hover:border-brand-primary hover:bg-brand-sidebar'
                            : 'border-brand-line/50 text-brand-secondary/40 hover:border-brand-primary/30',
                        disabled && 'cursor-not-allowed',
                      )}
                    >
                      {pitchClass}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
