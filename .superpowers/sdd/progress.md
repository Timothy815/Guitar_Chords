# SDD Progress Ledger
# Last updated: 2026-06-27
# All entries below are COMPLETE and shipped to origin/main

---

## Fretboard Trainer
**Plan:** docs/superpowers/plans/2026-06-23-fretboard-trainer.md
- [x] Task 1: Add FretboardRound + data functions to earTraining.ts (commits a554cd7..e0d0a9e)
- [x] Task 2: Add correctPositions and wrongPosition props to Fretboard.tsx (commits e0d0a9e..3b7193d)
- [x] Task 3: Create FretboardTrainer component (commits 3b7193d..567498f)
- [x] Task 4: Wire FretboardTrainer into EarTraining.tsx (commits 567498f..5d30298)

---

## Fretboard Hunt Mode
**Plan:** docs/superpowers/plans/2026-06-24-fretboard-hunt-mode.md
- [x] Task 1: Data layer — earTraining.ts (commits 3f71ec6..30291e2)
- [x] Task 2: Fretboard — previewPosition prop (commits 30291e2..4decbac)
- [x] Task 3: FretboardTrainer — Hunt mode logic (commits 4decbac..1db0d78)
- [x] Task 4: EarTraining.tsx — wire Hunt mode (commits 1db0d78..9405b88)

---

## Fretboard Focus + Octave Filter
**Plan:** docs/superpowers/plans/2026-06-24-fretboard-focus-octave.md
- [x] Task 1: Data layer — earTraining.ts (commits a3fa4b5..c5fa3ff)
- [x] Task 2: FretboardFocusSelector component (commits c5fa3ff..2b1d705)
- [x] Task 3: Fretboard dimming (commits 2b1d705..9b1a880)
- [x] Task 4: FretboardTrainer — updated stats, focus UI (commits 9b1a880..d4f28bc)
- [x] Task 5: EarTraining.tsx — wire focus state (commits d4f28bc..8851279)

---

## Tonal Drone
**Plan:** docs/superpowers/plans/2026-06-24-tonal-drone.md
- [x] Task 1: Drone oscillator in audio.ts (commits 9f88208..5510438)
- [x] Task 2: Cue-mode sequencing in FretboardTrainer (commits 5510438..63feffb)
- [x] Task 3: Drone state, settings UI, and lifecycle in EarTraining (commits 63feffb..8eac9f4)

---

## Comparative Playback
**Plan:** docs/superpowers/plans/2026-06-24-comparative-playback.md
- [x] Task 1: Comparative playback on wrong answer in Guess mode (commits db9c252..2f1d4fb)

---

## Sing-Then-Find
**Plan:** docs/superpowers/plans/2026-06-24-sing-then-find.md
- [x] Task 1: FretboardTrainer — singMode prop, locked state, and overlay (commits 5e43819..d2bedc8)
- [x] Task 2: EarTraining — Sing button and singMode prop wiring (commits d2bedc8..ce549f2)

---

## Spaced Repetition (Fretboard weighted deck)
**Plan:** docs/superpowers/plans/2026-06-24-spaced-repetition.md
- [x] Task 1: Weighted deck rebuild in nextFretboardNote (commits 3868a0b..40a1fdb)
- [x] Task 2: Weak note display — score bar and summary modal (commits 40a1fdb..77a9b05)

---

## Structured Curriculum (Plan tab)
**Plan:** docs/superpowers/plans/2026-06-24-structured-curriculum.md
- [x] Task 1: Create src/lib/planProgress.ts (commits 4674fa9..b440e3b)
- [x] Task 2: Add 'plan' to mode union in earTraining.ts (commits b440e3b..60e440f)
- [x] Task 3: Plan state, handlers, advancement logic in EarTraining.tsx (commits 60e440f..10ffecc)
- [x] Task 4: Plan tab UI, ladder, practice area, modal in EarTraining.tsx (commits 10ffecc..7194d26, fix 49493f0)

---

## Hunt Scoring & Session History
**Plan:** docs/superpowers/plans/2026-06-24-hunt-scoring.md
- [x] Task 1: Create src/lib/huntHistory.ts — data layer (commits f9e11e3..53f2b43)
- [x] Task 2: FretboardTrainer — live indicator + CSV buttons (commits 53f2b43..c791e5e)
- [x] Task 3: EarTraining — round recording + session tracking (commits c791e5e..3d6aadd)
- [x] Task 4: EarTraining — session summary panel (commits 3d6aadd..5d13770, fix 4076301)

---

## Chord + Interval Stats
**Plan:** docs/superpowers/plans/2026-06-24-chord-interval-stats.md
- [x] Task 1: Create chordHistory.ts and intervalHistory.ts (commits 021ed0d..3dd6e62)
- [x] Task 2: Record entries in EarTraining.tsx (commits 3dd6e62..e6d3d23)
- [x] Task 3: Session summary stats panel (commits e6d3d23..f8df2f9)
- [x] Task 4: Settings panel — weakest hint + Export/Import (commits f8df2f9..21f7726)

---

## Rhythm Ear Training
**Plan:** docs/superpowers/plans/2026-06-25-rhythm-ear-training.md
- [x] Task 1: Data layer — rhythmTraining.ts + earTraining.ts (commits a2e91f6..9d141c7)
- [x] Task 2: Audio — playRhythmRound + stopRhythm in audio.ts (commits 9d141c7..1d8035e)
- [x] Task 3: RhythmStaff component — VexFlow multi-measure staff (commits 1d8035e..198bbdf)
- [x] Task 4: RhythmTrainer component — game logic (commits 198bbdf..a2ba4ba)
- [x] Task 5: Wire into EarTraining.tsx (commits a2ba4ba..ada7217, fix 4f9de9e)

---

## Melodic Sequence Training
**Plan:** docs/superpowers/plans/2026-06-25-melodic-sequence-training.md
- [x] Task 1: Data layer — melodyTraining.ts (commits 9d04be6..12daee9)
- [x] Task 2: PianoInput component (commits 12daee9..df9da64)
- [x] Task 3: FretboardInput component (commits df9da64..7a63729)
- [x] Task 4: MelodyTrainer component (commits 7a63729..15b37e8)
- [x] Task 5: Wire melody into earTraining.ts + EarTraining.tsx (commits 15b37e8..b351bc8)
- [x] Task 6: RhythmTrainer retry mechanic (commits b351bc8..517b004)

---

## Per-Skill Curriculum Ladders
**Plan:** docs/superpowers/plans/2026-06-25-per-skill-curriculum-ladders.md
- [x] Task 1: Rewrite planProgress.ts with per-skill ladder types (commits 0b335d8..bfca78d)
- [x] Task 2: Update earTraining.ts — mode union + DIFFICULTY_PRESETS (commits bfca78d..f5ccecb)
- [x] Task 3: Update EarTraining.tsx — state, imports, handlers (commits f5ccecb..681e0a1)
- [x] Task 4: Update EarTraining.tsx — Plan tab UI dashboard grid (commits 681e0a1..e57f220, ship commit 4af2905)

---

## Count It Mode
**Plan:** docs/superpowers/plans/2026-06-26-count-it-mode.md
- [x] Task 1: Wire Count It mode into EarTraining (commits b04056f..d266178)
- [x] Task 2: Build CountItTrainer and connect to EarTraining (commits d266178..b1e9261)

---

## GuitarMaster Improvements (8 tasks)
**Plan:** docs/superpowers/plans/2026-06-26-guitar-master-improvements.md
- [x] Task 1: Standalone Metronome Page (commits 186edec..b9b3b52)
- [x] Task 2: Cross-Tool Navigation — Add to Progression + Ear Training links (commits 9ecdf8d)
- [x] Task 3: Plan Ladder Stage Descriptions — collapsible descriptions (commit range)
- [x] Task 4: Spaced Repetition for Study Mode — SM-2 SRS (src/lib/srs.ts)
- [x] Task 5: Scale Drilling Mode — ScaleDrillTrainer + highlightNote on Fretboard
- [x] Task 6: Voice Leading Hints — VoiceLeadingPanel + voiceLeading.ts
- [x] Task 7: Interval-to-Fretboard Mode — IntervalFretboardTrainer
- [x] Task 8: Scale Position Training Page — ScalePositions.tsx + route
**Final review:** APPROVED (commit ceec5a2)
**Follow-ups shipped:** ascending interval audio fix, active progression targeting, live sync (commit b1a3704)

---

## Note Labels + Piano Keyboard in Dictionary
**Plan:** docs/superpowers/plans/2026-06-21-note-labels-piano-keyboard.md
- [x] Implemented: showNoteNames rendering in Fretboard.tsx, PianoKeyboard.tsx component wired into Dictionary

---

## Piano Keyboard Ear Training + Octave Filter
**Plan:** docs/superpowers/plans/2026-06-25-piano-keyboard-ear-training.md
- [x] Implemented: PianoTrainer.tsx, pianoView toggle in EarTraining.tsx, Salamander piano sampler in audio.ts, octave filter in FretboardFocusSelector

---

## Chord Type Expansion
**Spec:** docs/superpowers/specs/2026-06-23-chord-type-expansion-design.md
- [x] Implemented: dim, aug, dim7, m7b5 shapes added to guitarData.ts

---

## Navigation Cleanup
- [x] Icons-only main nav with title tooltips (App.tsx, commit d20c069)
- [x] Ear Training tabs split into two grouped rows — Recognition / Practice (EarTraining.tsx, commit d20c069)

---

## Minor fixes (all shipped)
- [x] Progressions.tsx JSON.parse wrapped in try/catch (commit b1a3704 area)
- [x] ScaleDrillTrainer .find() non-null assertion replaced with ?? COMMON_SCALES[0] fallback
