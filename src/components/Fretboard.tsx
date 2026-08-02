import React, { useState, useEffect, useRef } from 'react';
import { ChordShape, ScalePattern, STANDARD_TUNING, Tuning } from '../types';
import { getFretNote, playNote } from '../lib/audio';
import { cn } from '../lib/utils';
import { ALL_NOTES } from '../data/guitarData';
import { FretboardFocus } from '../lib/earTraining';

type LabelMode = 'none' | 'note' | 'interval';

const INTERVAL_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

function isInFocus(
  stringIdx: number,
  fretIdx: number,
  focus: FretboardFocus,
  fretsNum: number,
): boolean {
  if (focus.stringIdxs && focus.stringIdxs.length > 0 && !focus.stringIdxs.includes(stringIdx)) return false;
  const fMin = focus.fretMin ?? 0;
  const fMax = focus.fretMax ?? fretsNum;
  return fretIdx >= fMin && fretIdx <= fMax;
}

function getIntervalName(root: string, note: string): string {
  const rootIdx = ALL_NOTES.indexOf(root as any);
  const noteIdx = ALL_NOTES.indexOf(note as any);
  if (rootIdx === -1 || noteIdx === -1) return '';
  return INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
}

interface FretboardProps {
  fretsNum?: number; // Usually 12 or 15 or 22
  startFret?: number; // Starting fret number (default 0) for focused windows
  chord?: ChordShape;
  scale?: ScalePattern;
  onNoteClick?: (note: string) => void;
  onFretClick?: (stringIdx: number, fretIdx: number) => void;
  onFretMouseDown?: (stringIdx: number, fretIdx: number) => void;
  showNoteNames?: boolean;
  className?: string; // Additional classes
  fretRange?: [number, number]; // [startFret, endFret] to isolate scales
  scalePositions?: Set<string>; // explicit string-fret positions for strict scale shapes
  playingNotes?: Set<string>;
  compact?: boolean; // removes min-width constraint and hides label toggle (for grid contexts)
  correctPositions?: Set<string>;
  wrongPosition?: string | null;
  previewPosition?: string | null;
  focusZone?: FretboardFocus;
  highlightNote?: { stringIdx: number; fret: number };
  labeledDots?: { stringIdx: number; fret: number }[];
  flashHighlight?: boolean;
  tuning?: Tuning;
  drillDots?: { stringIdx: number; fret: number; label: string; highlight?: boolean; color?: string }[];
  showAllNotes?: boolean; // ghost-dot every fret position; chord dots forced orange
  rootPosition?: string | null; // e.g., "2-5" for interval training root
  cagedPositionMap?: Map<string, number[]>; // position key -> CAGED position indices (0-4)
  cagedColors?: string[]; // Array of 5 colors for E/D/C/A/G shapes
}

export function Fretboard({ fretsNum = 12, startFret = 0, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, scalePositions, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null, focusZone, highlightNote, labeledDots, flashHighlight, tuning = STANDARD_TUNING, drillDots, showAllNotes = false, rootPosition = null, cagedPositionMap, cagedColors }: FretboardProps) {
  const [labelMode, setLabelMode] = useState<LabelMode>('none');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const stringsNum = 6;
  const paddingX = 40;
  const paddingY = 30;

  // Consistent string spacing across all views for visual consistency
  const stringSpacing = 36;

  // Keep fret spacing constant regardless of fret count for proper scrolling
  const baseFretSpacing = 60; // spacing for standard 12-fret view
  const fretSpacing = baseFretSpacing;
  const totalWidth = paddingX * 2 + fretSpacing * fretsNum;
  const totalHeight = paddingY * 2 + stringSpacing * (stringsNum - 1);

  const dots = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleDots = [12, 24];

  // Root note for interval calculation — from scale or chord name
  const labelRoot: string | null = scale?.root ?? (chord ? chord.name.split(' ')[0] : null);
  const canShowIntervals = labelRoot !== null;

  const cycleLabelMode = () => {
    setLabelMode(prev => {
      if (prev === 'none') return 'note';
      if (prev === 'note') return canShowIntervals ? 'interval' : 'none';
      return 'none';
    });
  };

  const getLabelText = (noteJustName: string): string => {
    if (labelMode === 'note') return noteJustName;
    if (labelMode === 'interval' && labelRoot) return getIntervalName(labelRoot, noteJustName);
    return '';
  };

  const handleDotClick = (stringIdx: number, fretIdx: number) => {
    const noteStr = getFretNote(stringIdx, fretIdx, tuning);
    if (onFretClick) onFretClick(stringIdx, fretIdx);
    else if (onNoteClick) onNoteClick(noteStr);
    else playNote(noteStr);
  };

  const renderNoteMarker = (stringIdx: number, fretIdx: number) => {
    const visualStringIdx = 5 - stringIdx;
    const isMuted = fretIdx === -1;

    let text = "";
    let bgColor = "fill-brand-secondary/80";
    let textColor = "fill-white";
    let show = false;

    const noteStr = getFretNote(stringIdx, fretIdx, tuning);
    const noteJustName = noteStr.replace(/[0-9]/g, '');
    const isPlaying = playingNotes.has(noteStr);

    // Check Chord
    if (chord && chord.frets[stringIdx] === fretIdx) {
      if (isMuted) {
        text = "X";
        bgColor = "transparent";
        textColor = "fill-brand-secondary";
      } else {
        if (fretIdx === 0) {
          bgColor = (isPlaying || showAllNotes) ? "fill-orange-500" : "transparent";
          textColor = (isPlaying || showAllNotes) ? "fill-white" : "fill-brand-active";
          text = labelMode !== 'none' ? getLabelText(noteJustName) : getFretNote(stringIdx, 0, tuning).replace(/[0-9]/g, '');
        } else {
          bgColor = (isPlaying || showAllNotes) ? "fill-orange-500" : "fill-brand-active";
          const finger = chord.fingers[stringIdx];
          if (labelMode !== 'none') {
            text = getLabelText(noteJustName);
          } else {
            text = showAllNotes ? noteJustName : (finger !== undefined && finger !== 0 && finger !== -1)
              ? finger.toString()
              : (showNoteNames ? noteJustName : '');
          }
        }
      }
      show = true;
    }

    // Track if this is a root note for special rendering
    let isRootNote = false;

    // Check Scale
    if (scale && !chord) {
      if (scale.notes.includes(noteJustName as any)) {
        const inExplicitPosition = scalePositions ? scalePositions.has(`${stringIdx}-${fretIdx}`) : true;
        if (!inExplicitPosition) {
          show = false;
        } else if (fretRange) {
          const [startFret, endFret] = fretRange;
          if (fretIdx >= startFret && fretIdx <= endFret) show = true;
        } else {
          show = true;
        }

        if (show) {
          if (isPlaying) {
            bgColor = "fill-orange-500";
            textColor = "fill-white";
          } else if (noteJustName === scale.root) {
            isRootNote = true;
            bgColor = "fill-brand-active";
          } else if (cagedPositionMap && cagedColors) {
            // Use CAGED position colors
            const posKey = `${stringIdx}-${fretIdx}`;
            const cagedPos = cagedPositionMap.get(posKey);
            if (cagedPos && cagedPos.length > 0) {
              // Primary color is the first CAGED position
              bgColor = '';  // We'll use inline style instead
            }
          }
        }
        const isExplicitlyLabeled = labeledDots?.some(d => d.stringIdx === stringIdx && d.fret === fretIdx) ?? false;
        // Show note names: always for open strings, when showNoteNames is on, or when explicitly labeled
        text = labelMode !== 'none' ? getLabelText(noteJustName) : (showNoteNames || isExplicitlyLabeled || fretIdx === 0 ? noteJustName : "");
      }
    }

    // drillDots: force-show a dot with a custom label (e.g. finger number) at this position
    const drillDot = drillDots?.find(d => d.stringIdx === stringIdx && d.fret === fretIdx);
    if (drillDot) {
      show = true;
      text = drillDot.label;
      bgColor = drillDot.color ? '' : (drillDot.highlight ? 'fill-amber-400' : 'fill-brand-primary');
      textColor = 'fill-white';
    }

    const x = isMuted || fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
    const y = paddingY + visualStringIdx * stringSpacing;

    if (!show && !isMuted) {
      if (fretIdx === 0 && (!chord && !scale)) {
        const noteName = getFretNote(stringIdx, 0, tuning).replace(/[0-9]/g, '');
        return (
          <g onClick={() => handleDotClick(stringIdx, fretIdx)} style={{cursor: 'pointer'}}>
            <circle cx={x} cy={y} r={12} className={cn("stroke-2 opacity-50", isPlaying ? "stroke-orange-500 fill-orange-500" : "stroke-brand-secondary fill-brand-bg")} />
            <text x={x} y={y + 4} className={cn("text-[14px] font-bold pointer-events-none", isPlaying ? "fill-white" : "fill-brand-secondary")} textAnchor="middle">{noteName}</text>
          </g>
        );
      }

      if (isPlaying && (!chord && !scale)) {
        return (
          <g>
            <circle cx={x} cy={y} r={fretIdx === 0 ? 12 : 14} className="stroke-2 stroke-orange-500 fill-orange-500 shadow-lg print:stroke-black print:fill-white" />
            {showNoteNames && <text x={x} y={y + 5} className="text-[14px] font-bold pointer-events-none fill-white print:fill-black" textAnchor="middle">{noteStr.replace(/[0-9]/g, '')}</text>}
          </g>
        );
      }

      if (showAllNotes) {
        const noteName = noteStr.replace(/[0-9]/g, '');
        return (
          <g onClick={() => handleDotClick(stringIdx, fretIdx)} style={{cursor: 'pointer'}}>
            <circle cx={x} cy={y} r={fretIdx === 0 ? 9 : 11} className="fill-brand-bg stroke-brand-secondary/60 stroke-1" />
            <text x={x} y={y + 4} className="text-[10px] pointer-events-none fill-brand-secondary" textAnchor="middle">{noteName}</text>
          </g>
        );
      }

      return null;
    }

    if (isMuted) {
      return (
        <text x={x} y={y + 5} className="text-sm font-bold fill-brand-secondary pointer-events-none" textAnchor="middle">X</text>
      );
    }

    // For open-string positions (fretIdx=0), fill-brand-bg is in the static class string.
    // When a drillDot overrides bgColor, drop fill-brand-bg so it doesn't win over fill-amber-400.
    const openStringBase = drillDot
      ? "stroke-brand-secondary print:stroke-black print:fill-white"
      : "stroke-brand-secondary fill-brand-bg print:stroke-black print:fill-white";

    // Check if this position has CAGED colors (only in full neck view)
    const posKey = `${stringIdx}-${fretIdx}`;
    const cagedPos = cagedPositionMap?.get(posKey);
    const usingCagedColors = cagedPositionMap && cagedColors; // true only in full neck view
    const hasCagedColor = cagedPos && cagedPos.length > 0 && usingCagedColors && !isRootNote;

    // Build inline style for CAGED colors or root notes
    let inlineStyle: React.CSSProperties | undefined = drillDot?.color ? { fill: drillDot.color } : undefined;
    if (isRootNote && usingCagedColors) {
      // Root notes in full neck view: brand-active color with thick black ring for emphasis
      inlineStyle = {
        fill: 'var(--color-brand-active)',
        stroke: '#000000',
        strokeWidth: 3,
      };
    } else if (hasCagedColor) {
      const primaryColor = cagedColors![cagedPos[0]];
      const hasOverlap = cagedPos.length > 1;
      const secondaryColor = hasOverlap ? cagedColors![cagedPos[1]] : undefined;

      inlineStyle = {
        fill: primaryColor,
        stroke: secondaryColor || (fretIdx === 0 ? undefined : '#ffffff33'),
        strokeWidth: secondaryColor ? 4 : 2,
      };
    }

    const dotRadius = isRootNote && usingCagedColors ? (fretIdx === 0 ? 12 : 16) : (fretIdx === 0 ? 10 : 14);

    return (
      <g onClick={() => handleDotClick(stringIdx, fretIdx)} style={{cursor: 'pointer'}}>
        <circle
          cx={x}
          cy={y}
          r={dotRadius}
          className={cn(
            "shadow-lg",
            fretIdx === 0 ? openStringBase : "print:stroke-black print:fill-white",
            // Only skip stroke/fill classes if we're actually applying inline styles
            (hasCagedColor || (isRootNote && usingCagedColors)) ? '' : (fretIdx === 0 ? '' : "stroke-white/20 stroke-2"),
            (hasCagedColor || (isRootNote && usingCagedColors)) ? '' : bgColor
          )}
          style={inlineStyle}
        />
        {text && <text x={x} y={y + 5} className={cn("text-[14px] font-bold pointer-events-none", textColor, fretIdx === 0 ? "print:fill-black" : "print:fill-black")} textAnchor="middle">{text}</text>}
      </g>
    );
  };

  const showToggle = !!(chord || scale);

  // For extended fretboards (>15 frets), use fixed width to enable scrolling
  const useFixedWidth = fretsNum > 15;
  const svgWidth = useFixedWidth ? totalWidth : undefined;

  // Auto-scroll for full neck view only (position views use startFret offset instead)
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    // Only auto-scroll for full neck view (startFret === 0, fretsNum > 15)
    // Position views with startFret offset don't need scrolling
    if (startFret !== 0 || fretsNum <= 15) {
      scrollContainerRef.current.scrollLeft = 0;
      return;
    }

    let rangeStartFret: number | undefined;

    // Try to get range from fretRange prop
    if (fretRange && fretRange.length === 2) {
      [rangeStartFret] = fretRange;
    }
    // If no fretRange, calculate from scalePositions (for strict CAGED positions)
    else if (scalePositions && scalePositions.size > 0) {
      const frets = Array.from(scalePositions).map(pos => parseInt(pos.split('-')[1], 10));
      rangeStartFret = Math.min(...frets);
    }

    // No range to scroll to
    if (rangeStartFret === undefined) return;

    // Auto-scroll if position starts at fret 10 or higher
    if (rangeStartFret >= 10) {
      const scrollPosition = Math.max(0, (rangeStartFret - 3) * fretSpacing);
      scrollContainerRef.current.scrollLeft = scrollPosition;
    } else if (rangeStartFret >= 7) {
      const scrollPosition = Math.max(0, (rangeStartFret - 2) * fretSpacing);
      scrollContainerRef.current.scrollLeft = scrollPosition;
    } else {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [fretRange, scalePositions, fretSpacing, startFret, fretsNum]);

  return (
    <div ref={scrollContainerRef} className={cn("w-full overflow-x-auto print:overflow-hidden pb-4 print:pb-0", className)}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={svgWidth}
        className={cn("h-auto drop-shadow-sm border-8 print:border-2 border-brand-fretborder rounded-xl", useFixedWidth ? "" : "w-full", !compact && !useFixedWidth && "min-w-[600px] print:min-w-0")}
      >
        {/* Fretboard Background */}
        <rect x={paddingX} y={paddingY} width={totalWidth - paddingX * 2} height={totalHeight - paddingY * 2} fill="var(--color-brand-fretboard)" />

        {/* Fret Lines */}
        {Array.from({ length: fretsNum + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={paddingX + i * fretSpacing}
            y1={paddingY}
            x2={paddingX + i * fretSpacing}
            y2={totalHeight - paddingY}
            stroke="var(--color-brand-fret)"
            strokeWidth={i === 0 ? 6 : 3}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: stringsNum }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={paddingX}
            y1={paddingY + i * stringSpacing}
            x2={totalWidth - paddingX}
            y2={paddingY + i * stringSpacing}
            stroke="#AAAAAA"
            strokeWidth={1 + (5 - i) * 0.4}
          />
        ))}

        {/* Fret Markers (Dots) */}
        {Array.from({ length: fretsNum }).map((_, i) => {
          const actualFret = startFret + i + 1;
          const x = paddingX + (i + 0.5) * fretSpacing;
          const middleY = paddingY + ((stringsNum - 1) * stringSpacing) / 2;

          if (dots.includes(actualFret)) {
            return <circle key={`dot-${actualFret}`} cx={x} cy={middleY} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />;
          }
          if (doubleDots.includes(actualFret)) {
            return (
              <g key={`dot-${actualFret}`}>
                 <circle cx={x} cy={paddingY + stringSpacing * 1.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
                 <circle cx={x} cy={paddingY + stringSpacing * 3.5} r={6} fill="var(--color-brand-fretborder)" opacity={0.6} />
              </g>
            );
          }
          return null;
        })}

        {/* Render Notes */}
        {Array.from({ length: stringsNum }).map((_, stringIdx) =>
          Array.from({ length: fretsNum + 1 }).map((_, i) => {
            const fretIdx = startFret + i;
            return (
              <g key={`note-${stringIdx}-${fretIdx}`}>
                <rect
                  x={i === 0 ? 0 : paddingX + (i - 1) * fretSpacing}
                  y={paddingY + (5 - stringIdx) * stringSpacing - 15}
                  width={i === 0 ? paddingX : fretSpacing}
                  height={30}
                  fill="transparent"
                  onClick={() => (!chord && !scale || onFretClick) ? handleDotClick(stringIdx, fretIdx) : null}
                  onMouseDown={onFretMouseDown ? () => onFretMouseDown(stringIdx, fretIdx) : undefined}
                  className={(!chord && !scale || onFretClick) ? "cursor-pointer hover:fill-brand-secondary/20 transition-colors" : ""}
                />
                {renderNoteMarker(stringIdx, fretIdx)}
              </g>
            );
          })
        )}

        {/* Dimming overlay — dims frets outside the active focus zone */}
        {focusZone && Array.from({ length: stringsNum }).map((_, stringIdx) =>
          Array.from({ length: fretsNum + 1 }).map((_, i) => {
            const fretIdx = startFret + i;
            if (isInFocus(stringIdx, fretIdx, focusZone, fretsNum + startFret)) return null;
            const visualStringIdx = 5 - stringIdx;
            const x = i === 0 ? 0 : paddingX + (i - 1) * fretSpacing;
            const y = paddingY + visualStringIdx * stringSpacing - 15;
            const width = i === 0 ? paddingX : fretSpacing;
            return (
              <rect
                key={`dim-${stringIdx}-${fretIdx}`}
                x={x}
                y={y}
                width={width}
                height={30}
                fill="rgba(0,0,0,0.35)"
                style={{ pointerEvents: 'none' }}
              />
            );
          })
        )}

        {/* Preview dot (Hunt mode) — blue circle with pitch-class label */}
        {previewPosition && (() => {
          const [sStr, fStr] = previewPosition.split('-');
          const sIdx = Number(sStr);
          const fIdx = Number(fStr);
          const visualStringIdx = 5 - sIdx;
          const x = fIdx === 0 ? paddingX / 2 : paddingX + (fIdx - 0.5) * fretSpacing;
          const y = paddingY + visualStringIdx * stringSpacing;
          const r = fIdx === 0 ? 10 : 14;
          const noteStr = getFretNote(sIdx, fIdx, tuning);
          const pitchClass = noteStr ? noteStr.replace(/\d$/, '') : '';
          return (
            <g key="preview" style={{ pointerEvents: 'none' }}>
              <circle cx={x} cy={y} r={r} fill="#3b82f6" opacity={0.9} />
              {pitchClass && (
                <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">
                  {pitchClass}
                </text>
              )}
            </g>
          );
        })()}

        {/* Trainer feedback dots */}
        {(correctPositions.size > 0 || wrongPosition !== null) && Array.from({ length: stringsNum }).map((_, stringIdx) =>
          Array.from({ length: fretsNum + 1 }).map((_, i) => {
            const fretIdx = startFret + i;
            const key = `${stringIdx}-${fretIdx}`;
            const isCorrect = correctPositions.has(key);
            const isWrong = wrongPosition === key;
            if (!isCorrect && !isWrong) return null;
            const visualStringIdx = 5 - stringIdx;
            const x = i === 0 ? paddingX / 2 : paddingX + (i - 0.5) * fretSpacing;
            const y = paddingY + visualStringIdx * stringSpacing;
            return (
              <circle
                key={`trainer-${key}`}
                cx={x}
                cy={y}
                r={fretIdx === 0 ? 10 : 14}
                fill={isWrong ? '#ef4444' : '#22c55e'}
                opacity={0.85}
                style={{ pointerEvents: 'none' }}
              />
            );
          })
        )}

        {/* Root position marker for interval training */}
        {rootPosition && (() => {
          const [stringIdx, fretIdx] = rootPosition.split('-').map(Number);
          const visualStringIdx = 5 - stringIdx;
          const x = fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
          const y = paddingY + visualStringIdx * stringSpacing;
          return (
            <circle
              key="root-position"
              cx={x}
              cy={y}
              r={fretIdx === 0 ? 10 : 14}
              fill="#3b82f6"
              opacity={0.9}
              style={{ pointerEvents: 'none' }}
            />
          );
        })()}

        {/* Highlight note — rendered as brand-primary filled circle over scale dot */}
        {highlightNote && (() => {
          const { stringIdx, fret } = highlightNote;
          const visualStringIdx = 5 - stringIdx;
          const x = fret === 0 ? paddingX / 2 : paddingX + (fret - 0.5) * fretSpacing;
          const y = paddingY + visualStringIdx * stringSpacing;
          const r = fret === 0 ? 10 : 14;
          return (
            <g key="highlight-note" style={{ pointerEvents: 'none' }} className={flashHighlight ? 'animate-pulse' : undefined}>
              <circle cx={x} cy={y} r={r} fill="var(--color-brand-primary)" opacity={0.9} />
              <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">★</text>
            </g>
          );
        })()}

        {/* Fret numbers — screen only */}
        {Array.from({ length: fretsNum }).map((_, i) => (
          <text
            key={`fnum-${i}`}
            x={paddingX + (i + 0.5) * fretSpacing}
            y={totalHeight - 8}
            textAnchor="middle"
            fontSize={10}
            className="font-mono fill-brand-secondary/70 print:hidden"
          >
            {startFret + i + 1}
          </text>
        ))}
      </svg>

      {/* Label mode toggle — only when chord or scale is active, and not in compact mode */}
      {showToggle && !compact && (
        <div className="flex justify-end mt-1 print:hidden">
          <button
            onClick={cycleLabelMode}
            className={cn(
              'text-xs px-2.5 py-0.5 rounded border transition-colors',
              labelMode !== 'none'
                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary'
            )}
          >
            {labelMode === 'none' ? 'Labels: off' : labelMode === 'note' ? 'Labels: notes' : 'Labels: intervals'}
          </button>
        </div>
      )}

      {/* Fret numbers for print — HTML so they render at full CSS size */}
      <div
        className="hidden print:flex text-[9px] font-mono text-gray-600"
        style={{ paddingLeft: `${(paddingX / totalWidth) * 100}%`, paddingRight: `${(paddingX / totalWidth) * 100}%` }}
      >
        {Array.from({ length: fretsNum }).map((_, i) => (
          <div key={i} className="flex-1 text-center">{startFret + i + 1}</div>
        ))}
      </div>
    </div>
  );
}
