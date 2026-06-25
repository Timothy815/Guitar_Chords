import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot } from 'vexflow';
import { RhythmRound, RhythmUnit, TimeSignature, durationBeats, beatsPerMeasure, vexDuration } from '../lib/rhythmTraining';

interface RhythmStaffProps {
  round: RhythmRound;
  placedUnits: RhythmUnit[];
  feedback: ('correct' | 'wrong' | null)[] | null;
  onSwap: (i: number, j: number) => void;
}

const STAFF_H = 110;
const CLEF_EXTRA = 70; // extra px for clef + time signature on first stave
const MIN_MEASURE_W = 180; // minimum px per measure before horizontal scroll kicks in

function makeStaveNote(unit: RhythmUnit): StaveNote {
  const isDotted = unit.duration === 'hd' || unit.duration === 'qd';
  const dur = vexDuration(unit);
  const note = new StaveNote({ keys: ['b/4'], duration: dur });
  if (isDotted) note.addModifier(new Dot(), 0);
  return note;
}

function voiceParams(ts: TimeSignature): { numBeats: number; beatValue: number } {
  if (ts === '4/4') return { numBeats: 4, beatValue: 4 };
  if (ts === '2/4') return { numBeats: 2, beatValue: 4 };
  if (ts === '3/4') return { numBeats: 3, beatValue: 4 };
  return { numBeats: 6, beatValue: 8 }; // 6/8
}

function fillPlaceholders(remaining: number): RhythmUnit[] {
  const durs = ['w', 'hd', 'h', 'qd', 'q', '8', '16'] as const;
  const result: RhythmUnit[] = [];
  let rem = remaining;
  while (rem > 0.001) {
    const d = durs.find(x => durationBeats(x) <= rem + 0.001);
    if (!d) break;
    result.push({ duration: d, isRest: true });
    rem -= durationBeats(d);
  }
  return result;
}

export function RhythmStaff({ round, placedUnits, feedback, onSwap }: RhythmStaffProps) {
  const vexRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [noteXs, setNoteXs] = useState<number[]>([]);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const clear = () => setDragSrc(null);
    window.addEventListener('mouseup', clear);
    return () => window.removeEventListener('mouseup', clear);
  }, []);

  useEffect(() => {
    const div = vexRef.current;
    if (!div) return;
    div.innerHTML = '';

    const inkColor = isDark ? '#e5e7eb' : '#000000';
    const placeholderColor = isDark ? '#4b5563' : '#cccccc';

    const W = Math.max((wrapRef.current?.clientWidth ?? 700) - 8, 400);
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, STAFF_H);
    const ctx = renderer.getContext();
    ctx.setFillStyle(inkColor);
    ctx.setStrokeStyle(inkColor);

    const bpb = beatsPerMeasure(round.timeSignature);
    const perMeasureW = (W - CLEF_EXTRA) / round.measures;

    const tsStr = round.timeSignature; // '4/4', '3/4', etc.

    // Split placedUnits into per-measure buckets
    const measureBuckets: RhythmUnit[][] = Array.from({ length: round.measures }, () => []);
    let cursor = 0;
    let mIdx = 0;
    for (const unit of placedUnits) {
      measureBuckets[mIdx].push(unit);
      cursor += durationBeats(unit.duration);
      if (cursor >= bpb * (mIdx + 1) - 0.001) mIdx = Math.min(mIdx + 1, round.measures - 1);
    }

    const placedNoteRefs: StaveNote[] = []; // only placed (non-placeholder) notes for x-tracking

    for (let m = 0; m < round.measures; m++) {
      const staveX = m === 0 ? 0 : CLEF_EXTRA + m * perMeasureW;
      const staveW = m === 0 ? CLEF_EXTRA + perMeasureW : perMeasureW;
      const stave = new Stave(staveX, 10, staveW);
      if (m === 0) stave.addClef('treble').addTimeSignature(tsStr);
      stave.setContext(ctx).draw();

      // Build notes for this measure
      const placed = measureBuckets[m];
      const placedBeats = placed.reduce((s, u) => s + durationBeats(u.duration), 0);
      const remaining = bpb - placedBeats;
      const placeholders = fillPlaceholders(remaining);

      const allNotes: StaveNote[] = [];
      const beamCandidates: StaveNote[] = [];

      for (let i = 0; i < placed.length; i++) {
        const unit = placed[i];
        const note = makeStaveNote(unit);

        // Determine global index for feedback
        const globalIdx = measureBuckets.slice(0, m).reduce((s, b) => s + b.length, 0) + i;
        let fill = inkColor;
        if (feedback) {
          const fb = feedback[globalIdx];
          fill = fb === 'correct' ? '#27ae60' : fb === 'wrong' ? '#c0392b' : inkColor;
        }
        note.setStyle({ fillStyle: fill, strokeStyle: fill });
        allNotes.push(note);
        placedNoteRefs.push(note);
        if (!unit.isRest && ['8', '16'].includes(unit.duration)) {
          beamCandidates.push(note);
        }
      }

      for (const ph of placeholders) {
        const note = makeStaveNote(ph);
        note.setStyle({ fillStyle: placeholderColor, strokeStyle: placeholderColor });
        allNotes.push(note);
      }

      const { numBeats, beatValue } = voiceParams(round.timeSignature);
      const voice = new Voice({ numBeats, beatValue }).setStrict(false);
      voice.addTickables(allNotes);
      const usableW = staveW - 20;
      new Formatter().joinVoices([voice]).format([voice], usableW);
      voice.draw(ctx, stave);

      const beams = Beam.generateBeams(beamCandidates);
      beams.forEach(b => b.setContext(ctx).draw());
    }

    // Capture placed note x-positions for drag overlays
    const xs = placedNoteRefs.map(n => n.getAbsoluteX());
    setNoteXs(xs);
  }, [round, placedUnits, feedback, isDark]);

  return (
    <div className="overflow-x-auto">
      <div ref={wrapRef} className="relative" style={{ minWidth: CLEF_EXTRA + MIN_MEASURE_W * round.measures }}>
      <div ref={vexRef} style={{ height: STAFF_H }} />
      {!feedback && noteXs.map((x, i) => (
        <div
          key={i}
          className="absolute top-0 cursor-grab"
          style={{
            left: x - 12,
            width: 24,
            height: STAFF_H,
            zIndex: 10,
            background: dragSrc === i ? 'rgba(99,102,241,0.12)' : 'transparent',
          }}
          onMouseDown={e => { e.preventDefault(); setDragSrc(i); }}
          onMouseUp={() => {
            if (dragSrc !== null && dragSrc !== i) onSwap(dragSrc, i);
            setDragSrc(null);
          }}
        />
      ))}
      </div>
    </div>
  );
}
