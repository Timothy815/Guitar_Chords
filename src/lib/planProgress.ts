import type { DifficultyLevel } from './earTraining';
import type { RhythmDuration } from './rhythmTraining';

export type LadderId = 'intervals' | 'chords' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
export type LadderGroup = 'pitch' | 'instrument';

export interface LadderStage {
  label: string;
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
  melodyShowFirstNote?: boolean;
  rhythmDurations?: RhythmDuration[];
  requiredRounds: number;
  requiredAccuracy: number;
}

export interface SkillLadder {
  id: LadderId;
  label: string;
  group: LadderGroup;
  mode: 'chord' | 'interval' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
  stages: LadderStage[];
}

export interface LadderProgress {
  stageIndex: number;
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export type PlanProgress = Record<LadderId, LadderProgress>;

export const SKILL_LADDERS: SkillLadder[] = [
  {
    id: 'intervals',
    label: 'Intervals',
    group: 'pitch',
    mode: 'interval',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    group: 'pitch',
    mode: 'chord',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed',
    group: 'pitch',
    mode: 'mixed',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'melody',
    label: 'Melody',
    group: 'pitch',
    mode: 'melody',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', melodyShowFirstNote: true, requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 10, requiredAccuracy: 0.80 },
      { label: 'Ears Only', difficulty: 'Advanced', melodyShowFirstNote: false, requiredRounds: 10, requiredAccuracy: 0.80 },
    ],
  },
  {
    id: 'fretboard',
    label: 'Fretboard',
    group: 'instrument',
    mode: 'fretboard',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Hunt', difficulty: 'Advanced', subMode: 'hunt', requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Sing', difficulty: 'Advanced', subMode: 'sing', requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    group: 'instrument',
    mode: 'rhythm',
    stages: [
      { label: 'Beginner', difficulty: 'Beginner', rhythmDurations: ['w', 'h', 'q'], requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Intermediate', difficulty: 'Intermediate', rhythmDurations: ['w', 'h', 'q', '8', 'qd'], requiredRounds: 20, requiredAccuracy: 0.85 },
      { label: 'Advanced', difficulty: 'Advanced', rhythmDurations: ['w', 'h', 'q', '8', '16', 'hd', 'qd'], requiredRounds: 20, requiredAccuracy: 0.85 },
    ],
  },
];

const LADDER_IDS: LadderId[] = ['intervals', 'chords', 'mixed', 'melody', 'fretboard', 'rhythm'];
const STORAGE_KEY = 'ear_training_plan_v2';

function defaultProgress(): PlanProgress {
  return Object.fromEntries(
    LADDER_IDS.map(id => [id, { stageIndex: 0, completedStages: {} }])
  ) as PlanProgress;
}

export const DEFAULT_PROGRESS: PlanProgress = defaultProgress();

export function loadPlanProgress(): PlanProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Record<LadderId, Partial<LadderProgress>>>;
    return Object.fromEntries(
      LADDER_IDS.map(id => [
        id,
        {
          stageIndex: parsed[id]?.stageIndex ?? 0,
          completedStages: parsed[id]?.completedStages ?? {},
        },
      ])
    ) as PlanProgress;
  } catch {
    return defaultProgress();
  }
}

export function savePlanProgress(p: PlanProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function resetPlanProgress(): PlanProgress {
  const fresh = defaultProgress();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function isMixedUnlocked(stageIndex: number, progress: PlanProgress): boolean {
  return (
    !!progress.intervals.completedStages[stageIndex] &&
    !!progress.chords.completedStages[stageIndex]
  );
}
