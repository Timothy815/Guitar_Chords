import React, { useState, useEffect, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { initAudio, playNote, getFretNote } from '../lib/audio';

const OPEN_PITCHES = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];

interface Pair {
  root: { string: number; fret: number };
  target: { string: number; fret: number };
  bString: boolean;
}

type Direction = 'forward' | 'reverse';
type ViewMode  = 'all' | 'adjacent' | 'inposition';

interface Props {
  rootNote: Note;
  intervalSemitones: number;
  fretsNum?: number;
  onSendToIdentify?: (frets: number[]) => void;
}

// ─── Mini 2-string shape diagram ─────────────────────────────────────────────

interface ShapeCardProps {
  rootString: number;
  targetString: number;
  rootFret: number;
  targetFret: number;
  stringLabel: string;
}

const ShapeCard: React.FC<ShapeCardProps> = ({ rootString, targetString, rootFret, targetFret, stringLabel }) => {
  const startFret = Math.max(1, Math.min(rootFret, targetFret) - 1);
  const numFrets = Math.max(5, Math.abs(targetFret - rootFret) + 2);
  const fretPx = 18;
  const pX = 24;
  const pY = 16;
  const stringSep = 16;
  const cardW = numFrets * fretPx + pX * 2;
  const cardH = pY * 2 + stringSep * 5;

  function nx(fret: number) {
    return pX + (fret - startFret + 0.5) * fretPx;
  }

  function ny(stringIdx: number) {
    return pY + (5 - stringIdx) * stringSep;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-medium text-brand-secondary">{stringLabel}</span>
      <svg viewBox={`0 0 ${cardW} ${cardH}`} width={cardW} height={cardH}>
        {Array.from({ length: numFrets + 1 }).map((_, i) => (
          <line key={i}
            x1={pX + i * fretPx} y1={pY}
            x2={pX + i * fretPx} y2={cardH - pY}
            stroke="#555" strokeWidth={1.5}
          />
        ))}
        {Array.from({ length: 6 }).map((_, stringIdx) => (
          <g key={`string-${stringIdx}`}>
            <text
              x={pX - 8}
              y={ny(stringIdx) + 3}
              textAnchor="end"
              fontSize={8}
              fill="#444"
              fontWeight="600"
            >
              {STRING_NAMES[stringIdx]}
            </text>
            <line
              x1={pX}
              y1={ny(stringIdx)}
              x2={pX + numFrets * fretPx}
              y2={ny(stringIdx)}
              stroke="#888"
              strokeWidth={stringIdx === 5 ? 2.5 : 1.2}
            />
          </g>
        ))}
        {Array.from({ length: 6 }).map((_, stringIdx) => {
          const active = stringIdx === rootString || stringIdx === targetString;
          if (active) return null;
          return (
            <text
              key={`mute-${stringIdx}`}
              x={pX + numFrets * fretPx / 2}
              y={ny(stringIdx) - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#444"
              fontWeight="600"
            >
              x
            </text>
          );
        })}
        <text x={pX + fretPx / 2} y={pY - 6} textAnchor="middle" fontSize={9} fill="#444" fontWeight="600">
          fret {startFret}
        </text>
        <circle cx={nx(rootFret)} cy={ny(rootString)} r={5.5} fill="#111" />
        <circle cx={nx(targetFret)} cy={ny(targetString)} r={5.5} fill="#111" />
      </svg>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export function IntervalFretboard({ rootNote, intervalSemitones, fretsNum = 15, onSendToIdentify }: Props) {
  const [selected,    setSelected]    = useState<{ string: number; fret: number } | null>(null);
  const [direction,   setDirection]   = useState<Direction>('forward');
  const [viewMode,    setViewMode]    = useState<ViewMode>('adjacent');
  const [isLooping,   setIsLooping]   = useState(false);
  const [loopPairIdx, setLoopPairIdx] = useState<number | null>(null);
  const loopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearLoopTimers() {
    loopTimers.current.forEach(clearTimeout);
    loopTimers.current = [];
  }

  useEffect(() => {
    clearLoopTimers();
    setIsLooping(false);
    setLoopPairIdx(null);
    setSelected(null);
  }, [rootNote, intervalSemitones]);

  useEffect(() => { return () => clearLoopTimers(); }, []);

  const stringsNum    = 6;
  const paddingX      = 40;
  const paddingY      = 30;
  const stringSpacing = 30;
  const totalWidth    = 800;
  const fretSpacing   = (totalWidth - paddingX * 2) / fretsNum;
  const totalHeight   = paddingY * 2 + stringSpacing * (stringsNum - 1);
  const markerFrets      = [3, 5, 7, 9, 15];
  const doubleMarkerFrets = [12];

  const rootPitchClass   = ALL_NOTES.indexOf(rootNote);
  const targetPitchClass = (rootPitchClass + intervalSemitones) % 12;
  const targetNote       = ALL_NOTES[targetPitchClass];

  const isUnison = intervalSemitones === 0;
  // For unison, show the shape going DOWN to the next thicker string (+5 frets) — the classic
  // guitar tuning relationship (fret 5 on string X = open on string X-1).
  const standardOffset = isUnison ? 5 : intervalSemitones - 5;
  const bStringOffset  = isUnison ? 4 : intervalSemitones - 4;
  const shapeCards = (() => {
    const pairDefs = intervalSemitones >= 10
      ? [
          { label: 'E → D', rootString: 0, targetString: 2, offset: intervalSemitones - 10 },
          { label: 'A → G', rootString: 1, targetString: 3, offset: intervalSemitones - 10 },
          { label: 'D → B', rootString: 2, targetString: 4, offset: intervalSemitones - 9 },
          { label: 'G → e', rootString: 3, targetString: 5, offset: intervalSemitones - 9 },
        ]
      : [
          { label: 'E → A', rootString: 0, targetString: 1, offset: standardOffset },
          { label: 'A → D', rootString: 1, targetString: 2, offset: standardOffset },
          { label: 'D → G', rootString: 2, targetString: 3, offset: standardOffset },
          { label: 'G → B', rootString: 3, targetString: 4, offset: bStringOffset },
          { label: 'B → e', rootString: 4, targetString: 5, offset: standardOffset },
        ];

    return pairDefs.map(pair => {
      const offset = pair.offset;
      const rootFret = offset >= 0 ? 1 : 1 - offset;
      const targetFret = rootFret + offset;
      return {
        label: pair.label,
        rootString: pair.rootString,
        targetString: pair.targetString,
        rootFret,
        targetFret,
      };
    });
  })();

  function noteX(fret: number) {
    return fret === 0 ? paddingX / 2 : paddingX + (fret - 0.5) * fretSpacing;
  }
  function noteY(stringIdx: number) {
    return paddingY + (5 - stringIdx) * stringSpacing;
  }

  const roots: Array<{ string: number; fret: number }> = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= fretsNum; f++)
      if ((OPEN_PITCHES[s] + f) % 12 === rootPitchClass)
        roots.push({ string: s, fret: f });

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

  // Adjacent pairs sorted low-E → high-E for the loop (covers all root positions)
  const loopPairs = pairs
    .filter(p => Math.abs(p.root.string - p.target.string) === 1)
    .sort((a, b) => a.root.string !== b.root.string
      ? a.root.string - b.root.string
      : a.root.fret - b.root.fret);

  async function toggleLoop() {
    if (isLooping) {
      clearLoopTimers();
      setIsLooping(false);
      setLoopPairIdx(null);
      return;
    }
    if (loopPairs.length === 0) return;
    await initAudio();
    setIsLooping(true);
    setSelected(null);

    const pairDuration = 1000;
    const noteGap      = 450;

    for (let idx = 0; idx < loopPairs.length; idx++) {
      const pair = loopPairs[idx];
      const t1 = setTimeout(() => {
        setLoopPairIdx(idx);
        playNote(getFretNote(pair.root.string, pair.root.fret), 1.5);
      }, idx * pairDuration);
      const t2 = setTimeout(() => {
        playNote(getFretNote(pair.target.string, pair.target.fret), 1.5);
      }, idx * pairDuration + noteGap);
      loopTimers.current.push(t1, t2);
    }

    const endTimer = setTimeout(() => {
      setIsLooping(false);
      setLoopPairIdx(null);
    }, loopPairs.length * pairDuration);
    loopTimers.current.push(endTimer);
  }

  const candidateLines = selected
    ? pairs.filter(p =>
        direction === 'forward'
          ? p.root.string   === selected.string && p.root.fret   === selected.fret
          : p.target.string === selected.string && p.target.fret === selected.fret
      )
    : [];

  const activeLines = (() => {
    if (!selected || candidateLines.length === 0) return [];
    if (viewMode === 'all') return candidateLines;
    if (viewMode === 'adjacent')
      return candidateLines.filter(p => Math.abs(p.root.string - p.target.string) === 1);
    // inposition: reachable without shifting — target within 4-fret hand span
    return candidateLines.filter(p => Math.abs(p.target.fret - p.root.fret) <= 4);
  })();

  // During loop, override which lines/dots are highlighted
  const displayLines = isLooping && loopPairIdx !== null
    ? (loopPairs[loopPairIdx] ? [loopPairs[loopPairIdx]] : [])
    : activeLines;

  const isDimmed = selected !== null || (isLooping && loopPairIdx !== null);
  const connectedKeys = new Set<string>();
  if (isDimmed) {
    if (isLooping && loopPairIdx !== null) {
      const p = loopPairs[loopPairIdx];
      if (p) {
        connectedKeys.add(`${p.root.string}-${p.root.fret}`);
        connectedKeys.add(`${p.target.string}-${p.target.fret}`);
      }
    } else if (selected) {
      connectedKeys.add(`${selected.string}-${selected.fret}`);
      for (const p of activeLines) {
        connectedKeys.add(`${p.root.string}-${p.root.fret}`);
        connectedKeys.add(`${p.target.string}-${p.target.fret}`);
      }
    }
  }

  function isSelected(s: number, f: number) {
    return selected?.string === s && selected?.fret === f;
  }
  function dotOpacity(s: number, f: number) {
    if (!isDimmed) return 1;
    return connectedKeys.has(`${s}-${f}`) ? 1 : 0.18;
  }

  // Find the best adjacent-string partner for playing the interval sound on click
  function getPrimaryPair(clickedString: number, clickedFret: number): Pair | null {
    const cands = pairs.filter(p =>
      direction === 'forward'
        ? p.root.string === clickedString && p.root.fret === clickedFret
        : p.target.string === clickedString && p.target.fret === clickedFret
    );
    // Prefer the next thinner string (string+1), then next thicker (string-1)
    return (
      cands.find(p => (direction === 'forward' ? p.target : p.root).string === clickedString + 1) ??
      cands.find(p => (direction === 'forward' ? p.target : p.root).string === clickedString - 1) ??
      null
    );
  }

  async function handleDotClick(s: number, f: number, isRoot: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    if (isLooping) {
      clearLoopTimers();
      setIsLooping(false);
      setLoopPairIdx(null);
    }
    const clickable = direction === 'forward' ? isRoot : !isRoot;
    const nowSelected = clickable ? (isSelected(s, f) ? null : { string: s, fret: f }) : null;
    if (clickable) setSelected(nowSelected);
    await initAudio();
    playNote(getFretNote(s, f), 1.5);
    // Play the interval as a two-note phrase so the user hears it, not just sees it
    if (nowSelected) {
      const primary = getPrimaryPair(s, f);
      if (primary) {
        const partner = direction === 'forward' ? primary.target : primary.root;
        setTimeout(() => playNote(getFretNote(partner.string, partner.fret), 1.2), 420);
      }
    }
  }

  function handleSendToIdentify() {
    if (!selected || !onSendToIdentify) return;
    const frets: number[] = [-1, -1, -1, -1, -1, -1];
    frets[selected.string] = selected.fret;
    const pair = getPrimaryPair(selected.string, selected.fret);
    if (pair) {
      const partner = direction === 'forward' ? pair.target : pair.root;
      frets[partner.string] = partner.fret;
    }
    onSendToIdentify(frets);
  }

  const activeNote  = direction === 'forward' ? rootNote   : targetNote;
  const partnerNote = direction === 'forward' ? targetNote : rootNote;

  const hint = (() => {
    if (isLooping) return loopPairIdx !== null
      ? `Shape ${loopPairIdx + 1} of ${loopPairs.length} — click Stop or any dot to cancel`
      : 'Starting…';
    if (selected) return 'Click the same dot or the fretboard background to clear';
    if (isUnison) return `Click any ${rootNote} dot to find same-pitch positions on other strings`;
    return `Click a ${activeNote} dot to hear and reveal its ${partnerNote} partners`;
  })();

  function lineLabel(pair: Pair) {
    const df = pair.target.fret - pair.root.fret;
    const ds = Math.abs(pair.target.string - pair.root.string);
    return `${df === 0 ? '±0' : df > 0 ? `+${df}` : `${df}`}f · ${ds}s`;
  }

  // Show fret offset labels in inposition mode (key teaching info) and during loop
  const showLineLabels = viewMode === 'inposition' || isLooping;

  return (
    <div className="w-full space-y-5">

      {/* ── Shape reference cards ── */}
      <div className="flex gap-6 justify-center flex-wrap py-1">
        {shapeCards.map(card => (
          <ShapeCard
            key={`${card.label}-${card.rootString}-${card.targetString}`}
            rootString={card.rootString}
            targetString={card.targetString}
            rootFret={card.rootFret}
            targetFret={card.targetFret}
            stringLabel={card.label}
          />
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Direction toggle — hidden for unison since both notes are the same */}
        {!isUnison && (
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
        )}

        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex rounded-lg overflow-hidden border border-brand-line text-sm font-medium">
            {([['all', 'All'], ['adjacent', 'Adjacent'], ['inposition', 'In Position']] as [ViewMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setViewMode(m); setSelected(null); }}
                className={`px-3 py-1.5 transition-colors ${viewMode === m ? 'bg-brand-active text-white' : 'bg-brand-surface text-brand-secondary hover:bg-brand-line'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Loop button */}
          <button
            onClick={toggleLoop}
            disabled={loopPairs.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
              ${isLooping
                ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600'
                : 'bg-brand-surface border-brand-line text-brand-secondary hover:bg-brand-line disabled:opacity-40'}`}
          >
            {isLooping ? <Square size={13} /> : <Play size={13} />}
            {isLooping ? 'Stop' : 'Loop shapes'}
          </button>

          {/* Send selected pair to Identify tab */}
          {onSendToIdentify && selected && (
            <button
              onClick={handleSendToIdentify}
              className="px-3 py-1.5 rounded-lg border border-brand-line bg-brand-surface text-brand-secondary text-sm font-medium hover:border-brand-primary/60 hover:text-brand-ink transition-colors"
              title="Send these two notes to the Chord Identifier"
            >
              Explore →
            </button>
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-sm text-brand-secondary -mt-2">{hint}</p>

      {/* ── Interactive fretboard ── */}
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-auto drop-shadow-sm border-8 border-brand-fretborder rounded-xl min-w-[600px]"
          onClick={() => { if (!isLooping) setSelected(null); }}
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

          {/* Position markers */}
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
          {displayLines.map((pair, i) => {
            const x1 = noteX(pair.root.fret);   const y1 = noteY(pair.root.string);
            const x2 = noteX(pair.target.fret); const y2 = noteY(pair.target.string);
            const mx = (x1 + x2) / 2;           const my = (y1 + y2) / 2;
            const label = lineLabel(pair);
            return (
              <g key={`line-${i}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={pair.bString ? '#f59e0b' : '#818cf8'}
                  strokeWidth={pair.bString ? 2.5 : 2}
                  opacity={pair.bString ? 0.9 : 0.8}
                  strokeDasharray={pair.bString ? '5 3' : undefined}
                />
                {showLineLabels && (
                  <g>
                    <rect x={mx - 18} y={my - 8} width={36} height={14} rx={3} fill="var(--color-brand-surface)" opacity={0.92} />
                    <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fill="var(--color-brand-ink)" fontWeight="600">{label}</text>
                  </g>
                )}
              </g>
            );
          })}

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
