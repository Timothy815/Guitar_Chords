# Guided Learning Layer Proposal

> **Status:** Product proposal for discussion and phased implementation. This is intentionally additive: it should improve teaching quality without turning GuitarMaster into a gated curriculum app.

**Goal:** Make GuitarMaster feel more like a teacher-guided learning resource while preserving its current strength as an open, exploratory practice workshop.

**Core Principle:** Guide, don't gate.

**Non-Goals:**
- Do not hide major tools behind staged unlocks.
- Do not turn the app into a rigid lesson platform.
- Do not add generic teaching copy just to fill space.
- Do not add navigation buttons that fail to carry meaningful context.

**Product Thesis:** The app already has broad educational value. What it lacks is a lightweight guidance layer that tells users what a tool is for, how to use it well, and what to do next. The right fix is not restriction; it is better orientation, better cross-tool flow, and a small amount of optional structure.

---

## Why This Matters

Right now GuitarMaster is strongest as a feature-rich practice lab:

- `Dictionary` provides chord, scale, interval, and identify workflows.
- `Ear Training` contains multiple serious drill modes and a plan ladder system.
- `CAGED`, `Scale Positions`, `Circle`, and `Progressions` cover connected theory territory.
- `Tuner` and `Metronome` make the app more usable as a real daily practice companion.

The gap is not breadth. The gap is instructional coherence.

Users can reach useful tools quickly, but they are often left to infer:

- what a page is actually training
- why it matters musically
- how to practice it effectively
- which tool should come next

This proposal adds that missing layer without removing freedom.

---

## Major Risks

### Risk 1: Weak Teaching Copy

This is the highest-risk part of the initiative.

If the teaching language is generic, repetitive, or obvious, it will make the app feel hollow. Good teaching copy must be short, specific, and musically actionable.

Examples:

- Bad: "This tool helps you learn guitar."
- Better: "Start with one movable shape, play it, then find the same root nearby so the pattern connects to a sound and a location."

**Decision:** Write and review copy before building reusable UI for it.

### Risk 2: Contextless Cross-Page Flows

Buttons like "Practice this in Ear Training" are only valuable if the destination opens with the same musical context already loaded.

Without context handoff, the app makes a promise it does not keep.

**Decision:** Only build cross-page flows that carry enough state to feel seamless.

### Risk 3: Competing Guidance Systems

`Ear Training` already contains a `Plan` / ladder system. A new global recommendation layer must not create a second, competing curriculum model.

**Decision:** Treat the future global path as cross-feature guidance, not as a replacement for `Ear Training`'s internal skill ladders.

---

## Proposed Hybrid Model

The guided-learning layer should have three additive parts:

1. In-page teaching context
2. Contextual cross-page flows
3. Lightweight global recommended paths

Each layer should provide standalone value. Do not block later layers on full completion of earlier ones.

---

## Layer 1: In-Page Teaching Context

### Recommendation

Use one compact, collapsible teaching panel per priority page or mode.

Do not add five separate instructional blocks inline on every page. That creates clutter, trains users to ignore the content, and makes the app feel heavier than it is.

### Intended Shape

Each panel should be short enough to scan in a few seconds. Target a single tight block that answers:

- what this tool builds
- how to begin using it
- one common trap
- one recommended next step

### Example Tone

`CAGED Explorer`

`Learn the 5 movable chord shapes that map the neck. Start with one shape at a single root and listen for how the same pattern changes position without changing function. Common trap: memorizing the box before hearing the root. Next: open Scale Positions and find the scale pattern that lives around this shape.`

### UX Rules

- Collapsible
- Dismissible
- Prefer collapsed-by-default after first meaningful exposure
- Never permanently consume large amounts of vertical space
- Written for usefulness, not completeness

### Priority Order

1. `CAGED`
2. `Circle`
3. `Ear Training` mode picker / landing area
4. `Scale Positions`
5. `Dictionary` scales workflow
6. `Progressions`

### Copy Standard

Before implementing this layer broadly, create a small copy standard covering:

- max length
- tone
- what qualifies as a useful "common trap"
- acceptable teaching density
- when to omit a panel entirely

---

## Layer 2: Contextual Cross-Page Flows

### Recommendation

Only add flows that carry meaningful musical context from one tool into another.

These flows should feel like a continuation of the same learning moment, not like general navigation.

### High-Value Candidate Flows

#### 1. `Dictionary -> Scale -> Ear Training`

**Intent:** Let a user move from seeing a scale to drilling it.

**Context to carry:**
- root
- scale name
- relevant drill mode or tab

**Why it matters:** This is one of the clearest "see it -> train it" loops in the app.

#### 2. `Dictionary -> Chord -> Progressions`

**Intent:** Let a user move from isolated chord lookup into musical use.

**Context to carry:**
- selected chord
- optional immediate add-to-progression action

**Why it matters:** It turns reference into application.

#### 3. `CAGED -> Scale Positions`

**Intent:** Connect a selected shape to the scale area that surrounds it.

**Context to carry:**
- root
- shape or position context

**Why it matters:** This directly addresses a common CAGED learning gap.

#### 4. `Circle -> Progressions`

**Intent:** Move from harmonic function into a playable progression context.

**Context to carry:**
- selected chord or degree-derived chord

#### 5. `Ear Training -> Interval -> Interval Fretboard`

**Intent:** Move from hearing an interval to locating it visually and physically.

**Context to carry:**
- interval context
- root if practical

### Implementation Rule

If a flow cannot carry enough context to save the user from re-selecting everything, defer it.

### Likely Technical Mechanisms

- URL search params for lightweight, shareable state
- `sessionStorage` or existing local state handoff for more temporary context
- narrow, explicit contracts between source and destination pages

---

## Layer 3: Lightweight Global Recommended Paths

### Recommendation

Provide optional top-level guidance for users who want a starting point, but do not make it feel like the official required way to use the app.

### What This Is

- a "Start Here" or "Where should I begin?" entry point
- a small set of recommended tracks
- each track made from existing pages and tools
- no locks, no progress bars, no nagging

### What This Is Not

- a hard curriculum
- a replacement for direct exploration
- a second version of the `Ear Training` plan ladders

### Recommended Structure

Limit this to 3 tracks at first to avoid choice paralysis:

1. `New to Guitar Theory`
2. `Know Chords, Want More`
3. `Ear Training Focus`

Each track should be short, practical, and framed as a suggestion:

- 4-6 steps max
- no completion pressure
- one sentence per step explaining why it comes next

### Relationship to Ear Training Plan

The distinction should be:

- `Ear Training Plan`: within-feature skill ladders and deliberate drill progression
- `Global Recommended Path`: cross-feature orientation and suggested routes through the app

If that distinction cannot be made clear in the UI, delay Layer 3 until it can.

---

## What To Avoid

1. Persistent teaching banners that cannot be dismissed
2. Generic educational copy that says little
3. Cross-page links without meaningful handoff
4. Overlapping guidance systems with unclear authority
5. Any UX that creates accidental pressure to "complete the course"

The app should feel more helpful, not more supervisory.

---

## Proposed Rollout

## Phase 1: Validate the Teaching-Panel Pattern

**Goal:** Prove that concise teaching context improves comprehension without clutter.

**Scope:**
- Write copy first
- Add teaching panels to:
  - `CAGED`
  - `Circle`
  - `Ear Training` mode picker / landing area

**Success criteria:**
- A new user can understand what to do on these pages quickly
- The panels feel useful rather than ornamental
- The app still feels open and not tutorial-heavy

## Phase 2: Build 3 Contextual Flows

**Goal:** Prove that cross-page continuation increases usefulness.

**Scope:**
- `Dictionary scale -> Ear Training`
- `Dictionary chord -> Progressions`
- `CAGED -> Scale Positions`

**Success criteria:**
- Destination pages open with useful context already selected
- The user does not need to reconstruct the previous setup manually

## Phase 3: Expand Teaching Context

**Scope:**
- `Scale Positions`
- `Dictionary`
- `Progressions`

Use the validated copy and interaction pattern from Phase 1.

## Phase 4: Add Optional Start-Here Paths

**Goal:** Add lightweight structure without building a second curriculum system.

**Scope:**
- one entry point
- 3 recommended tracks
- no progress UI initially

**Success criteria:**
- Helpful to new users
- Easy to ignore for experienced users
- Clearly separate from `Ear Training`'s existing `Plan` system

---

## Immediate Next Steps

1. Write the copy standard
2. Draft actual teaching-panel copy for `CAGED`
3. Define a concrete state-handoff contract for `Dictionary scale -> Ear Training`
4. Validate whether `Ear Training` can accept the needed incoming context cleanly
5. Only after that, implement the first UI pattern

---

## First Build Priorities

If implementation begins soon, the recommended order is:

1. `CAGED` teaching panel
2. `Ear Training` orientation panel
3. `Dictionary scale -> Ear Training` contextual flow
4. `Circle` teaching panel
5. Copy standard document for future guided-learning content

This order keeps the work practical, visible, and low-risk while establishing the product rules needed for the rest of the initiative.
