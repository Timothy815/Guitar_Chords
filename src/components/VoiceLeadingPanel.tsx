import React from 'react';
import { VoiceLeadingAnalysis } from '@/src/lib/voiceLeading';
import { cn } from '@/src/lib/utils';

const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

interface VoiceLeadingPanelProps {
  analysis: VoiceLeadingAnalysis;
  fromChordName: string;
  toChordName: string;
}

export function VoiceLeadingPanel({ analysis, fromChordName, toChordName }: VoiceLeadingPanelProps) {
  const { commonTones, largeLeapStrings, smoothScore } = analysis;

  const scoreColor =
    smoothScore >= 70 ? 'text-green-600' :
    smoothScore >= 40 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-brand-ink">
          {fromChordName} → {toChordName}
        </span>
        <span className={cn('font-bold', scoreColor)}>
          Voice leading: {smoothScore}/100
        </span>
      </div>

      {commonTones.length > 0 && (
        <div>
          <p className="text-xs font-medium text-brand-secondary mb-1">Common tones (keep these fingers down):</p>
          <div className="flex gap-1 flex-wrap">
            {commonTones.map(({ note, stringIdxs }) => (
              <span
                key={note}
                className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold dark:bg-green-900/30 dark:text-green-400"
              >
                {note} ({stringIdxs.map(i => STRING_NAMES[i]).join(', ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {largeLeapStrings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-brand-secondary mb-1">Large leaps (&gt;5 semitones):</p>
          <div className="flex gap-1 flex-wrap">
            {analysis.leaps.filter(l => l.semitones > 5).map((leap, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs dark:bg-yellow-900/30 dark:text-yellow-400"
              >
                {STRING_NAMES[leap.stringIdx]}: {leap.fromNote}→{leap.toNote} ({leap.semitones} st)
              </span>
            ))}
          </div>
          <p className="text-xs text-brand-secondary mt-1">
            Tip: try an inversion of either chord to reduce the leap.
          </p>
        </div>
      )}

      {commonTones.length === 0 && largeLeapStrings.length === 0 && (
        <p className="text-xs text-brand-secondary">No common tones — smooth stepwise motion throughout.</p>
      )}
    </div>
  );
}
