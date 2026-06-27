import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { RefreshCw, Play, Square, Volume2, ChevronDown, Info, Mic, MicOff } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { playTunerString, playReferenceTone } from '@/src/lib/audio';
import { detectPitch } from '@/src/lib/pitchDetection';
import {
  TUNING_DEFS,
  DETUNE_WINDOWS,
  CENT_STEPS,
  DEFAULT_SETTINGS,
  IN_TUNE_THRESHOLD,
  isInTune,
  displayHz,
  randomizeOffsets,
  getDetuneColors,
  getColorModeRowStyle,
  type TuningName,
  type TunerSettings,
  type StringState,
  type DetuneName,
  type ScaffoldMode,
  type ReferenceMode,
} from '@/src/lib/tunerData';

const STORAGE_KEY = 'guitar_tuner_settings';

function loadSettings(): TunerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

const SCAFFOLD_LABELS: Record<ScaffoldMode, string> = {
  ear: 'By Ear',
  color: 'Color',
  cents: 'Cents',
};

function findClosestString(hz: number, strings: StringState[]): { idx: number; centsOffset: number } | null {
  let bestIdx = -1, bestAbs = Infinity, bestCents = 0;
  for (let i = 0; i < strings.length; i++) {
    const cents = 1200 * Math.log2(hz / strings[i].targetHz);
    if (Math.abs(cents) < bestAbs) { bestAbs = Math.abs(cents); bestCents = cents; bestIdx = i; }
  }
  if (bestIdx === -1 || bestAbs > 100) return null;
  return { idx: bestIdx, centsOffset: Math.round(bestCents * 10) / 10 };
}

export function Tuner() {
  const [settings, setSettings] = useState<TunerSettings>(loadSettings);
  const [strings, setStrings] = useState<StringState[]>(() => {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    return randomizeOffsets(tuning, settings.detuneWindowCents);
  });
  const [allInTune, setAllInTune] = useState(false);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [micMode, setMicMode] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeMicString, setActiveMicString] = useState<number | null>(null);

  const playingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stringsRef = useRef<StringState[]>(strings);
  const lastDetectionRef = useRef<number>(0);
  const lastOffsetsRef = useRef<number[]>(strings.map(s => s.centsOffset));

  useEffect(() => { stringsRef.current = strings; }, [strings]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  useEffect(() => {
    if (!allInTune && strings.every(s => isInTune(s.centsOffset))) {
      setAllInTune(true);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
    }
  }, [strings, allInTune]);

  function reRandomize() {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
    setAllInTune(false);
    playingRef.current = false;
    setIsPlayingAll(false);
  }

  function stopMicInternal() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
  }

  async function startMic() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError('Microphone not supported in this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buffer = new Float32Array(analyser.fftSize);

      function detect() {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);
        const hz = detectPitch(buffer, ctx.sampleRate);
        const now = Date.now();
        if (hz !== null) {
          const result = findClosestString(hz, stringsRef.current);
          if (result) {
            lastDetectionRef.current = now;
            const prev = lastOffsetsRef.current[result.idx];
            if (Math.abs(result.centsOffset - prev) >= 0.2) {
              lastOffsetsRef.current[result.idx] = result.centsOffset;
              setActiveMicString(result.idx);
              setStrings(p => p.map((s, i) => i === result.idx ? { ...s, centsOffset: result.centsOffset } : s));
            }
          }
        }
        if (now - lastDetectionRef.current > 600) {
          setActiveMicString(p => p !== null ? null : p);
        }
        rafRef.current = requestAnimationFrame(detect);
      }

      rafRef.current = requestAnimationFrame(detect);
      setMicMode(true);
      setMicError(null);
      setAllInTune(false);
      setActiveMicString(null);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Could not access microphone');
    }
  }

  function stopMic() {
    stopMicInternal();
    setMicMode(false);
    setActiveMicString(null);
    setMicError(null);
  }

  function handleTuningChange(name: TuningName) {
    const tuning = TUNING_DEFS.find(t => t.name === name) ?? TUNING_DEFS[0];
    setSettings(s => ({ ...s, tuning: name }));
    setStrings(randomizeOffsets(tuning, settings.detuneWindowCents));
    setAllInTune(false);
  }

  function handleWindowChange(cents: number) {
    const tuning = TUNING_DEFS.find(t => t.name === settings.tuning) ?? TUNING_DEFS[0];
    setSettings(s => ({ ...s, detuneWindowCents: cents }));
    setStrings(randomizeOffsets(tuning, cents));
    setAllInTune(false);
  }

  function svol(idx: number) { return (settings.stringVolumes?.[idx] ?? 80) / 100; }
  function rvol(idx: number) { return settings.referenceVolumes?.[idx] ?? 70; }

  function setStringVolume(idx: number, val: number) {
    setSettings(s => {
      const vols = [...(s.stringVolumes ?? [80,80,80,80,80,80])];
      vols[idx] = val;
      return { ...s, stringVolumes: vols };
    });
  }

  function setReferenceVolume(idx: number, val: number) {
    setSettings(s => {
      const vols = [...(s.referenceVolumes ?? [70,70,70,70,70,70])];
      vols[idx] = val;
      return { ...s, referenceVolumes: vols };
    });
  }

  function setAllStringVolume(val: number) {
    setSettings(s => ({ ...s, stringVolumes: Array(6).fill(val) }));
  }

  function setAllReferenceVolume(val: number) {
    setSettings(s => ({ ...s, referenceVolumes: Array(6).fill(val) }));
  }

  function playRef(baseHz: number, duration: string, refVolPct: number, strVolPct: number) {
    if (settings.referenceMode === 'pitchpipe') {
      playReferenceTone(baseHz, duration, refVolPct);
    } else if (settings.referenceMode === 'guitar') {
      // 2 ms stagger so voices don't perfectly cancel at 0-cent offset
      playTunerString(baseHz, 0, duration, 0.002, strVolPct / 100);
    }
  }

  function adjustOffset(idx: number, delta: number) {
    const dur = settings.sustainSeconds ?? 2;
    setStrings(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const newOffset = Math.max(-60, Math.min(60, s.centsOffset + delta));
      playTunerString(s.targetHz, newOffset, dur, undefined, svol(i));
      if (settings.referenceMode !== 'off') playRef(s.targetHz, dur.toString(), rvol(i), settings.stringVolumes?.[i] ?? 80);
      return { ...s, centsOffset: newOffset };
    }));
  }

  function flattenString(idx: number) {
    const dur = settings.sustainSeconds ?? 2;
    setStrings(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const newOffset = -25;
      playTunerString(s.targetHz, newOffset, dur, undefined, svol(i));
      if (settings.referenceMode !== 'off') playRef(s.targetHz, dur.toString(), rvol(i), settings.stringVolumes?.[i] ?? 80);
      return { ...s, centsOffset: newOffset };
    }));
  }

  async function playSingleString(idx: number) {
    const dur = settings.sustainSeconds ?? 2;
    playTunerString(strings[idx].targetHz, strings[idx].centsOffset, dur, undefined, svol(idx));
    if (settings.referenceMode !== 'off') playRef(strings[idx].targetHz, dur.toString(), rvol(idx), settings.stringVolumes?.[idx] ?? 80);
  }

  async function handlePlayAll() {
    if (playingRef.current) {
      playingRef.current = false;
      setIsPlayingAll(false);
      return;
    }
    const dur = settings.sustainSeconds ?? 2;
    playingRef.current = true;
    setIsPlayingAll(true);
    try {
      if (settings.audioMode === 'simultaneous') {
        strings.forEach((s, i) => {
          setTimeout(() => {
            playTunerString(s.targetHz, s.centsOffset, dur, undefined, svol(i));
            if (settings.referenceMode !== 'off') playRef(s.targetHz, dur.toString(), rvol(i), settings.stringVolumes?.[i] ?? 80);
          }, i * 20);
        });
        await new Promise<void>(r => setTimeout(r, dur * 1000 + 500));
      } else {
        for (let i = 5; i >= 0; i--) {
          if (!playingRef.current) break;
          playTunerString(strings[i].targetHz, strings[i].centsOffset, dur, undefined, svol(i));
          if (settings.referenceMode !== 'off') playRef(strings[i].targetHz, dur.toString(), rvol(i), settings.stringVolumes?.[i] ?? 80);
          if (i > 0) await new Promise<void>(r => setTimeout(r, dur * 1000 + 200));
        }
      }
    } finally {
      playingRef.current = false;
      setIsPlayingAll(false);
    }
  }

  const displayedStrings = [...strings].reverse();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-brand-surface border border-brand-line">
        <h1 className="text-lg font-bold text-brand-ink font-serif mr-2">
          {micMode ? 'Live Tuner' : 'Tuner Simulator'}
        </h1>

        <select
          value={settings.tuning}
          onChange={e => handleTuningChange(e.target.value as TuningName)}
          className="px-3 py-1.5 rounded-md border border-brand-line bg-brand-bg text-brand-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
        >
          {TUNING_DEFS.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>

        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(Object.entries(DETUNE_WINDOWS) as [DetuneName, number][]).map(([label, cents]) => (
            <button
              key={label}
              onClick={() => handleWindowChange(cents)}
              className={cn(
                'px-3 py-1.5 transition-colors',
                settings.detuneWindowCents === cents
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(['simultaneous', 'sequential'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, audioMode: mode }))}
              className={cn(
                'px-3 py-1.5 capitalize transition-colors',
                settings.audioMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Scaffold mode */}
        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {(['ear', 'color', 'cents'] as ScaffoldMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, scaffoldMode: mode }))}
              className={cn(
                'px-3 py-1.5 transition-colors',
                settings.scaffoldMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {SCAFFOLD_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Reference mode */}
        <div className="flex rounded-md border border-brand-line overflow-hidden text-sm">
          {([['off', 'No Ref'], ['pitchpipe', 'Pipe'], ['guitar', 'Guitar']] as [ReferenceMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, referenceMode: mode }))}
              title={mode === 'off' ? 'No reference tone' : mode === 'pitchpipe' ? 'Pitch pipe reference (sine wave)' : 'Guitar string reference (same timbre)'}
              className={cn(
                'px-3 py-1.5 transition-colors',
                settings.referenceMode === mode
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Hz toggle */}
        <button
          onClick={() => setSettings(s => ({ ...s, showHz: !s.showHz }))}
          title={settings.showHz ? 'Hz display on — click to hide' : 'Hz display off — click to show'}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
            settings.showHz
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
          )}
        >
          Hz
        </button>

        {/* Beat indicator toggle */}
        <button
          onClick={() => setSettings(s => ({ ...s, showBeatIndicator: !s.showBeatIndicator }))}
          title={settings.showBeatIndicator ? 'Beat indicator on — click to hide (ear training mode)' : 'Beat indicator off — click to show'}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
            settings.showBeatIndicator
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
          )}
        >
          Beat
        </button>

        {/* Tips toggle */}
        <button
          onClick={() => setShowTips(v => !v)}
          title="Tuning tips"
          className={cn(
            'p-1.5 rounded-md border text-sm transition-colors',
            showTips
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
          )}
        >
          <Info size={15} />
        </button>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={micMode ? stopMic : startMic}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors',
              micMode
                ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                : 'bg-brand-bg text-brand-secondary border-brand-line hover:text-brand-ink hover:bg-brand-sidebar/50'
            )}
          >
            {micMode ? <><MicOff size={14} /> Stop Mic</> : <><Mic size={14} /> Live Mic</>}
          </button>
          {!micMode && (
            <button
              onClick={reRandomize}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-line text-sm text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
            >
              <RefreshCw size={14} />
              Re-randomize
            </button>
          )}
          <button
            onClick={handlePlayAll}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isPlayingAll
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-brand-primary text-white hover:bg-brand-primary/90'
            )}
          >
            {isPlayingAll
              ? <><Square size={14} /> Stop</>
              : <><Play size={14} /> Play All</>}
          </button>
        </div>
      </div>

      {/* Tuning tips */}
      {showTips && (
        <div className="p-4 rounded-xl bg-brand-surface border border-brand-line text-sm text-brand-ink space-y-2">
          <p className="font-semibold text-brand-ink">How to tune by ear</p>
          <ul className="space-y-1.5 text-brand-secondary list-none">
            <li><span className="font-medium text-brand-ink">Always tune up to pitch.</span> You can't tell sharp from flat just from the beating speed. Use the <ChevronDown size={12} className="inline" /> flatten button to drop the string clearly below pitch, then tune upward — you'll always know your direction.</li>
            <li><span className="font-medium text-brand-ink">Hear the target first.</span> Press <Volume2 size={12} className="inline" /> to play the perfectly-tuned reference pitch on its own. Sing or hum it, then press <Play size={12} className="inline" /> to hear your string — you'll immediately hear whether it's higher or lower.</li>
            <li><span className="font-medium text-brand-ink">Listen for the beating.</span> When reference and string play together you'll hear a rhythmic wobble. As you tune closer the wobble slows. In tune = no wobble.</li>
            <li><span className="font-medium text-brand-ink">Step down as you get close.</span> Use ±10 or ±5 when you're far off, then switch to ±2 or ±0.5 once the beating slows.</li>
            <li><span className="font-medium text-brand-ink">The five-fret rule.</span> On a real guitar, the 5th fret of each string matches the next open string (except G→B, which is the 4th fret). E at fret 5 = A; A at fret 5 = D, and so on.</li>
            <li><span className="font-medium text-brand-ink">Pipe vs Guitar reference.</span> <em>Pipe</em> uses a sine wave — its distinct timbre makes the beating easier to hear. <em>Guitar</em> uses the same string sound, closer to the real fret-5 technique.</li>
          </ul>
        </div>
      )}

      {/* Mic error banner */}
      {micError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 text-sm text-red-700 dark:text-red-400">
          <MicOff size={14} className="shrink-0" />
          <span>{micError}</span>
        </div>
      )}

      {/* Mic listening banner */}
      {micMode && !micError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-600 text-sm">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-blue-800 dark:text-blue-300 font-medium">
            Listening — play each string to tune it.
            {activeMicString !== null && ` Detecting: ${strings[activeMicString].targetNote}`}
          </span>
        </div>
      )}

      {/* Celebration banner */}
      {allInTune && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-green-100 dark:bg-green-950/30 border border-green-600/40 dark:border-green-600">
          <div>
            <p className="text-lg font-bold text-green-900 dark:text-green-400">Guitar in tune!</p>
            <p className="text-sm text-green-800 dark:text-green-500">All strings within ±{IN_TUNE_THRESHOLD}¢</p>
          </div>
          <button
            onClick={reRandomize}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <RefreshCw size={14} />
            Tune Again
          </button>
        </div>
      )}

      {/* Global volume controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-line text-xs text-brand-secondary">
        <span className="font-semibold text-brand-ink shrink-0">Set all:</span>
        <label className="flex items-center gap-2 shrink-0">
          <span className="w-12">String</span>
          <input
            type="range" min={0} max={100} defaultValue={80}
            onChange={e => setAllStringVolume(+e.target.value)}
            className="w-28 accent-brand-primary cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-2 shrink-0">
          <span className="w-12">Reference</span>
          <input
            type="range" min={0} max={100} defaultValue={70}
            onChange={e => setAllReferenceVolume(+e.target.value)}
            className="w-28 accent-brand-primary cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-2 shrink-0">
          <span className="w-12">Sustain</span>
          <input
            type="range" min={2} max={6} step={0.5}
            value={settings.sustainSeconds ?? 2}
            onChange={e => setSettings(s => ({ ...s, sustainSeconds: +e.target.value }))}
            className="w-28 accent-brand-primary cursor-pointer"
          />
          <span className="w-8 text-right">{(settings.sustainSeconds ?? 2).toFixed(1)}s</span>
        </label>
      </div>

      {/* By Ear hint */}
      {settings.scaffoldMode === 'ear' && !micMode && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-surface border border-brand-line text-xs text-brand-secondary">
          <Info size={14} className="shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-brand-ink">Listen for the beat.</span>{' '}
            Press <ChevronDown size={11} className="inline mb-0.5" /> to drop a string flat first — then tune upward so you always know your direction.
            Press ▶ to hear the string against the reference pitch; you'll hear a rhythmic wobble.
            The wobble slows as you get closer. Silence = in tune.
          </p>
        </div>
      )}

      {/* String rows — high E at top, low E at bottom */}
      <div className="space-y-2">
        {displayedStrings.map((s, displayIdx) => {
          const realIdx = strings.length - 1 - displayIdx;
          const colors = getDetuneColors(s.centsOffset);
          const inTune = isInTune(s.centsOffset);
          const isSharp = s.centsOffset > 0;
          const pct = Math.min(50, (Math.abs(s.centsOffset) / 60) * 50);
          const showHzSection = settings.scaffoldMode === 'cents' || settings.showHz;

          const abs = Math.abs(s.centsOffset);
          const earLabel = inTune ? 'In tune ✓'
            : abs <= 5 ? 'Nearly there'
            : abs <= 12 ? 'Slowing...'
            : 'Fast beat';
          const earLabelColor = inTune
            ? 'text-green-600 dark:text-green-400'
            : abs <= 12
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-500 dark:text-red-400';

          const isActiveMicStr = micMode && activeMicString === realIdx;
          const rowClass = cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-colors',
            isActiveMicStr
              ? cn(colors.row, 'ring-2 ring-blue-400 ring-offset-1')
              : settings.scaffoldMode === 'cents'
                ? colors.row
                : settings.scaffoldMode === 'color'
                  ? getColorModeRowStyle(s.centsOffset)
                  : 'border-brand-line'
          );

          const arrowText = inTune ? '✓' : isSharp ? '↑' : '↓';
          const arrowColor = Math.abs(s.centsOffset) <= 3
            ? 'text-green-600 dark:text-green-400'
            : Math.abs(s.centsOffset) <= 10
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-500 dark:text-red-400';

          const prevString = realIdx > 0 ? strings[realIdx - 1] : null;
          const fretRef = prevString
            ? `fr.${Math.round(12 * Math.log2(s.targetHz / prevString.targetHz))} ${prevString.targetNote}`
            : null;

          const beatingHz = s.targetHz * Math.abs(Math.pow(2, s.centsOffset / 1200) - 1);

          return (
            <div key={realIdx} className={rowClass}>
                {/* String label */}
                <div className="w-14 shrink-0 text-center">
                  <div className="text-sm font-bold text-brand-ink">{s.targetNote}</div>
                  <div className="text-xs text-brand-secondary">str {realIdx + 1}</div>
                  {fretRef && (
                    <div className="text-[10px] text-brand-secondary/70 leading-tight">{fretRef}</div>
                  )}
                </div>

                {/* Ear mode: verbal beat-rate label in the Hz column slot */}
                {settings.scaffoldMode === 'ear' && (
                  <div className="w-28 shrink-0">
                    <div className={cn('text-xs font-semibold', earLabelColor)}>{earLabel}</div>
                  </div>
                )}

                {/* Hz display + inline cents meter + cents label — fixed w-28 so row width never varies */}
                {showHzSection && (
                  <div className="w-28 shrink-0 space-y-1">
                    <div className="text-sm font-mono text-brand-ink">
                      {displayHz(s.targetHz, s.centsOffset)} Hz
                    </div>
                    {settings.showHz && (
                      <div className="text-xs font-mono text-brand-secondary">
                        → {s.targetHz.toFixed(1)} target
                      </div>
                    )}
                    {settings.scaffoldMode === 'cents' && (
                      <>
                        <div className="relative h-3 bg-brand-sidebar rounded-full overflow-hidden">
                          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-brand-ink/50 -translate-x-1/2 z-10" />
                          <div
                            className={cn('absolute top-0 bottom-0 transition-all duration-75', colors.bar)}
                            style={
                              inTune
                                ? { left: '47%', right: '47%' }
                                : isSharp
                                  ? { left: '50%', width: `${pct}%` }
                                  : { right: '50%', width: `${pct}%` }
                            }
                          />
                        </div>
                        <div className={cn('text-xs font-medium tabular-nums', colors.text)}>
                          {inTune
                            ? 'IN TUNE ✓'
                            : `${isSharp ? '+' : ''}${s.centsOffset.toFixed(1)}¢ ${isSharp ? 'SHARP' : 'FLAT'}`}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Color mode: arrow indicator */}
                {settings.scaffoldMode === 'color' && (
                  <div className={cn('w-8 shrink-0 text-center text-lg font-bold', arrowColor)}>
                    {arrowText}
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

              {/* Flatten / adjust buttons — hidden in live mic mode */}
              {!micMode && (
                <>
                  {/* Flatten: set to −25¢ so you can tune up from a known flat starting point */}
                  <button
                    onClick={() => flattenString(realIdx)}
                    title="Flatten to −25¢ — then tune up to find pitch"
                    className="shrink-0 px-2 py-1.5 rounded border border-brand-line text-xs text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70 transition-colors"
                  >
                    <ChevronDown size={13} />
                  </button>

                  {/* Decrement buttons (gross → fine, right to left) */}
                  <div className="flex gap-0.5 shrink-0">
                    {[...CENT_STEPS].reverse().map(step => (
                      <button
                        key={`dec-${step}`}
                        onClick={() => adjustOffset(realIdx, -step)}
                        className={cn(
                          'rounded text-xs font-mono border border-brand-line transition-colors',
                          'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                          step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                        )}
                      >
                        −{step}
                      </button>
                    ))}
                  </div>

                  {/* Increment buttons (fine → gross, left to right) */}
                  <div className="flex gap-0.5 shrink-0">
                    {[...CENT_STEPS].map(step => (
                      <button
                        key={`inc-${step}`}
                        onClick={() => adjustOffset(realIdx, step)}
                        className={cn(
                          'rounded text-xs font-mono border border-brand-line transition-colors',
                          'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/70',
                          step >= 10 ? 'px-2 py-1.5 font-bold' : 'px-1.5 py-1.5'
                        )}
                      >
                        +{step}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Play button */}
              <button
                onClick={() =>
                  settings.audioMode === 'simultaneous'
                    ? handlePlayAll()
                    : playSingleString(realIdx)
                }
                title={settings.audioMode === 'simultaneous' ? 'Play all strings (strum)' : 'Play this string'}
                className="shrink-0 p-2 rounded-lg border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
              >
                <Play size={14} />
              </button>

              {/* Play target pitch alone — follows reference mode */}
              <button
                onClick={() => {
                  const dur = settings.sustainSeconds ?? 2;
                  settings.referenceMode === 'guitar'
                    ? playTunerString(s.targetHz, 0, dur, undefined, rvol(realIdx) / 100)
                    : playReferenceTone(s.targetHz, dur.toString(), rvol(realIdx));
                }}
                title={`Play target pitch alone (${s.targetNote} = ${s.targetHz.toFixed(1)} Hz)`}
                className="shrink-0 p-2 rounded-lg border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50 transition-colors"
              >
                <Volume2 size={14} />
              </button>

              {/* Beat indicator — pulses at the beating frequency; off when in tune */}
              {settings.showBeatIndicator && (
                <motion.div
                  key={`beat-${realIdx}-${Math.round(Math.abs(s.centsOffset))}`}
                  className={cn('rounded-full shrink-0', settings.scaffoldMode === 'ear' ? 'w-4 h-4' : 'w-2.5 h-2.5')}
                  style={{
                    backgroundColor: inTune
                      ? '#22c55e'
                      : Math.abs(s.centsOffset) <= 6 ? '#eab308' : '#ef4444',
                  }}
                  animate={inTune ? { opacity: 1 } : { opacity: [0.15, 1, 0.15] }}
                  transition={inTune ? {} : {
                    duration: 1 / Math.max(0.1, beatingHz),
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Per-string volume sliders */}
              <div className="flex flex-col gap-0.5 shrink-0 text-[10px] text-brand-secondary pl-1">
                <label className="flex items-center gap-1">
                  <span className="w-3 font-medium">S</span>
                  <input
                    type="range" min={0} max={100}
                    value={settings.stringVolumes?.[realIdx] ?? 80}
                    onChange={e => setStringVolume(realIdx, +e.target.value)}
                    className="w-16 accent-brand-primary cursor-pointer"
                    style={{ height: '6px' }}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="w-3 font-medium">R</span>
                  <input
                    type="range" min={0} max={100}
                    value={settings.referenceVolumes?.[realIdx] ?? 70}
                    onChange={e => setReferenceVolume(realIdx, +e.target.value)}
                    className="w-16 accent-brand-primary cursor-pointer"
                    style={{ height: '6px' }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-brand-secondary text-center pb-4">
        {micMode
          ? 'Play each string — the tuner detects its pitch and updates the row automatically.'
          : settings.scaffoldMode === 'ear'
            ? 'Listen for the beating to slow and stop as each string approaches its target pitch.'
            : settings.scaffoldMode === 'color'
              ? 'Follow the arrows — tune until all rows turn green and show ✓.'
              : 'Use the increment buttons to tune — listen for the beating to slow and stop as each string approaches its target pitch.'}
      </p>
    </div>
  );
}
