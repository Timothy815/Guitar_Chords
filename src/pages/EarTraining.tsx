import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronDown, ChevronUp, Headphones } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  EarTrainingSettings, ChordRound, IntervalRound, Round, SessionScore,
  DifficultyLevel, CHORD_TYPE_DEFS, INTERVAL_DEFS, DIFFICULTY_PRESETS,
  loadSettings, saveSettings, initialScore,
  generateChordRound, generateIntervalRound, chordToNotes,
} from '../lib/earTraining';
import { initAudio, playStrum, playNote } from '../lib/audio';

function makeRound(s: EarTrainingSettings): Round {
  return s.mode === 'chord'
    ? generateChordRound(s.activeChordTypes)
    : generateIntervalRound(s.activeIntervals);
}

export function EarTraining() {
  const [settings, setSettings] = useState<EarTrainingSettings>(loadSettings);
  const [round, setRound] = useState<Round>(() => makeRound(loadSettings()));
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState<SessionScore>(initialScore);
  const [showSummary, setShowSummary] = useState(false);
  const audioUnlocked = useRef(false);

  useEffect(() => { saveSettings(settings); }, [settings]);

  const playRoundAudio = useCallback(async (r: Round) => {
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

  function advanceRound(s: EarTrainingSettings = settings) {
    const r = makeRound(s);
    setSelected(null);
    setRound(r);
  }

  function handleModeChange(mode: 'chord' | 'interval') {
    const next = { ...settings, mode };
    setSettings(next);
    advanceRound(next);
  }

  function handleDifficulty(level: DifficultyLevel) {
    const next: EarTrainingSettings = {
      ...settings,
      activeChordTypes: [...DIFFICULTY_PRESETS.chord[level]],
      activeIntervals: [...DIFFICULTY_PRESETS.interval[level]],
    };
    setSettings(next);
    advanceRound(next);
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

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = round.kind === 'chord'
      ? (round as ChordRound).options[index].displayLabel === (round as ChordRound).correct.displayLabel
      : (round as IntervalRound).options[index].label === (round as IntervalRound).correct.label;

    // Track score keyed by the correct answer's display label.
    const typeKey = round.kind === 'chord'
      ? (round as ChordRound).correct.typeLabel
      : (round as IntervalRound).correct.label;

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
  }

  function handleStartOver() {
    setScore(initialScore());
    setShowSummary(false);
    advanceRound();
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

  return (
    <div className="max-w-2xl mx-auto pb-24 space-y-4">
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
      </div>

      {/* Settings panel */}
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
              <div className="flex gap-2">
                {(['Beginner', 'Intermediate', 'Advanced'] as DifficultyLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => handleDifficulty(level)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Type / interval checkboxes */}
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
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleChordType(def.id)}
                          />
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
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleToggleInterval(def.label)}
                          />
                          {def.label}
                        </label>
                      );
                    })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Round area */}
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
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={answered}
                className={cn(
                  'p-4 rounded-lg border-2 text-sm font-medium transition-colors text-center leading-snug',
                  !answered && 'border-brand-line hover:border-brand-primary hover:bg-brand-sidebar cursor-pointer text-brand-ink',
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

      {/* Fixed score bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-line px-6 py-3 flex items-center justify-between z-10 print:hidden">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-brand-ink">
            {score.correct}
            <span className="text-brand-secondary font-normal"> / {score.total} correct</span>
          </span>
          {score.streak >= 2 && (
            <span className="text-orange-500 font-medium">🔥 {score.streak} streak</span>
          )}
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Session summary modal */}
      {showSummary && (
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

            {Object.keys(score.byType).length > 0 && (
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
