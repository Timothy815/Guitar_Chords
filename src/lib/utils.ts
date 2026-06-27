import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChordShape } from '../types';

// MIDI pitch of each open string: E2 A2 D3 G3 B3 E4
const OPEN_STRING_PITCHES = [40, 45, 50, 55, 59, 64];

export function avgChordPitch(chord: ChordShape): number {
  const pitches = chord.frets
    .map((f, s) => f !== -1 ? OPEN_STRING_PITCHES[s] + f : null)
    .filter((p): p is number => p !== null);
  return pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
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
