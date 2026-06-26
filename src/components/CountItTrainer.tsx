import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import {
  RhythmRound, RhythmSettings, RhythmDuration,
  durationBeats, beatsPerMeasure, getCountLabel,
} from '../lib/rhythmTraining';
import { SessionScore } from '../lib/earTraining';
import { initAudio, playRhythmRound, stopRhythm, getAudioOutputLatencyMs } from '../lib/audio';
import { RhythmStaff, staffMinWidth } from './RhythmStaff';

type SlotLabel = 'N' | 'R' | 'H';

interface TapResult {
  label: string;
  offsetMs: number;
  quality: 'perfect' | 'good' | 'late' | 'early' | 'miss';
}

interface CountItTrainerProps {
  round: RhythmRound;
  score: SessionScore;
  settings: RhythmSettings;
  onComplete: (wasCorrect: boolean) => void;
}

function getAdaptiveStep(enabledDurations: RhythmDuration[]): number {
  if (enabledDurations.includes('16')) return 0.25;
  if (enabledDurations.includes('8') || enabledDurations.includes('qd')) return 0.5;
  return 1.0;
}

function spokenName(countLabel: string): string {
  if (countLabel.endsWith('+')) return 'and';
  if (countLabel.endsWith('e')) return 'e';
  if (countLabel.endsWith('a')) return 'a';
  return countLabel;
}

function beatName(countLabel: string): string {
  if (countLabel.endsWith('+')) return `${countLabel.slice(0, -1)}-and`;
  if (countLabel.endsWith('e')) return `${countLabel.slice(0, -1)}-e`;
  if (countLabel.endsWith('a')) return `${countLabel.slice(0, -1)}-a`;
  return countLabel;
}

function generateErrors(
  slots: Array<{ label: string }>,
  userLabels: (SlotLabel | null)[],
  correctLabels: SlotLabel[],
): string[] {
  const messages: string[] = [];
  let i = 0;
  while (i < correctLabels.length) {
    const cl = correctLabels[i];
    let unitEnd = i + 1;
    if (cl === 'N') {
      while (unitEnd < correctLabels.length && correctLabels[unitEnd] === 'H') unitEnd++;
    } else {
      while (unitEnd < correctLabels.length && correctLabels[unitEnd] === 'R') unitEnd++;
    }
    let firstWrong = -1;
    for (let k = i; k < unitEnd; k++) {
      if (userLabels[k] !== correctLabels[k]) { firstWrong = k; break; }
    }
    if (firstWrong !== -1) {
      const ul = userLabels[firstWrong];
      const attackBeat = beatName(slots[i].label);
      const errorBeat  = beatName(slots[firstWrong].label);
      if (cl === 'N') {
        if (firstWrong === i) {
          messages.push(ul === 'R'
            ? `Beat ${errorBeat}: a note attacks here — you marked it as a rest`
            : `Beat ${errorBeat}: a note attacks here — you marked it as held from before`);
        } else {
          messages.push(ul === 'N'
            ? `Beat ${errorBeat}: no new attack here — the note from beat ${attackBeat} is still held`
            : `Beat ${errorBeat}: the note from beat ${attackBeat} is still held — not a rest`);
        }
      } else {
        messages.push(ul === 'N'
          ? `Beat ${errorBeat}: this is a rest — no note attacks here`
          : `Beat ${errorBeat}: this is a rest — nothing is being held here`);
      }
    }
    i = unitEnd;
  }
  return messages;
}

// ── Tap timing analytics ─────────────────────────────────────────────────────

const HIST_BINS  = 40;
const HIST_MS    = 10;
const HIST_START = -200; // ms, left edge of first bin

function buildBins(offsets: number[]): number[] {
  const counts = new Array(HIST_BINS).fill(0);
  for (const ms of offsets) {
    const clamped = Math.max(HIST_START, Math.min(HIST_START + HIST_BINS * HIST_MS - 1, ms));
    const idx = Math.floor((clamped - HIST_START) / HIST_MS);
    if (idx >= 0 && idx < HIST_BINS) counts[idx]++;
  }
  return counts;
}

function TapHistogram({ offsets }: { offsets: number[] }) {
  const bins     = buildBins(offsets);
  const maxCount = Math.max(...bins, 1);

  const W = 300, H = 118;
  const mL = 24, mR = 8, mT = 8, mB = 26;
  const pW = W - mL - mR; // 268
  const pH = H - mT - mB; // 84
  const barW = pW / HIST_BINS;

  const msToX = (ms: number) => mL + (ms - HIST_START) / (HIST_BINS * HIST_MS) * pW;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Subtle zone shading */}
      {([[-30, 30, '#22c55e'], [-80, -30, '#f59e0b'], [30, 80, '#f59e0b'],
         [-200, -80, '#ef4444'], [80, 200, '#ef4444']] as [number,number,string][])
        .map(([lo, hi, fill]) => (
          <rect key={`${lo}`} x={msToX(lo)} y={mT} width={msToX(hi) - msToX(lo)} height={pH} fill={fill} opacity={0.07} />
        ))}

      {/* Bars */}
      {bins.map((count, i) => {
        const centerMs = HIST_START + (i + 0.5) * HIST_MS;
        const abs = Math.abs(centerMs);
        const fill = abs <= 30 ? '#22c55e' : abs <= 80 ? '#f59e0b' : '#ef4444';
        const bH = (count / maxCount) * pH;
        return <rect key={i} x={mL + i * barW + 0.5} y={mT + pH - bH} width={Math.max(0, barW - 1)} height={bH} fill={fill} opacity={0.85} />;
      })}

      {/* Baseline */}
      <line x1={mL} y1={mT + pH} x2={mL + pW} y2={mT + pH} stroke="currentColor" strokeWidth={1} opacity={0.2} />

      {/* Benchmark dashes at ±20, ±40, ±80 */}
      {[20, 40, 80].flatMap(ms => [
        <line key={`+${ms}`} x1={msToX(ms)}  y1={mT} x2={msToX(ms)}  y2={mT + pH} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />,
        <line key={`-${ms}`} x1={msToX(-ms)} y1={mT} x2={msToX(-ms)} y2={mT + pH} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />,
      ])}

      {/* Center line */}
      <line x1={msToX(0)} y1={mT} x2={msToX(0)} y2={mT + pH} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 2" />

      {/* x-axis labels */}
      {[-200, -100, 0, 100, 200].map(ms => (
        <text key={ms} x={msToX(ms)} y={H - 12} textAnchor="middle" fontSize={8} fill="#94a3b8">
          {ms > 0 ? `+${ms}` : `${ms}`}
        </text>
      ))}
      <text x={mL + pW / 2} y={H - 2} textAnchor="middle" fontSize={7} fill="#94a3b8">ms from beat</text>

      {/* Early / Late labels */}
      <text x={msToX(-130)} y={mT + 7} textAnchor="middle" fontSize={7} fill="#94a3b8">← early</text>
      <text x={msToX( 130)} y={mT + 7} textAnchor="middle" fontSize={7} fill="#94a3b8">late →</text>
    </svg>
  );
}

function TapTrend({ offsets }: { offsets: number[] }) {
  if (offsets.length < 8) return null;
  const win = Math.max(3, Math.round(offsets.length / 8));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + win <= offsets.length; i += Math.max(1, Math.floor(win / 2))) {
    const slice = offsets.slice(i, i + win);
    pts.push({ x: i + win / 2, y: slice.reduce((s, v) => s + Math.abs(v), 0) / slice.length });
  }
  if (pts.length < 2) return null;

  const W = 300, H = 88;
  const mL = 28, mR = 8, mT = 8, mB = 22;
  const pW = W - mL - mR; // 264
  const pH = H - mT - mB; // 58

  const maxY = Math.max(...pts.map(p => p.y), 100);
  const n    = offsets.length;
  const ptX  = (x: number) => mL + (x / n) * pW;
  const ptY  = (y: number) => mT + pH - (y / maxY) * pH;

  const poly = pts.map(p => `${ptX(p.x).toFixed(1)},${ptY(p.y).toFixed(1)}`).join(' ');
  const refs = [20, 40, 80].filter(ms => ms <= maxY * 1.1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {refs.map(ms => (
        <g key={ms}>
          <line x1={mL} y1={ptY(ms)} x2={mL + pW} y2={ptY(ms)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
          <text x={mL - 3} y={ptY(ms) + 3} textAnchor="end" fontSize={7} fill="#94a3b8">{ms}</text>
        </g>
      ))}
      <line x1={mL} y1={mT + pH} x2={mL + pW} y2={mT + pH} stroke="currentColor" strokeWidth={1} opacity={0.2} />
      <polyline points={poly} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={ptX(p.x)} cy={ptY(p.y)} r={2.5} fill="#6366f1" />)}
      <text x={mL}      y={H - 5} textAnchor="start"  fontSize={7} fill="#94a3b8">start</text>
      <text x={mL + pW} y={H - 5} textAnchor="end"    fontSize={7} fill="#94a3b8">end</text>
      <text x={mL + pW / 2} y={H - 5} textAnchor="middle" fontSize={7} fill="#94a3b8">rolling avg |error| ms</text>
    </svg>
  );
}

function SessionStatsModal({
  offsets,
  onClose,
  onNewSession,
}: {
  offsets: number[];
  onClose: () => void;
  onNewSession: () => void;
}) {
  const n = offsets.length;
  if (n === 0) return null;

  const meanOffset  = Math.round(offsets.reduce((a, b) => a + b, 0) / n);
  const meanAbs     = Math.round(offsets.reduce((a, b) => a + Math.abs(b), 0) / n);
  const pctPerfect  = Math.round(100 * offsets.filter(x => Math.abs(x) < 30).length / n);
  const biasLabel   = Math.abs(meanOffset) >= 15
    ? `${Math.abs(meanOffset)}ms ${meanOffset > 0 ? 'late' : 'early'} bias`
    : 'no significant bias';
  const benchmarkLabel =
    meanAbs < 20 ? 'Studio-level' :
    meanAbs < 40 ? 'Skilled player' :
    meanAbs < 80 ? 'Solid feel' : 'Keep practicing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-brand-surface border border-brand-line rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-brand-line shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-brand-ink">Tap Session</h2>
            <p className="text-[11px] text-brand-secondary mt-0.5">{benchmarkLabel} · {biasLabel}</p>
          </div>
          <button onClick={onClose} className="text-brand-secondary hover:text-brand-ink text-lg leading-none px-1">✕</button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-4 space-y-5 flex-1">
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Taps', value: `${n}` },
              { label: 'Avg error', value: `±${meanAbs}ms` },
              { label: '≤30ms', value: `${pctPerfect}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-brand-bg border border-brand-line p-2.5 text-center">
                <div className="text-lg font-bold text-brand-ink leading-none">{value}</div>
                <div className="text-[10px] text-brand-secondary mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Histogram */}
          <div>
            <p className="text-[11px] font-medium text-brand-secondary mb-1.5">Timing distribution</p>
            <TapHistogram offsets={offsets} />
          </div>

          {/* Trend line */}
          {n >= 8 && (
            <div>
              <p className="text-[11px] font-medium text-brand-secondary mb-1.5">Error trend this session</p>
              <TapTrend offsets={offsets} />
            </div>
          )}

          {/* Human context */}
          <div className="rounded-lg bg-brand-bg border border-brand-line p-3 text-xs space-y-1.5">
            <p className="font-semibold text-brand-ink">Human benchmarks</p>
            <div className="space-y-1 text-brand-secondary">
              <p><span className="text-green-600 font-medium">±20ms</span> — studio-ready precision</p>
              <p><span className="text-amber-500 font-medium">±40ms</span> — trained player</p>
              <p><span className="text-red-500 font-medium">±80ms</span> — solid musical feel</p>
            </div>
            <p className="text-brand-line text-[10px] pt-0.5">Human motor jitter floor ≈ 10–15ms. Nobody hits 0.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-3 border-t border-brand-line flex gap-2 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onNewSession}
            className="px-3 py-1.5 text-xs rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function CountItTrainer({ round, score, settings, onComplete }: CountItTrainerProps) {
  const step       = getAdaptiveStep(settings.enabledDurations);
  const totalBeats = beatsPerMeasure(round.timeSignature) * round.measures;
  const totalSlots = Math.round(totalBeats / step);
  const bpb        = beatsPerMeasure(round.timeSignature);
  const spb        = 60 / round.bpm;

  const correctLabels: SlotLabel[] = round.units.flatMap(u => {
    const n = Math.round(durationBeats(u.duration) / step);
    if (u.isRest) return Array<SlotLabel>(n).fill('R');
    return ['N' as SlotLabel, ...Array<SlotLabel>(n - 1).fill('H')];
  });

  const slots = Array.from({ length: totalSlots }, (_, i) => ({
    pos: i * step,
    label: getCountLabel(i * step, round.timeSignature),
    widthPct: (step / totalBeats) * 100,
  }));

  // Label mode state
  const [userLabels, setUserLabels] = useState<(SlotLabel | null)[]>(() => Array(totalSlots).fill(null));
  const [selected,   setSelected]   = useState<Set<number>>(() => new Set());
  const [feedback,   setFeedback]   = useState<('correct' | 'wrong')[] | null>(null);
  const [attempts,   setAttempts]   = useState(0);
  const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);

  // Feature toggles
  const [loopMode,       setLoopMode]       = useState(false);
  const [countAlongMode, setCountAlongMode] = useState(false);
  const [tapMode,        setTapMode]        = useState(false);

  // Tap trainer
  const [lastTapResult,   setLastTapResult]   = useState<TapResult | null>(null);
  const [sessionOffsets,  setSessionOffsets]  = useState<number[]>([]);
  const [showSessionStats, setShowSessionStats] = useState(false);

  // Refs
  const loopTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nSlotTargetsRef = useRef<{ label: string; wallTimeMs: number }[]>([]);
  const handlePlayRef   = useRef<((skipLeadIn?: boolean) => void) | null>(null);
  // Incremented on each handlePlay call; .then() callbacks check this before
  // calling playRhythmRound so stale calls (from a rapid double-trigger) bail out
  const playGenRef      = useRef(0);
  // Mirror state into refs so the loop timeout callback reads live values
  const loopModeRef     = useRef(loopMode);
  const tapModeRef      = useRef(tapMode);
  // Track previous values to distinguish turn-on from turn-off
  const prevLoopRef     = useRef(false);
  const prevTapRef      = useRef(false);
  // Becomes true after the initial round-effect fires; guards toggle effects
  const isMountedRef    = useRef(false);

  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);
  useEffect(() => { tapModeRef.current  = tapMode;  }, [tapMode]);

  const handlePlay = useCallback((skipLeadIn = false) => {
    stopRhythm();
    if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    setActiveUnitIdx(null);

    const gen             = ++playGenRef.current;
    const useLeadIn       = !skipLeadIn && settings.enableLeadIn;
    const leadInBeats     = useLeadIn ? bpb : 0;
    const totalDurationMs = (leadInBeats + totalBeats) * spb * 1000;

    if (tapMode) {
      const audioLatencyMs = getAudioOutputLatencyMs();
      const patternStartMs = performance.now() + leadInBeats * spb * 1000 + audioLatencyMs;
      nSlotTargetsRef.current = slots
        .filter((_, i) => correctLabels[i] === 'N')
        .map((slot) => ({
          label: `beat ${beatName(slot.label)}`,
          wallTimeMs: patternStartMs + slot.pos * spb * 1000,
        }));
    }

    const countSlotsArg = (countAlongMode || tapMode)
      ? slots.map((s, i) => ({ pos: s.pos, isAttack: correctLabels[i] === 'N' }))
      : undefined;

    initAudio()
      .then(() => {
        if (playGenRef.current !== gen) return; // superseded by a newer handlePlay call
        playRhythmRound(round, useLeadIn, setActiveUnitIdx, countSlotsArg);
      })
      .catch(() => {});

    if (loopMode) {
      loopTimeoutRef.current = setTimeout(() => {
        if (loopModeRef.current) {
          handlePlayRef.current?.();
        } else {
          loopTimeoutRef.current = null;
        }
      }, totalDurationMs + 200);
    }
  }, [round, settings.enableLeadIn, bpb, totalBeats, spb, slots, correctLabels, loopMode, tapMode, countAlongMode]);

  // Keep ref current so the loop timeout always calls the latest version
  handlePlayRef.current = handlePlay;

  const handleStop = useCallback(() => {
    ++playGenRef.current;
    stopRhythm();
    if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    setActiveUnitIdx(null);
  }, []);

  // Reset + auto-play on new round
  useEffect(() => {
    setUserLabels(Array(totalSlots).fill(null));
    setSelected(new Set());
    setFeedback(null);
    setAttempts(0);
    setActiveUnitIdx(null);
    setLastTapResult(null);
    if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    handlePlayRef.current?.();
    return () => {
      stopRhythm();
      if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    };
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loop / tap mode changes
  // Turn ON → restart immediately to apply settings and begin looping
  // Turn OFF (and other mode also off) → soft stop: cancel the pending loop restart,
  //   the current play runs to its natural end then silence
  // Turn OFF (other mode still on) → do nothing, loop continues via timeout + refs
  useEffect(() => {
    if (!isMountedRef.current) return;
    const loopTurnedOn = loopMode && !prevLoopRef.current;
    const tapTurnedOn  = tapMode  && !prevTapRef.current;
    prevLoopRef.current = loopMode;
    prevTapRef.current  = tapMode;

    if (loopTurnedOn || tapTurnedOn) {
      if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
      handlePlayRef.current?.();
    } else if (!loopMode) {
      // Loop is off — cancel any queued loop restart; current play finishes naturally
      if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    }
  }, [loopMode, tapMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count audio change: always restart (Transport events must be fully rescheduled)
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    handlePlayRef.current?.();
  }, [countAlongMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark mounted after the initial round-effect fires; this prevents the toggle
  // effects above from double-playing on first render
  useEffect(() => { isMountedRef.current = true; }, []);

  // Tap handler — only reads refs and stable setters, no stale closure risk
  const handleTap = useCallback(() => {
    const nowMs   = performance.now();
    const targets = nSlotTargetsRef.current;
    if (targets.length === 0) return;

    let nearest = targets[0];
    let minDist = Math.abs(targets[0].wallTimeMs - nowMs);
    for (const t of targets) {
      const d = Math.abs(t.wallTimeMs - nowMs);
      if (d < minDist) { minDist = d; nearest = t; }
    }

    if (minDist > 250) {
      setLastTapResult({ label: 'no nearby attack', offsetMs: 0, quality: 'miss' });
      return;
    }

    const offsetMs = Math.round(nowMs - nearest.wallTimeMs);
    const absOff   = Math.abs(offsetMs);
    const quality: TapResult['quality'] =
      absOff < 30 ? 'perfect' :
      absOff < 80 ? 'good'    :
      offsetMs > 0 ? 'late'   : 'early';

    setLastTapResult({ label: nearest.label, offsetMs, quality });
    setSessionOffsets(prev => [...prev, offsetMs]);
  }, []);

  // Spacebar fires tap when tap mode is active
  useEffect(() => {
    if (!tapMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleTap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapMode, handleTap]);

  function handleSlotClick(i: number) {
    if (feedback || tapMode) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleApplyLabel(label: SlotLabel) {
    if (selected.size === 0 || feedback) return;
    setUserLabels(prev => {
      const next = [...prev];
      selected.forEach(i => { next[i] = label; });
      return next;
    });
    setSelected(new Set());
  }

  const allFilled      = userLabels.every(l => l !== null);
  const unlabeledCount = userLabels.filter(l => l === null).length;

  function handleSubmit() {
    if (!allFilled || feedback) return;
    setAttempts(a => a + 1);
    setFeedback(userLabels.map((ul, i) =>
      (ul === correctLabels[i] ? 'correct' : 'wrong') as 'correct' | 'wrong'
    ));
  }

  function handleTryAgain() {
    setUserLabels(Array(totalSlots).fill(null));
    setSelected(new Set());
    setFeedback(null);
  }

  function handleNext() {
    const allCorrect = feedback !== null && feedback.every(f => f === 'correct');
    stopRhythm();
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    setActiveUnitIdx(null);
    onComplete(attempts === 1 && allCorrect);
  }

  // Tap result display helpers
  function tapColor(q: TapResult['quality']) {
    if (q === 'perfect') return 'text-green-600 dark:text-green-400';
    if (q === 'good')    return 'text-yellow-500 dark:text-yellow-400';
    if (q === 'miss')    return 'text-brand-secondary';
    return 'text-red-500 dark:text-red-400';
  }

  function tapLabel(r: TapResult) {
    if (r.quality === 'perfect') return `${r.label} — perfect ✓`;
    if (r.quality === 'miss')    return 'missed — no nearby attack';
    return `${r.label} — ${Math.abs(r.offsetMs)}ms ${r.offsetMs > 0 ? 'late' : 'early'}`;
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-4 space-y-4">

      {/* Score badge */}
      <div className="flex items-center justify-between text-xs text-brand-secondary">
        <span>Round {score.total + 1}</span>
        <span>{score.correct}/{score.total} correct</span>
      </div>

      {/* Staff + count grid in shared horizontal scroll */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: staffMinWidth(round, round.units) }} className="relative">
          <RhythmStaff
            round={round}
            placedUnits={round.units}
            feedback={null}
            onSwap={() => {}}
          />

          <div className="flex font-mono select-none">
            {slots.map((slot, i) => {
              // In tap mode show correct labels read-only; otherwise show user labels
              const ul = tapMode ? correctLabels[i] : userLabels[i];
              const fb = tapMode ? null : feedback?.[i];
              const isSelected   = !tapMode && selected.has(i);
              const correctLabel = !tapMode && feedback ? correctLabels[i] : null;
              const isAttack     = correctLabels[i] === 'N';

              let displayLabel = slot.label;
              if (ul === 'R') displayLabel = `[${slot.label}]`;
              else if (ul === 'H') displayLabel = `(${slot.label})`;

              const slotClass =
                fb === 'correct' ? 'bg-green-500/20 text-green-700 dark:text-green-400 font-bold' :
                fb === 'wrong'   ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-bold' :
                tapMode && isAttack ? 'bg-brand-primary/15 text-brand-primary font-bold' :
                tapMode ? 'text-brand-line' :
                isSelected ? 'bg-brand-primary/20 text-brand-primary font-bold' :
                ul === 'N' ? 'bg-brand-primary/15 text-brand-primary font-bold' :
                ul === 'R' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                ul === 'H' ? 'bg-brand-line/20 text-brand-secondary italic' :
                'text-brand-line';

              return (
                <div
                  key={i}
                  style={{ width: `${slot.widthPct}%` }}
                  className={cn(
                    'relative text-center text-[11px] leading-none py-1 border transition-colors',
                    slotClass,
                    !feedback && !tapMode && 'cursor-pointer rounded',
                    isSelected ? 'border-brand-primary' : 'border-transparent',
                    !feedback && !tapMode && !isSelected && 'hover:border-brand-primary/40',
                    (feedback || tapMode) && 'cursor-default',
                  )}
                  onClick={() => handleSlotClick(i)}
                >
                  <span className="block truncate">{displayLabel}</span>
                  {fb === 'wrong' && correctLabel && (
                    <span className="block text-[9px] text-green-600 font-normal not-italic">
                      {correctLabel === 'R' ? `[${slot.label}]` : correctLabel === 'H' ? `(${slot.label})` : slot.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toggle row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-brand-secondary shrink-0">Practice:</span>
        {(
          [
            { key: 'loop',  label: '↺ Loop',        active: loopMode,       toggle: () => setLoopMode(v => !v) },
            { key: 'count', label: '♩ Count Audio',  active: countAlongMode, toggle: () => setCountAlongMode(v => !v) },
            { key: 'tap',   label: '👏 Tap Along',   active: tapMode,        toggle: () => setTapMode(v => !v) },
          ] as const
        ).map(({ key, label, active, toggle }) => (
          <button
            key={key}
            onClick={toggle}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              active
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-secondary hover:border-brand-primary/60 hover:text-brand-ink',
            )}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleStop}
          className="px-2.5 py-1 rounded-full text-xs font-medium border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
        >
          ■ Stop
        </button>
      </div>

      {/* Tap trainer UI */}
      {tapMode && (
        <div className="space-y-3">
          <p className="text-xs text-brand-secondary text-center">
            Tap the button (or press <kbd className="px-1 py-0.5 rounded border border-brand-line font-mono text-[10px]">space</kbd>) on every note attack
          </p>
          <div className="flex justify-center">
            <button
              onPointerDown={e => { e.preventDefault(); handleTap(); }}
              className="w-28 h-28 rounded-full bg-brand-primary text-white text-xl font-bold shadow-lg active:scale-95 transition-transform select-none touch-none"
            >
              TAP
            </button>
          </div>
          {lastTapResult && (
            <p className={cn('text-sm font-medium text-center', tapColor(lastTapResult.quality))}>
              {tapLabel(lastTapResult)}
            </p>
          )}
          {sessionOffsets.length > 0 && (
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setShowSessionStats(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-400 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                📊 End Session ({sessionOffsets.length} taps)
              </button>
              <button
                onClick={() => setSessionOffsets([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {showSessionStats && (
        <SessionStatsModal
          offsets={sessionOffsets}
          onClose={() => setShowSessionStats(false)}
          onNewSession={() => { setSessionOffsets([]); setShowSessionStats(false); }}
        />
      )}

      {/* Label toolbar — visible when slots are selected */}
      {!tapMode && hasSelection && !feedback && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-brand-secondary">
            {selected.size} slot{selected.size === 1 ? '' : 's'} selected:
          </span>
          {(['N', 'R', 'H'] as SlotLabel[]).map(opt => (
            <button
              key={opt}
              onClick={() => handleApplyLabel(opt)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors',
                opt === 'N' && 'bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/80',
                opt === 'R' && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-400',
                opt === 'H' && 'bg-brand-secondary/70 text-white border-brand-secondary/70 hover:bg-brand-secondary/50',
              )}
            >
              {opt === 'N' ? 'N — Attack' : opt === 'R' ? 'R — Rest' : 'H — Held'}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-brand-line hover:text-brand-secondary transition-colors ml-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Status line */}
      {!tapMode && !feedback && !hasSelection && (
        <p className="text-xs text-brand-secondary text-center">
          {unlabeledCount > 0
            ? `${unlabeledCount} slot${unlabeledCount === 1 ? '' : 's'} unlabeled — click slots to select, then choose a label`
            : 'All slots labeled — ready to submit'}
        </p>
      )}

      {/* Feedback summary */}
      {!tapMode && feedback && (() => {
        const allCorrect = feedback.every(f => f === 'correct');
        const errors = allCorrect ? [] : generateErrors(slots, userLabels, correctLabels);
        return (
          <>
            <p className={cn('text-sm font-semibold text-center', allCorrect ? 'text-green-600' : 'text-red-500')}>
              {allCorrect ? 'Correct! 🎯' : 'Not quite — slots highlighted above'}
            </p>
            {!allCorrect && errors.length > 0 && (
              <ul className="rounded-lg bg-brand-surface border-l-4 border-red-500 border border-brand-line p-3 space-y-1">
                {errors.map((msg, idx) => (
                  <li key={idx} className="text-xs text-brand-ink leading-relaxed">{msg}</li>
                ))}
              </ul>
            )}
          </>
        );
      })()}

      {/* Spoken count — shown after correct submission */}
      {!tapMode && feedback && feedback.every(f => f === 'correct') && (
        <div className="rounded-lg bg-brand-bg border border-brand-line p-3 space-y-2">
          <p className="text-xs font-semibold text-brand-secondary">How to count it aloud:</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono">
            {slots.map((slot, i) => {
              const role = correctLabels[i];
              const word = spokenName(slot.label);
              if (role === 'N') return <span key={i} className="text-sm font-bold text-brand-ink">{word}</span>;
              if (role === 'H') return <span key={i} className="text-xs text-brand-line italic">({word})</span>;
              return <span key={i} className="text-xs text-brand-line">[{word}]</span>;
            })}
          </div>
          <p className="text-[10px] text-brand-line leading-relaxed">
            <span className="font-bold text-brand-ink not-italic">voiced</span>
            {' · '}
            <span className="italic">(held — feel it, don't say it)</span>
            {' · '}
            <span>[rest — count silently]</span>
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handlePlay()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          ▶ Play
        </button>
        {!tapMode && allFilled && !feedback && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Submit
          </button>
        )}
        {!tapMode && feedback && !feedback.every(f => f === 'correct') && (
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-line text-brand-secondary hover:border-brand-primary/60 transition-colors"
          >
            Try Again
          </button>
        )}
        {(feedback || tapMode) && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
