import { ChordShape, Tuning, STANDARD_TUNING } from '../types';
import { getNoteFromFret } from '../data/guitarData';
import { cn } from '../lib/utils';

interface ChordDiagramProps {
  chord: ChordShape;
  /** Dot labels: finger numbers (default) or note names. */
  labelMode?: 'fingers' | 'notes';
  tuning?: Tuning;
  className?: string;
}

// Geometry, in SVG user units. The viewBox scales to the container, so these
// are ratios rather than pixels — every diagram gets the same proportions
// regardless of where on the neck the shape sits.
const STRING_GAP = 22;
const FRET_GAP = 26;
const FRET_ROWS = 5; // window height; every diagram shows exactly this many frets
const PAD_L = 24; // room for the fret-number column
const PAD_R = 12; // room for a dot to overhang the high-E string
const MARKER_H = 20; // top row holding the × / ○ markers
const NAME_H = 18; // bottom row holding the string names
const DOT_R = 8.5;

const GRID_W = STRING_GAP * 5;
const GRID_Y = MARKER_H;
const VIEW_W = PAD_L + GRID_W + PAD_R;

const stringX = (stringIdx: number) => PAD_L + STRING_GAP * stringIdx;

/**
 * Picks the fret window to draw. Open-position shapes start at the nut;
 * anything higher slides the window down to the shape's lowest fretted note.
 * The window is 5 frets tall unless a shape genuinely spans more, so every
 * diagram comes out the same size.
 */
function getWindow(frets: number[]): { startFret: number; rows: number } {
  const fretted = frets.filter(f => f > 0);
  if (fretted.length === 0) return { startFret: 1, rows: FRET_ROWS };
  const max = Math.max(...fretted);
  if (max <= FRET_ROWS) return { startFret: 1, rows: FRET_ROWS };
  const startFret = Math.min(...fretted);
  return { startFret, rows: Math.max(FRET_ROWS, max - startFret + 1) };
}

/**
 * Finds barres by looking at the shape itself rather than `chord.barre`,
 * whose generated `stringEnd` can run past muted strings: one finger holding
 * down two or more strings at the same fret is a barre.
 */
function getBarres(chord: ChordShape): { fret: number; from: number; to: number }[] {
  const groups = new Map<string, number[]>();
  chord.frets.forEach((fret, stringIdx) => {
    const finger = chord.fingers[stringIdx];
    if (fret <= 0 || finger === undefined || finger === 0 || finger === -1) return;
    const key = `${fret}:${finger}`;
    groups.set(key, [...(groups.get(key) ?? []), stringIdx]);
  });

  const barres: { fret: number; from: number; to: number }[] = [];
  for (const [key, strings] of groups) {
    if (strings.length < 2) continue;
    barres.push({
      fret: Number(key.split(':')[0]),
      from: Math.min(...strings),
      to: Math.max(...strings),
    });
  }
  return barres;
}

/**
 * A standard vertical chord box: strings left-to-right low E → high E, a
 * fixed 5-fret window, fret numbers down the left, and × / ○ above the nut.
 */
export function ChordDiagram({ chord, labelMode = 'fingers', tuning = STANDARD_TUNING, className }: ChordDiagramProps) {
  const { startFret, rows } = getWindow(chord.frets);
  const isOpenPosition = startFret === 1;
  const barres = getBarres(chord);

  const gridH = FRET_GAP * rows;
  const viewH = MARKER_H + gridH + NAME_H;
  const fretY = (fret: number) => GRID_Y + FRET_GAP * (fret - startFret + 0.5);

  const dotLabel = (stringIdx: number, fret: number): string => {
    if (labelMode === 'notes') return getNoteFromFret(tuning.notes[stringIdx], fret);
    const finger = chord.fingers[stringIdx];
    if (finger === undefined || finger === 0 || finger === -1) return '';
    return finger.toString();
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${viewH}`}
      className={cn('w-full h-auto select-none', className)}
      role="img"
      aria-label={`${chord.name} chord diagram`}
    >
      {/* Frets */}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={PAD_L}
          x2={PAD_L + GRID_W}
          y1={GRID_Y + FRET_GAP * i}
          y2={GRID_Y + FRET_GAP * i}
          className={i === 0 && isOpenPosition ? 'stroke-brand-ink' : 'stroke-brand-secondary/60'}
          strokeWidth={i === 0 && isOpenPosition ? 4.5 : 1.2}
          strokeLinecap="square"
        />
      ))}

      {/* Strings */}
      {Array.from({ length: 6 }).map((_, stringIdx) => (
        <line
          key={`string-${stringIdx}`}
          x1={stringX(stringIdx)}
          x2={stringX(stringIdx)}
          y1={GRID_Y}
          y2={GRID_Y + gridH}
          className="stroke-brand-secondary/60"
          strokeWidth={1.2}
        />
      ))}

      {/* Fret numbers */}
      {Array.from({ length: rows }).map((_, i) => (
        <text
          key={`fretnum-${i}`}
          x={PAD_L - 7}
          y={GRID_Y + FRET_GAP * (i + 0.5)}
          textAnchor="end"
          dominantBaseline="central"
          className="fill-brand-secondary"
          fontSize={9}
        >
          {startFret + i}
        </text>
      ))}

      {/* Muted (×) and open (○) markers */}
      {chord.frets.map((fret, stringIdx) => {
        if (fret > 0) return null;
        const x = stringX(stringIdx);
        const y = MARKER_H / 2 - 1;
        if (fret === -1) {
          return (
            <text
              key={`mute-${stringIdx}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-brand-secondary"
              fontSize={11}
            >
              ×
            </text>
          );
        }
        return (
          <circle
            key={`open-${stringIdx}`}
            cx={x}
            cy={y}
            r={4}
            fill="none"
            className="stroke-brand-secondary"
            strokeWidth={1.4}
          />
        );
      })}

      {/* Barres, drawn under the dots */}
      {barres.map(({ fret, from, to }) => (
        <rect
          key={`barre-${fret}-${from}`}
          x={stringX(from) - DOT_R}
          y={fretY(fret) - DOT_R}
          width={stringX(to) - stringX(from) + DOT_R * 2}
          height={DOT_R * 2}
          rx={DOT_R}
          className="fill-brand-active"
        />
      ))}

      {/* Fretted notes */}
      {chord.frets.map((fret, stringIdx) => {
        if (fret <= 0) return null;
        const label = dotLabel(stringIdx, fret);
        return (
          <g key={`dot-${stringIdx}`}>
            <circle cx={stringX(stringIdx)} cy={fretY(fret)} r={DOT_R} className="fill-brand-active" />
            {label && (
              <text
                x={stringX(stringIdx)}
                y={fretY(fret)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={label.length > 1 ? 8.5 : 10}
                fontWeight={700}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* String names */}
      {tuning.notes.map((note, stringIdx) => (
        <text
          key={`name-${stringIdx}`}
          x={stringX(stringIdx)}
          y={GRID_Y + gridH + NAME_H / 2 + 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-brand-secondary"
          fontSize={9}
        >
          {note}
        </text>
      ))}
    </svg>
  );
}
