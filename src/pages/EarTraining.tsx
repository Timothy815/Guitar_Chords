import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronDown, ChevronUp, Headphones, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  buildFretboardNotePool, makeFretboardRound,
  chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
import { initAudio, playStrum, playNote, startDrone, stopDrone } from '../lib/audio';
import { FretboardTrainer } from '../components/FretboardTrainer';
import { PlanProgress, PlanStage, PLAN_STAGES, loadPlanProgress, savePlanProgress, resetPlanProgress } from '../lib/planProgress';

function makeRound(
  s: EarTrainingSettings,
  difficulty: DifficultyLevel = 'Beginner',
  focus: FretboardFocus = {},
): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty, focus);
  return generateIntervalRound(s.activeIntervals);
}

export function EarTraining() {
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Beginner');
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt' | 'sing'>('guess');
  const [biasTally, setBiasTally] = useState({ sharp: 0, flat: 0, correct: 0 });
  const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});
  const [droneNote, setDroneNote] = useState<string | null>(null);
  const [droneMode, setDroneMode] = useState<'off' | 'continuous' | 'cue'>('off');
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
  const [selected, setSelected] = useState<number | null>(null);
  const [tentative, setTentative] = useState<number | null>(null);
  const [score, setScore] = useState<SessionScore>(initialScore);
  const [showSummary, setShowSummary] = useState(false);
  const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const audioUnlocked = useRef(false);
  const deckRef = useRef<string[]>([]);
  const deckKeyRef = useRef<string>('');
  const [planProgress, setPlanProgress] = useState<PlanProgress>(loadPlanProgress);
  const [planPracticing, setPlanPracticing] = useState(false);
  const [showPlanComplete, setShowPlanComplete] = useState<{ accuracy: number; stageLabel: string; isFinal: boolean } | null>(null);

  const FRETS_FOR: Record<DifficultyLevel, number> = { Beginner: 6, Intermediate: 10, Advanced: 13 };

  function nextFretboardNote(diff: DifficultyLevel, focus: FretboardFocus): string {
    const key = `${diff}|${JSON.stringify(focus)}`;
    if (deckKeyRef.current !== key || deckRef.current.length === 0) {
      const pool = buildFretboardNotePool(diff, focus);
      const a: string[] = [];
      for (const note of pool) {
        const wrong = (score.byType[note]?.total ?? 0) - (score.byType[note]?.correct ?? 0);
        const copies = Math.min(wrong + 1, 4);
        for (let c = 0; c < copies; c++) a.push(note);
      }
      // Fisher-Yates shuffle
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      deckRef.current = a;
      deckKeyRef.current = key;
    }
    return deckRef.current.pop()!;
  }

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { savePlanProgress(planProgress); }, [planProgress]);

  useEffect(() => {
    if (settings.mode === 'study') {
      setStudyDeck(generateStudyDeck(settings.activeChordTypes, settings.activeIntervals));
      setStudyIndex(0);
    }
  }, [settings.mode, settings.activeChordTypes, settings.activeIntervals]);

  useEffect(() => {
    if (settings.mode === 'fretboard' && droneMode === 'continuous' && droneNote) {
      initAudio().then(() => startDrone(droneNote)).catch(() => {});
    } else {
      stopDrone();
    }
    return () => stopDrone();
  }, [settings.mode, droneMode, droneNote]);

  const playRoundAudio = useCallback(async (r: Round) => {
    if (r.kind === 'fretboard') return;
    await initAudio();
    audioUnlocked.current = true;
    if (r.kind === 'chord') {
      playStrum(chordToNotes((r as ChordRound).correct.chord), '2n');
    } else {
      const ir = r as IntervalRound;
      playNote(ir.correct.rootNote, '2n');
      setTimeout(() => playNote(ir.correct.topNote, '2n'), 400);
    }
  }, []);

  // Auto-play when round changes — only works once audio is unlocked by a user gesture.
  useEffect(() => {
    if (audioUnlocked.current) {
      playRoundAudio(round);
    }
  }, [round, playRoundAudio]);

  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus) {
    const activeFocus = focusOverride ?? fretboardFocus;
    const effectiveMode = s.mode === 'plan'
      ? PLAN_STAGES[planProgress.stageIndex].mode
      : s.mode;
    let r: Round;
    if (effectiveMode === 'fretboard') {
      const note = nextFretboardNote(difficulty, activeFocus);
      r = makeFretboardRound(note, FRETS_FOR[difficulty]);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
  }

  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }

  function handleStudyMode() {
    setSettings(s => ({ ...s, mode: 'study' }));
  }

  function handleFretboardDifficulty(level: DifficultyLevel | 'Hunt') {
    if (level === 'Hunt') {
      setFretboardSubMode('hunt');
      setDifficulty('Advanced');
    } else {
      if (fretboardSubMode !== 'sing') setFretboardSubMode('guess');
      setDifficulty(level);
    }
  }

  function handleFretboardMode() {
    const next = { ...settings, mode: 'fretboard' as const };
    setSettings(next);
    advanceRound(next);
  }

  function handlePlanMode() {
    setSettings(s => ({ ...s, mode: 'plan' }));
    setPlanPracticing(false);
  }

  function handlePlanStart() {
    const stage = PLAN_STAGES[planProgress.stageIndex];
    const next: EarTrainingSettings = {
      ...settings,
      mode: 'plan',
      activeChordTypes: stage.mode === 'chord'
        ? [...DIFFICULTY_PRESETS.chord[stage.difficulty]]
        : settings.activeChordTypes,
      activeIntervals: stage.mode === 'interval'
        ? [...DIFFICULTY_PRESETS.interval[stage.difficulty]]
        : settings.activeIntervals,
    };
    setSettings(next);
    setDifficulty(stage.difficulty);
    setFretboardSubMode(stage.subMode ?? 'guess');
    setScore(initialScore());
    deckRef.current = [];
    deckKeyRef.current = '';
    setPlanPracticing(true);
    advanceRound(next);
  }

  function handlePlanAdvance(accuracyFraction: number) {
    const accuracyPct = Math.round(accuracyFraction * 100);
    const currentStage = PLAN_STAGES[planProgress.stageIndex];
    const nextIndex = planProgress.stageIndex + 1;
    const isFinal = nextIndex >= PLAN_STAGES.length;
    const updatedProgress: PlanProgress = {
      stageIndex: isFinal ? planProgress.stageIndex : nextIndex,
      completedStages: {
        ...planProgress.completedStages,
        [planProgress.stageIndex]: {
          accuracy: accuracyPct,
          completedAt: new Date().toISOString(),
        },
      },
    };
    setPlanProgress(updatedProgress);
    setScore(initialScore());
    setPlanPracticing(false);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setShowPlanComplete({ accuracy: accuracyPct, stageLabel: currentStage.label, isFinal });
  }

  function handleFocusChange(focus: FretboardFocus) {
    setFretboardFocus(focus);
    advanceRound(settings, focus);
  }

  function handleFretboardComplete(wasCorrect: boolean, huntResult?: HuntResult) {
    const typeKey = (round as FretboardRound).targetNote;
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(prev => ({
      correct: prev.correct + (wasCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: wasCorrect ? prev.streak + 1 : 0,
      byType: {
        ...prev.byType,
        [typeKey]: {
          correct: (prev.byType[typeKey]?.correct ?? 0) + (wasCorrect ? 1 : 0),
          total: (prev.byType[typeKey]?.total ?? 0) + 1,
        },
      },
      totalStars: huntResult ? (prev.totalStars ?? 0) + huntResult.stars : prev.totalStars,
      huntAttempts: huntResult ? [...(prev.huntAttempts ?? []), huntResult.attempts] : prev.huntAttempts,
    }));
    if (huntResult) {
      setBiasTally(prev => ({
        ...prev,
        [huntResult.direction]: prev[huntResult.direction] + 1,
      }));
    }
    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
      return;
    }
    advanceRound();
  }

  function handleDifficulty(level: DifficultyLevel) {
    setDifficulty(level);
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    if (next.mode !== 'study' && next.mode !== 'fretboard') advanceRound(next);
  }

  function handleToggleChordType(id: string) {
    setSettings(s => {
      if (s.activeChordTypes.includes(id)) {
        if (s.activeChordTypes.length <= 2) return s;
        return { ...s, activeChordTypes: s.activeChordTypes.filter(t => t !== id) };
      }
      return { ...s, activeChordTypes: [...s.activeChordTypes, id] };
    });
  }

  function handleToggleInterval(label: string) {
    setSettings(s => {
      if (s.activeIntervals.includes(label)) {
        if (s.activeIntervals.length <= 2) return s;
        return { ...s, activeIntervals: s.activeIntervals.filter(l => l !== label) };
      }
      return { ...s, activeIntervals: [...s.activeIntervals, label] };
    });
  }

  function handleTentative(i: number) {
    if (selected !== null) return;
    setTentative(i);
    playOptionAudio(round, i).catch(() => {});
  }

  function handleConfirm() {
    if (tentative === null || selected !== null) return;
    handleSelect(tentative);
  }

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = round.kind === 'chord'
      ? (round as ChordRound).options[index].displayLabel === (round as ChordRound).correct.displayLabel
      : (round as IntervalRound).options[index].label === (round as IntervalRound).correct.label;

    const typeKey = round.kind === 'chord'
      ? (round as ChordRound).correct.typeLabel
      : (round as IntervalRound).correct.label;

    const newCorrect = score.correct + (isCorrect ? 1 : 0);
    const newTotal = score.total + 1;

    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
      byType: {
        ...prev.byType,
        [typeKey]: {
          correct: (prev.byType[typeKey]?.correct ?? 0) + (isCorrect ? 1 : 0),
          total: (prev.byType[typeKey]?.total ?? 0) + 1,
        },
      },
    }));

    if (settings.mode === 'plan' && planPracticing && newTotal >= 20 && newCorrect / newTotal >= 0.85) {
      handlePlanAdvance(newCorrect / newTotal);
    }
  }

  function handleStartOver() {
    deckRef.current = [];
    deckKeyRef.current = '';
    setScore(initialScore());
    setBiasTally({ sharp: 0, flat: 0, correct: 0 });
    setFretboardFocus({});
    setShowSummary(false);
    advanceRound(settings, {});
  }

  function getOptionLabel(index: number): string {
    if (round.kind === 'chord') return (round as ChordRound).options[index].displayLabel;
    return (round as IntervalRound).options[index].label;
  }

  function isOptionCorrect(index: number): boolean {
    if (round.kind === 'chord') {
      const r = round as ChordRound;
      return r.options[index].displayLabel === r.correct.displayLabel;
    }
    const r = round as IntervalRound;
    return r.options[index].label === r.correct.label;
  }

  const accuracy = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 0;

  const weakNotes = settings.mode === 'fretboard'
    ? Object.entries(score.byType)
        .map(([note, data]: [string, { correct: number; total: number }]) => ({ note, wrong: data.total - data.correct, total: data.total }))
        .filter(e => e.wrong > 0)
        .sort((a, b) => b.wrong - a.wrong || a.note.localeCompare(b.note))
    : [];

  return (
    <div className={cn('max-w-2xl mx-auto space-y-4', settings.mode !== 'study' && 'pb-24')}>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
          <Headphones size={18} className="text-white" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Ear Training</h1>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-lg border border-brand-line overflow-hidden">
        {(['chord', 'interval'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              settings.mode === mode
                ? 'bg-brand-primary text-white'
                : 'text-brand-secondary hover:bg-brand-sidebar'
            )}
          >
            {mode === 'chord' ? 'Chord Recognition' : 'Interval Recognition'}
          </button>
        ))}
        <button
          onClick={handleStudyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'study'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Study
        </button>
        <button
          onClick={handleFretboardMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'fretboard'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Fretboard
        </button>
        <button
          onClick={handlePlanMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'plan'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Plan
        </button>
      </div>

      {/* Settings panel */}
      {settings.mode !== 'plan' && (
      <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
        <button
          onClick={() => setSettings(s => ({ ...s, settingsPanelOpen: !s.settingsPanelOpen }))}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-ink hover:bg-brand-sidebar transition-colors"
        >
          <span>Settings</span>
          {settings.settingsPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {settings.settingsPanelOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-brand-line">
            {/* Difficulty presets */}
            <div className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Difficulty</p>
              <div className="flex gap-2 flex-wrap">
                {(['Beginner', 'Intermediate', 'Advanced'] as DifficultyLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => settings.mode === 'fretboard' ? handleFretboardDifficulty(level) : handleDifficulty(level)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      settings.mode === 'fretboard' && (fretboardSubMode === 'guess' || fretboardSubMode === 'sing') && difficulty === level
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    {level}
                  </button>
                ))}
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => handleFretboardDifficulty('Hunt')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'hunt'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Hunt
                  </button>
                )}
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => { setFretboardSubMode('sing'); advanceRound(); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'sing'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Sing
                  </button>
                )}
              </div>
            </div>

            {/* Drone controls — fretboard mode only */}
            {settings.mode === 'fretboard' && (
              <div className="space-y-2 pt-2 border-t border-brand-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary pt-1">Drone</p>

                {/* Mode pills */}
                <div className="flex gap-2 flex-wrap">
                  {(['off', 'continuous', 'cue'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setDroneMode(mode)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize',
                        droneMode === mode
                          ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                          : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary',
                      )}
                    >
                      {mode === 'off' ? 'Off' : mode === 'continuous' ? 'Continuous' : 'Cue'}
                    </button>
                  ))}
                </div>

                {/* Tonic note pills — hidden when Off */}
                {droneMode !== 'off' && (
                  <div className="flex gap-1.5 flex-wrap">
                    {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(pitch => (
                      <button
                        key={pitch}
                        onClick={() => setDroneNote(`${pitch}3`)}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                          droneNote === `${pitch}3`
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-primary',
                        )}
                      >
                        {pitch}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Type / interval checkboxes */}
            {settings.mode === 'study' ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Chord Types</p>
                  <div className="flex flex-wrap gap-2">
                    {CHORD_TYPE_DEFS.map(def => {
                      const checked = settings.activeChordTypes.includes(def.id);
                      const disabled = checked && settings.activeChordTypes.length <= 2;
                      return (
                        <label
                          key={def.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleChordType(def.id)} />
                          {def.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">Intervals</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERVAL_DEFS.map(def => {
                      const checked = settings.activeIntervals.includes(def.label);
                      const disabled = checked && settings.activeIntervals.length <= 2;
                      return (
                        <label
                          key={def.label}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                            checked
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                            disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleInterval(def.label)} />
                          {def.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-2">
                  {settings.mode === 'chord' ? 'Chord Types' : 'Intervals'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {settings.mode === 'chord'
                    ? CHORD_TYPE_DEFS.map(def => {
                        const checked = settings.activeChordTypes.includes(def.id);
                        const disabled = checked && settings.activeChordTypes.length <= 2;
                        return (
                          <label
                            key={def.id}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                              checked
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                              disabled && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleChordType(def.id)} />
                            {def.label}
                          </label>
                        );
                      })
                    : INTERVAL_DEFS.map(def => {
                        const checked = settings.activeIntervals.includes(def.label);
                        const disabled = checked && settings.activeIntervals.length <= 2;
                        return (
                          <label
                            key={def.label}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors select-none',
                              checked
                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                : 'border-brand-line text-brand-secondary hover:border-brand-primary/50',
                              disabled && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => handleToggleInterval(def.label)} />
                            {def.label}
                          </label>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Plan tab body */}
      {settings.mode === 'plan' && (
        <>
          {/* Stage ladder */}
          <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
            {planPracticing ? (
              /* Collapsed header while practicing */
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-brand-ink">
                  Plan · Stage {planProgress.stageIndex + 1} of {PLAN_STAGES.length} · {PLAN_STAGES[planProgress.stageIndex].label}
                </span>
                <button
                  onClick={() => setPlanPracticing(false)}
                  className="text-xs text-brand-secondary hover:text-brand-primary transition-colors"
                >
                  View ladder ↑
                </button>
              </div>
            ) : (
              /* Full ladder */
              <div className="divide-y divide-brand-line">
                {PLAN_STAGES.map((stage: PlanStage, i: number) => {
                  const completed = !!planProgress.completedStages[i];
                  const current = i === planProgress.stageIndex;
                  const locked = i > planProgress.stageIndex;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'px-4 py-3 flex items-center gap-3',
                        locked && 'opacity-40'
                      )}
                    >
                      <span className="w-5 shrink-0 flex items-center justify-center">
                        {completed
                          ? <Check size={14} className="text-green-500" />
                          : current
                            ? <span className="text-brand-primary font-bold text-sm">→</span>
                            : <span className="text-brand-line text-sm">·</span>}
                      </span>
                      <span className={cn(
                        'flex-1 text-sm',
                        current ? 'font-medium text-brand-ink' : 'text-brand-secondary'
                      )}>
                        {stage.label}
                      </span>
                      {completed && (
                        <span className="text-xs text-brand-secondary">
                          {planProgress.completedStages[i].accuracy}%
                        </span>
                      )}
                      {current && (
                        <button
                          onClick={handlePlanStart}
                          className="px-3 py-1 rounded-md bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Practice area — only shown after Start is clicked */}
          {planPracticing && (() => {
            const stage = PLAN_STAGES[planProgress.stageIndex];
            if (stage.mode === 'fretboard') {
              return (
                <FretboardTrainer
                  round={round as FretboardRound}
                  difficulty={difficulty}
                  score={score}
                  isHuntMode={fretboardSubMode === 'hunt'}
                  singMode={fretboardSubMode === 'sing'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
                  onComplete={handleFretboardComplete}
                />
              );
            }
            return (
              <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
                <div className="flex justify-center">
                  <button
                    onClick={() => playRoundAudio(round)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                  >
                    <Volume2 size={18} /> Replay
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }, (_, i) => {
                    const answered = selected !== null;
                    const correct = isOptionCorrect(i);
                    const isSelected = selected === i;
                    const isTentative = tentative === i;
                    const hasTentative = tentative !== null;
                    return (
                      <button
                        key={i}
                        onClick={() => handleTentative(i)}
                        disabled={answered}
                        className={cn(
                          'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                          !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
                          !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
                          !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
                          answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                          answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                          answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
                        )}
                      >
                        {getOptionLabel(i)}
                      </button>
                    );
                  })}
                </div>
                {tentative !== null && selected === null && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleConfirm}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                )}
                {selected !== null && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => advanceRound()}
                      className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Round area / Study view / Fretboard trainer */}
      {settings.mode === 'fretboard' ? (
        <FretboardTrainer
          round={round as FretboardRound}
          difficulty={difficulty}
          score={score}
          isHuntMode={fretboardSubMode === 'hunt'}
          singMode={fretboardSubMode === 'sing'}
          focus={fretboardFocus}
          onFocusChange={handleFocusChange}
          droneNote={droneNote}
          droneMode={droneMode}
          onComplete={handleFretboardComplete}
        />
      ) : settings.mode === 'study' ? (
        studyDeck.length === 0 ? (
          <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-center text-brand-secondary text-sm">
            No cards — enable at least one chord type or interval in Settings.
          </div>
        ) : (
          <div className="rounded-lg border border-brand-line bg-brand-surface p-8 flex flex-col items-center gap-6">
            {/* Category chip */}
            <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-line text-brand-secondary">
              {studyDeck[studyIndex].kind === 'chord' ? 'Chord' : 'Interval'}
            </span>

            {/* Name */}
            <p className="text-3xl font-serif font-bold text-brand-ink text-center">
              {studyDeck[studyIndex].kind === 'chord'
                ? studyDeck[studyIndex].displayLabel
                : studyDeck[studyIndex].label}
            </p>

            {/* Play button */}
            <button
              onClick={() => playStudyCard(studyDeck[studyIndex]).catch(() => {})}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
            >
              <Volume2 size={18} /> Play
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => setStudyIndex(i => i - 1)}
                disabled={studyIndex === 0}
                className="p-2 rounded-lg border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous card"
              >
                ←
              </button>
              <span className="text-sm text-brand-secondary tabular-nums">
                {studyIndex + 1} / {studyDeck.length}
              </span>
              <button
                onClick={() => setStudyIndex(i => i + 1)}
                disabled={studyIndex === studyDeck.length - 1}
                className="p-2 rounded-lg border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next card"
              >
                →
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-6 space-y-6">
          {/* Replay button — also serves as the first user gesture to unlock audio */}
          <div className="flex justify-center">
            <button
              onClick={() => playRoundAudio(round)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
            >
              <Volume2 size={18} /> Replay
            </button>
          </div>

          {/* Answer options — 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => {
              const answered = selected !== null;
              const correct = isOptionCorrect(i);
              const isSelected = selected === i;
              const isTentative = tentative === i;
              const hasTentative = tentative !== null;
              return (
                <button
                  key={i}
                  onClick={() => handleTentative(i)}
                  disabled={answered}
                  className={cn(
                    'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                    !answered && !hasTentative && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
                    !answered && isTentative && 'border-brand-primary bg-brand-primary/10 cursor-pointer text-brand-ink',
                    !answered && hasTentative && !isTentative && 'border-brand-line cursor-pointer text-brand-ink opacity-60 hover:opacity-90',
                    answered && correct && 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                    answered && !correct && isSelected && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                    answered && !correct && !isSelected && 'border-brand-line text-brand-secondary opacity-50',
                  )}
                >
                  {getOptionLabel(i)}
                </button>
              );
            })}
          </div>

          {/* Confirm button — appears after tentative pick */}
          {tentative !== null && selected === null && (
            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Confirm
              </button>
            </div>
          )}

          {/* Next button — appears after answering */}
          {selected !== null && (
            <div className="flex justify-end">
              <button
                onClick={() => advanceRound()}
                className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fixed score bar */}
      {settings.mode !== 'study' && (
        <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-line px-6 py-3 flex items-center justify-between z-10 print:hidden">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-brand-ink">
              {score.correct}
              <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
            </span>
            {score.streak >= 2 && (
              <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
            )}
            {settings.mode === 'plan' && planPracticing ? (
              <span className={cn(
                'text-sm font-medium tabular-nums',
                score.total >= 20 && accuracy >= 85 ? 'text-green-600' : 'text-brand-secondary'
              )}>
                {score.total} / 20 rounds · {accuracy}%
              </span>
            ) : weakNotes.length > 0 && (
              <span className="text-brand-secondary">
                Weak: <span className="text-brand-ink font-medium">
                  {weakNotes.slice(0, 3).map(e => e.note.replace(/\d$/, '')).join(' · ')}
                </span>
              </span>
            )}
          </div>
          {settings.mode !== 'plan' && (
            <button
              onClick={() => setShowSummary(true)}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      )}

      {/* Plan stage complete modal */}
      {showPlanComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface rounded-xl border border-brand-line p-6 max-w-sm w-full space-y-4 text-center">
            <h2 className="text-xl font-serif font-bold text-brand-ink">
              {showPlanComplete.isFinal ? 'Plan complete! 🎉' : 'Stage complete!'}
            </h2>
            <p className="text-brand-secondary text-sm">
              {showPlanComplete.stageLabel} — {showPlanComplete.accuracy}% accuracy
            </p>
            {showPlanComplete.isFinal ? (
              <button
                onClick={() => {
                  setPlanProgress(resetPlanProgress());
                  setShowPlanComplete(null);
                }}
                className="w-full py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Start over
              </button>
            ) : (
              <button
                onClick={() => setShowPlanComplete(null)}
                className="w-full py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Continue → {PLAN_STAGES[planProgress.stageIndex].label}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Session summary modal */}
      {showSummary && settings.mode !== 'study' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="bg-brand-surface rounded-xl border border-brand-line p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-serif font-bold text-brand-ink">Session Complete</h2>
            <p className="text-brand-ink">
              <span className="text-2xl font-bold">{score.correct}</span>
              <span className="text-brand-secondary"> / {score.total} correct</span>
              <span className="ml-2 text-sm text-brand-secondary">({accuracy}%)</span>
            </p>

            {settings.mode === 'fretboard' ? (
              weakNotes.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-line text-left">
                      <th className="pb-1.5 font-medium text-brand-secondary">Note</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Wrong</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Attempted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weakNotes.map(({ note, wrong, total }) => (
                      <tr key={note} className="border-b border-brand-line/40">
                        <td className="py-1.5 text-brand-ink">{note.replace(/\d$/, '')}</td>
                        <td className="py-1.5 text-right text-red-500 font-medium">{wrong}</td>
                        <td className="py-1.5 text-right text-brand-secondary">{total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              Object.keys(score.byType).length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-line text-left">
                      <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Correct</th>
                      <th className="pb-1.5 font-medium text-brand-secondary text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(score.byType).map(([type, data]: [string, { correct: number; total: number }]) => (
                      <tr key={type} className="border-b border-brand-line/40">
                        <td className="py-1.5 text-brand-ink">{type}</td>
                        <td className="py-1.5 text-right text-green-600 font-medium">{data.correct}</td>
                        <td className="py-1.5 text-right text-brand-secondary">{data.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {score.huntAttempts && score.huntAttempts.length > 0 && (
              <div className="pt-2 border-t border-brand-line space-y-1">
                <p className="text-sm font-medium text-brand-ink">Hunt Mode</p>
                <p className="text-xs text-brand-secondary">
                  Avg stars: {((score.totalStars ?? 0) / score.huntAttempts.length).toFixed(1)} / 3
                  &nbsp;·&nbsp;
                  Avg attempts: {(score.huntAttempts.reduce((a, b) => a + b, 0) / score.huntAttempts.length).toFixed(1)}
                </p>
                {biasTally.sharp > biasTally.flat + 2 && (
                  <p className="text-xs text-brand-secondary">Tendency: guessing sharp ↑</p>
                )}
                {biasTally.flat > biasTally.sharp + 2 && (
                  <p className="text-xs text-brand-secondary">Tendency: guessing flat ↓</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleStartOver}
                className="flex-1 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 py-2 rounded-lg border border-brand-line text-brand-secondary text-sm font-medium hover:border-brand-primary hover:text-brand-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
