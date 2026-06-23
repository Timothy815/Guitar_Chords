import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, TabStave, TabNote, Voice, Formatter, Accidental } from 'vexflow';
import { ChordShape } from '../types';
import { Fretboard } from './Fretboard';
import { getFretNote } from '../lib/audio';

interface ChordCardProps {
  chord: ChordShape;
  progressionKey: string;
}

// Maps our sharp-only root notes to VexFlow key signature strings
const SHARP_TO_VEX_KEY: Record<string, string> = {
  'C': 'C', 'C#': 'Db', 'D': 'D', 'D#': 'Eb', 'E': 'E',
  'F': 'F', 'F#': 'F#', 'G': 'G', 'G#': 'Ab', 'A': 'A',
  'A#': 'Bb', 'B': 'B',
};

// Converts 'C#4' → 'c#/5' (adds 1 octave for guitar treble clef transposition)
function toVexStaffKey(noteStr: string): string {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return 'c/4';
  return `${match[1].toLowerCase()}/${parseInt(match[2]) + 1}`;
}

export function ChordCard({ chord, progressionKey }: ChordCardProps) {
  const vexRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = vexRef.current;
    if (!div) return;
    div.innerHTML = '';

    // Collect sounding strings: fret >= 0, not muted (-1)
    const sounding = chord.frets
      .map((fret, stringIdx) => ({ fret, stringIdx }))
      .filter(({ fret }) => fret >= 0);

    if (sounding.length === 0) return;

    // Build note arrays
    const staffKeys = sounding.map(({ fret, stringIdx }) =>
      toVexStaffKey(getFretNote(stringIdx, fret))
    );
    // Sort ascending by octave then note for correct chord voicing display
    staffKeys.sort((a, b) => {
      const [na, oa] = a.split('/');
      const [nb, ob] = b.split('/');
      return parseInt(oa) !== parseInt(ob)
        ? parseInt(oa) - parseInt(ob)
        : na.localeCompare(nb);
    });

    // VexFlow tab: str 1=high e, 6=low E; convert from our 0=low E convention
    const tabPositions = sounding.map(({ fret, stringIdx }) => ({
      str: 6 - stringIdx,
      fret: fret,
    }));

    const W = 260;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, 160);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    // Standard notation stave
    const vexKey = SHARP_TO_VEX_KEY[progressionKey] ?? 'C';
    const stave = new Stave(5, 5, W - 15);
    stave.addClef('treble').addKeySignature(vexKey);
    stave.setContext(ctx).draw();

    const staveNote = new StaveNote({ keys: staffKeys, duration: 'w' });
    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables([staveNote]);
    Accidental.applyAccidentals([voice], vexKey);
    new Formatter().joinVoices([voice]).format([voice], W - 50);
    voice.draw(ctx, stave);

    // Tab stave
    const tabStave = new TabStave(5, 90, W - 15);
    tabStave.addClef('tab');
    tabStave.setContext(ctx).draw();

    const tabNote = new TabNote({ positions: tabPositions, duration: 'w' });
    const tabVoice = new Voice({ numBeats: 4, beatValue: 4 });
    tabVoice.setStrict(false);
    tabVoice.addTickables([tabNote]);
    new Formatter().joinVoices([tabVoice]).format([tabVoice], W - 50);
    tabVoice.draw(ctx, tabStave);
  }, [chord, progressionKey]);

  const maxFret = Math.max(...chord.frets.filter(f => f >= 0));
  const displayFrets = Math.max(5, maxFret <= 5 ? 5 : maxFret + 1);

  return (
    <div className="flex flex-col items-center border border-brand-line rounded-lg p-3 bg-white print:border-gray-300 break-inside-avoid">
      <h3 className="font-serif font-bold text-brand-ink text-base mb-2 text-center print:text-black">
        {chord.name.split('(')[0].trim()}
      </h3>
      <Fretboard
        fretsNum={displayFrets}
        chord={chord}
        showNoteNames={false}
        className="pointer-events-none w-full"
        compact
      />
      <div ref={vexRef} className="w-full overflow-hidden" style={{ height: 160 }} />
    </div>
  );
}
