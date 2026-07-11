const STORAGE_KEY = 'interval_history';

export interface IntervalHistoryEntry {
  date: string;
  label: string;
  rootNote: string;
  correct: boolean;
  responseTimeMs: number;
  skill?: 'match' | 'name'; // Find the Tone only — which half of the round this entry scores
}

export function loadIntervalHistory(): IntervalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntervalHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveIntervalHistory(entries: IntervalHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendIntervalEntries(entries: IntervalHistoryEntry[]): void {
  saveIntervalHistory([...loadIntervalHistory(), ...entries]);
}

export function mergeIntervalEntries(incoming: IntervalHistoryEntry[]): void {
  const existing = loadIntervalHistory();
  const rowKey = (e: IntervalHistoryEntry) =>
    `${e.date}|${e.label}|${e.rootNote}|${e.correct}|${e.responseTimeMs}`;
  const existingKeys = new Set(existing.map(rowKey));
  const newEntries = incoming.filter(e => !existingKeys.has(rowKey(e)));
  saveIntervalHistory([...existing, ...newEntries]);
}

export function exportIntervalToCsv(entries: IntervalHistoryEntry[]): string {
  const header = 'date,label,root_note,correct,response_time_ms';
  const rows = entries.map(e =>
    `${e.date},${e.label},${e.rootNote},${e.correct},${e.responseTimeMs}`,
  );
  return [header, ...rows].join('\n');
}

export function parseIntervalFromCsv(csv: string): IntervalHistoryEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  if (header !== 'date,label,root_note,correct,response_time_ms') return [];
  const entries: IntervalHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;
    const [date, label, rootNote, correctStr, rtStr] = parts;
    const responseTimeMs = parseInt(rtStr, 10);
    if (!date || !label || !rootNote || isNaN(responseTimeMs)) continue;
    entries.push({ date, label, rootNote, correct: correctStr === 'true', responseTimeMs });
  }
  return entries;
}
