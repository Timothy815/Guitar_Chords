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

## Picking Drills
**Plan:** docs/superpowers/plans/2026-07-02-picking-drills.md
- [x] Task 1: Extend drillData.ts with picking drill types and 17 new drills (commits 02500b8..13cb522, review clean)
- [x] Task 2: Update Technique.tsx — two-row tabs and annotation strip (commits 13cb522..ef3ee9a, review clean)
**Final whole-branch review:** APPROVED (commits 9b52828..ef3ee9a, 4 commits, ready to merge)
**Minor findings:** fretRange/drillDots latent coupling (open-string drills work by drillDots bypassing fretRange — note in code if fretRange filtering ever changes); annotation strip key={i} is safe for static step arrays; duplicate step positions in PIMA/Travis render once correctly (existing Fretboard behavior)

---

## Minor fixes (all shipped)
- [x] Progressions.tsx JSON.parse wrapped in try/catch (commit b1a3704 area)
- [x] ScaleDrillTrainer .find() non-null assertion replaced with ?? COMMON_SCALES[0] fallback

## Tuner Simulator
**Plan:** docs/superpowers/plans/2026-06-27-tuner-simulator.md
- [x] Task 1: playTunedString in audio.ts (commit 3b3f61e, review clean)
- [x] Task 2: tunerData.ts (commit 4e4a276, review clean)
- [x] Task 3: Tuner.tsx page (commit 5e107dd, review clean)
- [x] Task 4: Wire /tuner route and nav in App.tsx (commit 3f0edce, review clean)

## Tuner Enhancements
**Plan:** docs/superpowers/plans/2026-06-27-tuner-enhancements.md
- [x] Task 1: tunerData.ts — ScaffoldMode, settings, getColorModeRowStyle (commit 8891b95, review clean)
- [x] Task 2: Tuner.tsx — toolbar, reference tone, conditional rendering (commit 4425b41, review clean; minor: Stop btn red-500 pre-existing)

## Scale Drill Overhaul
**Plan:** docs/superpowers/plans/2026-06-29-scale-drill-overhaul.md
- [x] Task 1: Fretboard labeledDots + flashHighlight (commit 454c237..22ba299, review clean)
- [x] Task 2: earTraining.ts generateScaleDrillRound + SCALE_DRILL_POSITIONS + anchor (commit 22ba299..b76eaa3, review clean)
- [x] Task 3: ScaleDrillTrainer rebuilt (commit b76eaa3..d1e5b49, review clean; minor: openNote unused param, vestigial scaleDrillRound state in EarTraining — Task 4 fixes)
- [x] Task 4: EarTraining.tsx cleanup (commits d1e5b49..10fb172, review clean after Fragment fix)
- Final whole-branch review: clean (454c237..10fb172, 5 commits, merge approved)

## Scale Interval Drill
**Plan:** docs/superpowers/plans/2026-06-29-scale-interval-drill.md
- [x] Task 1: ScaleIntervalRound type + generateScaleIntervalRound in earTraining.ts (commits 4601d3a..7b7865f, fix bbe8df3 — options fallback for narrow scales, review clean)
- [x] Task 2: IntervalDrillTrainer component (commit bbe8df3..cbbe44a, review clean; minor: labeledDots shown in Beginner mode — cosmetic, low impact)
- [x] Task 3: EarTraining.tsx tab row integration (commit cbbe44a..4f4645b, review clean)
- [x] Fix: Advanced mode flashHighlight — added advancedHighlight state (commit a81ca1b, final-review finding resolved)

## Technique Drills
**Plan:** docs/superpowers/plans/2026-07-02-technique-drills.md
- [x] Task 1: Add drillDots prop to Fretboard.tsx (commits 63a5453..42dec84, review clean)
- [x] Task 2: Create src/data/drillData.ts (commits 42dec84..75504e7, review clean)
- [x] Task 3: Create src/pages/Technique.tsx (commits 75504e7..4d221d4, review clean)
- [x] Task 4: Wire Technique into App.tsx (commits 4d221d4..88b481f, review clean)
**Final whole-branch review:** APPROVED (commits 188098d..88b481f, 5 commits)
**Minor findings logged:** useEffect dep style (selectedDrill vs selectedDrillId), duplicate drillDots on legato drills (visually correct), drillDots no fretRange clip (not a current bug), flash condition `>=` vs `>` (misleading message but no data corruption)
Task 1: complete (commits 3432e7d..c02f56a, review clean)
Task 2: complete (commits c02f56a..c95d36d, review clean)
Final whole-branch review: APPROVED, ready to merge (commits 3432e7d..c95d36d, 2 commits)
Minor finding fixed post-review: unused `type DiagonalCell` import removed (commit 4899bf8)

## Scale Position Audit
**Plan:** docs/superpowers/plans/2026-07-12-scale-position-audit.md
- [x] Task 1: symmetricScalePatterns.ts + Task 2: findShapeAnchors/getCagedScaleRepeat/symmetric routing — landed together in a single commit (implementer for Task 2 found Task 1's file missing and authored it inline). Commit 0788212 (parent 5e6f74c). Review clean (spec ✅, quality approved, build-time assertions independently re-derived).
