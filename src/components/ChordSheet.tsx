import React from 'react';
import { Progression, ChordShape } from '../types';
import { ChordCard } from './ChordCard';

interface ChordSheetProps {
  progression: Progression;
  showDiagrams: boolean;
  showChart: boolean;
}

export function ChordSheet({ progression, showDiagrams, showChart }: ChordSheetProps) {
  // Deduplicate chords by name, preserving first occurrence order
  const uniqueChords: ChordShape[] = [];
  const seen = new Set<string>();
  for (const slot of progression.slots) {
    if (!seen.has(slot.chord.name)) {
      seen.add(slot.chord.name);
      uniqueChords.push(slot.chord);
    }
  }

  return (
    <div className="font-sans text-black p-6 print:p-0 space-y-8">
      <h1 className="text-2xl font-serif font-bold text-center border-b-2 border-black pb-3">
        {progression.name || 'Untitled Progression'}
      </h1>

      {showDiagrams && uniqueChords.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
            Chord Reference
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {uniqueChords.map((chord, i) => (
              <React.Fragment key={chord.name ?? i}>
                <ChordCard
                  chord={chord}
                  progressionKey={progression.key ?? 'C'}
                />
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {showChart && progression.slots.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Lead Chart — Key of {progression.key ?? 'C'}
            </h2>
            <span className="text-xl font-serif font-bold text-gray-700">4/4</span>
          </div>
          <LeadChart progression={progression} />
        </section>
      )}
    </div>
  );
}

function LeadChart({ progression }: { progression: Progression }) {
  return (
    <div className="grid grid-cols-4 border-t-2 border-l-2 border-black">
      {progression.slots.map((slot, i) => {
        const chordLabel = slot.chord.name.split('(')[0].trim();
        return (
          <div
            key={i}
            className="border-r-2 border-b-2 border-black p-3 min-h-[80px] flex flex-col"
          >
            {i === 0 && (
              <span className="text-[10px] text-gray-400 mb-1 leading-none">
                Key of {progression.key ?? 'C'}
              </span>
            )}
            <span className="font-serif text-xl font-bold leading-tight">{chordLabel}</span>
            <div className="mt-auto flex gap-3 pt-2">
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-gray-300 text-xs">|</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
