import React, { useState, useEffect, useMemo } from 'react';
import { Fretboard } from '../components/Fretboard';
import { Finger, Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { playStrum, playNote, initAudio, getFretNote, playArpeggio } from '../lib/audio';
import { Volume2 } from 'lucide-react';

const CAGED_BASE_SHAPES = [
  { id: 'C', baseRoot: 'C', name: 'C Shape', relFrets: [-1, 3, 2, 0, 1, 0], description: 'Originates from the open C major chord. The root note is on the A (5th) string. When moved up the neck, your index finger acts as the nut (barre).' },
  { id: 'A', baseRoot: 'A', name: 'A Shape', relFrets: [-1, 0, 2, 2, 2, 0], description: 'Originates from the open A major chord. Root is on the A (5th) string. This is one of the most common barre chord shapes.' },
  { id: 'G', baseRoot: 'G', name: 'G Shape', relFrets: [3, 2, 0, 0, 0, 3], description: 'Originates from the open G major chord. Root is on the low E (6th) string. This shape spans a wide fret range and is often played partially.' },
  { id: 'E', baseRoot: 'E', name: 'E Shape', relFrets: [0, 2, 2, 1, 0, 0], description: 'Originates from the open E major chord. Root is on the low E (6th) string. This is the most widely used major barre chord shape.' },
  { id: 'D', baseRoot: 'D', name: 'D Shape', relFrets: [-1, -1, 0, 2, 3, 2], description: 'Originates from the open D major chord. Root is on the D (4th) string. Useful for higher-register voicings and triads.' }
];

const COMMON_KEYS: Note[] = ['E', 'A', 'D', 'G', 'C', 'F', 'B', 'G#'];

const PRACTICE_SCENARIOS: { label: string; mode: 'byKey' | 'byShape'; key?: Note; shapeId?: string; shift?: number }[] = [
  { label: 'Open Chords in E',         mode: 'byKey',   key: 'E' },
  { label: 'Open Chords in G',         mode: 'byKey',   key: 'G' },
  { label: 'Open Chords in C',         mode: 'byKey',   key: 'C' },
  { label: 'Open Chords in D',         mode: 'byKey',   key: 'D' },
  { label: 'Barre Chords – E shape',   mode: 'byShape', shapeId: 'E', shift: 2 },
  { label: 'Barre Chords – A shape',   mode: 'byShape', shapeId: 'A', shift: 2 },
  { label: 'Upper Neck – G shape',     mode: 'byShape', shapeId: 'G', shift: 7 },
  { label: 'Upper Neck – C shape',     mode: 'byShape', shapeId: 'C', shift: 5 },
];

const SEQ_DUR_MULT: Record<string, number> = { '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4 };
const DURATION_LABELS: Record<string, string> = { '16n': '16', '8n': '8', '4n': '4', '2n': '2', '1n': '1' };
const DURATION_CYCLE = ['16n', '8n', '4n', '2n', '1n'];

function getDistance(from: Note, to: Note) {
  const fromIdx = ALL_NOTES.indexOf(from);
  const toIdx = ALL_NOTES.indexOf(to);
  if (toIdx >= fromIdx) return toIdx - fromIdx;
  return toIdx + 12 - fromIdx;
}

export function Caged() {
  const [viewMode, setViewMode] = useState<'byKey' | 'byShape'>('byKey');
  const [selectedKey, setSelectedKey] = useState<Note>('C');
  const [selectedShapeId, setSelectedShapeId] = useState<string>('C');
  const [shapeShift, setShapeShift] = useState<number>(0);

  // Arpeggio sequencer (byShape mode)
  const [seqSteps, setSeqSteps] = useState<boolean[][]>(Array.from({ length: 6 }, () => Array(16).fill(false)));
  const [seqDurs, setSeqDurs] = useState<string[]>(Array(16).fill('8n'));
  const [seqNum, setSeqNum] = useState(8);
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [seqTempo, setSeqTempo] = useState(120);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIdxRef = React.useRef(0);

  const activeShapeDef = CAGED_BASE_SHAPES.find(s => s.id === selectedShapeId)!;
  const fretsForShape = useMemo(
    () => activeShapeDef.relFrets.map(f => f === -1 ? -1 : f + shapeShift),
    [activeShapeDef, shapeShift]
  );

  // Refs so the scheduler always reads the latest values without causing effect re-runs
  const seqStepsRef = React.useRef(seqSteps);
  const seqDursRef = React.useRef(seqDurs);
  const seqNumRef = React.useRef(seqNum);
  const seqTempoRef = React.useRef(seqTempo);
  const fretsForShapeRef = React.useRef(fretsForShape);
  useEffect(() => { seqStepsRef.current = seqSteps; }, [seqSteps]);
  useEffect(() => { seqDursRef.current = seqDurs; }, [seqDurs]);
  useEffect(() => { seqNumRef.current = seqNum; }, [seqNum]);
  useEffect(() => { seqTempoRef.current = seqTempo; }, [seqTempo]);
  useEffect(() => { fretsForShapeRef.current = fretsForShape; }, [fretsForShape]);

  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!seqPlaying) { setCurrentStep(-1); stepIdxRef.current = 0; return; }
    stepIdxRef.current = 0;
    const scheduleNext = () => {
      const step = stepIdxRef.current;
      const steps = seqStepsRef.current;
      const durs = seqDursRef.current;
      const num = seqNumRef.current;
      const tempo = seqTempoRef.current;
      const frets = fretsForShapeRef.current;
      setCurrentStep(step);
      const dur = durs[step] ?? '8n';
      const stepSecs = (60 / tempo) * (SEQ_DUR_MULT[dur] ?? 0.5);
      steps.forEach((row, sIdx) => {
        if (row[step] && frets[sIdx] !== -1) {
          playNote(getFretNote(sIdx, frets[sIdx]), stepSecs * 0.9);
        }
      });
      stepIdxRef.current = (step + 1) % num;
      timerRef.current = setTimeout(scheduleNext, stepSecs * 1000);
    };
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [seqPlaying]);

  const applyPreset = (name: string) => {
    const grid = Array.from({ length: 6 }, () => Array(16).fill(false)) as boolean[][];
    let durs = Array(16).fill('8n') as string[];
    let num = 8;
    const mark = (stringOrder: number[], stepDur: string) => {
      stringOrder.forEach((s, step) => { grid[s][step] = true; });
      durs = Array(16).fill(stepDur);
      num = stringOrder.length;
    };
    if (name === 'Ascending')         mark([0,1,2,3,4,5,4,3], '8n');
    else if (name === 'Descending')   mark([5,4,3,2,1,0,1,2], '8n');
    else if (name === 'Travis Pick')  mark([0,3,1,4,0,3,1,4], '8n');
    else if (name === 'Banjo Roll')   mark([3,4,5,3,4,5,3,4], '16n');
    else if (name === 'P-i-m-a')      mark([0,2,3,5,0,2,3,5], '8n');
    else if (name === 'Full Strum') {
      num = 4; durs = Array(16).fill('4n');
      for (let step = 0; step < 4; step++) for (let s = 0; s < 6; s++) grid[s][step] = true;
    } else if (name === 'Bass + Chord') {
      num = 4; durs = Array(16).fill('4n');
      grid[0][0] = true;
      [2,3,4,5].forEach(s => { grid[s][1] = true; grid[s][3] = true; });
      grid[0][2] = true;
    }
    setSeqSteps(grid);
    setSeqDurs(durs);
    setSeqNum(num);
  };

  const getCagedChord = (shape: typeof CAGED_BASE_SHAPES[0], targetNote: Note) => {
    const shift = getDistance(shape.baseRoot as Note, targetNote);
    const finalFrets = shape.relFrets.map(f => f === -1 ? -1 : f + shift);
    return {
      name: `${targetNote} Major (${shape.name})`,
      frets: finalFrets,
      fingers: [-1,-1,-1,-1,-1,-1] as Finger[],
      fretsOnly: finalFrets
    };
  };

  const handlePlay = async (frets: number[]) => {
    await initAudio();
    const notesToPlay = frets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
    playStrum(notesToPlay, 2, 'down');
  };

  const handleArpeggiate = async (frets: number[]) => {
    await initAudio();
    const notes = frets.map((fret, sIdx) => fret === -1 ? null : getFretNote(sIdx, fret)).filter((n): n is string => n !== null);
    playArpeggio([...notes, ...notes.slice(0,-1).reverse()], seqTempo, '8n');
  };

  const loadScenario = (label: string) => {
    const s = PRACTICE_SCENARIOS.find(p => p.label === label);
    if (!s) return;
    setViewMode(s.mode);
    if (s.key) setSelectedKey(s.key);
    if (s.shapeId) setSelectedShapeId(s.shapeId);
    if (s.shift !== undefined) setShapeShift(s.shift);
    setSeqPlaying(false);
  };

  const resultingNote = ALL_NOTES[(ALL_NOTES.indexOf(activeShapeDef.baseRoot as Note) + shapeShift) % 12];
  const byShapeChordData = {
    name: `${resultingNote} Major (${activeShapeDef.name})`,
    frets: fretsForShape,
    fingers: [-1,-1,-1,-1,-1,-1] as Finger[],
    fretsOnly: fretsForShape
  };
  const displayFretsNum = Math.max(12, Math.max(...fretsForShape) + 2);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
           <h1 className="text-4xl font-serif font-bold text-brand-ink mb-2">The CAGED System</h1>
           <p className="text-brand-secondary text-lg max-w-2xl">
             The CAGED system maps the guitar fretboard using five basic open chord shapes: C, A, G, E, and D.
             By connecting these shapes, you can play any major chord anywhere on the neck.
           </p>
        </div>
        {/* Practice scenarios */}
        <select
          onChange={(e) => { if (e.target.value) { loadScenario(e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
          className="text-sm px-3 py-2 rounded-lg border border-brand-line bg-brand-surface text-brand-ink outline-none focus:border-brand-primary shrink-0"
        >
          <option value="">Practice scenario…</option>
          {PRACTICE_SCENARIOS.map(s => <option key={s.label}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex bg-brand-surface rounded-lg p-1 border border-brand-line w-max mb-8 shadow-sm">
        <button
          onClick={() => setViewMode('byKey')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-bold text-sm transition-all duration-200 ${viewMode === 'byKey' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar'}`}
        >
          Find Shapes for Key
        </button>
        <button
          onClick={() => setViewMode('byShape')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-bold text-sm transition-all duration-200 ${viewMode === 'byShape' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar'}`}
        >
          Move Shape on Neck
        </button>
      </div>

      {viewMode === 'byKey' ? (
        <>
          <div className="bg-brand-sidebar p-6 rounded-xl border border-brand-line space-y-4">
             {/* Common key shortcuts */}
             <div>
               <p className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-2">Common Keys</p>
               <div className="flex flex-wrap gap-2">
                 {COMMON_KEYS.map(note => (
                   <button
                     key={note}
                     onClick={() => setSelectedKey(note)}
                     className={`px-3 py-1.5 rounded-md font-bold text-sm transition-all border ${
                       selectedKey === note
                         ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                         : 'bg-brand-surface text-brand-ink hover:border-brand-primary border-brand-line'
                     }`}
                   >
                     {note}
                   </button>
                 ))}
               </div>
             </div>
             {/* Full key picker */}
             <div>
               <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-2">All Keys</h3>
               <div className="flex flex-wrap gap-2">
                  {ALL_NOTES.map(note => (
                    <button
                      key={note}
                      onClick={() => setSelectedKey(note)}
                      className={`w-10 h-10 rounded-full font-bold transition-all ${
                        selectedKey === note
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'bg-brand-surface text-brand-ink hover:bg-brand-hover border border-brand-line'
                      }`}
                    >
                      {note}
                    </button>
                  ))}
               </div>
             </div>
          </div>

          <div className="space-y-12">
            {CAGED_BASE_SHAPES.map(shape => {
               return { shape, chordData: getCagedChord(shape, selectedKey), shift: getDistance(shape.baseRoot as Note, selectedKey) };
            }).sort((a, b) => a.shift - b.shift).map(({shape, chordData}) => {
               const maxFret = Math.max(...chordData.fretsOnly);
               const displayFretsNumLocal = Math.max(5, maxFret + 1);

               return (
                  <div key={shape.id} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-brand-surface border border-brand-line rounded-xl p-8 shadow-sm">
                     <div className="md:col-span-1 space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-brand-primary text-white font-serif text-2xl font-bold">
                              {shape.id}
                           </div>
                           <h2 className="text-2xl font-bold text-brand-ink">{shape.name}</h2>
                        </div>
                        <p className="text-brand-secondary leading-relaxed">
                           {shape.description}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                             onClick={() => handlePlay(chordData.fretsOnly)}
                             className="flex items-center gap-2 px-4 py-2 bg-brand-bg border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm"
                          >
                             <Volume2 size={16} /> Play
                          </button>
                          <button
                             onClick={() => handleArpeggiate(chordData.fretsOnly)}
                             className="flex items-center gap-2 px-4 py-2 bg-brand-bg border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm"
                          >
                             Arpeggiate
                          </button>
                        </div>
                     </div>
                     <div className="md:col-span-2 overflow-x-auto">
                        <div className="min-w-[400px]">
                           <Fretboard
                              fretsNum={Math.min(18, displayFretsNumLocal + 2)}
                              chord={chordData}
                              onFretClick={() => {}}
                           />
                        </div>
                     </div>
                  </div>
               );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-brand-sidebar p-6 md:p-8 rounded-xl border border-brand-line flex flex-col md:flex-row items-start md:items-center gap-8">
             <div>
                <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-3">Select Shape</h3>
                <div className="flex gap-2">
                   {CAGED_BASE_SHAPES.map(shape => (
                     <button
                       key={shape.id}
                       onClick={() => { setSelectedShapeId(shape.id); setShapeShift(0); setSeqPlaying(false); }}
                       className={`w-14 h-14 rounded-xl font-bold font-serif text-2xl transition-all ${
                         selectedShapeId === shape.id
                           ? 'bg-brand-primary text-white shadow-[0_4px_12px_rgba(var(--brand-primary-rgb),0.3)]'
                           : 'bg-brand-surface text-brand-ink hover:bg-brand-hover border border-brand-line'
                       }`}
                     >
                       {shape.id}
                     </button>
                   ))}
                </div>
             </div>

             <div className="flex-1 w-full relative">
                <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-4 flex justify-between">
                   <span>Move up/down the neck</span>
                   <span className="text-brand-primary text-base">+{shapeShift} Fret{shapeShift !== 1 ? 's' : ''}</span>
                </h3>
                <input
                  type="range"
                  min="0" max="12"
                  value={shapeShift}
                  onChange={(e) => { setShapeShift(Number(e.target.value)); setSeqPlaying(false); }}
                  className="w-full accent-brand-primary cursor-pointer hover:accent-brand-primary/80 transition-all h-2 bg-brand-line rounded-lg appearance-none"
                />
                <div className="flex justify-between text-xs text-brand-secondary mt-3 font-mono font-bold tracking-widest">
                   <span>0 (OPEN)</span>
                   <span>12 (OCTAVE)</span>
                </div>
             </div>
          </div>

          <div className="bg-brand-surface border border-brand-line rounded-xl p-6 md:p-10 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-brand-line pb-8">
                <div>
                   <h2 className="text-4xl font-bold text-brand-ink mb-2">{resultingNote} Major</h2>
                   <p className="text-brand-secondary text-lg">
                     <strong className="text-brand-ink">{activeShapeDef.name}</strong> shifted by {shapeShift} fret{shapeShift !== 1 ? 's' : ''}
                   </p>
                </div>
                <button
                   onClick={() => handlePlay(fretsForShape)}
                   className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors font-bold shadow-[0_4px_12px_rgba(var(--brand-primary-rgb),0.2)]"
                >
                   <Volume2 size={20} /> Play Shape
                </button>
             </div>
             <div className="overflow-x-auto">
                <div className="min-w-[600px] py-4">
                   <Fretboard
                      fretsNum={Math.min(18, displayFretsNum)}
                      chord={byShapeChordData}
                      onFretClick={() => {}}
                   />
                </div>
             </div>
          </div>

          {/* Arpeggio sequencer */}
          <div className="w-full p-6 border border-brand-line rounded-xl bg-brand-bg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-brand-ink">Arp Sequencer</h3>
                <p className="text-xs text-brand-secondary">Pick a preset or build your own pattern. Muted strings are disabled.</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <select
                    onChange={(e) => { if (e.target.value) { applyPreset(e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
                    className="text-[10px] border border-brand-line rounded px-1 py-0.5 bg-brand-surface text-brand-secondary outline-none"
                  >
                    <option value="">Preset…</option>
                    <option>Ascending</option>
                    <option>Descending</option>
                    <option>Travis Pick</option>
                    <option>Banjo Roll</option>
                    <option>P-i-m-a</option>
                    <option>Full Strum</option>
                    <option>Bass + Chord</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSeqNum(n => Math.max(1, n - 1))} className="w-5 h-5 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-xs">−</button>
                    <span className="text-[10px] font-mono text-brand-secondary w-14 text-center">{seqNum} steps</span>
                    <button onClick={() => setSeqNum(n => Math.min(16, n + 1))} className="w-5 h-5 rounded border border-brand-line text-brand-secondary hover:text-brand-ink flex items-center justify-center text-xs">+</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-brand-secondary font-bold uppercase">BPM</label>
                    <input type="range" min="40" max="200" value={seqTempo} onChange={(e) => setSeqTempo(Number(e.target.value))} className="w-20 accent-brand-primary" />
                    <span className="text-[10px] font-mono font-bold text-brand-ink w-8">{seqTempo}</span>
                  </div>
                  <button
                    className="text-[10px] uppercase font-bold text-red-500"
                    onClick={() => { setSeqSteps(Array.from({ length: 6 }, () => Array(16).fill(false))); setSeqDurs(Array(16).fill('8n')); }}
                  >Clear</button>
                </div>
              </div>
              <button
                onClick={async () => { await initAudio(); setSeqPlaying(p => !p); }}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${seqPlaying ? 'bg-brand-active/10 text-brand-active border border-brand-active/30' : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
              >
                {seqPlaying ? 'Stop' : 'Play Pattern'}
              </button>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex flex-col gap-1 min-w-[400px]">
                {[...seqSteps].reverse().map((row, reversedIdx) => {
                  const sIdx = 5 - reversedIdx;
                  const muted = fretsForShape[sIdx] === -1;
                  const STRING_LABELS = ['low_e', 'A', 'D', 'G', 'B', 'high_e'];
                  return (
                    <div key={`str-${sIdx}`} className="flex items-center gap-1">
                      <div className={`w-10 text-[10px] font-mono font-bold text-right pr-2 uppercase ${muted ? 'text-brand-line' : 'text-brand-secondary'}`}>
                        {STRING_LABELS[sIdx]}
                      </div>
                      {row.slice(0, seqNum).map((active, stepIdx) => (
                        <button
                          key={stepIdx}
                          disabled={muted}
                          onClick={() => {
                            if (muted) return;
                            const next = seqSteps.map((r, i) => i === sIdx ? r.map((v, j) => j === stepIdx ? !v : v) : r);
                            setSeqSteps(next);
                          }}
                          className={`flex-1 h-8 rounded-sm border transition-colors ${muted ? 'border-brand-line/30 bg-brand-line/10 cursor-not-allowed' : currentStep === stepIdx ? 'border-brand-primary cursor-default' : 'border-brand-line cursor-pointer'} ${
                            !muted && active ? 'bg-brand-primary shadow-[inset_0_0_8px_rgba(0,0,0,0.2)]' : !muted ? 'bg-brand-surface hover:bg-brand-line/50' : ''
                          }`}
                        />
                      ))}
                    </div>
                  );
                })}
                {/* Duration row */}
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-10 text-[10px] font-mono text-brand-secondary font-bold text-right pr-2">dur</div>
                  {Array.from({ length: seqNum }, (_, stepIdx) => {
                    const dur = seqDurs[stepIdx] ?? '8n';
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => {
                          const next = DURATION_CYCLE[(DURATION_CYCLE.indexOf(dur) + 1) % DURATION_CYCLE.length];
                          const d = [...seqDurs]; d[stepIdx] = next; setSeqDurs(d);
                        }}
                        title={dur}
                        className={`flex-1 h-6 rounded-sm border text-[10px] transition-colors ${currentStep === stepIdx ? 'border-brand-primary text-brand-primary' : 'border-brand-line text-brand-secondary'} bg-brand-surface hover:border-brand-primary`}
                      >
                        {DURATION_LABELS[dur]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
