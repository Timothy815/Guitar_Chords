import { ChordShape, ChordSlot, Progression } from '@/src/types';

const STORAGE_KEY = 'guitar_progressions';

/**
 * Appends `chord` as a new slot to the first saved progression.
 * Returns true on success, false if no progressions are saved yet.
 */
export function addChordToActiveProgression(chord: ChordShape): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const progressions: Progression[] = JSON.parse(raw);
    if (progressions.length === 0) return false;
    const slot: ChordSlot = { chord };
    progressions[0] = { ...progressions[0], slots: [...progressions[0].slots, slot] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressions));
    return true;
  } catch {
    return false;
  }
}
