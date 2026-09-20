import React from 'react';
import { Note } from '../types';
import { cn } from '../lib/utils';
import { relativeMinorOf, displayNote, wedgeInfo, WedgeQuality } from '../data/musicTheory';

interface CircleOfFifthsProps {
  tonic: Note | null;
  mode: 'major' | 'minor';
  selected?: { root: Note; quality: WedgeQuality } | null;
  onSelect: (root: Note, quality: WedgeQuality) => void;
  showNumerals?: boolean;
  compact?: boolean;
  className?: string;
}

const CX = 200, CY = 200;

// Clockwise from top (major key at 12 o'clock), in fifths.
const MAJOR_NOTES: Note[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

const MAJOR_OUTER_R = 180, MAJOR_INNER_R = 118;
const MINOR_OUTER_R = 116, MINOR_INNER_R = 58;
const MAJOR_LABEL_R = 163, MAJOR_NUMERAL_R = 135;
const MINOR_LABEL_R = 100, MINOR_NUMERAL_R = 74;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polar(r: number, angleDeg: number) {
  return { x: CX + r * Math.cos(toRad(angleDeg)), y: CY + r * Math.sin(toRad(angleDeg)) };
}

function wedgePath(i: number, r0: number, r1: number): string {
  const gap = 1.5;
  const s = i * 30 - 90 + gap / 2;
  const e = (i + 1) * 30 - 90 - gap / 2;
  const p1 = polar(r1, s);
  const p2 = polar(r1, e);
  const p3 = polar(r0, e);
  const p4 = polar(r0, s);
  return (
    `M ${p1.x} ${p1.y} ` +
    `A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} ` +
    `L ${p3.x} ${p3.y} ` +
    `A ${r0} ${r0} 0 0 0 ${p4.x} ${p4.y} Z`
  );
}

function textAt(r: number, i: number) {
  const mid = i * 30 - 90 + 15;
  return polar(r, mid);
}

function wedgeFill(isTonic: boolean, isDiatonic: boolean, isSelected: boolean): string {
  if (isTonic) return 'var(--color-brand-active)';
  if (isSelected) return 'var(--color-brand-primary)';
  if (isDiatonic) return 'color-mix(in srgb, var(--color-brand-active) 20%, var(--color-brand-surface))';
  return 'var(--color-brand-surface)';
}

export function CircleOfFifths({
  tonic,
  mode,
  selected = null,
  onSelect,
  showNumerals = true,
  compact = false,
  className,
}: CircleOfFifthsProps) {
  const numeralsOn = showNumerals && !compact;

  return (
    <div className={cn('w-full max-w-sm mx-auto', className)}>
      <svg viewBox="0 0 400 400" className="w-full h-auto drop-shadow-md">
        {MAJOR_NOTES.map((majorNote, i) => {
          const minorNote = relativeMinorOf(majorNote);
          const majorInfo = wedgeInfo(tonic, mode, majorNote, 'major');
          const minorInfo = wedgeInfo(tonic, mode, minorNote, 'minor');
          const majorSelected = !!selected && selected.root === majorNote && selected.quality === 'major';
          const minorSelected = !!selected && selected.root === minorNote && selected.quality === 'minor';

          const majorLabelPos = textAt(MAJOR_LABEL_R, i);
          const majorNumeralPos = textAt(MAJOR_NUMERAL_R, i);
          const minorLabelPos = textAt(MINOR_LABEL_R, i);
          const minorNumeralPos = textAt(MINOR_NUMERAL_R, i);
          const majorDisplay = displayNote(majorNote);
          const majorFontSize = compact
            ? (majorDisplay.length > 2 ? 8 : 11)
            : (majorDisplay.length > 2 ? 9 : 13);

          return (
            <g key={majorNote}>
              {/* Outer (major) wedge */}
              <g onClick={() => onSelect(majorNote, 'major')} style={{ cursor: 'pointer' }}>
                <path
                  d={wedgePath(i, MAJOR_INNER_R, MAJOR_OUTER_R)}
                  fill={wedgeFill(majorInfo.isTonic, majorInfo.isDiatonic, majorSelected)}
                  stroke="var(--color-brand-line)"
                  strokeWidth={majorSelected ? 2.5 : 1}
                />
                <text
                  x={majorLabelPos.x} y={majorLabelPos.y + 5}
                  textAnchor="middle"
                  fontSize={majorFontSize}
                  fontWeight="bold"
                  fill={majorInfo.isTonic || majorSelected ? 'white' : 'var(--color-brand-ink)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {majorDisplay}
                </text>
                {numeralsOn && majorInfo.numeral && (
                  <text
                    x={majorNumeralPos.x} y={majorNumeralPos.y + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={majorInfo.isTonic || majorSelected ? 'rgba(255,255,255,0.85)' : 'var(--color-brand-secondary)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {majorInfo.numeral}
                  </text>
                )}
              </g>

              {/* Inner (relative minor) wedge */}
              <g onClick={() => onSelect(minorNote, 'minor')} style={{ cursor: 'pointer' }}>
                <path
                  d={wedgePath(i, MINOR_INNER_R, MINOR_OUTER_R)}
                  fill={wedgeFill(minorInfo.isTonic, minorInfo.isDiatonic, minorSelected)}
                  stroke="var(--color-brand-line)"
                  strokeWidth={minorSelected ? 2.5 : 1}
                />
                <text
                  x={minorLabelPos.x} y={minorLabelPos.y + 4}
                  textAnchor="middle"
                  fontSize={compact ? 7 : 8}
                  fill={minorInfo.isTonic || minorSelected ? 'white' : 'var(--color-brand-secondary)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {displayNote(minorNote)}m
                </text>
                {numeralsOn && minorInfo.numeral && (
                  <text
                    x={minorNumeralPos.x} y={minorNumeralPos.y + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fill={minorInfo.isTonic || minorSelected ? 'rgba(255,255,255,0.8)' : 'var(--color-brand-secondary)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {minorInfo.numeral}
                  </text>
                )}
              </g>
            </g>
          );
        })}
        {/* Decorative center circle */}
        <circle cx={CX} cy={CY} r={50} fill="var(--color-brand-fretborder)" opacity={0.25} />
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
