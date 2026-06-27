import { ChordShape, Note } from '@/src/types';
import { ALL_NOTES, getNoteFromFret } from '@/src/data/guitarData';

export interface NoteLeap {
  fromNote: Note;
  toNote: Note;
  semitones: number;
  stringIdx: number;
}

export interface VoiceLeadingAnalysis {
  commonTones: { note: Note; stringIdxs: number[] }[];
  leaps: NoteLeap[];
  largeLeapStrings: number[];   // stringIdxs with leap > 5 semitones
  smoothScore: number;          // 0–100: higher = smoother voice leading
}

function noteAtString(frets: number[], stringIdx: number, tuningNotes: Note[]): Note | null {
  const fret = frets[stringIdx];
  if (fret === -1) return null;
  return getNoteFromFret(tuningNotes[stringIdx], fret);
}

export function analyzeVoiceLeading(
  chordA: ChordShape,
  chordB: ChordShape,
  tuningNotes: Note[],
): VoiceLeadingAnalysis {
  const notesA = tuningNotes.map((_, i) => noteAtString(chordA.frets, i, tuningNotes));
  const notesB = tuningNotes.map((_, i) => noteAtString(chordB.frets, i, tuningNotes));

  const commonMap = new Map<Note, number[]>();
  const leaps: NoteLeap[] = [];

  for (let i = 0; i < 6; i++) {
    const a = notesA[i];
    const b = notesB[i];
    if (!a || !b) continue;

    if (a === b) {
      const existing = commonMap.get(a);
      if (existing) existing.push(i);
      else commonMap.set(a, [i]);
    } else {
      const idxA = ALL_NOTES.indexOf(a);
      const idxB = ALL_NOTES.indexOf(b);
      const diff = Math.abs(idxB - idxA);
      const semitones = Math.min(diff, 12 - diff);
      leaps.push({ fromNote: a, toNote: b, semitones, stringIdx: i });
    }
  }

  const commonTones = Array.from(commonMap.entries()).map(([note, stringIdxs]) => ({ note, stringIdxs }));
  const largeLeapStrings = leaps.filter(l => l.semitones > 5).map(l => l.stringIdx);

  // Smooth score: start at 100, deduct per large leap, add per common tone
  const smoothScore = Math.max(0, Math.min(100,
    100 - largeLeapStrings.length * 15 + commonTones.length * 10,
  ));

  return { commonTones, leaps, largeLeapStrings, smoothScore };
}
