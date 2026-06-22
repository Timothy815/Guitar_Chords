import React from 'react';
import { Note } from '../types';
import { cn } from '../lib/utils';

interface CircleOfFifthsProps {
  selectedKey: Note | null;
  onKeySelect: (key: Note) => void;
  className?: string;
}

const CX = 200, CY = 200;
const OUTER_R = 175, INNER_R = 60;
const TEXT_MAJOR_R = 135, TEXT_MINOR_R = 103, TEXT_SIG_R = 80;

// Clockwise from top (C at 12 o'clock), in fifths.
// `note` is the Note (sharp) spelling used for COMMON_CHORDS lookups.
// `display` is the conventional label shown on the wedge.
const CIRCLE_DATA = [
  { note: 'C'  as Note, display: 'C',      minor: 'Am',  keySig: '0'  },
  { note: 'G'  as Note, display: 'G',      minor: 'Em',  keySig: '1♯' },
  { note: 'D'  as Note, display: 'D',      minor: 'Bm',  keySig: '2♯' },
  { note: 'A'  as Note, display: 'A',      minor: 'F#m', keySig: '3♯' },
  { note: 'E'  as Note, display: 'E',      minor: 'C#m', keySig: '4♯' },
  { note: 'B'  as Note, display: 'B',      minor: 'G#m', keySig: '5♯' },
  { note: 'F#' as Note, display: 'F#/Gb',  minor: 'D#m', keySig: '6♯' },
  { note: 'C#' as Note, display: 'Db',     minor: 'Bbm', keySig: '5♭' },
  { note: 'G#' as Note, display: 'Ab',     minor: 'Fm',  keySig: '4♭' },
  { note: 'D#' as Note, display: 'Eb',     minor: 'Cm',  keySig: '3♭' },
  { note: 'A#' as Note, display: 'Bb',     minor: 'Gm',  keySig: '2♭' },
  { note: 'F'  as Note, display: 'F',      minor: 'Dm',  keySig: '1♭' },
];

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polar(r: number, angleDeg: number) {
  return {
    x: CX + r * Math.cos(toRad(angleDeg)),
    y: CY + r * Math.sin(toRad(angleDeg)),
  };
}

// SVG arc path for one wedge segment at index i (0-11).
function wedgePath(i: number): string {
  const gap = 1.5; // degrees of gap between wedges
  const s = i * 30 - 90 + gap / 2;
  const e = (i + 1) * 30 - 90 - gap / 2;
  const p1 = polar(OUTER_R, s);
  const p2 = polar(OUTER_R, e);
  const p3 = polar(INNER_R, e);
  const p4 = polar(INNER_R, s);
  return (
    `M ${p1.x} ${p1.y} ` +
    `A ${OUTER_R} ${OUTER_R} 0 0 1 ${p2.x} ${p2.y} ` +
    `L ${p3.x} ${p3.y} ` +
    `A ${INNER_R} ${INNER_R} 0 0 0 ${p4.x} ${p4.y} Z`
  );
}

// (x,y) of the midpoint of wedge i at radius r.
function textAt(r: number, i: number) {
  const mid = i * 30 - 90 + 15;
  return polar(r, mid);
}

export function CircleOfFifths({ selectedKey, onKeySelect, className }: CircleOfFifthsProps) {
  return (
    <div className={cn('w-full max-w-sm mx-auto', className)}>
      <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-md">
        {CIRCLE_DATA.map((entry, i) => {
          const isSelected = selectedKey === entry.note;
          const tMajor = textAt(TEXT_MAJOR_R, i);
          const tMinor = textAt(TEXT_MINOR_R, i);
          const tSig   = textAt(TEXT_SIG_R, i);
          // F#/Gb label is long — use a smaller font
          const majorFontSize = entry.display.length > 2 ? 9 : 13;
          return (
            <g
              key={entry.note}
              onClick={() => onKeySelect(entry.note)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={wedgePath(i)}
                fill={isSelected ? 'var(--color-brand-active)' : 'var(--color-brand-surface)'}
                stroke="var(--color-brand-line)"
                strokeWidth={1}
              />
              {/* Major key name */}
              <text
                x={tMajor.x} y={tMajor.y + 5}
                textAnchor="middle"
                fontSize={majorFontSize}
                fontWeight="bold"
                fill={isSelected ? 'white' : 'var(--color-brand-ink)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.display}
              </text>
              {/* Relative minor */}
              <text
                x={tMinor.x} y={tMinor.y + 4}
                textAnchor="middle"
                fontSize={8}
                fill={isSelected ? 'rgba(255,255,255,0.85)' : 'var(--color-brand-secondary)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.minor}
              </text>
              {/* Key signature */}
              <text
                x={tSig.x} y={tSig.y + 3}
                textAnchor="middle"
                fontSize={7}
                fill={isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-brand-secondary)'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {entry.keySig}
              </text>
            </g>
          );
        })}
        {/* Decorative center circle */}
        <circle cx={CX} cy={CY} r={55} fill="var(--color-brand-fretborder)" opacity={0.25} />
        <text
          x={CX} y={CY + 5}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="var(--color-brand-secondary)"
          style={{ userSelect: 'none' }}
        >
          5ths
        </text>
      </svg>
    </div>
  );
}
