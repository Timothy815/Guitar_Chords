import { ChordShape, ChordSlot, Progression } from '@/src/types';

const STORAGE_KEY = 'guitar_progressions';
const ACTIVE_KEY = 'guitar_active_prog_id';

export function addChordToActiveProgression(chord: ChordShape): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const progressions: Progression[] = JSON.parse(raw);
    if (progressions.length === 0) return false;

    const activeId = localStorage.getItem(ACTIVE_KEY);
    const targetIdx = activeId
      ? progressions.findIndex(p => p.id === activeId)
      : -1;
    const idx = targetIdx >= 0 ? targetIdx : 0;

    const slot: ChordSlot = { chord };
    progressions[idx] = { ...progressions[idx], slots: [...progressions[idx].slots, slot] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressions));
    window.dispatchEvent(new CustomEvent('guitar_progressions_updated'));
    return true;
  } catch {
    return false;
  }
}
