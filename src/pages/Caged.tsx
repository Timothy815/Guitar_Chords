import React, { useState } from 'react';
import { Fretboard } from '../components/Fretboard';
import { Finger, Note } from '../types';
import { ALL_NOTES } from '../data/guitarData';
import { playStrum, initAudio, getFretNote } from '../lib/audio';
import { Volume2 } from 'lucide-react';

const CAGED_BASE_SHAPES = [
  { id: 'C', baseRoot: 'C', name: 'C Shape', relFrets: [-1, 3, 2, 0, 1, 0], description: 'Originates from the open C major chord. The root note is on the A (5th) string. When moved up the neck, your index finger acts as the nut (barre).' },
  { id: 'A', baseRoot: 'A', name: 'A Shape', relFrets: [-1, 0, 2, 2, 2, 0], description: 'Originates from the open A major chord. Root is on the A (5th) string. This is one of the most common barre chord shapes.' },
  { id: 'G', baseRoot: 'G', name: 'G Shape', relFrets: [3, 2, 0, 0, 0, 3], description: 'Originates from the open G major chord. Root is on the low E (6th) string. This shape spans a wide fret range and is often played partially.' },
  { id: 'E', baseRoot: 'E', name: 'E Shape', relFrets: [0, 2, 2, 1, 0, 0], description: 'Originates from the open E major chord. Root is on the low E (6th) string. This is the most widely used major barre chord shape.' },
  { id: 'D', baseRoot: 'D', name: 'D Shape', relFrets: [-1, -1, 0, 2, 3, 2], description: 'Originates from the open D major chord. Root is on the D (4th) string. Useful for higher-register voicings and triads.' }
];

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

  const getCagedChord = (shape: typeof CAGED_BASE_SHAPES[0], targetNote: Note) => {
    const shift = getDistance(shape.baseRoot as Note, targetNote);
    const finalFrets = shape.relFrets.map(f => f === -1 ? -1 : f + shift);
    
    // Determine the root string for this shape to mark it or just return shape.
    // D shape = string index 3 (D string)
    // C, A shape = string index 1 (A string)
    // G, E shape = string index 0 (Low E string)
    
    return {
      name: `${targetNote} Major (${shape.name})`,
      frets: finalFrets,
      fingers: [-1,-1,-1,-1,-1,-1] as Finger[], // Simplification, Fretboard doesn't strictly need accurate fingers if we map the shape
      fretsOnly: finalFrets
    };
  };

  const handlePlay = async (frets: number[]) => {
      await initAudio();
      const notesToPlay = frets.map((fret, stringIdx) => getFretNote(stringIdx, fret)).filter(n => n !== "");
      playStrum(notesToPlay, 2, 'down');
  };

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
          <div className="bg-brand-sidebar p-6 rounded-xl border border-brand-line flex items-center gap-4">
             <div>
                <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-2">Select Key</h3>
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
               // Display at least 5 frets, centered around the chord
               const displayFretsNum = Math.max(5, maxFret + 1);

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
                        <button 
                           onClick={() => handlePlay(chordData.fretsOnly)}
                           className="flex items-center gap-2 px-4 py-2 bg-brand-bg border border-brand-line text-brand-ink rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors font-semibold text-sm"
                        >
                           <Volume2 size={16} /> Play Shape
                        </button>
                     </div>
                     <div className="md:col-span-2 overflow-x-auto">
                        <div className="min-w-[400px]">
                           <Fretboard 
                              fretsNum={Math.min(18, displayFretsNum + 2)} 
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
        (() => {
           const activeShapeDef = CAGED_BASE_SHAPES.find(s => s.id === selectedShapeId)!;
           const resultingNote = ALL_NOTES[(ALL_NOTES.indexOf(activeShapeDef.baseRoot as Note) + shapeShift) % 12];
           const fretsWithOffset = activeShapeDef.relFrets.map(f => f === -1 ? -1 : f + shapeShift);
           const chordData = {
              name: `${resultingNote} Major (${activeShapeDef.name})`,
              frets: fretsWithOffset,
              fingers: [-1,-1,-1,-1,-1,-1] as Finger[],
              fretsOnly: fretsWithOffset
           };
           const displayFretsNum = Math.max(12, Math.max(...fretsWithOffset) + 2);

           return (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="bg-brand-sidebar p-6 md:p-8 rounded-xl border border-brand-line flex flex-col md:flex-row items-start md:items-center gap-8">
                   <div>
                      <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-3">Select Shape</h3>
                      <div className="flex gap-2">
                         {CAGED_BASE_SHAPES.map(shape => (
                           <button
                             key={shape.id}
                             onClick={() => { setSelectedShapeId(shape.id); setShapeShift(0); }}
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
                        onChange={(e) => setShapeShift(Number(e.target.value))}
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
                         onClick={() => handlePlay(chordData.fretsOnly)}
                         className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors font-bold shadow-[0_4px_12px_rgba(var(--brand-primary-rgb),0.2)]"
                      >
                         <Volume2 size={20} /> Play Shape
                      </button>
                   </div>
                   <div className="overflow-x-auto">
                      <div className="min-w-[600px] py-4">
                         <Fretboard 
                            fretsNum={Math.min(18, displayFretsNum)} 
                            chord={chordData} 
                            onFretClick={() => {}}
                         />
                      </div>
                   </div>
                </div>
              </div>
           );
        })()
      )}
    </div>
  );
}
