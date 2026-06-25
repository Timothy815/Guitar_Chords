import React from 'react';

interface PianoKeyboardProps {
  octaveMin: number;
  octaveMax: number;
  correctKeys: Set<string>;
  wrongKey: string | null;
  previewKey: string | null;
  onKeyClick: (note: string) => void;
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const WHITE_SET = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

interface KeyRect {
  note: string;
  x: number;
  w: number;
  h: number;
  isBlack: boolean;
}

export function PianoKeyboard({ octaveMin, octaveMax, correctKeys, wrongKey, previewKey, onKeyClick }: PianoKeyboardProps) {
  const octaves = Array.from({ length: octaveMax - octaveMin + 1 }, (_, i) => octaveMin + i);
  const totalWhiteKeys = octaves.length * 7;

  const VW = 1000;
  const VH = 120;
  const ww = VW / totalWhiteKeys;
  const wh = VH;
  const bw = ww * 0.6;
  const bh = VH * 0.62;

  const whiteKeys: KeyRect[] = [];
  const blackKeys: KeyRect[] = [];

  let wi = 0;
  for (const oct of octaves) {
    for (const pc of CHROMATIC) {
      const note = `${pc}${oct}`;
      if (WHITE_SET.has(pc)) {
        whiteKeys.push({ note, x: wi * ww, w: ww, h: wh, isBlack: false });
        wi++;
      } else {
        blackKeys.push({ note, x: wi * ww - bw / 2, w: bw, h: bh, isBlack: true });
      }
    }
  }

  function keyFill(note: string, isBlack: boolean): string {
    if (note === wrongKey) return '#c0392b';
    if (correctKeys.has(note)) return '#27ae60';
    if (note === previewKey) return '#3b82f6';
    return isBlack ? '#1a1a1a' : 'white';
  }

  function labelColor(note: string): string {
    if (note === wrongKey || correctKeys.has(note) || note === previewKey) return 'white';
    return '#888';
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full select-none"
      style={{ height: '120px', display: 'block' }}
      aria-label="Piano keyboard"
    >
      {whiteKeys.map(k => (
        <g key={k.note} onClick={() => onKeyClick(k.note)} style={{ cursor: 'pointer' }}>
          <rect
            x={k.x + 0.5}
            y={0.5}
            width={k.w - 1}
            height={k.h - 1}
            fill={keyFill(k.note, false)}
            stroke="#ccc"
            strokeWidth={1}
            rx={2}
          />
          {k.note.startsWith('C') && (
            <text
              x={k.x + k.w / 2}
              y={k.h - 6}
              textAnchor="middle"
              fontSize={10}
              fill={labelColor(k.note)}
              style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
            >
              {k.note}
            </text>
          )}
        </g>
      ))}
      {blackKeys.map(k => (
        <rect
          key={k.note}
          x={k.x}
          y={0}
          width={k.w}
          height={k.h}
          fill={keyFill(k.note, true)}
          rx={2}
          onClick={() => onKeyClick(k.note)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </svg>
  );
}
