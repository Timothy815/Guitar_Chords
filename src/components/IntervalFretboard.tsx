import React from 'react';
import { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { initAudio, playNote, getFretNote } from '../lib/audio';

const OPEN_PITCHES = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

interface Pair {
  root: { string: number; fret: number };
  target: { string: number; fret: number };
  bString: boolean; // crosses the G(3)→B(4) boundary
}

interface Props {
  rootNote: Note;
  intervalSemitones: number;
  fretsNum?: number;
}

export function IntervalFretboard({ rootNote, intervalSemitones, fretsNum = 15 }: Props) {
  const stringsNum = 6;
  const paddingX = 40;
  const paddingY = 30;
  const stringSpacing = 30;
  const totalWidth = 800;
  const fretSpacing = (totalWidth - paddingX * 2) / fretsNum;
  const totalHeight = paddingY * 2 + stringSpacing * (stringsNum - 1);

  const markerFrets = [3, 5, 7, 9, 15];
  const doubleMarkerFrets = [12];

  const rootPitchClass = ALL_NOTES.indexOf(rootNote);
  const targetPitchClass = (rootPitchClass + intervalSemitones) % 12;

  function noteX(fret: number): number {
    return fret === 0 ? paddingX / 2 : paddingX + (fret - 0.5) * fretSpacing;
  }

  function noteY(stringIdx: number): number {
    // high E (string 5) drawn at top → visual index = 5 - stringIdx
    return paddingY + (5 - stringIdx) * stringSpacing;
  }

  // All positions where the root pitch class appears
  const roots: Array<{ string: number; fret: number }> = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= fretsNum; f++) {
      if ((OPEN_PITCHES[s] + f) % 12 === rootPitchClass) {
        roots.push({ string: s, fret: f });
      }
    }
  }

  // For each root, compute the exact target on every string using absolute pitch
  const pairs: Pair[] = [];
  const targetMap = new Map<string, { string: number; fret: number }>();

  for (const root of roots) {
    const rootAbsPitch = OPEN_PITCHES[root.string] + root.fret;
    const targetAbsPitch = rootAbsPitch + intervalSemitones;

    for (let s2 = 0; s2 < 6; s2++) {
      const f2 = targetAbsPitch - OPEN_PITCHES[s2];
      if (f2 < 0 || f2 > fretsNum) continue;
      if (s2 === root.string && f2 === root.fret) continue; // skip unison

      targetMap.set(`${s2}-${f2}`, { string: s2, fret: f2 });

      // B-string crossing: line spans the G(3)→B(4) string pair
      const sMin = Math.min(root.string, s2);
      const sMax = Math.max(root.string, s2);
      pairs.push({ root, target: { string: s2, fret: f2 }, bString: sMin === 3 && sMax === 4 });
    }
  }

  const targetPositions = Array.from(targetMap.values()).filter(
    ({ string, fret }) => (OPEN_PITCHES[string] + fret) % 12 !== rootPitchClass
  );

  async function handleClick(stringIdx: number, fret: number) {
    await initAudio();
    playNote(getFretNote(stringIdx, fret), 1.5);
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="w-full h-auto drop-shadow-sm border-8 border-brand-fretborder rounded-xl min-w-[600px]"
      >
        {/* Fretboard background */}
        <rect
          x={paddingX} y={paddingY}
          width={totalWidth - paddingX * 2}
          height={totalHeight - paddingY * 2}
          fill="var(--color-brand-fretboard)"
        />

        {/* Fret lines — fret 0 is the nut (thicker) */}
        {Array.from({ length: fretsNum + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={paddingX + i * fretSpacing} y1={paddingY}
            x2={paddingX + i * fretSpacing} y2={totalHeight - paddingY}
            stroke="var(--color-brand-fret)"
            strokeWidth={i === 0 ? 6 : 3}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: stringsNum }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={paddingX} y1={paddingY + i * stringSpacing}
            x2={totalWidth - paddingX} y2={paddingY + i * stringSpacing}
            stroke="#AAAAAA"
            strokeWidth={1 + (5 - i) * 0.4}
          />
        ))}

        {/* Fret position markers */}
        {Array.from({ length: fretsNum }).map((_, idx) => {
          const f = idx + 1;
          const x = paddingX + (idx + 0.5) * fretSpacing;
          const midY = paddingY + ((stringsNum - 1) * stringSpacing) / 2;
          if (markerFrets.includes(f)) {
            return <circle key={`m-${f}`} cx={x} cy={midY} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />;
          }
          if (doubleMarkerFrets.includes(f)) {
            return (
              <g key={`m-${f}`}>
                <circle cx={x} cy={paddingY + stringSpacing * 1.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
                <circle cx={x} cy={paddingY + stringSpacing * 3.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
              </g>
            );
          }
          return null;
        })}

        {/* Fret numbers at bottom */}
        {[3, 5, 7, 9, 12, 15].filter(f => f <= fretsNum).map(f => (
          <text
            key={`fn-${f}`}
            x={paddingX + (f - 0.5) * fretSpacing}
            y={totalHeight - 6}
            textAnchor="middle"
            fontSize={10}
            fill="#888"
          >{f}</text>
        ))}

        {/* Connecting lines (drawn under dots) */}
        {pairs.map((pair, i) => (
          <line
            key={`line-${i}`}
            x1={noteX(pair.root.fret)} y1={noteY(pair.root.string)}
            x2={noteX(pair.target.fret)} y2={noteY(pair.target.string)}
            stroke={pair.bString ? '#f59e0b' : '#818cf8'}
            strokeWidth={pair.bString ? 2 : 1.5}
            opacity={pair.bString ? 0.75 : 0.5}
            strokeDasharray={pair.bString ? '5 3' : undefined}
          />
        ))}

        {/* Target dots (orange) — only when pitch class differs from root */}
        {targetPositions.map(({ string, fret }, i) => {
          const x = noteX(fret);
          const y = noteY(string);
          const label = ALL_NOTES[targetPitchClass];
          return (
            <g key={`t-${i}`} onClick={() => handleClick(string, fret)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={fret === 0 ? 10 : 14} fill="#f97316" stroke="white" strokeWidth={1.5} opacity={0.92} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>{label}</text>
            </g>
          );
        })}

        {/* Root dots (teal) */}
        {roots.map(({ string, fret }, i) => {
          const x = noteX(fret);
          const y = noteY(string);
          return (
            <g key={`r-${i}`} onClick={() => handleClick(string, fret)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={fret === 0 ? 10 : 14} fill="var(--color-brand-active)" stroke="white" strokeWidth={1.5} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>{rootNote}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
