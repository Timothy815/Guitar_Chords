import type { DifficultyLevel } from './earTraining';
import type { RhythmDuration } from './rhythmTraining';

export type LadderId = 'intervals' | 'chords' | 'mixed' | 'melody' | 'fretboard' | 'rhythm';
export type LadderGroup = 'pitch' | 'instrument';

export interface LadderStage {
  label: string;
  description?: string;
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
      {
        label: 'Beginner',
        description: 'Distinguish perfect intervals (unison, 4th, 5th, octave) and the major 2nd. Intervals are played melodically (one note then the other). Goal: build the habit of singing intervals internally.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Add 3rds, 6ths, and the tritone. Intervals are played both melodically and harmonically. Goal: identify all diatonic intervals by ear without guessing.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'All 13 intervals including compound intervals and chromatic variants. Intervals are played in any order, any direction. Goal: instant recognition with 85%+ accuracy.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'chords',
    label: 'Chords',
    group: 'pitch',
    mode: 'chord',
    stages: [
      {
        label: 'Beginner',
        description: 'Identify major vs. minor triads. Chords are played as slow arpeggios so each note is audible. Goal: hear the emotional character (bright vs. dark) reliably.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Add dominant 7th, major 7th, and minor 7th chords. Arpeggios are faster. Goal: distinguish quality and tension — know if a chord is resolved or wants to move.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'All chord types including diminished, augmented, m7b5, and sus chords. Chords may be played strummed or arpeggiated. Goal: identify any chord in real musical context.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed',
    group: 'pitch',
    mode: 'mixed',
    stages: [
      {
        label: 'Beginner',
        description: 'Intervals and chords presented in random order. Unlocks after completing Intervals Beginner and Chords Beginner. Goal: switch between interval and chord recognition without losing context.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Intermediate intervals and chords mixed. Goal: the sound of a sound — not just the category but the quality within the category.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Full vocabulary mixed. Goal: effortless real-time identification as heard in live music.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'melody',
    label: 'Melody',
    group: 'pitch',
    mode: 'melody',
    stages: [
      {
        label: 'Beginner',
        description: 'Short 3–4 note diatonic melodies. First note is shown so you can orient to the key. Goal: develop the skill of hearing a melody as movable do scale degrees.',
        difficulty: 'Beginner',
        melodyShowFirstNote: true,
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Intermediate',
        description: 'Longer melodies including leaps and chromatic passing tones. First note still shown. Goal: transcribe melodies quickly, hearing the function of each note.',
        difficulty: 'Intermediate',
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Advanced',
        description: 'Complex melodies including modal and blues scales. First note shown. Goal: transcribe any lead guitar phrase.',
        difficulty: 'Advanced',
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
      {
        label: 'Ears Only',
        description: 'Same as Advanced but the first note is NOT shown — you must find the key yourself. Goal: the final form of melodic ear training. Transcribe anything you hear.',
        difficulty: 'Advanced',
        melodyShowFirstNote: false,
        requiredRounds: 10,
        requiredAccuracy: 0.80,
      },
    ],
  },
  {
    id: 'fretboard',
    label: 'Fretboard',
    group: 'instrument',
    mode: 'fretboard',
    stages: [
      {
        label: 'Beginner',
        description: 'Open position notes (frets 0–5) on the low three strings. Goal: know every note on strings 6, 5, and 4 without counting.',
        difficulty: 'Beginner',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'All notes frets 0–12, all six strings. Goal: find any named note in under 2 seconds on any string.',
        difficulty: 'Intermediate',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Notes above fret 12 included. Random across the full neck. Goal: instantaneous fretboard knowledge — no more counting from open.',
        difficulty: 'Advanced',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Hunt',
        description: 'Hunt mode: find EVERY occurrence of a given note on the neck before time runs out. Goal: see the whole fretboard, not just the nearest position.',
        difficulty: 'Advanced',
        subMode: 'hunt',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Sing',
        description: 'Sing mode: hear a note played, identify its name. Tests your ability to connect sound to note name — the bridge between ear training and fretboard knowledge.',
        difficulty: 'Advanced',
        subMode: 'sing',
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
    ],
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    group: 'instrument',
    mode: 'rhythm',
    stages: [
      {
        label: 'Beginner',
        description: 'Whole, half, and quarter notes only in 4/4. Goal: transcribe any rhythm built from simple note values. Learn to count beats aloud.',
        difficulty: 'Beginner',
        rhythmDurations: ['w', 'h', 'q'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Intermediate',
        description: 'Adds eighth notes and dotted quarter notes. Goal: handle syncopated rhythms found in pop and rock guitar parts.',
        difficulty: 'Intermediate',
        rhythmDurations: ['w', 'h', 'q', '8', 'qd'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
      {
        label: 'Advanced',
        description: 'Full rhythmic vocabulary including 16th notes and dotted halves. Goal: transcribe any single-instrument rhythm part from a recording.',
        difficulty: 'Advanced',
        rhythmDurations: ['w', 'h', 'q', '8', '16', 'hd', 'qd'],
        requiredRounds: 20,
        requiredAccuracy: 0.85,
      },
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
