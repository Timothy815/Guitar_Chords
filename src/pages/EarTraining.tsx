import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronDown, ChevronUp, Headphones, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import {
  EarTrainingSettings, ChordRound, IntervalRound, FretboardRound, HuntResult, FretboardFocus, Round, SessionScore, StudyCard,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, generateStudyDeck, generateFretboardRound,
  buildFretboardNotePool, makeFretboardRound, buildKeyboardNotePool,
  chordToNotes, playOptionAudio, playStudyCard,
} from '../lib/earTraining';
import { initAudio, playStrum, playNote, startDrone, stopDrone, stopRhythm } from '../lib/audio';
import { FretboardTrainer } from '../components/FretboardTrainer';
import { PianoTrainer } from '../components/PianoTrainer';
import { FretboardFocusSelector } from '../components/FretboardFocusSelector';
import { LadderId, LadderStage, SkillLadder, SKILL_LADDERS, PlanProgress, loadPlanProgress, savePlanProgress, resetPlanProgress, isMixedUnlocked } from '../lib/planProgress';
import { HuntHistoryEntry, appendHuntEntries, loadHuntHistory } from '../lib/huntHistory';
import {
  ChordHistoryEntry,
  appendChordEntries,
  loadChordHistory,
  mergeChordEntries,
  exportChordToCsv,
  parseChordFromCsv,
} from '../lib/chordHistory';
import {
  IntervalHistoryEntry,
  appendIntervalEntries,
  loadIntervalHistory,
  mergeIntervalEntries,
  exportIntervalToCsv,
  parseIntervalFromCsv,
} from '../lib/intervalHistory';
import { ALL_NOTES } from '../data/guitarData';
import { RhythmRound, RhythmSettings, RhythmDuration, generateRhythmRound } from '../lib/rhythmTraining';
import { RhythmTrainer } from '../components/RhythmTrainer';
import { MelodyRound, MelodySettings, generateMelodyRound } from '../lib/melodyTraining';
import { MelodyTrainer } from '../components/MelodyTrainer';

function RhythmRoundLoader({ onLoad }: { onLoad: () => void }) {
  useEffect(() => { onLoad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-center text-brand-secondary text-sm">Loading…</div>;
}

function makeRound(
  s: EarTrainingSettings,
  difficulty: DifficultyLevel = 'Beginner',
  focus: FretboardFocus = {},
): Round {
  if (s.mode === 'chord') return generateChordRound(s.activeChordTypes);
  if (s.mode === 'mixed') return Math.random() < 0.5 ? generateChordRound(s.activeChordTypes) : generateIntervalRound(s.activeIntervals);
  if (s.mode === 'fretboard') return generateFretboardRound(difficulty, focus);
  return generateIntervalRound(s.activeIntervals);
}

function huntCellColor(avg: number): string {
  if (avg <= 1.5) return '#27ae60';
  if (avg <= 2.5) return '#2ecc71';
  if (avg <= 3.5) return '#e67e22';
  if (avg <= 5.0) return '#c0392b';
  return '#922b21';
}

export function EarTraining() {
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Beginner');
  const [fretboardSubMode, setFretboardSubMode] = useState<'guess' | 'hunt' | 'sing' | 'singhunt'>('guess');
  const [biasTally, setBiasTally] = useState({ sharp: 0, flat: 0, correct: 0 });
  const [fretboardFocus, setFretboardFocus] = useState<FretboardFocus>({});
  const [pianoView, setPianoView] = useState(false);
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
  const roundStartTimeRef = useRef<number>(Date.now());
  const [planProgress, setPlanProgress] = useState<PlanProgress>(loadPlanProgress);
  const [planPracticing, setPlanPracticing] = useState(false);
  const [activeLadder, setActiveLadder] = useState<LadderId | null>(null);
  const [rhythmSettings, setRhythmSettings] = useState<RhythmSettings>({
    timeSignature: '4/4',
    enabledDurations: ['h', 'q'],
    enableRests: false,
    bpm: 80,
    enableLeadIn: true,
    showCount: false,
  });
  const [showPlanComplete, setShowPlanComplete] = useState<{ accuracy: number; stageLabel: string; isFinal: boolean } | null>(null);
  const [huntSessionRounds, setHuntSessionRounds] = useState<Array<{ firstTapSemitones: number; tapCount: number }>>([]);
  const practiceImportRef = useRef<HTMLInputElement>(null);
  const [practiceImportMsg, setPracticeImportMsg] = useState<string | null>(null);

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
    if (r.kind === 'rhythm') return;
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

  function advanceRound(s: EarTrainingSettings = settings, focusOverride?: FretboardFocus, pianoViewOverride?: boolean) {
    const activeFocus = focusOverride ?? fretboardFocus;
    const effectiveMode = s.mode === 'plan' && activeLadder
      ? SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!.mode
      : s.mode;
    let r: Round;
    if (effectiveMode === 'fretboard') {
      const activePianoView = pianoViewOverride !== undefined ? pianoViewOverride : pianoView;
      let note: string;
      if (activePianoView) {
        const kbPool = buildKeyboardNotePool(activeFocus.octaveMin ?? 2, activeFocus.octaveMax ?? 4);
        note = kbPool[Math.floor(Math.random() * kbPool.length)];
        r = makeFretboardRound(note, 13);
      } else {
        note = nextFretboardNote(difficulty, activeFocus);
        r = makeFretboardRound(note, FRETS_FOR[difficulty]);
      }
    } else if (effectiveMode === 'rhythm') {
      const rr = generateRhythmRound(difficulty, rhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'melody') {
      const mr = generateMelodyRound(difficulty, settings.melodySettings);
      setSelected(null);
      setTentative(null);
      setRound(mr);
      roundStartTimeRef.current = Date.now();
      return;
    } else if (effectiveMode === 'mixed') {
      r = Math.random() < 0.5
        ? generateChordRound(s.activeChordTypes)
        : generateIntervalRound(s.activeIntervals);
    } else {
      r = makeRound({ ...s, mode: effectiveMode }, difficulty, activeFocus);
    }
    setSelected(null);
    setTentative(null);
    setRound(r);
    roundStartTimeRef.current = Date.now();
  }

  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }

  function handleStudyMode() {
    setSettings(s => ({ ...s, mode: 'study' }));
  }

  function handleFretboardDifficulty(level: DifficultyLevel | 'Hunt' | 'SingHunt') {
    if (level === 'Hunt') {
      setFretboardSubMode('hunt');
      setHuntSessionRounds([]);
      setDifficulty('Advanced');
    } else if (level === 'SingHunt') {
      setFretboardSubMode('singhunt');
      setHuntSessionRounds([]);
      setDifficulty('Advanced');
    } else {
      if (fretboardSubMode !== 'sing') { setFretboardSubMode('guess'); setHuntSessionRounds([]); }
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
    setActiveLadder(null);
  }

  function handleRhythmMode() {
    stopRhythm();
    const next = { ...settings, mode: 'rhythm' as const };
    setSettings(next);
    advanceRound(next);
  }

  function handleRhythmComplete(wasCorrect: boolean) {
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        setTimeout(() => handlePlanAdvance(newCorrect / newTotal), 400);
        return;
      }
    }
    setTimeout(() => advanceRound(), 400);
  }

  function handleMelodyMode() {
    const next = { ...settings, mode: 'melody' as const };
    setSettings(next);
    advanceRound(next);
  }

  function handleMelodyComplete(wasCorrect: boolean) {
    const newCorrect = score.correct + (wasCorrect ? 1 : 0);
    const newTotal = score.total + 1;
    setScore(s => ({
      ...s,
      correct: wasCorrect ? s.correct + 1 : s.correct,
      total: s.total + 1,
      streak: wasCorrect ? s.streak + 1 : 0,
    }));
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        setTimeout(() => handlePlanAdvance(newCorrect / newTotal), 400);
        return;
      }
    }
    setTimeout(() => advanceRound(), 400);
  }

  function handlePlanStart(ladderId: LadderId) {
    const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === ladderId)!;
    const stageIdx = planProgress[ladderId].stageIndex;
    const stage = ladder.stages[stageIdx];
    const next: EarTrainingSettings = {
      ...settings,
      mode: 'plan' as const,
      activeChordTypes: (ladder.mode === 'chord' || ladder.mode === 'mixed')
        ? [...DIFFICULTY_PRESETS.chord[stage.difficulty]]
        : settings.activeChordTypes,
      activeIntervals: (ladder.mode === 'interval' || ladder.mode === 'mixed')
        ? [...DIFFICULTY_PRESETS.interval[stage.difficulty]]
        : settings.activeIntervals,
      melodySettings: stage.melodyShowFirstNote !== undefined
        ? { ...settings.melodySettings, showFirstNote: stage.melodyShowFirstNote }
        : settings.melodySettings,
    };
    setActiveLadder(ladderId);
    setSettings(next);
    setDifficulty(stage.difficulty);
    setFretboardSubMode(stage.subMode ?? 'guess');
    setHuntSessionRounds([]);
    setScore(initialScore());
    deckRef.current = [];
    deckKeyRef.current = '';
    setPlanPracticing(true);
    if (ladder.mode === 'rhythm' && stage.rhythmDurations) {
      const newRhythmSettings = { ...rhythmSettings, enabledDurations: stage.rhythmDurations };
      setRhythmSettings(newRhythmSettings);
      const rr = generateRhythmRound(stage.difficulty, newRhythmSettings);
      setSelected(null);
      setTentative(null);
      setRound(rr);
      roundStartTimeRef.current = Date.now();
    } else {
      advanceRound(next);
    }
  }

  function handlePlanAdvance(accuracyFraction: number) {
    if (activeLadder === null) return;
    const accuracyPct = Math.round(accuracyFraction * 100);
    const ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
    const currentStageIdx = planProgress[activeLadder].stageIndex;
    const nextStageIdx = currentStageIdx + 1;
    const isFinal = nextStageIdx >= ladder.stages.length;
    const updatedProgress: PlanProgress = {
      ...planProgress,
      [activeLadder]: {
        stageIndex: isFinal ? currentStageIdx : nextStageIdx,
        completedStages: {
          ...planProgress[activeLadder].completedStages,
          [currentStageIdx]: {
            accuracy: accuracyPct,
            completedAt: new Date().toISOString(),
          },
        },
      },
    };
    setPlanProgress(updatedProgress);
    setScore(initialScore());
    setPlanPracticing(false);
    setActiveLadder(null);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setShowPlanComplete({
      accuracy: accuracyPct,
      stageLabel: `${ladder.label} · ${ladder.stages[currentStageIdx].label}`,
      isFinal,
    });
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
    if (huntResult && wasCorrect) {
      const fr = round as FretboardRound;
      const match = fr.targetNote.match(/^([A-G]#?)(\d)$/);
      if (match) {
        const entry: HuntHistoryEntry = {
          date: new Date().toISOString().slice(0, 10),
          note: match[1],
          octave: parseInt(match[2], 10),
          firstTapSemitones: huntResult.firstSelectionSemitones,
          tapCount: huntResult.selectionCount,
          fretMin: fretboardFocus.fretMin ?? 0,
          fretMax: fretboardFocus.fretMax ?? FRETS_FOR[difficulty],
        };
        appendHuntEntries([entry]);
      }
      setHuntSessionRounds(prev => [
        ...prev,
        { firstTapSemitones: huntResult.firstSelectionSemitones, tapCount: huntResult.selectionCount },
      ]);
    }
    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
        return;
      }
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

    // Record to persistent history
    const responseTimeMs = Date.now() - roundStartTimeRef.current;
    if (round.kind === 'chord') {
      const cr = round as ChordRound;
      appendChordEntries([{
        date: new Date().toISOString().slice(0, 10),
        typeLabel: cr.correct.typeLabel,
        rootNote: cr.correct.root,
        correct: isCorrect,
        responseTimeMs,
      }]);
    } else if (round.kind === 'interval') {
      const ir = round as IntervalRound;
      appendIntervalEntries([{
        date: new Date().toISOString().slice(0, 10),
        label: ir.correct.label,
        rootNote: ir.correct.rootNote,
        correct: isCorrect,
        responseTimeMs,
      }]);
    }

    if (settings.mode === 'plan' && planPracticing && activeLadder !== null) {
      const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
      const _stage = _ladder.stages[planProgress[activeLadder].stageIndex];
      if (newTotal >= _stage.requiredRounds && newCorrect / newTotal >= _stage.requiredAccuracy) {
        handlePlanAdvance(newCorrect / newTotal);
      }
    }
  }

  function handleStartOver() {
    deckRef.current = [];
    deckKeyRef.current = '';
    setScore(initialScore());
    setBiasTally({ sharp: 0, flat: 0, correct: 0 });
    setFretboardFocus({});
    setShowSummary(false);
    setHuntSessionRounds([]);
    advanceRound(settings, {});
  }

  function handlePracticeExport() {
    const [csv, filename] = settings.mode === 'chord'
      ? [exportChordToCsv(loadChordHistory()), 'guitar-chord-stats.csv']
      : [exportIntervalToCsv(loadIntervalHistory()), 'guitar-interval-stats.csv'];
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function handlePracticeImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        if (settings.mode === 'chord') {
          const parsed = parseChordFromCsv(text);
          mergeChordEntries(parsed);
          setPracticeImportMsg(`Imported ${parsed.length} rows`);
        } else {
          const parsed = parseIntervalFromCsv(text);
          mergeIntervalEntries(parsed);
          setPracticeImportMsg(`Imported ${parsed.length} rows`);
        }
      } catch {
        setPracticeImportMsg('Import failed — check file format');
      }
      if (practiceImportRef.current) practiceImportRef.current.value = '';
    };
    reader.readAsText(file);
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

  const sessionAvgSemitones = huntSessionRounds.length >= 3
    ? huntSessionRounds.reduce((s, r) => s + r.firstTapSemitones, 0) / huntSessionRounds.length
    : undefined;
  const sessionAvgTaps = huntSessionRounds.length >= 3
    ? huntSessionRounds.reduce((s, r) => s + r.tapCount, 0) / huntSessionRounds.length
    : undefined;

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
        <button
          onClick={handleRhythmMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'rhythm'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Rhythm
        </button>
        <button
          onClick={handleMelodyMode}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            settings.mode === 'melody'
              ? 'bg-brand-primary text-white'
              : 'text-brand-secondary hover:bg-brand-sidebar'
          )}
        >
          Melody
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
                      settings.mode === 'fretboard' && (fretboardSubMode === 'guess' || fretboardSubMode === 'sing') && difficulty === level && fretboardSubMode !== 'singhunt'
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
                    onClick={() => { setFretboardSubMode('sing'); setHuntSessionRounds([]); advanceRound(); }}
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
                {settings.mode === 'fretboard' && (
                  <button
                    onClick={() => handleFretboardDifficulty('SingHunt')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      fretboardSubMode === 'singhunt'
                        ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary'
                    )}
                  >
                    Sing+Hunt
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

            {/* Rhythm settings — rhythm mode only */}
            {settings.mode === 'rhythm' && (
              <div className="pt-3 space-y-3 border-t border-brand-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary">Rhythm Settings</p>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">Time Signature</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['4/4', '2/4', '3/4', '6/8'] as const).map(ts => (
                      <button
                        key={ts}
                        onClick={() => setRhythmSettings(r => ({ ...r, timeSignature: ts }))}
                        className={cn(
                          'px-3 py-1 rounded text-xs font-medium border transition-colors',
                          rhythmSettings.timeSignature === ts
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                        )}
                      >
                        {ts}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">BPM: {rhythmSettings.bpm}</p>
                  <input
                    type="range"
                    min={40}
                    max={160}
                    step={5}
                    value={rhythmSettings.bpm}
                    onChange={e => setRhythmSettings(r => ({ ...r, bpm: Number(e.target.value) }))}
                    className="w-full accent-brand-primary"
                  />
                </div>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">Note Types</p>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { dur: 'w' as RhythmDuration, label: 'Whole' },
                      { dur: 'h' as RhythmDuration, label: 'Half' },
                      { dur: 'hd' as RhythmDuration, label: 'Dotted Half' },
                      { dur: 'q' as RhythmDuration, label: 'Quarter' },
                      { dur: 'qd' as RhythmDuration, label: 'Dotted Quarter' },
                      { dur: '8' as RhythmDuration, label: 'Eighth' },
                      { dur: '16' as RhythmDuration, label: 'Sixteenth' },
                    ]).map(({ dur, label }) => {
                      const active = rhythmSettings.enabledDurations.includes(dur);
                      return (
                        <button
                          key={dur}
                          onClick={() =>
                            setRhythmSettings(r => ({
                              ...r,
                              enabledDurations: active
                                ? r.enabledDurations.length > 1
                                  ? r.enabledDurations.filter(d => d !== dur)
                                  : r.enabledDurations
                                : [...r.enabledDurations, dur],
                            }))
                          }
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                            active
                              ? 'bg-brand-primary text-white border-brand-primary'
                              : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setRhythmSettings(r => ({ ...r, enableRests: !r.enableRests }))}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium border transition-colors',
                      rhythmSettings.enableRests
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                    )}
                  >
                    {rhythmSettings.enableRests ? 'Rests: On' : 'Rests: Off'}
                  </button>
                  <button
                    onClick={() => setRhythmSettings(r => ({ ...r, enableLeadIn: !r.enableLeadIn }))}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium border transition-colors',
                      rhythmSettings.enableLeadIn
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                    )}
                  >
                    {rhythmSettings.enableLeadIn ? 'Count-in: On' : 'Count-in: Off'}
                  </button>
                  <button
                    onClick={() => setRhythmSettings(r => ({ ...r, showCount: !r.showCount }))}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium border transition-colors',
                      rhythmSettings.showCount
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                    )}
                  >
                    {rhythmSettings.showCount ? 'Count: On' : 'Count: Off'}
                  </button>
                </div>
              </div>
            )}

            {/* Melody settings — melody mode only */}
            {settings.mode === 'melody' && (
              <div className="pt-3 space-y-3 border-t border-brand-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-secondary">Melody Settings</p>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">Root Key</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['random', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).map(key => (
                      <button
                        key={key}
                        onClick={() => setSettings(s => ({ ...s, melodySettings: { ...s.melodySettings, rootKey: key } }))}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                          settings.melodySettings.rootKey === key
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                        )}
                      >
                        {key === 'random' ? 'Random' : key}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-brand-secondary mb-1.5">BPM: {settings.melodySettings.bpm}</p>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    step={5}
                    value={settings.melodySettings.bpm}
                    onChange={e => setSettings(s => ({ ...s, melodySettings: { ...s.melodySettings, bpm: Number(e.target.value) } }))}
                    className="w-full accent-brand-primary"
                  />
                </div>

                <div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, melodySettings: { ...s.melodySettings, showFirstNote: !s.melodySettings.showFirstNote } }))}
                    className={cn(
                      'px-3 py-1.5 rounded text-xs font-medium border transition-colors',
                      settings.melodySettings.showFirstNote
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-line text-brand-secondary hover:border-brand-primary/60',
                    )}
                  >
                    {settings.melodySettings.showFirstNote ? 'First note: Given' : 'First note: Hidden'}
                  </button>
                </div>
              </div>
            )}

            {/* Weakest types hint + Export/Import — chord/interval only */}
            {(settings.mode === 'chord' || settings.mode === 'interval') && (() => {
              const history = (settings.mode === 'chord' ? loadChordHistory() : loadIntervalHistory()) as Array<ChordHistoryEntry | IntervalHistoryEntry>;
              const stats: Record<string, { correct: number; total: number }> = {};
              for (const e of history) {
                const k = settings.mode === 'chord'
                  ? (e as unknown as ChordHistoryEntry).typeLabel
                  : (e as unknown as IntervalHistoryEntry).label;
                if (!stats[k]) stats[k] = { correct: 0, total: 0 };
                if (e.correct) stats[k].correct++;
                stats[k].total++;
              }
              const weakest = Object.entries(stats)
                .filter(([, d]) => d.total >= 5)
                .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
                .slice(0, 3)
                .map(([type, d]) => `${type} (${Math.round((d.correct / d.total) * 100)}%)`);
              return (
                <div className="space-y-2 pt-1">
                  {weakest.length >= 3 && (
                    <p className="text-xs text-brand-secondary">
                      Weakest: {weakest.join(' · ')}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={handlePracticeExport}
                      className="px-2.5 py-1 text-xs border border-brand-line text-brand-secondary rounded hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => practiceImportRef.current?.click()}
                      className="px-2.5 py-1 text-xs border border-brand-line text-brand-secondary rounded hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      Import CSV
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={practiceImportRef}
                      className="hidden"
                      onChange={handlePracticeImport}
                    />
                    {practiceImportMsg && (
                      <p className={`text-xs ${practiceImportMsg.startsWith('Import failed') ? 'text-red-500' : 'text-green-600'}`}>
                        {practiceImportMsg}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      )}

      {/* Plan tab body — dashboard grid rendered by Task 4 */}
      {settings.mode === 'plan' && (
        <>
          {/* Collapsed header while practicing */}
          {planPracticing && activeLadder !== null && (() => {
            const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
            const _stageIdx = planProgress[activeLadder].stageIndex;
            const _stage = _ladder.stages[_stageIdx];
            return (
              <div className="rounded-lg border border-brand-line bg-brand-surface overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-ink">
                    {_ladder.label} · {_stage.label} · Stage {_stageIdx + 1} of {_ladder.stages.length}
                  </span>
                  <button
                    onClick={() => { setPlanPracticing(false); setActiveLadder(null); }}
                    className="text-xs text-brand-secondary hover:text-brand-primary transition-colors"
                  >
                    View ladders ↑
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Skill ladder cards — placeholder for Task 4 dashboard grid */}
          {!planPracticing && (
            <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-2">
              {SKILL_LADDERS.map((ladder: SkillLadder) => {
                const ladderProgress = planProgress[ladder.id];
                const stageIdx = ladderProgress.stageIndex;
                const isFinal = stageIdx >= ladder.stages.length;
                const stage = isFinal ? ladder.stages[ladder.stages.length - 1] : ladder.stages[stageIdx];
                const completed = isFinal;
                return (
                  <div key={ladder.id} className="flex items-center gap-3 py-2 border-b border-brand-line last:border-0">
                    <span className="w-5 shrink-0 flex items-center justify-center">
                      {completed
                        ? <Check size={14} className="text-green-500" />
                        : <span className="text-brand-primary font-bold text-sm">→</span>}
                    </span>
                    <span className="flex-1 text-sm font-medium text-brand-ink">
                      {ladder.label}
                      <span className="ml-2 text-xs font-normal text-brand-secondary">
                        {completed ? 'Complete' : `Stage ${stageIdx + 1}/${ladder.stages.length} · ${stage.label}`}
                      </span>
                    </span>
                    {!completed && (
                      <button
                        onClick={() => handlePlanStart(ladder.id)}
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

          {/* Practice area — only shown after Start is clicked */}
          {planPracticing && activeLadder !== null && (() => {
            const _ladder = SKILL_LADDERS.find((l: SkillLadder) => l.id === activeLadder)!;
            const _stageIdx = planProgress[activeLadder].stageIndex;
            const _stage = _ladder.stages[_stageIdx];
            if (_ladder.mode === 'fretboard') {
              return (
                <FretboardTrainer
                  round={round as FretboardRound}
                  difficulty={difficulty}
                  score={score}
                  isHuntMode={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt'}
                  singMode={fretboardSubMode === 'sing' || fretboardSubMode === 'singhunt'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
                  sessionAvgSemitones={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgSemitones : undefined}
                  sessionAvgTaps={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgTaps : undefined}
                  onComplete={handleFretboardComplete}
                />
              );
            }
            if (_ladder.mode === 'rhythm') {
              return round.kind === 'rhythm' ? (
                <RhythmTrainer
                  round={round as RhythmRound}
                  score={score}
                  settings={rhythmSettings}
                  onComplete={handleRhythmComplete}
                />
              ) : (
                <RhythmRoundLoader onLoad={() => advanceRound()} />
              );
            }
            if (_ladder.mode === 'melody') {
              return round.kind === 'melody' ? (
                <MelodyTrainer
                  round={round as MelodyRound}
                  score={score}
                  settings={settings.melodySettings}
                  difficulty={difficulty}
                  onComplete={handleMelodyComplete}
                />
              ) : (
                <RhythmRoundLoader onLoad={() => advanceRound()} />
              );
            }
            // chord / interval / mixed
            void _stage;
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
      {settings.mode !== 'plan' && (
        <>
          {settings.mode === 'fretboard' ? (
            <div className="space-y-3">
              {/* Fretboard | Piano toggle */}
              <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-brand-sidebar border border-brand-line w-fit mx-auto">
                <button
                  onClick={() => { setPianoView(false); advanceRound(settings, undefined, false); }}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                    !pianoView
                      ? 'bg-brand-surface text-brand-ink shadow-sm'
                      : 'text-brand-secondary hover:text-brand-ink',
                  )}
                >
                  Fretboard
                </button>
                <button
                  onClick={() => { setPianoView(true); advanceRound(settings, undefined, true); }}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                    pianoView
                      ? 'bg-brand-surface text-brand-ink shadow-sm'
                      : 'text-brand-secondary hover:text-brand-ink',
                  )}
                >
                  Piano
                </button>
              </div>

              {pianoView ? (
                <div className="space-y-2">
                  <PianoTrainer
                    round={round as FretboardRound}
                    score={score}
                    octaveMin={fretboardFocus.octaveMin ?? 2}
                    octaveMax={fretboardFocus.octaveMax ?? 4}
                    mode={fretboardSubMode}
                    droneNote={droneNote}
                    droneMode={droneMode}
                    onComplete={handleFretboardComplete}
                  />
                  <FretboardFocusSelector
                    focus={fretboardFocus}
                    onChange={handleFocusChange}
                    octaveOnly
                  />
                </div>
              ) : (
                <FretboardTrainer
                  round={round as FretboardRound}
                  difficulty={difficulty}
                  score={score}
                  isHuntMode={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt'}
                  singMode={fretboardSubMode === 'sing' || fretboardSubMode === 'singhunt'}
                  focus={fretboardFocus}
                  onFocusChange={handleFocusChange}
                  droneNote={droneNote}
                  droneMode={droneMode}
                  sessionAvgSemitones={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgSemitones : undefined}
                  sessionAvgTaps={fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt' ? sessionAvgTaps : undefined}
                  onComplete={handleFretboardComplete}
                />
              )}
            </div>
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
          ) : settings.mode === 'rhythm' ? (
            round.kind === 'rhythm' ? (
              <RhythmTrainer
                round={round as RhythmRound}
                score={score}
                settings={rhythmSettings}
                onComplete={handleRhythmComplete}
              />
            ) : (
              <RhythmRoundLoader onLoad={() => advanceRound()} />
            )
          ) : settings.mode === 'melody' ? (
            round.kind === 'melody' ? (
              <MelodyTrainer
                round={round as MelodyRound}
                score={score}
                settings={settings.melodySettings}
                difficulty={difficulty}
                onComplete={handleMelodyComplete}
              />
            ) : (
              <RhythmRoundLoader onLoad={() => advanceRound()} />
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
        </>
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
                Continue
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
              Object.keys(score.byType).length > 0 && (() => {
                // Normalize to common shape for easier processing
                const typeEntries: Array<{ date: string; type: string; correct: boolean; responseTimeMs: number }> =
                  settings.mode === 'chord'
                    ? loadChordHistory().map(e => ({ date: e.date, type: e.typeLabel, correct: e.correct, responseTimeMs: e.responseTimeMs }))
                    : loadIntervalHistory().map(e => ({ date: e.date, type: e.label, correct: e.correct, responseTimeMs: e.responseTimeMs }));

                // All-time stats per type
                const allTime: Record<string, { correct: number; total: number; totalRtMs: number }> = {};
                for (const e of typeEntries) {
                  if (!allTime[e.type]) allTime[e.type] = { correct: 0, total: 0, totalRtMs: 0 };
                  if (e.correct) allTime[e.type].correct++;
                  allTime[e.type].total++;
                  allTime[e.type].totalRtMs += e.responseTimeMs;
                }

                // Rows: types from this session, sorted weakest first
                const rows = Object.keys(score.byType)
                  .map(type => {
                    const d = allTime[type] ?? { correct: 0, total: 0, totalRtMs: 0 };
                    return {
                      type,
                      acc: d.total > 0 ? d.correct / d.total : 0,
                      avgRtS: d.total > 0 ? d.totalRtMs / d.total / 1000 : 0,
                      hasData: d.total > 0,
                    };
                  })
                  .sort((a, b) => a.acc - b.acc);

                // Sparkline: overall accuracy per calendar date, last 8 dates with ≥3 entries
                const byDate: Record<string, { correct: number; total: number }> = {};
                for (const e of typeEntries) {
                  if (!byDate[e.date]) byDate[e.date] = { correct: 0, total: 0 };
                  if (e.correct) byDate[e.date].correct++;
                  byDate[e.date].total++;
                }
                const sparkDates = Object.entries(byDate)
                  .filter(([, d]) => d.total >= 3)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-8);
                const sparkPoints = sparkDates.map(([, d]) => (d.correct / d.total) * 100);

                // Weakest types: ≥5 attempts, bottom 3 by accuracy
                const weakest = Object.entries(allTime)
                  .filter(([, d]) => d.total >= 5)
                  .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
                  .slice(0, 3)
                  .map(([type, d]) => `${type} (${Math.round((d.correct / d.total) * 100)}%)`);

                const accColor = (acc: number) =>
                  acc >= 0.8 ? '#27ae60' : acc >= 0.6 ? '#f1c40f' : '#c0392b';

                return (
                  <div className="space-y-3">
                    {/* Per-type accuracy table */}
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-brand-line text-left">
                          <th className="pb-1.5 font-medium text-brand-secondary">Type</th>
                          <th className="pb-1.5 font-medium text-brand-secondary text-right">All-time</th>
                          <th className="pb-1.5 font-medium text-brand-secondary text-right">Avg time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ type, acc, avgRtS, hasData }) => (
                          <tr key={type} className="border-b border-brand-line/40">
                            <td className="py-1.5 text-brand-ink">{type}</td>
                            <td
                              className="py-1.5 text-right font-medium"
                              style={{ color: hasData ? accColor(acc) : undefined }}
                            >
                              {hasData ? `${Math.round(acc * 100)}%` : '—'}
                            </td>
                            <td className="py-1.5 text-right text-brand-secondary">
                              {hasData ? `${avgRtS.toFixed(1)}s` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Sparkline */}
                    {sparkPoints.length >= 2 && (() => {
                      const W = 300, H = 48, PAD = 6;
                      const plotW = W - 2 * PAD;
                      const plotH = H - 2 * PAD;
                      const pts = sparkPoints.map((v, i) => ({
                        x: PAD + (i / (sparkPoints.length - 1)) * plotW,
                        y: PAD + (1 - v / 100) * plotH,
                      }));
                      const last = sparkPoints[sparkPoints.length - 1];
                      const lineColor = last >= 80 ? '#27ae60' : last >= 60 ? '#f1c40f' : '#c0392b';
                      return (
                        <div>
                          <p className="text-xs text-brand-secondary mb-1">
                            Accuracy trend (last {sparkPoints.length} sessions)
                          </p>
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
                            <polyline
                              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke={lineColor}
                              strokeWidth="2"
                            />
                            {pts.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} />
                            ))}
                          </svg>
                        </div>
                      );
                    })()}

                    {/* Weakest types */}
                    {weakest.length >= 3 && (
                      <p className="text-xs text-brand-secondary">
                        Focus on: {weakest.join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })()
            )}

            {(fretboardSubMode === 'hunt' || fretboardSubMode === 'singhunt') && score.huntAttempts && score.huntAttempts.length > 0 && (() => {
              const huntHistory = loadHuntHistory();

              // Sparkline: last 8 calendar dates with ≥5 entries
              const byDate: Record<string, HuntHistoryEntry[]> = {};
              for (const e of huntHistory) {
                (byDate[e.date] ??= []).push(e);
              }
              const sparkDates = Object.entries(byDate)
                .filter(([, es]) => es.length >= 5)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-8);
              const sparkPoints = sparkDates.map(([, es]) =>
                es.reduce((s, e) => s + e.firstTapSemitones, 0) / es.length,
              );

              // Grid: note×octave heatmap
              const OCTAVES = [2, 3, 4];
              const reachableSet = new Set(buildFretboardNotePool(difficulty, fretboardFocus));
              const cellData: Record<string, { sum: number; count: number }> = {};
              for (const e of huntHistory) {
                const key = `${e.note}${e.octave}`;
                if (!cellData[key]) cellData[key] = { sum: 0, count: 0 };
                cellData[key].sum += e.firstTapSemitones;
                cellData[key].count += 1;
              }

              // Readiness
              const fMin = fretboardFocus.fretMin ?? 0;
              const fMax = fretboardFocus.fretMax ?? FRETS_FOR[difficulty];
              const rangeEntries = huntHistory.filter(e => e.fretMin === fMin && e.fretMax === fMax);
              const rangeByDate: Record<string, HuntHistoryEntry[]> = {};
              for (const e of rangeEntries) {
                (rangeByDate[e.date] ??= []).push(e);
              }
              const last3 = Object.entries(rangeByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-3);
              const qualDates = last3.filter(([, es]) => es.length >= 15);
              const allQual = qualDates.flatMap(([, es]) => es);
              const crit1 = qualDates.length === 3;
              const crit2 = allQual.length > 0 && allQual.reduce((s, e) => s + e.firstTapSemitones, 0) / allQual.length <= 2.0;
              const crit3 = allQual.length > 0 && allQual.reduce((s, e) => s + e.tapCount, 0) / allQual.length <= 1.5;
              const critCount = [crit1, crit2, crit3].filter(Boolean).length;
              const readinessMsg =
                critCount === 3
                  ? { text: "You've nailed this range. Try adding more frets to your focus.", cls: 'text-green-600' }
                  : critCount >= 2
                    ? { text: "Solid progress. Keep at it — 3 consistent sessions and you're ready to expand.", cls: 'text-yellow-600' }
                    : { text: "Keep hunting. Focus on the red cells — those notes need more reps.", cls: 'text-brand-secondary' };

              return (
                <div className="pt-2 border-t border-brand-line space-y-3">
                  {/* Stars + bias summary */}
                  <div className="space-y-1">
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

                  {/* Sparkline */}
                  {sparkPoints.length >= 2 && (() => {
                    const W = 300, H = 48, PAD = 6;
                    const plotW = W - 2 * PAD;
                    const plotH = H - 2 * PAD;
                    const maxY = 6;
                    const pts = sparkPoints.map((v, i) => {
                      const x = PAD + (i / (sparkPoints.length - 1)) * plotW;
                      const y = PAD + (1 - Math.min(v, maxY) / maxY) * plotH;
                      return { x, y };
                    });
                    const lineColor = (() => {
                      const last = sparkPoints[sparkPoints.length - 1];
                      if (last <= 1.5) return '#27ae60';
                      if (last <= 3.0) return '#f1c40f';
                      return '#c0392b';
                    })();
                    return (
                      <div>
                        <p className="text-xs text-brand-secondary mb-1">Trend (last {sparkPoints.length} sessions)</p>
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
                          <polyline
                            points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="2"
                          />
                          {pts.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} />
                          ))}
                        </svg>
                      </div>
                    );
                  })()}

                  {/* Note×octave grid */}
                  <div>
                    <p className="text-xs text-brand-secondary mb-1">Note accuracy (avg semitones off — all history)</p>
                    <div className="overflow-x-auto">
                      <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(3, 1fr)', gap: '2px', minWidth: '200px' }}>
                        <div />
                        {[2, 3, 4].map(o => (
                          <div key={o} className="text-center text-xs text-brand-secondary py-1">Oct {o}</div>
                        ))}
                        {ALL_NOTES.map(note => (
                          <React.Fragment key={note}>
                            <div className="text-right text-xs text-brand-secondary pr-1 flex items-center justify-end" style={{ fontSize: '10px' }}>
                              {note}
                            </div>
                            {OCTAVES.map(oct => {
                              const key = `${note}${oct}`;
                              const isReachable = reachableSet.has(key);
                              const data = cellData[key];
                              if (!isReachable) {
                                return (
                                  <div
                                    key={oct}
                                    style={{ height: '22px', borderRadius: '3px', background: '#1e1e2e', border: '1px solid #2a2a3e' }}
                                  />
                                );
                              }
                              if (!data) {
                                return (
                                  <div
                                    key={oct}
                                    style={{ height: '22px', borderRadius: '3px', background: '#252535', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <span style={{ fontSize: '9px', color: '#555' }}>—</span>
                                  </div>
                                );
                              }
                              const avg = data.sum / data.count;
                              return (
                                <div
                                  key={oct}
                                  style={{
                                    height: '22px', borderRadius: '3px',
                                    background: huntCellColor(avg),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', fontWeight: '600', color: 'rgba(0,0,0,0.8)',
                                  }}
                                >
                                  {avg.toFixed(1)}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Readiness message */}
                  <p className={`text-xs font-medium ${readinessMsg.cls}`}>{readinessMsg.text}</p>
                </div>
              );
            })()}

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
