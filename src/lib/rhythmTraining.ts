export type RhythmDuration = 'w' | 'h' | 'q' | '8' | '16' | 'hd' | 'qd';

export interface RhythmUnit {
  duration: RhythmDuration;
  isRest: boolean;
}

export type TimeSignature = '4/4' | '2/4' | '3/4' | '6/8';

export interface RhythmRound {
  kind: 'rhythm';
  units: RhythmUnit[];
  measures: number;
  timeSignature: TimeSignature;
  bpm: number;
}

export interface RhythmSettings {
  timeSignature: TimeSignature;
  enabledDurations: RhythmDuration[];
  enableRests: boolean;
  bpm: number;
  enableLeadIn: boolean;
}

export function durationBeats(duration: RhythmDuration): number {
  switch (duration) {
    case 'w':  return 4.0;
    case 'h':  return 2.0;
    case 'hd': return 3.0;
    case 'q':  return 1.0;
    case 'qd': return 1.5;
    case '8':  return 0.5;
    case '16': return 0.25;
  }
}

export function beatsPerMeasure(ts: TimeSignature): number {
  if (ts === '4/4') return 4.0;
  if (ts === '2/4') return 2.0;
  return 3.0; // '3/4' and '6/8' both use 3 quarter-beat units
}

export function vexDuration(unit: RhythmUnit): string {
  const isDotted = unit.duration === 'hd' || unit.duration === 'qd';
  const baseVex = isDotted
    ? (unit.duration === 'hd' ? 'h' : 'q')
    : unit.duration;
  return unit.isRest ? baseVex + 'r' : baseVex;
}

export function generateRhythmRound(
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
  settings: RhythmSettings,
): RhythmRound {
  const measures = difficulty === 'Beginner' ? 1 : difficulty === 'Intermediate' ? 2 : 3;
  const budget = beatsPerMeasure(settings.timeSignature) * measures;

  const units: RhythmUnit[] = [];
  let remaining = budget;
  let attempts = 0;

  while (remaining > 0.001 && attempts < 200) {
    attempts++;
    const available = settings.enabledDurations.filter(
      d => durationBeats(d) <= remaining + 0.001,
    );

    if (available.length === 0) {
      if (units.length > 0) {
        const last = units.pop()!;
        remaining += durationBeats(last.duration);
      }
      continue;
    }

    const duration = available[Math.floor(Math.random() * available.length)];
    const canBeRest = settings.enableRests && units.some(u => !u.isRest);
    const isRest = canBeRest && Math.random() < 0.3;
    units.push({ duration, isRest });
    remaining -= durationBeats(duration);
  }

  // Fallback: fill any remaining budget with the smallest fitting duration
  if (remaining > 0.001) {
    const fallback: RhythmDuration =
      remaining >= 1.0 ? 'q' : remaining >= 0.5 ? '8' : '16';
    while (remaining > 0.001) {
      units.push({ duration: fallback, isRest: false });
      remaining -= durationBeats(fallback);
    }
  }

  // Guarantee at least one non-rest note
  if (units.length > 0 && units.every(u => u.isRest)) {
    units[0] = { ...units[0], isRest: false };
  }

  return { kind: 'rhythm', units, measures, timeSignature: settings.timeSignature, bpm: settings.bpm };
}
