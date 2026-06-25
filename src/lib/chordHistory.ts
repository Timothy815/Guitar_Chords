const STORAGE_KEY = 'chord_history';

export interface ChordHistoryEntry {
  date: string;
  typeLabel: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
}

export function loadChordHistory(): ChordHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChordHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveChordHistory(entries: ChordHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendChordEntries(entries: ChordHistoryEntry[]): void {
  saveChordHistory([...loadChordHistory(), ...entries]);
}

export function mergeChordEntries(incoming: ChordHistoryEntry[]): void {
  const existing = loadChordHistory();
  const rowKey = (e: ChordHistoryEntry) =>
    `${e.date}|${e.typeLabel}|${e.rootNote}|${e.correct}|${e.responseTimeMs}`;
  const existingKeys = new Set(existing.map(rowKey));
  const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
  saveChordHistory([...existing, ...newEntries]);
}

export function exportChordToCsv(entries: ChordHistoryEntry[]): string {
  const header = 'date,type_label,root_note,correct,response_time_ms';
  const rows = entries.map(e =>
    `${e.date},${e.typeLabel},${e.rootNote},${e.correct},${e.responseTimeMs}`,
  );
  return [header, ...rows].join('\n');
}

export function parseChordFromCsv(csv: string): ChordHistoryEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  if (header !== 'date,type_label,root_note,correct,response_time_ms') return [];
  const entries: ChordHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;
    const [date, typeLabel, rootNote, correctStr, rtStr] = parts;
    const responseTimeMs = parseInt(rtStr, 10);
    if (!date || !typeLabel || !rootNote || isNaN(responseTimeMs)) continue;
    entries.push({ date, typeLabel, rootNote, correct: correctStr === 'true', responseTimeMs });
  }
  return entries;
}
