import React, { useState } from 'react';
import { ChordShape, ScalePattern, STANDARD_TUNING } from '../types';
import { getFretNote, playNote } from '../lib/audio';
import { cn } from '../lib/utils';
import { ALL_NOTES } from '../data/guitarData';

type LabelMode = 'none' | 'note' | 'interval';

const INTERVAL_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

function getIntervalName(root: string, note: string): string {
  const rootIdx = ALL_NOTES.indexOf(root as any);
  const noteIdx = ALL_NOTES.indexOf(note as any);
  if (rootIdx === -1 || noteIdx === -1) return '';
  return INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12];
}

interface FretboardProps {
  fretsNum?: number; // Usually 12 or 15 or 22
  chord?: ChordShape;
  scale?: ScalePattern;
  onNoteClick?: (note: string) => void;
  onFretClick?: (stringIdx: number, fretIdx: number) => void;
  onFretMouseDown?: (stringIdx: number, fretIdx: number) => void;
  showNoteNames?: boolean;
  className?: string; // Additional classes
  fretRange?: [number, number]; // [startFret, endFret] to isolate scales
  playingNotes?: Set<string>;
  compact?: boolean; // removes min-width constraint and hides label toggle (for grid contexts)
  correctPositions?: Set<string>;
  wrongPosition?: string | null;
  previewPosition?: string | null;
}

export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, onFretMouseDown, showNoteNames = true, className, fretRange, playingNotes = new Set(), compact = false, correctPositions = new Set(), wrongPosition = null, previewPosition = null }: FretboardProps) {
  const [labelMode, setLabelMode] = useState<LabelMode>('none');

  const stringsNum = 6;
  const paddingX = 40;
  const paddingY = 30;
  const stringSpacing = 30;
  const totalWidth = 800; // SVG ViewBox
  const fretSpacing = (totalWidth - paddingX * 2) / fretsNum;
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
    const noteStr = getFretNote(stringIdx, fretIdx);
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

    const noteStr = getFretNote(stringIdx, fretIdx);
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
          bgColor = isPlaying ? "fill-orange-500" : "transparent";
          textColor = isPlaying ? "fill-white" : "fill-brand-active";
          text = labelMode !== 'none' ? getLabelText(noteJustName) : getFretNote(stringIdx, 0).replace(/[0-9]/g, '');
        } else {
          bgColor = isPlaying ? "fill-orange-500" : "fill-brand-active";
          const finger = chord.fingers[stringIdx];
          if (labelMode !== 'none') {
            text = getLabelText(noteJustName);
          } else {
            text = (finger !== undefined && finger !== 0 && finger !== -1)
              ? finger.toString()
              : (showNoteNames ? noteJustName : '');
          }
        }
      }
      show = true;
    }

    // Check Scale
    if (scale && !chord) {
      if (scale.notes.includes(noteJustName as any)) {
        if (fretRange) {
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
            bgColor = "fill-brand-active";
          }
        }
        text = labelMode !== 'none' ? getLabelText(noteJustName) : (showNoteNames ? noteJustName : "");
      }
    }

    const x = isMuted || fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
    const y = paddingY + visualStringIdx * stringSpacing;

    if (!show && !isMuted) {
      if (fretIdx === 0 && (!chord && !scale)) {
        const noteName = getFretNote(stringIdx, 0).replace(/[0-9]/g, '');
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

      return null;
    }

    if (isMuted) {
      return (
        <text x={x} y={y + 5} className="text-sm font-bold fill-brand-secondary pointer-events-none" textAnchor="middle">X</text>
      );
    }

    return (
      <g onClick={() => handleDotClick(stringIdx, fretIdx)} style={{cursor: 'pointer'}}>
        <circle cx={x} cy={y} r={fretIdx === 0 ? 10 : 14} className={cn("stroke-2 shadow-lg", fretIdx === 0 ? "stroke-brand-secondary fill-brand-bg print:stroke-black print:fill-white" : "stroke-white/20 print:stroke-black print:fill-white", bgColor)} />
        {text && <text x={x} y={y + 5} className={cn("text-[14px] font-bold pointer-events-none", textColor, fretIdx === 0 ? "print:fill-black" : "print:fill-black")} textAnchor="middle">{text}</text>}
      </g>
    );
  };

  const showToggle = !!(chord || scale);

  return (
    <div className={cn("w-full overflow-x-auto print:overflow-hidden pb-4 print:pb-0", className)}>
      <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className={cn("w-full h-auto drop-shadow-sm border-8 print:border-2 border-brand-fretborder rounded-xl", !compact && "min-w-[600px] print:min-w-0")}>
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
        {Array.from({ length: fretsNum }).map((_, fretIdx) => {
          const actualFret = fretIdx + 1;
          const x = paddingX + (fretIdx + 0.5) * fretSpacing;
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
          Array.from({ length: fretsNum + 1 }).map((_, fretIdx) =>
            <g key={`note-${stringIdx}-${fretIdx}`}>
              <rect
                x={fretIdx === 0 ? 0 : paddingX + (fretIdx - 1) * fretSpacing}
                y={paddingY + (5 - stringIdx) * stringSpacing - 15}
                width={fretIdx === 0 ? paddingX : fretSpacing}
                height={30}
                fill="transparent"
                onClick={() => (!chord && !scale || onFretClick) ? handleDotClick(stringIdx, fretIdx) : null}
                onMouseDown={onFretMouseDown ? () => onFretMouseDown(stringIdx, fretIdx) : undefined}
                className={(!chord && !scale || onFretClick) ? "cursor-pointer hover:fill-brand-secondary/20 transition-colors" : ""}
              />
              {renderNoteMarker(stringIdx, fretIdx)}
            </g>
          )
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
          const noteStr = getFretNote(sIdx, fIdx);
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
          Array.from({ length: fretsNum + 1 }).map((_, fretIdx) => {
            const key = `${stringIdx}-${fretIdx}`;
            const isCorrect = correctPositions.has(key);
            const isWrong = wrongPosition === key;
            if (!isCorrect && !isWrong) return null;
            const visualStringIdx = 5 - stringIdx;
            const x = fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
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
            {i + 1}
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
          <div key={i} className="flex-1 text-center">{i + 1}</div>
        ))}
      </div>
    </div>
  );
}
