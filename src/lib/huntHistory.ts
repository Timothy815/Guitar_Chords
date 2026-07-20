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

export interface HuntSession {
  date: string;
  avgSemitones: number;
  avgTaps: number;
  count: number;
  focusKey: string; // e.g. "0-12" or "E-string"
}

/**
 * Aggregate hunt history into session summaries by date and focus area.
 * Focus key is derived from fretMin/fretMax or can be customized.
 */
export function aggregateHuntSessions(entries: HuntHistoryEntry[]): HuntSession[] {
  const sessionMap: Record<string, { totalSemitones: number; totalTaps: number; count: number }> = {};

  for (const entry of entries) {
    const focusKey = `${entry.fretMin}-${entry.fretMax}`;
    const sessionKey = `${entry.date}|${focusKey}`;

    if (!sessionMap[sessionKey]) {
      sessionMap[sessionKey] = { totalSemitones: 0, totalTaps: 0, count: 0 };
    }

    sessionMap[sessionKey].totalSemitones += entry.firstTapSemitones;
    sessionMap[sessionKey].totalTaps += entry.tapCount;
    sessionMap[sessionKey].count++;
  }

  return Object.entries(sessionMap)
    .map(([sessionKey, data]) => {
      const [date, focusKey] = sessionKey.split('|');
      return {
        date,
        avgSemitones: data.totalSemitones / data.count,
        avgTaps: data.totalTaps / data.count,
        count: data.count,
        focusKey,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
}

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface TrendComparison {
  current: HuntSession;
  previous: HuntSession | null;
  semitoneTrend: TrendDirection;
  tapTrend: TrendDirection;
  personalBest: {
    semitones: number;
    taps: number;
  };
}

/**
 * Compare current session against previous sessions and calculate trends.
 * Returns null if there's no current session data.
 */
export function calculateHuntTrends(
  currentSessionEntries: HuntHistoryEntry[],
  allHistory: HuntHistoryEntry[]
): TrendComparison | null {
  if (currentSessionEntries.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const focusKey = `${currentSessionEntries[0].fretMin}-${currentSessionEntries[0].fretMax}`;

  // Calculate current session stats
  const currentSemitones = currentSessionEntries.reduce((sum, e) => sum + e.firstTapSemitones, 0) / currentSessionEntries.length;
  const currentTaps = currentSessionEntries.reduce((sum, e) => sum + e.tapCount, 0) / currentSessionEntries.length;

  const current: HuntSession = {
    date: today,
    avgSemitones: currentSemitones,
    avgTaps: currentTaps,
    count: currentSessionEntries.length,
    focusKey,
  };

  // Get all sessions for the same focus area
  const sessions = aggregateHuntSessions(allHistory).filter(s => s.focusKey === focusKey && s.date !== today);

  // Find previous session (most recent before today)
  const previous = sessions[0] || null;

  // Calculate trends (threshold: 0.2 for stable)
  const semitoneDiff = previous ? currentSemitones - previous.avgSemitones : 0;
  const tapDiff = previous ? currentTaps - previous.avgTaps : 0;

  const semitoneTrend: TrendDirection =
    !previous ? 'stable' :
    semitoneDiff < -0.2 ? 'improving' :
    semitoneDiff > 0.2 ? 'declining' :
    'stable';

  const tapTrend: TrendDirection =
    !previous ? 'stable' :
    tapDiff < -0.2 ? 'improving' :
    tapDiff > 0.2 ? 'declining' :
    'stable';

  // Find personal bests
  const allSemitones = [currentSemitones, ...sessions.map(s => s.avgSemitones)];
  const allTaps = [currentTaps, ...sessions.map(s => s.avgTaps)];

  return {
    current,
    previous,
    semitoneTrend,
    tapTrend,
    personalBest: {
      semitones: Math.min(...allSemitones),
      taps: Math.min(...allTaps),
    },
  };
}
