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

Three routes under the shared `Layout` in `App.tsx`:
- `/dictionary` — `Dictionary.tsx`: chord browser, scale visualizer, chord identifier, with arpeggiator and 16-step sequencer
- `/caged` — `Caged.tsx`: interactive CAGED system explorer (by key or by shape)
- `/progressions` — `Progressions.tsx`: build and play chord progressions, persisted to `localStorage`

### Core component

`src/components/Fretboard.tsx` renders an SVG fretboard. String/fret indexing conventions:
- `stringIdx 0` = low E (E2), `stringIdx 5` = high E (E4)
- `frets[i] === -1` means muted; `frets[i] === 0` means open string
- Visual SVG rows are inverted: `visualStringIdx = 5 - stringIdx` (high E drawn at top)
- Accepts `chord?: ChordShape`, `scale?: ScalePattern`, and `fretRange?: [number, number]` for isolated scale positions

### Data layer (`src/data/guitarData.ts`)

`COMMON_CHORDS` is a `Record<Note, ChordShape[]>` generated at module load by transposing 14 CAGED-based shape templates across all 12 roots. `COMMON_SCALES` is a static list of interval arrays; `generateScalePattern(root, scaleDef)` produces a `ScalePattern` on demand.

### Audio engine (`src/lib/audio.ts`)

Singleton module wrapping Tone.js. Must be initialized by calling `initAudio()` before any playback (browser autoplay policy — always gate with `await initAudio()` on user gesture). Effect chain: `Sampler → Filter → Overdrive → Fuzz → Phaser → Chorus → FeedbackDelay → Reverb → Destination`. Soundfont samples are loaded from `gleitz.github.io/midi-js-soundfonts`. Key exports: `playNote`, `playStrum`, `playArpeggio`, `playKick`, `playSnare`, `playClick`, `setEffects`, `setInstrument`, `setAudioTuning`.

### Types (`src/types.ts`)

Central type file. `ChordShape.frets` is a 6-element array (index 0 = low E). `TUNINGS` and `STANDARD_TUNING` are exported constants. `Finger` encodes finger numbers 1–4, open (0), muted (−1), and thumb (`'T'`).

### Styling

Tailwind v4 with custom CSS variables for the design system. Brand tokens include `brand-primary`, `brand-ink`, `brand-secondary`, `brand-surface`, `brand-sidebar`, `brand-bg`, `brand-line`, `brand-active`, `brand-fretboard`, `brand-fret`, `brand-fretborder`. Dark mode is toggled via `document.documentElement.classList.toggle('dark')`.

### Utilities (`src/lib/utils.ts`)

- `cn(...inputs)` — Tailwind-aware class merger (`clsx` + `tailwind-merge`). Use instead of template literals for conditional classes.
- `handlePrint(elementId?)` — Opens a print window mirroring the current stylesheet. Used by pages that support chord/scale diagram printing.

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
