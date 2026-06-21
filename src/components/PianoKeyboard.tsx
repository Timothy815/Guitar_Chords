import React from 'react';
import { cn } from '../lib/utils';

interface PianoKeyboardProps {
  highlightedNotes: string[]; // note+octave strings e.g. ["E2", "G3", "C#4"]
  className?: string;
}

const WK_W = 22;   // white key width
const WK_H = 72;   // white key height
const BK_W = 14;   // black key width
const BK_H = 44;   // black key height
const PAD = 4;
const START_OCT = 2;
const END_OCT = 5;                           // C2..B5, 4 octaves
const NUM_OCTS = END_OCT - START_OCT + 1;   // 4
const TOTAL_W = NUM_OCTS * 7 * WK_W + PAD * 2;
const TOTAL_H = WK_H + PAD * 2;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'] as const;

// x position of black key center, measured in white-key-widths from the octave's C
const BLACK_KEY_OFFSET: Record<string, number> = {
  'C#': 0.65, 'D#': 1.65, 'F#': 3.65, 'G#': 4.65, 'A#': 5.65,
};

const WHITE_NOTE_IDX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

export function PianoKeyboard({ highlightedNotes, className }: PianoKeyboardProps) {
  const highlighted = new Set(highlightedNotes);
  const octaveX = (oct: number) => PAD + (oct - START_OCT) * 7 * WK_W;

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        className="h-24 min-w-[400px] w-full"
        style={{ maxWidth: TOTAL_W }}
      >
        {/* White keys */}
        {Array.from({ length: NUM_OCTS }, (_, i) => START_OCT + i).flatMap(oct =>
          WHITE_NOTES.map(note => {
            const id = `${note}${oct}`;
            const x = octaveX(oct) + WHITE_NOTE_IDX[note] * WK_W;
            const lit = highlighted.has(id);
            return (
              <g key={id}>
                <rect
                  x={x} y={PAD}
                  width={WK_W - 1} height={WK_H}
                  fill={lit ? 'var(--color-brand-active)' : 'white'}
                  stroke="var(--color-brand-line)"
                  strokeWidth={0.5}
                  rx={2}
                />
                {lit && (
                  <text
                    x={x + WK_W / 2} y={PAD + WK_H - 10}
                    textAnchor="middle" fontSize={9} fontWeight="bold" fill="white"
                  >
                    {note}
                  </text>
                )}
                {note === 'C' && !lit && (
                  <text
                    x={x + 2} y={PAD + WK_H - 2}
                    fontSize={6} fill="var(--color-brand-secondary)" opacity={0.4}
                  >
                    C{oct}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Black keys — rendered after white keys so they appear on top */}
        {Array.from({ length: NUM_OCTS }, (_, i) => START_OCT + i).flatMap(oct =>
          BLACK_NOTES.map(note => {
            const id = `${note}${oct}`;
            const x = octaveX(oct) + BLACK_KEY_OFFSET[note] * WK_W - BK_W / 2;
            const lit = highlighted.has(id);
            return (
              <g key={id}>
                <rect
                  x={x} y={PAD}
                  width={BK_W} height={BK_H}
                  fill={lit ? 'var(--color-brand-active)' : '#222'}
                  rx={2}
                />
                {lit && (
                  <text
                    x={x + BK_W / 2} y={PAD + BK_H - 5}
                    textAnchor="middle" fontSize={7} fontWeight="bold" fill="white"
                  >
                    {note}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
