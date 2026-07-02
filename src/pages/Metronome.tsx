import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { initAudio, playClick } from '@/src/lib/audio';
import { cn } from '@/src/lib/utils';

const TIME_SIGNATURES = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '6/8', beats: 6 },
] as const;

type TimeSig = typeof TIME_SIGNATURES[number];

export function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [bpmDraft, setBpmDraft] = useState('120');
  const [timeSig, setTimeSig] = useState<TimeSig>(TIME_SIGNATURES[2]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);
  const beatRef = useRef(0);
  const tapTimesRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current?.dispose();
    loopRef.current = null;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    setIsPlaying(false);
    setCurrentBeat(null);
    beatRef.current = 0;
  }, []);

  // Stop on unmount
  useEffect(() => () => { stop(); }, [stop]);

  const start = useCallback(async (nextBpm: number, nextTimeSig: TimeSig) => {
    await initAudio();
    Tone.getTransport().bpm.value = nextBpm;
    beatRef.current = 0;

    loopRef.current = new Tone.Loop((time) => {
      const beat = beatRef.current;
      playClick(beat === 0, time);
      const now = Tone.now();
      const delay = Math.max(0, (time - now) * 1000);
      setTimeout(() => setCurrentBeat(beat), delay);
      beatRef.current = (beatRef.current + 1) % nextTimeSig.beats;
    }, '4n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    setIsPlaying(true);
  }, []);

  const handleToggle = useCallback(async () => {
    if (isPlaying) {
      stop();
    } else {
      await start(bpm, timeSig);
    }
  }, [isPlaying, stop, start, bpm, timeSig]);

  const handleBpmChange = useCallback((value: number) => {
    setBpm(value);
    setBpmDraft(String(value));
    if (isPlaying) Tone.getTransport().bpm.value = value;
  }, [isPlaying]);

  const commitBpmDraft = useCallback(() => {
    const v = parseInt(bpmDraft, 10);
    handleBpmChange(Math.min(240, Math.max(40, isNaN(v) ? bpm : v)));
  }, [bpmDraft, bpm, handleBpmChange]);

  const handleTimeSigChange = useCallback((ts: TimeSig) => {
    if (isPlaying) stop();
    setTimeSig(ts);
  }, [isPlaying, stop]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const prev = tapTimesRef.current;
    const updated = [...prev.slice(-4), now];
    tapTimesRef.current = updated;
    if (updated.length >= 2) {
      const intervals = updated.slice(1).map((t, i) => t - updated[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapped = Math.min(240, Math.max(40, Math.round(60000 / avg)));
      handleBpmChange(tapped);
    }
  }, [handleBpmChange]);

  return (
    <div className="max-w-md mx-auto space-y-8 py-4">
      <h1 className="text-2xl font-serif font-bold text-brand-ink">Metronome</h1>

      {/* Beat indicator dots */}
      <div className="flex gap-3 justify-center">
        {Array.from({ length: timeSig.beats }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-14 h-14 rounded-full border-2 transition-all duration-75',
              currentBeat === i
                ? i === 0
                  ? 'bg-brand-primary border-brand-primary scale-125'
                  : 'bg-green-500 border-green-500 scale-110'
                : 'border-brand-line bg-brand-surface',
            )}
          />
        ))}
      </div>

      {/* BPM control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-ink">BPM</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBpmChange(Math.max(40, bpm - 1))}
              className="w-8 h-8 rounded border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar transition-colors"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={bpmDraft}
              onChange={e => setBpmDraft(e.target.value)}
              onBlur={commitBpmDraft}
              onKeyDown={e => e.key === 'Enter' && commitBpmDraft()}
              className="text-3xl font-bold font-mono text-brand-primary w-16 text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-brand-primary/50 rounded"
            />
            <button
              onClick={() => handleBpmChange(Math.min(240, bpm + 1))}
              className="w-8 h-8 rounded border border-brand-line text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar transition-colors"
            >+</button>
          </div>
        </div>
        <input
          type="range"
          min={40}
          max={240}
          value={bpm}
          onChange={e => handleBpmChange(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-primary)]"
        />
        <div className="flex justify-between text-xs text-brand-secondary font-mono">
          <span>40</span><span>♩=120</span><span>240</span>
        </div>
      </div>

      {/* Time signature */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-brand-ink">Time Signature</span>
        <div className="flex gap-2 flex-wrap">
          {TIME_SIGNATURES.map(ts => (
            <button
              key={ts.label}
              onClick={() => handleTimeSigChange(ts)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                timeSig.label === ts.label
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'border-brand-line text-brand-ink hover:border-brand-primary/60',
              )}
            >
              {ts.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleToggle}
          className={cn(
            'flex-1 py-3 rounded-lg font-semibold text-white transition-colors text-lg',
            isPlaying
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-brand-primary hover:bg-brand-primary/90',
          )}
        >
          {isPlaying ? '■ Stop' : '▶ Start'}
        </button>
        <button
          onClick={handleTap}
          className="px-6 py-3 rounded-lg font-semibold border border-brand-line text-brand-ink hover:bg-brand-sidebar transition-colors"
        >
          Tap Tempo
        </button>
      </div>

      <p className="text-xs text-brand-secondary text-center">
        Beat 1 accent plays higher pitch. Tap at least twice to set tempo by tapping.
      </p>
    </div>
  );
}
