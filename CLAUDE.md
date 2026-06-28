# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000 (all interfaces)
npm run build     # Production build
npm run lint      # TypeScript type-check only (tsc --noEmit)
npm run preview   # Preview production build
npm run clean     # Remove dist/ and server.js
```

There are no tests. `npm run lint` is the only static check available.

## Architecture

**GuitarMaster** is a React 19 + TypeScript + Vite SPA for guitar learning. It uses Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`), React Router v7, Tone.js for audio synthesis, and `@tonaljs/tonal` for music theory.

### Routing & pages (`src/pages/`)

Eight routes under the shared `Layout` in `App.tsx`:

- `/dictionary` — `Dictionary.tsx`: four tabs — **Chords** (browse/play chords with arpeggiator and 16-step sequencer), **Scales** (scale visualizer), **Identify** (chord identifier from fretboard input), **Intervals** (interval explorer via `IntervalFretboard`)
- `/caged` — `Caged.tsx`: interactive CAGED system explorer (by key or by shape)
- `/circle` — `Circle.tsx`: standalone Circle of Fifths with diatonic chord panel and chord-to-progression quick-add
- `/progressions` — `Progressions.tsx`: build and play chord progressions persisted to `localStorage`; features Circle of Fifths panel (diatonic chord highlighting when a key is selected), per-chord arpeggiation patterns, voice leading analysis (`VoiceLeadingPanel`), and chord sheet printing
- `/ear-training` — `EarTraining.tsx`: multi-mode ear trainer — interval, chord, fretboard (guess/hunt/sing), melody, rhythm, count-it, study flashcards, and skill-ladder plan mode
- `/metronome` — `Metronome.tsx`: tap-tempo metronome
- `/scale-positions` — `ScalePositions.tsx`: 5 CAGED scale position boxes (E/D/C/A/G-shape) for any root and scale; free-explore and drill/quiz modes; play button sounds only the visible fret window
- `/tuner` — `Tuner.tsx`: chromatic guitar tuner using local acoustic samples for precise pitch detection

### Core component

`src/components/Fretboard.tsx` renders an SVG fretboard. String/fret indexing conventions:
- `stringIdx 0` = low E (E2), `stringIdx 5` = high E (E4)
- `frets[i] === -1` means muted; `frets[i] === 0` means open string
- Visual SVG rows are inverted: `visualStringIdx = 5 - stringIdx` (high E drawn at top)
- Accepts `chord?: ChordShape`, `scale?: ScalePattern`, `fretRange?: [number, number]` for isolated scale positions, and `fretsNum` to extend the neck beyond 12 frets

### Other notable components (`src/components/`)

- `CircleOfFifths.tsx` — reusable SVG circle of fifths; used in both `Circle.tsx` and `Progressions.tsx`
- `ChordCard.tsx` — renders a single chord diagram (used in chord sheet and elsewhere)
- `ChordSheet.tsx` — print-ready chord sheet layout rendered via portal
- `IntervalFretboard.tsx` — interval explorer; supports All / Adjacent / In Position view modes, Loop all shapes, dot-click two-note playback, and unison (P1) mode
- `FretboardTrainer.tsx` — note identification game on the fretboard
- `IntervalFretboardTrainer.tsx` — interval ear training on the fretboard
- `ScaleDrillTrainer.tsx` — scale spelling and identification drill
- `RhythmTrainer.tsx` / `RhythmStaff.tsx` — rhythm pattern trainer with staff notation
- `MelodyTrainer.tsx` — melody sing-back / recognition trainer
- `CountItTrainer.tsx` — rhythmic subdivision counting trainer
- `PianoKeyboard.tsx` / `PianoInput.tsx` / `PianoTrainer.tsx` — piano UI used in ear training and chord identification
- `VoiceLeadingPanel.tsx` — voice leading analysis display for the Progressions page
- `FretboardFocusSelector.tsx` / `FretboardInput.tsx` — supporting input components

### Data layer (`src/data/guitarData.ts`)

`COMMON_CHORDS` is a `Record<Note, ChordShape[]>` generated at module load by transposing 18 CAGED-based shape templates across all 12 roots. Shapes covered: Major (E/A/C), Minor (E/A), 7 (E/A), Maj7 (E/A), m7 (E/A), sus2 (A), sus4 (A/E), dim (A), aug (A), dim7 (A), m7b5 (A). Open chord voicings for C/A/G/E/D are prepended before CAGED shapes.

`COMMON_SCALES` is a static list of interval arrays across 5 categories (Pentatonic, Blues, Modes, Minor, Symmetric); `generateScalePattern(root, scaleDef)` produces a `ScalePattern` on demand.

### Audio engine (`src/lib/audio.ts`)

Singleton module wrapping Tone.js. Must be initialized by calling `initAudio()` before any playback (browser autoplay policy — always gate with `await initAudio()` on user gesture).

**Guitar sampler:** Uses self-hosted acoustic guitar samples (University of Iowa recordings) stored in `/public`. Do **not** replace these with Gleitz CDN samples — the local samples produce accurate overtones required for the Tuner's pitch detection. Gleitz CDN is only used as fallback for non-guitar instruments.

**Piano sampler:** Loaded separately via `initPianoSampler()` using Salamander Grand Piano from tonejs.github.io.

Effect chain: `Sampler → Filter → Overdrive → Fuzz → Phaser → Chorus → FeedbackDelay → Reverb → Destination`

Key exports: `playNote`, `startNote`, `stopNote`, `playStrum`, `playArpeggio`, `playProgressionWithPatterns`, `stopRhythm`, `playKick`, `playSnare`, `playClick`, `playRhythmRound`, `startDrone`, `stopDrone`, `playTunedString`, `playTunerString`, `playReferenceTone`, `initPianoSampler`, `playPianoNote`, `setEffects`, `setInstrument`, `setAudioTuning`, `getFretNote`, `getAudioOutputLatencyMs`

### Types (`src/types.ts`)

Central type file. `ChordShape.frets` is a 6-element array (index 0 = low E). `TUNINGS` and `STANDARD_TUNING` are exported constants. `Finger` encodes finger numbers 1–4, open (0), muted (−1), and thumb (`'T'`).

### Styling

Tailwind v4 with custom CSS variables for the design system. Brand tokens include `brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`, `brand-active`, `brand-fretboard`, `brand-fret`, `brand-fretborder`. Dark mode is toggled via `document.documentElement.classList.toggle('dark')`.

### Utilities (`src/lib/utils.ts`)

- `cn(...inputs)` — Tailwind-aware class merger (`clsx` + `tailwind-merge`). Use instead of template literals for conditional classes.
- `handlePrint(elementId?)` — Opens a print window mirroring the current stylesheet.
- `printChordSheet(elementId)` — In-page print helper that hides the React root and exposes a portal element; used by the chord sheet feature.
- `avgChordPitch(chord)` — Returns average MIDI pitch of a chord's fretted notes; used for palette sort.
- `chordPositionBucket(chord)` — Categorises a chord as `'open' | 'low' | 'high'`; used for the position filter in the chord palette.
- `PositionBucket` type and `POSITION_LABELS` record — label map for the position filter UI.

### Key logic in pages

**Progressions.tsx** defines two helpers at module scope:
- `getDiatonicRoots(key: Note): Set<string>` — returns the 7 note names in a major key
- `isChordDiatonic(chord: ChordShape, key: Note): boolean` — checks root + quality against the expected scale degree (I/IV=Major, ii/iii/vi=Minor, V=Major/dom7, vii°=dim)

These power the Circle of Fifths diatonic highlighting: when `circleKey` state is set, root note buttons and chord palette buttons both glow with `brand-active` when they belong to the selected key.

**ScalePositions.tsx** computes box fret windows with fixed CAGED offsets relative to the root fret on low E (`-1, +2, +4, +7, +9` semitones for E/D/C/A/G shapes). Boxes above fret 11 wrap one octave down via `% 12`. The play button collects only the notes visible in the active fret window, sorted by MIDI pitch.

### Path alias

`@` resolves to the **project root** (not `src/`). `@/src/...` is the correct form for aliased imports.

### Deployment base path

`vite.config.ts` sets `base: '/Guitar_Chords/'` and `App.tsx` sets `BrowserRouter basename="/Guitar_Chords"`. These must stay in sync; the app is deployed to GitHub Pages under that path.

### Available dependencies (non-obvious)

- `@google/genai` — Gemini API client (for AI features)
- `motion` — Framer Motion v12 (animation)
- `lucide-react` — icon library already in use throughout the app
- `canvas-confetti` — celebration effects

### Environment

`GEMINI_API_KEY` and `APP_URL` are injected by Google AI Studio at runtime. Copy `.env.example` to `.env.local` for local development.
