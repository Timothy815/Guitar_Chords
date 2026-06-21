import React from 'react';
import { ChordShape, ScalePattern, STANDARD_TUNING } from '../types';
import { getFretNote, playNote } from '../lib/audio';
import { cn } from '../lib/utils';
import { ALL_NOTES } from '../data/guitarData';

interface FretboardProps {
  fretsNum?: number; // Usually 12 or 15 or 22
  chord?: ChordShape;
  scale?: ScalePattern;
  onNoteClick?: (note: string) => void;
  onFretClick?: (stringIdx: number, fretIdx: number) => void;
  showNoteNames?: boolean;
  className?: string; // Additional classes
  fretRange?: [number, number]; // [startFret, endFret] to isolate scales
  playingNotes?: Set<string>;
}

export function Fretboard({ fretsNum = 12, chord, scale, onNoteClick, onFretClick, showNoteNames = true, className, fretRange, playingNotes = new Set() }: FretboardProps) {
  const stringsNum = 6;
  const paddingX = 40;
  const paddingY = 30;
  const stringSpacing = 30;
  const totalWidth = 800; // SVG ViewBox
  const fretSpacing = (totalWidth - paddingX * 2) / fretsNum;
  const totalHeight = paddingY * 2 + stringSpacing * (stringsNum - 1);

  const dots = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleDots = [12, 24];

  const handleDotClick = (stringIdx: number, fretIdx: number) => {
    const noteStr = getFretNote(stringIdx, fretIdx);
    if (onFretClick) onFretClick(stringIdx, fretIdx);
    else if (onNoteClick) onNoteClick(noteStr);
    else playNote(noteStr);
  };

  const renderNoteMarker = (stringIdx: number, fretIdx: number) => {
    // stringIdx 0 is bottom drawn string (E2), strings usually drawn highest to lowest visually?
    // Standard notation: Top string visually is e (Highest frequency, index 5). Bottom string visually is E (Lowest frequency, index 0).
    const visualStringIdx = 5 - stringIdx; 
    const isMuted = fretIdx === -1;
    
    let text = "";
    let bgColor = "fill-brand-secondary/80";
    let textColor = "fill-white";
    let show = false;

    // Find note string for this position
    const noteStr = getFretNote(stringIdx, fretIdx);
    const isPlaying = playingNotes.has(noteStr);

    // Check Chord
    if (chord && chord.frets[stringIdx] === fretIdx) {
      if (isMuted) {
        text = "X";
        bgColor = "transparent";
        textColor = "fill-brand-secondary";
      } else {
         const finger = chord.fingers[stringIdx];
         text = (finger !== undefined && finger !== 0 && finger !== -1)
           ? finger.toString()
           : (showNoteNames ? noteStr.replace(/[0-9]/g, '') : '');
         if (fretIdx === 0) {
             bgColor = isPlaying ? "fill-orange-500" : "transparent";
             textColor = isPlaying ? "fill-white" : "fill-brand-active";
             text = getFretNote(stringIdx, 0).replace(/[0-9]/g, '');
         } else {
             bgColor = isPlaying ? "fill-orange-500" : "fill-brand-active";
         }
      }
      show = true;
    }

    // Check Scale
    if (scale && !chord) {
      const noteJustName = noteStr.replace(/[0-9]/g, '');
      if (scale.notes.includes(noteJustName as any)) {
         // Apply fretRange filtering
         if (fretRange) {
           const [startFret, endFret] = fretRange;
           if (fretIdx >= startFret && fretIdx <= endFret) {
             show = true;
           }
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
         text = showNoteNames ? noteJustName : "";
      }
    }

    const x = isMuted || fretIdx === 0 ? paddingX / 2 : paddingX + (fretIdx - 0.5) * fretSpacing;
    const y = paddingY + visualStringIdx * stringSpacing;

    if (!show && !isMuted) {
        if (fretIdx === 0 && (!chord && !scale)) {
            // Draw default open string notes when exploring
            const noteName = getFretNote(stringIdx, 0).replace(/[0-9]/g, '');
            return (
                <g onClick={() => handleDotClick(stringIdx, fretIdx)} style={{cursor: 'pointer'}}>
                  <circle cx={x} cy={y} r={12} className={cn("stroke-2 opacity-50", isPlaying ? "stroke-orange-500 fill-orange-500" : "stroke-brand-secondary fill-brand-bg")} />
                  <text x={x} y={y + 4} className={cn("text-[14px] font-bold pointer-events-none", isPlaying ? "fill-white" : "fill-brand-secondary")} textAnchor="middle">{noteName}</text>
                </g>
            );
        }
        
        // If it's playing but not in scale/chord, we can still show a ghost playing note
        if (isPlaying && (!chord && !scale)) {
           return (
            <g>
              <circle cx={x} cy={y} r={fretIdx === 0 ? 12 : 14} className="stroke-2 stroke-orange-500 fill-orange-500 shadow-lg print:stroke-black print:fill-white" />
              {showNoteNames && <text x={x} y={y + 5} className="text-[14px] font-bold pointer-events-none fill-white print:fill-black" textAnchor="middle">{noteStr.replace(/[0-9]/g, '')}</text>}
            </g>
           )
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

  return (
    <div className={cn("w-full overflow-x-auto print:overflow-hidden pb-4 print:pb-0", className)}>
      <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="w-full min-w-[600px] print:min-w-0 h-auto drop-shadow-sm border-8 print:border-2 border-brand-fretborder rounded-xl">
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
            strokeWidth={1 + (5 - i) * 0.4} // Thicker strings for lower ones visually (index 5 is bottom visually, which maps to E2)
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
              {/* String background interaction area for better clicks if we build an explorer mode */}
              <rect
                x={fretIdx === 0 ? 0 : paddingX + (fretIdx - 1) * fretSpacing}
                y={paddingY + (5 - stringIdx) * stringSpacing - 15}
                width={fretIdx === 0 ? paddingX : fretSpacing}
                height={30}
                fill="transparent"
                onClick={() => (!chord && !scale || onFretClick) ? handleDotClick(stringIdx, fretIdx) : null}
                className={(!chord && !scale || onFretClick) ? "cursor-pointer hover:fill-brand-secondary/20 transition-colors" : ""}
              />
              {renderNoteMarker(stringIdx, fretIdx)}
            </g>
          )
        )}

        {/* Fret numbers — inside SVG so they scale with the fretboard */}
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
    </div>
  );
}
