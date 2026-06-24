import { DifficultyLevel } from './earTraining';

export interface PlanStage {
  label: string;
  mode: 'chord' | 'interval' | 'fretboard';
  difficulty: DifficultyLevel;
  subMode?: 'hunt' | 'sing';
}

export interface PlanProgress {
  stageIndex: number;
  completedStages: Record<number, { accuracy: number; completedAt: string }>;
}

export const PLAN_STAGES: PlanStage[] = [
  { label: 'Intervals: Beginner',     mode: 'interval',  difficulty: 'Beginner' },
  { label: 'Intervals: Intermediate', mode: 'interval',  difficulty: 'Intermediate' },
  { label: 'Intervals: Advanced',     mode: 'interval',  difficulty: 'Advanced' },
  { label: 'Chords: Beginner',        mode: 'chord',     difficulty: 'Beginner' },
  { label: 'Chords: Intermediate',    mode: 'chord',     difficulty: 'Intermediate' },
  { label: 'Chords: Advanced',        mode: 'chord',     difficulty: 'Advanced' },
  { label: 'Fretboard: Beginner',     mode: 'fretboard', difficulty: 'Beginner' },
  { label: 'Fretboard: Intermediate', mode: 'fretboard', difficulty: 'Intermediate' },
  { label: 'Fretboard: Advanced',     mode: 'fretboard', difficulty: 'Advanced' },
  { label: 'Fretboard: Hunt',         mode: 'fretboard', difficulty: 'Advanced', subMode: 'hunt' },
  { label: 'Fretboard: Sing',         mode: 'fretboard', difficulty: 'Advanced', subMode: 'sing' },
];

const STORAGE_KEY = 'ear_training_plan';

const DEFAULT_PROGRESS: PlanProgress = { stageIndex: 0, completedStages: {} };

export function loadPlanProgress(): PlanProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, completedStages: {} };
    const parsed = JSON.parse(raw) as Partial<PlanProgress>;
    return {
      stageIndex: parsed.stageIndex ?? 0,
      completedStages: parsed.completedStages ?? {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS, completedStages: {} };
  }
}

export function savePlanProgress(p: PlanProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function resetPlanProgress(): PlanProgress {
  const fresh: PlanProgress = { stageIndex: 0, completedStages: {} };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
