import * as Tone from 'tone';
import { Note, STANDARD_TUNING, Tuning, ArpeggioPattern } from '../types';

let sampler: Tone.Sampler | null = null;
let kickSynth: Tone.MembraneSynth;
let snareSynth: Tone.NoiseSynth;
let clickSynth: Tone.MembraneSynth;
let isInitialized = false;
let currentInstrument = "acoustic_guitar_steel";
let initPromise: Promise<void> | null = null;
let droneOsc: Tone.Oscillator | null = null;

export function getInstrument() {
  return currentInstrument;
}

export async function setInstrument(inst: string) {
  if (currentInstrument === inst) return;
  currentInstrument = inst;
  if (!isInitialized) return;
  
  return new Promise<void>((resolve) => {
    const newSampler = new Tone.Sampler({
      urls: {
        "E2": "E2.mp3",
        "A2": "A2.mp3",
        "D3": "D3.mp3",
        "G3": "G3.mp3",
        "B3": "B3.mp3",
        "E4": "E4.mp3",
      },
      baseUrl: `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${inst}-mp3/`,
      onload: () => {
        newSampler.connect(filterNode);
        newSampler.volume.value = 5;
        if (sampler) sampler.dispose();
        sampler = newSampler;
        resolve();
      }
    });
  });
}

// Effects nodes
let reverbNode: Tone.Reverb;
let delayNode: Tone.FeedbackDelay;
let chorusNode: Tone.Chorus;
let flangerNode: Tone.FeedbackDelay; // built using modulated delay or we use phaser
let phaserNode: Tone.Phaser;
let overdriveNode: Tone.Distortion;
let fuzzNode: Tone.Distortion;
let filterNode: Tone.Filter;

let currentAudioTuning: Tuning = STANDARD_TUNING;

export function setAudioTuning(tuning: Tuning) {
  currentAudioTuning = tuning;
}

// Convert Note (E, F#) and Octave (2) to string 'E2'
export function getNoteString(note: Note, octave: number) {
  let mappedNote = note;
  return `${mappedNote}${octave}`;
}

export function getFretNote(stringIndex: number, fret: number, tuning: Tuning = currentAudioTuning): string {
  if (fret === -1) return '';
  const stringNotes = tuning.notes;
  const stringOctaves = tuning.octaves;
  
  const baseNote = stringNotes[stringIndex];
  const baseOctave = stringOctaves[stringIndex];
  
  const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const baseNoteIndex = allNotes.indexOf(baseNote);
  
  const totalSemitones = baseNoteIndex + Math.max(0, fret);
  const noteIndex = totalSemitones % 12;
  const octaveOffset = Math.floor(totalSemitones / 12);
  
  return `${allNotes[noteIndex]}${baseOctave + octaveOffset}`;
}

export async function initAudio() {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  await Tone.start();
  
  // Create effect chain: Sampler -> Filter(Tone) -> Overdrive -> Fuzz -> Phaser -> Chorus -> Delay -> Reverb -> Destination
  reverbNode = new Tone.Reverb(2).toDestination();
  delayNode = new Tone.FeedbackDelay("4n", 0.6).connect(reverbNode);
  
  chorusNode = new Tone.Chorus(4, 2.5, 0.5).connect(delayNode);
  phaserNode = new Tone.Phaser({ frequency: 1, octaves: 3, baseFrequency: 200 }).connect(chorusNode);
  
  fuzzNode = new Tone.Distortion(0.8).connect(phaserNode); // Fuzz is high distortion
  overdriveNode = new Tone.Distortion(0.3).connect(fuzzNode);
  filterNode = new Tone.Filter(5000, "lowpass").connect(overdriveNode);
  
  // Initial effect levels
  reverbNode.wet.value = 0.2;
  delayNode.wet.value = 0.0;
  chorusNode.wet.value = 0.0;
  phaserNode.wet.value = 0.0;
  fuzzNode.wet.value = 0.0;
  overdriveNode.wet.value = 0.0;

  try { chorusNode.start(); } catch (e) {}

  clickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.01 }
  }).toDestination();
  clickSynth.volume.value = -5;

  kickSynth = new Tone.MembraneSynth().toDestination();
  snareSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
  }).toDestination();
  kickSynth.volume.value = -8;
  snareSynth.volume.value = -12;

  initPromise = new Promise<void>((resolve) => {
    sampler = new Tone.Sampler({
      urls: {
        "E2": "E2.mp3",
        "A2": "A2.mp3",
        "D3": "D3.mp3",
        "G3": "G3.mp3",
        "B3": "B3.mp3",
        "E4": "E4.mp3",
      },
      baseUrl: `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${currentInstrument}-mp3/`,
      onload: () => {
        console.log("Guitar sampler loaded");
        isInitialized = true;
        resolve();
      }
    }).connect(filterNode);
    
    sampler.volume.value = 5;
  });

  return initPromise;
}

export function setEffects(opts: { reverb?: number, delay?: number, delayTime?: string, chorus?: number, flanger?: number, overdrive?: number, fuzz?: number, tone?: number }) {
  if (!isInitialized) return;
  if (opts.reverb !== undefined) reverbNode.wet.value = opts.reverb;
  if (opts.delay !== undefined) delayNode.wet.value = opts.delay;
  if (opts.delayTime !== undefined) delayNode.delayTime.value = opts.delayTime as any;
  if (opts.chorus !== undefined) chorusNode.wet.value = opts.chorus;
  if (opts.flanger !== undefined) phaserNode.wet.value = opts.flanger;
  if (opts.overdrive !== undefined) overdriveNode.wet.value = opts.overdrive;
  if (opts.fuzz !== undefined) fuzzNode.wet.value = opts.fuzz;
  if (opts.tone !== undefined) {
    // Map tone (0-1) to frequency (500Hz to 15000Hz)
    const minFreq = 500;
    const maxFreq = 15000;
    filterNode.frequency.value = minFreq + (maxFreq - minFreq) * opts.tone;
  }
}

let onNotePlayCallback: ((note: string) => void) | null = null;

export function setOnNotePlayCallback(cb: (note: string) => void) {
  onNotePlayCallback = cb;
}

export function playNote(noteInfo: string, duration: number | string = "2n") {
  if (!isInitialized || !sampler) return;
  sampler.triggerAttackRelease(noteInfo, duration);
  if (onNotePlayCallback) onNotePlayCallback(noteInfo);
}

export function startNote(noteInfo: string) {
  if (!isInitialized || !sampler) return;
  sampler.triggerAttack(noteInfo);
  if (onNotePlayCallback) onNotePlayCallback(noteInfo);
}

export function stopNote() {
  if (!isInitialized || !sampler) return;
  sampler.releaseAll();
}

export function startDrone(noteStr: string): void {
  if (!isInitialized) return;
  const freq = Tone.Frequency(noteStr).toFrequency();
  if (droneOsc) {
    // Already running — just re-tune without restarting.
    droneOsc.frequency.value = freq;
    return;
  }
  droneOsc = new Tone.Oscillator(freq, 'sine').toDestination();
  droneOsc.volume.value = -18;
  droneOsc.start();
}

export function stopDrone(): void {
  if (!droneOsc) return;
  droneOsc.stop();
  droneOsc.dispose();
  droneOsc = null;
}

export function playStrum(notes: string[], duration: number | string = "1m", direction: 'down' | 'up' | 'up-down' | 'down-up' = 'down') {
  if (!isInitialized || !sampler) return;
  const now = Tone.now();
  
  const strumOnce = (strumNotes: string[], startTime: number) => {
    strumNotes.forEach((note, index) => {
      const time = startTime + index * 0.03;
      sampler!.triggerAttackRelease(note, duration, time); 
      Tone.Draw.schedule(() => {
        if (onNotePlayCallback) onNotePlayCallback(note);
      }, time);
    });
  }

  // Assuming `notes` are ordered lowest pitch to highest pitch
  const downNotes = [...notes];
  const upNotes = [...notes].reverse();

  if (direction === 'down') {
    strumOnce(downNotes, now);
  } else if (direction === 'up') {
    strumOnce(upNotes, now);
  } else if (direction === 'down-up') {
    strumOnce(downNotes, now);
    strumOnce(upNotes, now + 0.6); // slight pause
  } else if (direction === 'up-down') {
    strumOnce(upNotes, now);
    strumOnce(downNotes, now + 0.6);
  }
}

let lastKickTime = 0;
export function playKick() {
  if (!isInitialized) return;
  let now = Tone.now();
  if (now <= lastKickTime) now = lastKickTime + 0.01;
  kickSynth.triggerAttackRelease("C1", "8n", now);
  lastKickTime = now;
}

let lastSnareTime = 0;
export function playSnare() {
  if (!isInitialized) return;
  let now = Tone.now();
  if (now <= lastSnareTime) now = lastSnareTime + 0.01;
  snareSynth.triggerAttackRelease("16n", now);
  lastSnareTime = now;
}

let lastClickTime = 0;
export function playClick(isHigh = false) {
  if (!isInitialized) return;
  let now = Tone.now();
  if (now <= lastClickTime) now = lastClickTime + 0.01;
  clickSynth.triggerAttackRelease(isHigh ? "C5" : "C4", "16n", now);
  lastClickTime = now;
}

export function playArpeggio(notes: string[], tempoBpm = 120, duration: number | string = "4n") {
    if (!isInitialized || !sampler) return;
    const now = Tone.now();
    const delayBetweenNotes = 60 / tempoBpm;
    notes.forEach((note, index) => {
      const time = now + index * delayBetweenNotes;
      sampler!.triggerAttackRelease(note, duration, time);
      Tone.Draw.schedule(() => {
        if (onNotePlayCallback) onNotePlayCallback(note);
      }, time);
    });
}

const DURATION_MULTIPLIERS: Record<string, number> = {
  '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4,
};

function stepDurationSeconds(dur: string, bpm: number): number {
  return (60 / bpm) * (DURATION_MULTIPLIERS[dur] ?? 1);
}

// Generation counter: each playback run captures its own ID. Incrementing
// invalidates all Tone.Draw.schedule callbacks from the previous run without
// needing to cancel them (they can't be cancelled once queued).
let _generation = 0;
let _loopTimeoutId: ReturnType<typeof setTimeout> | null = null;
const _chordChangeTimeouts: ReturnType<typeof setTimeout>[] = [];

export function playProgressionWithPatterns(
  slots: Array<{ notesByString: (string | null)[]; pattern?: ArpeggioPattern }>,
  bpm: number,
  loop: boolean,
  onChordChange?: (slotIndex: number) => void,
): () => void {
  if (!isInitialized || !sampler) return () => {};

  _generation++;
  const myGen = _generation;
  _chordChangeTimeouts.forEach(clearTimeout);
  _chordChangeTimeouts.length = 0;
  if (_loopTimeoutId !== null) { clearTimeout(_loopTimeoutId); _loopTimeoutId = null; }

  const now = Tone.now();
  let offset = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotStart = offset;

    const delayMs = slotStart * 1000;
    _chordChangeTimeouts.push(
      setTimeout(() => {
        if (myGen !== _generation) return;
        onChordChange?.(i);
      }, delayMs) as unknown as ReturnType<typeof setTimeout>
    );

    if (slot.pattern && slot.pattern.steps.length > 0) {
      for (const step of slot.pattern.steps) {
        const t = now + offset;
        const dur = step.duration;
        const notesToPlay = step.strings
          .map(sIdx => slot.notesByString[sIdx])
          .filter((n): n is string => n !== null);

        Tone.Draw.schedule(() => {
          if (myGen !== _generation) return;
          notesToPlay.forEach(note => {
            sampler!.triggerAttackRelease(note, dur, Tone.now());
          });
        }, t);

        offset += stepDurationSeconds(dur, bpm);
      }
    } else {
      const t = now + offset;
      const strumNotes = slot.notesByString.filter((n): n is string => n !== null);
      Tone.Draw.schedule(() => {
        if (myGen !== _generation) return;
        strumNotes.forEach((note, idx) => {
          sampler!.triggerAttackRelease(note, '2n', Tone.now() + idx * 0.03);
        });
      }, t);
      offset += (60 / bpm) * 4;
    }
  }

  if (loop) {
    _loopTimeoutId = setTimeout(() => {
      if (myGen !== _generation) return;
      playProgressionWithPatterns(slots, bpm, loop, onChordChange);
    }, offset * 1000) as unknown as ReturnType<typeof setTimeout>;
  }

  return () => {
    _generation++;
    _chordChangeTimeouts.forEach(clearTimeout);
    _chordChangeTimeouts.length = 0;
    if (_loopTimeoutId !== null) { clearTimeout(_loopTimeoutId); _loopTimeoutId = null; }
    if (sampler) sampler.releaseAll();
  };
}
