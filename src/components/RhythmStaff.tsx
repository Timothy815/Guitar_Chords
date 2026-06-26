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
export const CLEF_EXTRA = 70;
export const MIN_MEASURE_W = 200;
const PX_PER_NOTE = 58; // minimum pixels per note/rest for VexFlow
const RIGHT_PAD = 32;   // Reserved after last stave for closing barline + note overflow

// Compute the minimum staff pixel width needed to render all notes without crowding.
// Uses note density per measure so complex rounds trigger horizontal scroll.
export function staffMinWidth(round: RhythmRound, placedUnits: RhythmUnit[]): number {
  const bpb = beatsPerMeasure(round.timeSignature);
  const unitsPerMeasure = (units: RhythmUnit[]) => {
    const counts = new Array<number>(round.measures).fill(0);
    let cur = 0;
    for (const u of units) {
      const m = Math.min(Math.floor(cur / bpb + 0.001), round.measures - 1);
      counts[m]++;
      cur += durationBeats(u.duration);
    }
    return counts;
  };
  const correct = unitsPerMeasure(round.units);
  const placed  = unitsPerMeasure(placedUnits);
  let w = CLEF_EXTRA;
  for (let m = 0; m < round.measures; m++) {
    w += Math.max(correct[m] ?? 0, placed[m] ?? 0, 4) * PX_PER_NOTE;
  }
  return w + RIGHT_PAD;
}

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

    // Use note-density minimum so the SVG is always wide enough and
    // forces the scroll container to scroll rather than crowding notes.
    const W = Math.max(
      (wrapRef.current?.clientWidth ?? 0) - 8,
      staffMinWidth(round, placedUnits),
    );
    // Explicitly size the wrapper so the overflow-x-auto ancestor sees real content width.
    if (wrapRef.current) wrapRef.current.style.minWidth = `${W}px`;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, STAFF_H);
    const ctx = renderer.getContext();

    const bpb = beatsPerMeasure(round.timeSignature);
    // Exclude RIGHT_PAD from the stave layout so the closing barline lands at
    // W - RIGHT_PAD and has room to render without being clipped by the SVG.
    const perMeasureW = (W - CLEF_EXTRA - RIGHT_PAD) / round.measures;

    const tsStr = round.timeSignature;

    const measureBuckets: RhythmUnit[][] = Array.from({ length: round.measures }, () => []);
    let cursor = 0;
    let mIdx = 0;
    for (const unit of placedUnits) {
      measureBuckets[mIdx].push(unit);
      cursor += durationBeats(unit.duration);
      if (cursor >= bpb * (mIdx + 1) - 0.001) mIdx = Math.min(mIdx + 1, round.measures - 1);
    }

    const placedNoteRefs: StaveNote[] = [];

    for (let m = 0; m < round.measures; m++) {
      const staveX = m === 0 ? 0 : CLEF_EXTRA + m * perMeasureW;
      const staveW = m === 0 ? CLEF_EXTRA + perMeasureW : perMeasureW;
      const stave = new Stave(staveX, 10, staveW);
      if (m === 0) stave.addClef('treble').addTimeSignature(tsStr);
      stave.setContext(ctx).draw();

      const placed = measureBuckets[m];
      const placedBeats = placed.reduce((s, u) => s + durationBeats(u.duration), 0);
      const remaining = bpb - placedBeats;
      const placeholders = fillPlaceholders(remaining);

      const allNotes: StaveNote[] = [];
      const beamCandidates: StaveNote[] = [];

      for (let i = 0; i < placed.length; i++) {
        const unit = placed[i];
        const note = makeStaveNote(unit);
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

    // Post-process SVG: change all non-feedback colors to inkColor in dark mode
    if (isDark) {
      const keepColors = new Set([placeholderColor, '#27ae60', '#c0392b', 'none', 'transparent', '#ffffff', 'white']);
      div.querySelectorAll('svg *').forEach(el => {
        const svgEl = el as SVGElement;
        const fill = svgEl.getAttribute('fill');
        const stroke = svgEl.getAttribute('stroke');
        if (fill !== null && !keepColors.has(fill.toLowerCase())) {
          svgEl.setAttribute('fill', inkColor);
        }
        if (stroke !== null && !keepColors.has(stroke.toLowerCase())) {
          svgEl.setAttribute('stroke', inkColor);
        }
      });
    }

    const xs = placedNoteRefs.map(n => n.getAbsoluteX());
    setNoteXs(xs);
  }, [round, placedUnits, feedback, isDark]);

  return (
    <div ref={wrapRef} className="relative">
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
  );
}
