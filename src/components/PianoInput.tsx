import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { initAudio, playNote } from '../lib/audio';

interface PianoInputProps {
  onNoteSelect: (pitch: string) => void;
  allowedPitches?: string[];
  disabled?: boolean;
}

const OCTAVES = [3, 4] as const;
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
// Which white note has a black key to its right?
const BLACK_AFTER: Record<string, string> = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

const WKW = 36; // white key width (px)
const WKH = 112; // white key height (px)
const BKW = 22; // black key width (px)
const BKH = 70; // black key height (px)

export function PianoInput({ onNoteSelect, allowedPitches, disabled }: PianoInputProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function handleKey(pitch: string, oct: number) {
    if (disabled) return;
    initAudio().then(() => playNote(`${pitch}${oct}`)).catch(() => {});
    onNoteSelect(pitch);
    setFlash(pitch);
    setTimeout(() => setFlash(f => (f === pitch ? null : f)), 150);
  }

  const totalWhiteKeys = OCTAVES.length * WHITE_NOTES.length;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative select-none"
        style={{ width: totalWhiteKeys * WKW, height: WKH }}
      >
        {OCTAVES.flatMap((oct, octIdx) =>
          WHITE_NOTES.map((note, ni) => {
            const absIdx = octIdx * WHITE_NOTES.length + ni;
            const blackNote = BLACK_AFTER[note];
            const isWhiteAllowed = !allowedPitches || allowedPitches.includes(note);
            const isBlackAllowed = !blackNote || !allowedPitches || allowedPitches.includes(blackNote);
            // Black key left: center at 2/3 of white key, then offset by half black key width
            const blackLeft = absIdx * WKW + Math.round(WKW * 0.67) - Math.round(BKW / 2);

            return (
              <React.Fragment key={`${note}${oct}`}>
                {/* White key */}
                <div
                  onClick={() => handleKey(note, oct)}
                  className={cn(
                    'absolute border border-gray-300 dark:border-gray-600 rounded-b-sm cursor-pointer',
                    'flex items-end justify-center pb-1',
                    flash === note
                      ? 'bg-brand-primary/30'
                      : isDark
                        ? 'bg-[#e5e7eb] hover:bg-[#d1d5db]'
                        : 'bg-white hover:bg-gray-100',
                    !isWhiteAllowed && 'opacity-40',
                  )}
                  style={{ left: absIdx * WKW, top: 0, width: WKW - 1, height: WKH, zIndex: 1 }}
                >
                  <span className={cn('text-[8px] pointer-events-none', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {note}{oct}
                  </span>
                </div>

                {/* Black key (if this white note has one to its right) */}
                {blackNote && (
                  <div
                    onClick={e => { e.stopPropagation(); handleKey(blackNote, oct); }}
                    className={cn(
                      'absolute rounded-b-sm cursor-pointer',
                      flash === blackNote
                        ? 'bg-brand-primary/70'
                        : isDark
                          ? 'bg-[#374151] hover:bg-[#4b5563]'
                          : 'bg-gray-900 hover:bg-gray-700',
                      !isBlackAllowed && 'opacity-40',
                    )}
                    style={{ left: blackLeft, top: 0, width: BKW, height: BKH, zIndex: 2 }}
                  />
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
