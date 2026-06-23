import React, { useState, useEffect } from 'react';
import { Progression, ChordShape, Note } from '../types';
import { COMMON_CHORDS, ALL_NOTES } from '../data/guitarData';
import { Fretboard } from '../components/Fretboard';
import { CircleOfFifths } from '../components/CircleOfFifths';
import { Plus, Trash2, Save, Play, Printer, Disc, GripHorizontal } from 'lucide-react';
import { Reorder } from 'motion/react';
import { playStrum, initAudio } from '../lib/audio';
import { handlePrint } from '../lib/utils';

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

function getDiatonicRoots(key: Note): Set<string> {
  const rootIdx = ALL_NOTES.indexOf(key);
  if (rootIdx === -1) return new Set();
  return new Set(MAJOR_INTERVALS.map(i => ALL_NOTES[(rootIdx + i) % 12]));
}

export function Progressions() {
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [activeProgId, setActiveProgId] = useState<string | null>(null);
  const [chordPaletteKey, setChordPaletteKey] = useState<string>('C');
  const [showCircle, setShowCircle] = useState(false);
  const [circleKey, setCircleKey] = useState<Note | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('guitar_progressions');
    if (saved) {
      setProgressions(JSON.parse(saved));
    } else {
      // Default placeholder
      const defaultProg: Progression = {
        id: '1',
        name: 'Classic I-V-vi-IV (C Major)',
        chords: [
          COMMON_CHORDS['C'][0],
          COMMON_CHORDS['G'][0],
          COMMON_CHORDS['A'][1], // Am
          COMMON_CHORDS['F'][1], // F small
        ].filter(Boolean)
      };
      setProgressions([defaultProg]);
    }
  }, []);

  const saveProgressions = (newProgs: Progression[]) => {
    setProgressions(newProgs);
    localStorage.setItem('guitar_progressions', JSON.stringify(newProgs));
  };

  const createProgression = () => {
    const newProg: Progression = {
      id: Date.now().toString() + Math.random().toString(),
      name: 'New Progression',
      chords: []
    };
    saveProgressions([...progressions, newProg]);
    setActiveProgId(newProg.id);
  };

  const deleteProgression = (id: string) => {
    const updated = progressions.filter(p => p.id !== id);
    if (updated.length === 0) {
      // If deleted last one, load preset
      loadPreset('I-V-vi-IV (C Major)', []);
    } else {
      saveProgressions(updated);
      if (activeProgId === id) {
        setActiveProgId(updated[0].id);
      }
    }
  };

  const loadPreset = (presetName: string, baseProgressions = progressions) => {
    let presetChords: ChordShape[] = [];
    if (presetName === 'I-V-vi-IV (C Major)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['G'][0], COMMON_CHORDS['A'][1], COMMON_CHORDS['F'][1]];
    } else if (presetName === 'ii-V-I (Jazz, C Major)') {
      presetChords = [COMMON_CHORDS['D'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['C'][0]]; // Dm - G - C
    } else if (presetName === '12-Bar Blues (A)') {
      presetChords = [
        COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0],
        COMMON_CHORDS['D'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0],
        COMMON_CHORDS['E'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0]
      ];
    } else if (presetName === 'I-vi-IV-V (50s, G Major)') {
      presetChords = [COMMON_CHORDS['G'][0], COMMON_CHORDS['E'][1], COMMON_CHORDS['C'][0], COMMON_CHORDS['D'][0]]; // G - Em - C - D
    } else if (presetName === 'Andalusian Cadence (Am)') {
      presetChords = [COMMON_CHORDS['A'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['F'][1], COMMON_CHORDS['E'][0]]; // Am - G - F - E
    } else if (presetName === 'Doo-Wop (C)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['A'][1], COMMON_CHORDS['F'][1], COMMON_CHORDS['G'][0]]; // C - Am - F - G
    } else if (presetName === 'Minor Plagal (G)') {
      presetChords = [COMMON_CHORDS['G'][0], COMMON_CHORDS['B'][0], COMMON_CHORDS['C'][0], COMMON_CHORDS['C'][1]]; // G - B - C - Cm
    } else if (presetName === "Pachelbel's Canon (D)") {
      presetChords = [COMMON_CHORDS['D'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['B'][0], COMMON_CHORDS['F#'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['D'][0], COMMON_CHORDS['G'][0], COMMON_CHORDS['A'][0]];
    } else if (presetName === '12-Bar Blues (E)') {
      presetChords = [
        COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0],
        COMMON_CHORDS['A'][0], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['E'][0],
        COMMON_CHORDS['B'][1], COMMON_CHORDS['A'][0], COMMON_CHORDS['E'][0], COMMON_CHORDS['B'][1]
      ];
    } else if (presetName === 'La Bamba (I-IV-V, C)') {
      presetChords = [COMMON_CHORDS['C'][0], COMMON_CHORDS['F'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['G'][0]]; // C - F - G - G
    } else if (presetName === 'Jazz Turnaround (vi-ii-V-I, C)') {
      presetChords = [COMMON_CHORDS['A'][3], COMMON_CHORDS['D'][1], COMMON_CHORDS['G'][0], COMMON_CHORDS['C'][2]]; // Am7 - Dm - G - Cmaj7
    }

    const newProg: Progression = {
      id: Date.now().toString() + Math.random().toString(),
      name: presetName,
      chords: presetChords.filter(Boolean)
    };
    const updated = [...baseProgressions, newProg];
    saveProgressions(updated);
    setActiveProgId(newProg.id);
  };

  const activeProgression = progressions.find(p => p.id === activeProgId) || progressions[0];

  const addChordToProgression = (chord: ChordShape) => {
    if (!activeProgression) return;
    const updated = progressions.map(p => {
      if (p.id === activeProgression.id) {
         return { ...p, chords: [...p.chords, chord] };
      }
      return p;
    });
    saveProgressions(updated);
  };

  // Simple playback sequence
  const playSequence = async () => {
      if (!activeProgression) return;
      await initAudio();
      const delay = 1500; // ms between chords
      activeProgression.chords.forEach((chord, i) => {
          setTimeout(() => {
              const notes = chord.frets
                .map((f, sIdx) => {
                   if (f === -1) return "";
                   const base = ["E", "A", "D", "G", "B", "E"][sIdx];
                   const octaves = [2, 2, 3, 3, 3, 4];
                   const all = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                   const bIdx = all.indexOf(base);
                   const t = bIdx + f;
                   return `${all[t % 12]}${octaves[sIdx] + Math.floor(t / 12)}`;
                })
                .filter(Boolean);
              playStrum(notes);
          }, i * delay);
      });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="flex justify-between items-center bg-brand-surface p-6 rounded-xl border border-brand-line">
          <div>
            <h1 className="text-2xl font-sans font-bold text-brand-ink">Custom Progressions</h1>
            <p className="text-brand-secondary mt-1">Build and save chord sequences for practice.</p>
          </div>
          <button onClick={createProgression} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
            <Plus size={18} /> New Sequence
          </button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
             {progressions.map((p) => (
                <div 
                  key={p.id}
                  className={`w-full flex items-center justify-between p-4 rounded-md border transition-all ${
                     (activeProgId === p.id || (!activeProgId && p === progressions[0])) 
                     ? 'bg-brand-primary/10 border-brand-primary text-brand-primary ring-1 ring-brand-primary' 
                     : 'bg-brand-surface border-brand-line text-brand-ink hover:border-brand-primary/50'
                  }`}
                >
                  <button 
                    onClick={() => setActiveProgId(p.id)}
                    className="flex-1 text-left"
                  >
                     <div className="font-medium text-brand-ink">{p.name}</div>
                     <div className="text-xs text-brand-secondary mt-1">{p.chords.length} chords</div>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteProgression(p.id); }} className="text-brand-secondary hover:text-red-500 p-2">
                     <Trash2 size={16} />
                  </button>
                </div>
             ))}

             <div className="pt-6 border-t border-brand-line space-y-3">
                <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Load Presets</h3>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      loadPreset(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full p-2 text-sm bg-brand-surface border border-brand-line rounded-md text-brand-ink focus:outline-none focus:border-brand-primary"
                >
                   <option value="">-- Choose Preset --</option>
                   <option value="I-V-vi-IV (C Major)">Pop Punk (C)</option>
                   <option value="ii-V-I (Jazz, C Major)">Jazz ii-V-I (C)</option>
                   <option value="12-Bar Blues (A)">12-Bar Blues (A)</option>
                   <option value="I-vi-IV-V (50s, G Major)">50s Progression (G)</option>
                   <option value="Andalusian Cadence (Am)">Andalusian Cadence (Am)</option>
                   <option value="Doo-Wop (C)">Doo-Wop (C)</option>
                   <option value="Minor Plagal (G)">Minor Plagal (G)</option>
                   <option value="Pachelbel's Canon (D)">Pachelbel's Canon (D)</option>
                   <option value="12-Bar Blues (E)">12-Bar Blues (E)</option>
                   <option value="La Bamba (I-IV-V, C)">La Bamba (C)</option>
                   <option value="Jazz Turnaround (vi-ii-V-I, C)">Jazz Turnaround (C)</option>
                </select>
             </div>
          </div>

          <div className="lg:col-span-3">
             {activeProgression ? (
                <div id="print-area" className="bg-brand-surface p-6 md:p-8 print:p-0 print:border-none rounded-xl border border-brand-line space-y-8 print:space-y-4">
                   
                   <div className="flex justify-between items-center border-b border-brand-line pb-4 print:pb-2 print:border-b-2 print:border-black">
                      <input 
                         type="text" 
                         value={activeProgression.name}
                         onChange={(e) => {
                            saveProgressions(progressions.map(p => p.id === activeProgression.id ? {...p, name: e.target.value} : p));
                         }}
                         className="text-2xl font-serif text-brand-ink bg-transparent border-none focus:outline-none focus:ring-0 px-0 w-full max-w-md placeholder:text-brand-line print:hidden"
                         placeholder="Name this progression..."
                      />
                      <h2 className="hidden print:block text-2xl font-serif text-black">{activeProgression.name || 'Untitled Progression'}</h2>
                      <div className="flex gap-2 print:hidden">
                         <button onClick={playSequence} onMouseEnter={initAudio} className="flex items-center gap-2 px-6 py-2 bg-[#F2F5F3] text-brand-primary font-medium border border-brand-primary/30 rounded-md hover:bg-brand-primary hover:text-white transition-colors dark:bg-brand-primary/20 dark:hover:bg-brand-primary dark:text-brand-ink">
                            <Play size={18} fill="currentColor" /> Play
                         </button>
                         <button onClick={() => handlePrint('print-area')} className="flex items-center gap-2 px-4 py-2 bg-transparent text-brand-ink border border-brand-line font-medium rounded-md hover:border-brand-primary hover:text-brand-primary transition-colors">
                            <Printer size={18} /> Print
                         </button>
                         <button onClick={() => deleteProgression(activeProgression.id)} className="flex items-center gap-2 px-3 py-2 bg-transparent text-red-500 border border-brand-line font-medium rounded-md hover:border-red-500 hover:text-red-500 transition-colors" title="Delete Progression">
                            <Trash2 size={18} />
                         </button>
                      </div>
                   </div>

                   {/* Chord sequence viz */}
                   {activeProgression.chords.length > 0 ? (
                     <Reorder.Group
                       as="div"
                       axis="x"
                       values={activeProgression.chords}
                       onReorder={(newOrder) => {
                         const updated = { ...activeProgression, chords: newOrder };
                         saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
                       }}
                       className="flex gap-4 print:gap-4 print:justify-start print:items-start overflow-x-auto pb-4 print:pb-0 print:flex-row print:flex-wrap print:overflow-hidden print:w-full"
                     >
                       {activeProgression.chords.map((chord, i) => {
                         const maxFret = Math.max(...chord.frets);
                         const displayFrets = Math.max(5, maxFret <= 5 ? 5 : maxFret + 1);
                         return (
                           <Reorder.Item
                             as="div"
                             key={`${chord.name}-${i}`}
                             value={chord}
                             className="flex-shrink-0 w-48 border border-brand-line rounded-lg p-4 relative group bg-brand-bg print:w-[360px] print:border-none print:shadow-none print:p-0 print:bg-transparent print:mb-8 print:break-inside-avoid cursor-grab active:cursor-grabbing select-none"
                             whileDrag={{ scale: 1.04, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 50 }}
                           >
                             <div className="absolute top-2 left-1/2 -translate-x-1/2 text-brand-line opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                               <GripHorizontal size={14} />
                             </div>
                             <button
                               onPointerDown={(e) => e.stopPropagation()}
                               onClick={() => {
                                 const updated = { ...activeProgression, chords: activeProgression.chords.filter((_, idx) => idx !== i) };
                                 saveProgressions(progressions.map(p => p.id === updated.id ? updated : p));
                               }}
                               className="absolute top-2 right-2 p-1.5 bg-brand-surface border border-brand-line rounded-full text-brand-active opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                             >
                               <Trash2 size={14} />
                             </button>
                             <h4 className="text-center font-bold text-brand-ink mb-2 mt-3 print:mb-2 print:mt-0 print:text-xl">{chord.name}</h4>
                             <Fretboard fretsNum={displayFrets} chord={chord} showNoteNames={false} className="pointer-events-none origin-top print:scale-100 scale-75" />
                           </Reorder.Item>
                         );
                       })}
                     </Reorder.Group>
                   ) : (
                     <div className="flex gap-4 pb-4">
                       <div className="text-brand-secondary/70 p-8 border-2 border-dashed border-brand-line bg-brand-bg/50 rounded-lg w-full text-center">
                         No chords yet. Add some from the dictionary below.
                       </div>
                     </div>
                   )}

                   {/* Add Chords Palette */}
                   <div className="pt-6 border-t border-brand-line print:hidden">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-wider">Add from Common Chords</h3>
                        <button
                          onClick={() => {
                            const next = !showCircle;
                            setShowCircle(next);
                            if (!next) setCircleKey(null);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            showCircle
                              ? 'bg-brand-primary text-white border-brand-primary'
                              : 'bg-brand-surface text-brand-secondary border-brand-line hover:border-brand-primary hover:text-brand-primary'
                          }`}
                        >
                          <Disc size={13} /> Circle of 5ths
                        </button>
                      </div>

                      {showCircle && (
                        <div className="mb-5 p-4 bg-brand-bg rounded-xl border border-brand-line">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-brand-secondary">
                              {circleKey ? `Showing diatonic chords for ${circleKey} Major` : 'Click a key to highlight its diatonic chords'}
                            </p>
                            {circleKey && (
                              <button onClick={() => setCircleKey(null)} className="text-xs text-brand-secondary hover:text-brand-ink underline">Clear</button>
                            )}
                          </div>
                          <CircleOfFifths
                            selectedKey={circleKey}
                            onKeySelect={(key) => {
                              setCircleKey(key);
                              setChordPaletteKey(key);
                            }}
                            className="max-w-xs mx-auto"
                          />
                        </div>
                      )}

                      <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
                         {Object.keys(COMMON_CHORDS).map(key => {
                            const isDiatonic = circleKey ? getDiatonicRoots(circleKey).has(key) : false;
                            return (
                              <button
                                key={key}
                                onClick={() => setChordPaletteKey(key)}
                                className={`px-2 py-1 flex-shrink-0 text-xs font-bold rounded transition-colors ${
                                  chordPaletteKey === key
                                    ? 'bg-brand-primary text-white'
                                    : isDiatonic
                                    ? 'bg-brand-active/10 border border-brand-active text-brand-active hover:bg-brand-active hover:text-white'
                                    : 'bg-brand-surface border border-brand-line text-brand-ink hover:border-brand-primary'
                                }`}
                              >
                                {key}
                              </button>
                            );
                         })}
                      </div>

                      <div className="flex flex-wrap gap-2">
                         {COMMON_CHORDS[chordPaletteKey]?.map((chord, i) => (
                            <button
                               key={i}
                               onClick={() => addChordToProgression(chord)}
                               className="px-3 py-1.5 border border-brand-line bg-brand-surface rounded-md text-sm text-brand-ink hover:bg-brand-bg hover:border-brand-primary transition-colors"
                            >
                               {chord.name}
                            </button>
                         ))}
                      </div>
                   </div>

                </div>
             ) : (
                <div className="p-12 text-center text-brand-secondary bg-brand-surface rounded-xl border border-brand-line">Select or create a progression.</div>
             )}
          </div>
       </div>
    </div>
  );
}
