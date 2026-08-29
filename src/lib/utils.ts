import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChordShape } from '../types';

// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4
const OPEN_STRING_PITCHES = [40, 45, 50, 55, 59, 64];

export function shiftFretsAcrossStrings(frets: number[], delta: 1 | -1): number[] {
  const fretted = frets
    .map((fret, str) => ({ str, fret }))
    .filter((n): n is { str: number; fret: number } => frets[n.str] !== -1);

  if (fretted.length === 0) return frets;

  const withMidi = fretted.map(n => ({ ...n, midi: OPEN_STRING_PITCHES[n.str] + n.fret }));

  // Notes whose new string index falls off the neck are dropped.
  const survivors = withMidi
    .map(n => ({ ...n, newStr: n.str + delta }))
    .filter(n => n.newStr >= 0 && n.newStr <= 5);

  const result = frets.map(() => -1);
  if (survivors.length === 0) return result;

  // The anchor is the lowest-pitched surviving note. It keeps its fret
  // number unchanged on its new string — that's what "sliding the shape
  // over" means when consecutive strings are a uniform interval apart
  // (e.g. E-A-D -> A-D-G with the same frets reproduces the same chord,
  // just a fourth higher in pitch, which is correct and expected).
  // Every other note is placed at the same semitone offset from the
  // anchor's NEW pitch that it had from the anchor's OLD pitch. This is
  // where the B-string correction falls out for free: wherever the
  // major-third seam sits differently relative to the anchor after the
  // move, the recomputed fret differs from the naive "same fret, new
  // string" value by exactly the right amount.
  const anchor = survivors.reduce((a, b) => (a.midi <= b.midi ? a : b));
  const anchorNewMidi = OPEN_STRING_PITCHES[anchor.newStr] + anchor.fret;

  const FRET_CAP = 15;
  for (const n of survivors) {
    const offset = n.midi - anchor.midi; // 0 for the anchor itself
    let targetMidi = anchorNewMidi + offset;
    let newFret = targetMidi - OPEN_STRING_PITCHES[n.newStr];
    // Nudge by whole octaves to land in the playable range. A 16-fret
    // window (0-15) always contains a representative of every pitch
    // class, so this always terminates with a valid fret in practice;
    // the "else" below is a defensive fallback only.
    while (newFret < 0) { newFret += 12; targetMidi += 12; }
    while (newFret > FRET_CAP) { newFret -= 12; targetMidi -= 12; }
    if (newFret >= 0 && newFret <= FRET_CAP) {
      result[n.newStr] = newFret;
    }
    // else: dropped — unplayable even after the octave search
  }

  return result;
}

export function avgChordPitch(chord: ChordShape): number {
  const pitches = chord.frets
    .map((f, s) => f !== -1 ? OPEN_STRING_PITCHES[s] + f : null)
    .filter((p): p is number => p !== null);
  return pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
}

export type PositionBucket = 'all' | 'open' | 'low' | 'high';

export const POSITION_LABELS: Record<PositionBucket, string> = {
  all:  'All',
  open: 'Open',
  low:  'Low (2–7)',
  high: 'High (8+)',
};

export function chordPositionBucket(chord: ChordShape): Exclude<PositionBucket, 'all'> {
  if (chord.frets.some(f => f === 0)) return 'open';
  const fretted = chord.frets.filter(f => f > 0);
  if (fretted.length === 0) return 'open';
  return Math.min(...fretted) <= 7 ? 'low' : 'high';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function printChordSheet(elementId: string) {
  const style = document.createElement('style');
  // Hide the React root; the chord-sheet portal (a body sibling) stays visible.
  style.textContent = [
    '@media print {',
    '  #root { display: none !important; }',
    `  #${elementId} {`,
    '    position: static !important;',
    '    left: auto !important;',
    '    width: 100% !important;',
    '    overflow: visible !important;',
    '  }',
    '}',
  ].join('\n');
  document.head.appendChild(style);
  window.addEventListener('afterprint', () => style.remove(), { once: true });
  window.print();
}

export function handlePrint(elementId?: string) {
  const contentNode = elementId ? document.getElementById(elementId) : null;
  const pWindow = window.open('', '_blank');
  if (pWindow) {
    pWindow.document.write('<html><head><title>Print</title>');
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        if (sheet.href) {
          pWindow.document.write(`<link rel="stylesheet" href="${sheet.href}">`);
        } else {
          pWindow.document.write(`<style>${Array.from(sheet.cssRules).map(r => r.cssText).join('\n')}</style>`);
        }
      } catch(e) {}
    });
    pWindow.document.write('</head><body class="bg-brand-bg text-brand-ink">');
    pWindow.document.write(contentNode ? contentNode.innerHTML : document.body.innerHTML);
    pWindow.document.write('</body></html>');
    pWindow.document.close();
    pWindow.focus();
    setTimeout(() => { pWindow.print(); }, 500);
  }
}
