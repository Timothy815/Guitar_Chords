# Guided Learning Copy Standard

**Purpose:** Define the writing rules for the guided-learning layer so the app gains real teaching value instead of generic instructional noise.

**Applies to:**
- in-page teaching panels
- "next recommended step" copy
- cross-page flow labels and helper text
- optional future "Start Here" track blurbs

**Core Principle:** Practical, specific, and musically useful beats complete, academic, or motivational.

---

## Tone

Write like a good guitar teacher in the first 30 seconds of a lesson:

- direct
- concrete
- musician-first
- brief
- non-patronizing

Avoid:

- fluffy encouragement
- academic theory exposition
- vague benefit language
- marketing tone
- obvious filler

Examples:

- Bad: `This tool helps you understand music better.`
- Better: `Use one shape at one root first, then move it so your hand learns the pattern and your ear hears the same function in a new place.`

---

## Teaching Panel Format

Each panel should usually be one short block, not multiple labeled sections.

Target structure:

1. What this tool trains
2. How to start
3. One common trap
4. One next step

This can usually fit in 3-4 sentences.

### Length

- Preferred: 45-90 words
- Hard max: 110 words
- If it needs more, the page probably needs a tighter concept, not more copy

### Good Panel Example Shape

`Learn the 5 movable chord shapes that map the neck. Start with one familiar shape at a single root and listen for how the same pattern moves without changing its job. Common trap: memorizing the box before hearing the root. Next: open Scale Positions and find the scale pattern that sits around the same shape.`

---

## "Common Trap" Rule

The most important sentence in most panels is the trap sentence. It must describe a real learning failure mode, not a moral instruction.

Good traps:

- `memorizing the box before hearing the root`
- `playing the shape without noticing where the chord tones sit`
- `running the scale pattern without connecting it to the key center`

Bad traps:

- `not practicing enough`
- `going too fast`
- `forgetting music theory`

Rule: if the sentence would apply equally well to any instrument, it is probably too generic.

---

## "How to Start" Rule

Opening guidance must reduce choice overload.

Good:

- `Start with one shape at one root.`
- `Pick one degree and listen to how it resolves back to I.`
- `Play the scale up once, then name the root notes only.`

Bad:

- `Explore the page and try different options.`
- `Use any mode you like.`

Rule: the first action should be obvious enough that a new user can do it immediately.

---

## "Next Step" Rule

The next-step sentence should point to a specific adjacent skill, not vaguely encourage more practice.

Good:

- `Next: take this shape to Scale Positions and find the scale around it.`
- `Next: add this chord to Progressions and hear it in a musical context.`
- `Next: drill this scale in Ear Training so the pattern becomes recall, not recognition.`

Bad:

- `Next: keep practicing.`
- `Next: explore more features.`

Rule: next steps should be actionable and, when possible, map to an actual cross-page flow.

---

## Cross-Page Flow Copy Rules

Buttons and helper text for contextual flows must promise exactly what the destination will do.

### Button Labels

Prefer:

- `Drill This in Ear Training`
- `Build a Progression`
- `See the Scale Around This Shape`
- `Train This Interval on the Fretboard`

Avoid:

- `Go to Ear Training`
- `Open Progressions`
- `Learn More`

### Helper Text

Optional helper text should clarify the carried context:

- `Opens Ear Training with this root and scale ready to drill.`
- `Adds the current chord to your progression workspace.`

If the app cannot actually carry that context yet, do not use the stronger copy.

---

## Start-Here Track Copy Rules

If a lightweight global path is added later:

- each track should have a plain-language promise
- each step should say why it comes next
- no "complete the course" tone

Good track label:

- `Know Chords, Want More`

Bad track label:

- `Intermediate Curriculum Pathway`

Good step blurb:

- `Start in CAGED so chord shapes become neck landmarks before you add scales.`

Bad step blurb:

- `This lesson introduces foundational concepts for future learning.`

---

## Vocabulary Rules

Prefer:

- `root`
- `shape`
- `position`
- `hear`
- `find`
- `resolve`
- `moveable`
- `chord tones`
- `landmark`

Use sparingly unless the page already supports them clearly:

- `voice leading`
- `functional harmony`
- `modal interchange`
- `tertian`

Do not write above the level the UI currently supports.

---

## Review Checklist

Before shipping any guided-learning copy, check:

1. Can a player act on the first sentence immediately?
2. Is the trap sentence specific to the page's musical skill?
3. Does the next-step sentence point somewhere concrete?
4. Would a working teacher actually say this out loud?
5. Can at least 20% of the words be cut without losing meaning?

If the answer to #5 is no, the copy is probably already tight enough.

---

## Initial Reference Standard

Use the `CAGED` panel as the first tone-setting example for the guided-learning layer. Later panels should feel consistent with it in density, specificity, and practicality.
