import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { initAudio, playNote, getFretNote } from '../lib/audio';

const OPEN_PITCHES = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

interface Pair {
  root: { string: number; fret: number };
  target: { string: number; fret: number };
  bString: boolean;
}

type Direction = 'forward' | 'reverse';

interface Props {
  rootNote: Note;
  intervalSemitones: number;
  fretsNum?: number;
}

// ─── Mini 2-string shape diagram ─────────────────────────────────────────────

interface ShapeCardProps {
  offset: number;       // semitones - stringGap
  bString: boolean;
  direction: Direction;
  rootNote: string;
  targetNote: string;
  stringLabel: string;
}

function ShapeCard({ offset, bString, direction, rootNote, targetNote, stringLabel }: ShapeCardProps) {
  // In forward mode: anchor root at fret 3, target at 3+offset (both shown on 2 strings)
  // In reverse mode: anchor target at fret 3, root at 3-offset
  // Root always on the bottom (thicker) string, target on top (thinner).
  const rootFret  = direction === 'forward' ? 3 : 3 - offset;
  const targetFret = direction === 'forward' ? 3 + offset : 3;

  const leftFret  = Math.min(rootFret, targetFret) - 1;
  const rightFret = Math.max(rootFret, targetFret) + 1;
  const numFrets  = rightFret - leftFret;

  const fretPx   = 28;
  const pX       = 22;
  const pY       = 14;
  const stringSep = 38;
  const cardW    = numFrets * fretPx + pX * 2;
  const cardH    = pY * 2 + stringSep;

  function nx(fret: number) {
    return pX + (fret - leftFret - 0.5) * fretPx;
  }

  const lineColor = bString ? '#f59e0b' : '#818cf8';
  const rootY    = pY + stringSep; // bottom / thicker string
  const targetY  = pY;             // top    / thinner string

  // Direction arrow: small triangle at the destination end of the line
  const fromX = nx(direction === 'forward' ? rootFret  : targetFret);
  const fromY = direction === 'forward' ? rootY   : targetY;
  const toX   = nx(direction === 'forward' ? targetFret : rootFret);
  const toY   = direction === 'forward' ? targetY : rootY;
  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-medium text-brand-secondary">{stringLabel}</span>
      <svg viewBox={`0 0 ${cardW} ${cardH}`} width={cardW} height={cardH}>
        {/* Fret lines */}
        {Array.from({ length: numFrets + 1 }).map((_, i) => (
          <line key={i}
            x1={pX + i * fretPx} y1={targetY}
            x2={pX + i * fretPx} y2={rootY}
            stroke="#555" strokeWidth={1.5}
          />
        ))}
        {/* Strings — thinner on top, thicker on bottom */}
        <line x1={pX} y1={targetY} x2={pX + numFrets * fretPx} y2={targetY} stroke="#aaa" strokeWidth={1} />
        <line x1={pX} y1={rootY}   x2={pX + numFrets * fretPx} y2={rootY}   stroke="#aaa" strokeWidth={2.5} />

        {/* Connecting line */}
        <line
          x1={fromX} y1={fromY} x2={toX} y2={toY}
          stroke={lineColor} strokeWidth={2}
          strokeDasharray={bString ? '4 2' : undefined}
          opacity={0.85}
        />
        {/* Arrowhead at destination */}
        <polygon
          points="-5,-3 5,0 -5,3"
          fill={lineColor} opacity={0.85}
          transform={`translate(${toX},${toY}) rotate(${angle})`}
        />

        {/* Root dot (teal, bottom) */}
        <circle cx={nx(rootFret)}   cy={rootY}   r={11} fill="var(--color-brand-active)" stroke="white" strokeWidth={1.5} />
        <text   x={nx(rootFret)}    y={rootY + 4}   textAnchor="middle" fontSize={9}  fontWeight="bold" fill="white">{rootNote}</text>

        {/* Target dot (orange, top) */}
        <circle cx={nx(targetFret)} cy={targetY} r={11} fill="#f97316" stroke="white" strokeWidth={1.5} />
        <text   x={nx(targetFret)}  y={targetY + 4} textAnchor="middle" fontSize={9}  fontWeight="bold" fill="white">{targetNote}</text>
      </svg>
      <span className="text-[11px] text-brand-secondary">
        {bString ? 'exception' : 'standard'} · {offset > 0 ? `+${offset}` : `${offset}`} frets
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntervalFretboard({ rootNote, intervalSemitones, fretsNum = 15 }: Props) {
  const [selected, setSelected]   = useState<{ string: number; fret: number } | null>(null);
  const [direction, setDirection] = useState<Direction>('forward');

  useEffect(() => { setSelected(null); }, [rootNote, intervalSemitones]);

  const stringsNum    = 6;
  const paddingX      = 40;
  const paddingY      = 30;
  const stringSpacing = 30;
  const totalWidth    = 800;
  const fretSpacing   = (totalWidth - paddingX * 2) / fretsNum;
  const totalHeight   = paddingY * 2 + stringSpacing * (stringsNum - 1);
  const markerFrets   = [3, 5, 7, 9, 15];
  const doubleMarkerFrets = [12];

  const rootPitchClass   = ALL_NOTES.indexOf(rootNote);
  const targetPitchClass = (rootPitchClass + intervalSemitones) % 12;
  const targetNote       = ALL_NOTES[targetPitchClass];

  // Adjacent-string offsets (how many frets to shift on the next string up)
  const standardOffset = intervalSemitones - 5; // normal string gap = P4
  const bStringOffset  = intervalSemitones - 4; // G→B gap = M3

  function noteX(fret: number) {
    return fret === 0 ? paddingX / 2 : paddingX + (fret - 0.5) * fretSpacing;
  }
  function noteY(stringIdx: number) {
    return paddingY + (5 - stringIdx) * stringSpacing;
  }

  // All root positions
  const roots: Array<{ string: number; fret: number }> = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= fretsNum; f++)
      if ((OPEN_PITCHES[s] + f) % 12 === rootPitchClass)
        roots.push({ string: s, fret: f });

  // All root→target pairs and unique target positions
  const pairs: Pair[] = [];
  const targetMap = new Map<string, { string: number; fret: number }>();
  for (const root of roots) {
    const rootAbsPitch   = OPEN_PITCHES[root.string] + root.fret;
    const targetAbsPitch = rootAbsPitch + intervalSemitones;
    for (let s2 = 0; s2 < 6; s2++) {
      const f2 = targetAbsPitch - OPEN_PITCHES[s2];
      if (f2 < 0 || f2 > fretsNum) continue;
      if (s2 === root.string && f2 === root.fret) continue;
      targetMap.set(`${s2}-${f2}`, { string: s2, fret: f2 });
      const sMin = Math.min(root.string, s2);
      const sMax = Math.max(root.string, s2);
      pairs.push({ root, target: { string: s2, fret: f2 }, bString: sMin === 3 && sMax === 4 });
    }
  }

  const targetPositions = Array.from(targetMap.values()).filter(
    ({ string, fret }) => (OPEN_PITCHES[string] + fret) % 12 !== rootPitchClass
  );

  // Lines shown only from the selected dot, filtered by direction
  const activeLines = selected
    ? pairs.filter(p =>
        direction === 'forward'
          ? p.root.string   === selected.string && p.root.fret   === selected.fret
          : p.target.string === selected.string && p.target.fret === selected.fret
      )
    : [];

  const connectedKeys = new Set<string>();
  if (selected) {
    connectedKeys.add(`${selected.string}-${selected.fret}`);
    for (const p of activeLines) {
      connectedKeys.add(`${p.root.string}-${p.root.fret}`);
      connectedKeys.add(`${p.target.string}-${p.target.fret}`);
    }
  }

  function isSelected(s: number, f: number) {
    return selected?.string === s && selected?.fret === f;
  }
  function dotOpacity(s: number, f: number) {
    if (!selected) return 1;
    return connectedKeys.has(`${s}-${f}`) ? 1 : 0.18;
  }

  async function handleDotClick(s: number, f: number, isRoot: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    const clickable = direction === 'forward' ? isRoot : !isRoot;
    if (clickable) setSelected(isSelected(s, f) ? null : { string: s, fret: f });
    await initAudio();
    playNote(getFretNote(s, f), 1.5);
  }

  const activeNote = direction === 'forward' ? rootNote : targetNote;
  const partnerNote = direction === 'forward' ? targetNote : rootNote;
  const hint = selected
    ? 'Click the same dot or the fretboard background to clear'
    : `Click a ${activeNote} dot to reveal its ${partnerNote} partners`;

  return (
    <div className="w-full space-y-5">

      {/* ── Shape reference cards ── */}
      <div className="flex gap-10 justify-center flex-wrap py-1">
        <ShapeCard
          offset={standardOffset}
          bString={false}
          direction={direction}
          rootNote={rootNote}
          targetNote={targetNote}
          stringLabel="E/A · A/D · D/G · B/E"
        />
        <ShapeCard
          offset={bStringOffset}
          bString={true}
          direction={direction}
          rootNote={rootNote}
          targetNote={targetNote}
          stringLabel="G → B"
        />
      </div>

      {/* ── Direction toggle + hint ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg overflow-hidden border border-brand-line text-sm font-medium">
          <button
            onClick={() => { setDirection('forward'); setSelected(null); }}
            className={`px-4 py-1.5 transition-colors ${direction === 'forward' ? 'bg-brand-active text-white' : 'bg-brand-surface text-brand-secondary hover:bg-brand-line'}`}
          >
            {rootNote} → {targetNote}
          </button>
          <button
            onClick={() => { setDirection('reverse'); setSelected(null); }}
            className={`px-4 py-1.5 transition-colors ${direction === 'reverse' ? 'bg-brand-active text-white' : 'bg-brand-surface text-brand-secondary hover:bg-brand-line'}`}
          >
            {targetNote} → {rootNote}
          </button>
        </div>
        <p className="text-sm text-brand-secondary">{hint}</p>
      </div>

      {/* ── Interactive fretboard ── */}
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-auto drop-shadow-sm border-8 border-brand-fretborder rounded-xl min-w-[600px]"
          onClick={() => setSelected(null)}
        >
          {/* Background */}
          <rect x={paddingX} y={paddingY} width={totalWidth - paddingX * 2} height={totalHeight - paddingY * 2} fill="var(--color-brand-fretboard)" />

          {/* Fret lines */}
          {Array.from({ length: fretsNum + 1 }).map((_, i) => (
            <line key={`fret-${i}`}
              x1={paddingX + i * fretSpacing} y1={paddingY}
              x2={paddingX + i * fretSpacing} y2={totalHeight - paddingY}
              stroke="var(--color-brand-fret)" strokeWidth={i === 0 ? 6 : 3}
            />
          ))}

          {/* Strings */}
          {Array.from({ length: stringsNum }).map((_, i) => (
            <line key={`string-${i}`}
              x1={paddingX} y1={paddingY + i * stringSpacing}
              x2={totalWidth - paddingX} y2={paddingY + i * stringSpacing}
              stroke="#AAAAAA" strokeWidth={1 + (5 - i) * 0.4}
            />
          ))}

          {/* Fret position markers */}
          {Array.from({ length: fretsNum }).map((_, idx) => {
            const f   = idx + 1;
            const x   = paddingX + (idx + 0.5) * fretSpacing;
            const midY = paddingY + ((stringsNum - 1) * stringSpacing) / 2;
            if (markerFrets.includes(f))
              return <circle key={`m-${f}`} cx={x} cy={midY} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />;
            if (doubleMarkerFrets.includes(f))
              return (
                <g key={`m-${f}`}>
                  <circle cx={x} cy={paddingY + stringSpacing * 1.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
                  <circle cx={x} cy={paddingY + stringSpacing * 3.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
                </g>
              );
            return null;
          })}

          {/* Fret numbers */}
          {[3, 5, 7, 9, 12, 15].filter(f => f <= fretsNum).map(f => (
            <text key={`fn-${f}`} x={paddingX + (f - 0.5) * fretSpacing} y={totalHeight - 6} textAnchor="middle" fontSize={10} fill="#888">{f}</text>
          ))}

          {/* Active connecting lines */}
          {activeLines.map((pair, i) => (
            <line key={`line-${i}`}
              x1={noteX(pair.root.fret)}   y1={noteY(pair.root.string)}
              x2={noteX(pair.target.fret)} y2={noteY(pair.target.string)}
              stroke={pair.bString ? '#f59e0b' : '#818cf8'}
              strokeWidth={pair.bString ? 2.5 : 2}
              opacity={pair.bString ? 0.9 : 0.8}
              strokeDasharray={pair.bString ? '5 3' : undefined}
            />
          ))}

          {/* Target dots (orange) — clickable in reverse mode */}
          {targetPositions.map(({ string, fret }, i) => {
            const x   = noteX(fret);
            const y   = noteY(string);
            const op  = dotOpacity(string, fret);
            const sel = isSelected(string, fret);
            return (
              <g key={`t-${i}`} onClick={e => handleDotClick(string, fret, false, e)} style={{ cursor: direction === 'reverse' ? 'pointer' : 'default' }}>
                <circle cx={x} cy={y} r={fret === 0 ? 10 : 14} fill="#f97316" stroke="white" strokeWidth={sel ? 3 : 1.5} opacity={op} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="white" opacity={op} style={{ pointerEvents: 'none' }}>{targetNote}</text>
              </g>
            );
          })}

          {/* Root dots (teal) — clickable in forward mode */}
          {roots.map(({ string, fret }, i) => {
            const x   = noteX(fret);
            const y   = noteY(string);
            const op  = dotOpacity(string, fret);
            const sel = isSelected(string, fret);
            return (
              <g key={`r-${i}`} onClick={e => handleDotClick(string, fret, true, e)} style={{ cursor: direction === 'forward' ? 'pointer' : 'default' }}>
                <circle cx={x} cy={y} r={fret === 0 ? 10 : 14} fill="var(--color-brand-active)" stroke="white" strokeWidth={sel ? 3 : 1.5} opacity={op} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="white" opacity={op} style={{ pointerEvents: 'none' }}>{rootNote}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
