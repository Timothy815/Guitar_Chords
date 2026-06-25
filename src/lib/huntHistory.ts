const STORAGE_KEY = 'hunt_history';

export interface HuntHistoryEntry {
  date: string;
  note: string;
  octave: number;
  firstTapSemitones: number;
  tapCount: number;
  fretMin: number;
  fretMax: number;
}

export function loadHuntHistory(): HuntHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HuntHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHuntHistory(entries: HuntHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendHuntEntries(entries: HuntHistoryEntry[]): void {
  saveHuntHistory([...loadHuntHistory(), ...entries]);
}

export function mergeHuntEntries(incoming: HuntHistoryEntry[]): void {
  const existing = loadHuntHistory();
  const rowKey = (e: HuntHistoryEntry) =>
    `${e.date}|${e.note}|${e.octave}|${e.firstTapSemitones}|${e.tapCount}|${e.fretMin}|${e.fretMax}`;
  const existingKeys = new Set(existing.map(rowKey));
  const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
  saveHuntHistory([...existing, ...newEntries]);
}

export function exportToCsv(entries: HuntHistoryEntry[]): string {
  const header = 'date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max';
  const rows = entries.map(e =>
    `${e.date},${e.note},${e.octave},${e.firstTapSemitones},${e.tapCount},${e.fretMin},${e.fretMax}`,
  );
  return [header, ...rows].join('\n');
}

export function parseFromCsv(csv: string): HuntHistoryEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  if (header !== 'date,note,octave,first_tap_semitones,tap_count,fret_min,fret_max') return [];
  const entries: HuntHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 7) continue;
    const [date, note, octaveStr, semStr, tapStr, fminStr, fmaxStr] = parts;
    const octave = parseInt(octaveStr, 10);
    const firstTapSemitones = parseFloat(semStr);
    const tapCount = parseInt(tapStr, 10);
    const fretMin = parseInt(fminStr, 10);
    const fretMax = parseInt(fmaxStr, 10);
    if (!date || !note || isNaN(octave) || isNaN(firstTapSemitones) || isNaN(tapCount) || isNaN(fretMin) || isNaN(fretMax)) continue;
    entries.push({ date, note, octave, firstTapSemitones, tapCount, fretMin, fretMax });
  }
  return entries;
}
