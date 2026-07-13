# Scale Position Audit — Verification Against Authoritative Sources

Task 6 of `docs/superpowers/plans/2026-07-12-scale-position-audit.md`. This document records the source verification performed for each scale family's CAGED/box position data in `src/lib/ionianCagedPatterns.ts`, `src/lib/bluesBoxPatterns.ts`, and `src/lib/minorFamilyCagedPatterns.ts`.

## Method

For each scale family, the goal was to find one or more reputable, diagram-based teaching sources and compare shape ordering, position anchor frets, and (where extractable) individual fret/degree content against the app's stored patterns, normalizing for key by comparing relative fret offsets rather than absolute frets.

**Tooling constraint encountered:** the overwhelming majority of guitar-teaching sites present scale-position diagrams as images (JPG/PNG) or vector diagrams embedded in HTML/PDF, not as machine-readable text or tables. `WebFetch`'s automatic text extraction cannot read these. Where a source was a PDF, `WebFetch` still saved the binary locally and the `Read` tool was then able to render the PDF's pages as images and extract genuine diagram content — this worked for two sources (see Ionian and Minor Blues/Pentatonic below). Where a source was a JPG/PNG embedded in a webpage, no equivalent workaround was available within this session, and those sources could not be used despite being located.

## Ionian-family template (Major, and all diatonic modes derived from it)

**Source(s):** "G Major Scale · 5 Position CAGED System" by Pebber Brown (pbguitarstudio.com, © 1998–2009), PDF fetched and read via the WebFetch→local-file→Read workaround.

**Result:** Confirmed match. The source's arpeggio diagram section explicitly labels the five positions "Looks like E", "Looks like D", "Looks like C", "Looks like A", "Looks like G" in that order moving up the neck — matching `IONIAN_CAGED`'s comment and array order (E, D, C, A, G) in `ionianCagedPatterns.ts` exactly. A partial fret-offset cross-check (Position 1, low-E string) also matched: the app's offsets `[-1, 0, 2]` produce scale degrees `7, 1, 2`, which matched the corresponding degree sequence visible in the source. No changes made.

## Minor Blues

**Source(s):** "Emi Pentatonic and Blues Scale Overlay Positions" by Pebber Brown (pbguitarstudio.com, © 2007), 5-page PDF (one page per position), fetched and read via the same WebFetch→local-file→Read workaround.

**Result:** Confirmed match on position anchors and ordering. The source lays out five positions for E minor pentatonic/blues with low-E-string anchor frets at approximately 0, 3, 5, 7, and 9–10 for positions 1–5 respectively (each position's diagram is boxed at its home fret range, with an octave-repeat box shown 12 frets higher). This matches `MINOR_BLUES`'s low-E string offsets in `bluesBoxPatterns.ts` (`box1` offset 0, `box2` offset 3, `box3` offset 5, `box4` offset 7, `box5` offset 10) both in value and in ascending order. The source also confirms each position's diagram includes an added "blue note" beyond the plain pentatonic shape, consistent with the app's `MINOR_BLUES` having one extra fretted note per box relative to a plain minor-pentatonic shape.

Full string-by-string, fret-by-fret transcription of the source's diagrams was not reliably extractable (the PDF's fret-dot layout renders as a grid image rather than clean structured text), so this verification is at the position-anchor/shape-ordering level rather than a note-for-note diff. This is corroborated by the file's own build-time assertions (`validatePatterns` in `bluesBoxPatterns.ts`), which mechanically check, for every fret in every box: (a) the resulting interval belongs to the Minor Blues interval set `[0, 3, 5, 6, 7, 10]`, and (b) each box shares a blue-note connector (the b5) with its neighboring box. Both checks pass (see Self-Checks below). No changes made.

## Major Blues

**Source(s):** Same publisher/style as Minor Blues above; a dedicated Major Blues position-by-position diagram source was not fetched separately in this session (time-boxed per the plan's Step 2 scope).

**Result:** Not independently diagram-verified. `MAJOR_BLUES` in `bluesBoxPatterns.ts` is structurally the relative-major transposition of `MINOR_BLUES` (same box-anchor progression: offsets 0, 2, 4, 7, 9), which is the standard, theoretically-required relationship between the major blues scale and its relative minor blues scale (major blues built on scale degree 3 of the minor blues scale's key). The file's build-time assertions confirm every fret's interval belongs to `[0, 2, 3, 4, 7, 9]` (the Major Blues interval set) and that each box shares its blue note (the #2/b3) with its neighbor. No changes made.

## Major/Minor Pentatonic

**Source(s):** Same Pebber Brown "Emi Pentatonic and Blues Scale Overlay Positions" PDF as Minor Blues above (each page overlays the plain pentatonic shape alongside the blues-scale overlay).

**Result:** Confirmed match. Pentatonic scales are not a separately-stored pattern in this codebase — they are derived by omitting the blue note from the Blues box shapes at render time (per the existing architecture read during earlier tasks). Since the underlying `MINOR_BLUES`/`MAJOR_BLUES` box anchors and ordering are confirmed above, and the source PDF explicitly overlays "Emi Pentatonic" alongside "E Blues Scale" using the identical five box anchors, no separate pentatonic-specific data exists to diverge from the verified Blues data. No changes made.

## Harmonic Minor

**Source(s):** Attempted three sources: (1) a WebSearch for a Pebber Brown harmonic-minor CAGED PDF found no direct PDF link, only a general lesson-syllabus page; (2) Jens Larsen's "Harmonic minor Scale – CAGED" (jenslarsen.nl) — page text confirms a 5-position CAGED harmonic-minor diagram exists but the actual shape/fret data is embedded in a JPG image that WebFetch's text extraction could not read, and the image was not independently locatable at a fetchable URL; (3) Will Scott Guitar's "A Harmonic Minor - 5 Positions" — same limitation, diagram is a JPG image not extractable via WebFetch, and no PDF/local-file fallback was available (unlike the two PDF sources above, WebFetch does not save JPG binaries locally in a way `Read` can render).

**Result:** Not independently diagram-verified — no extractable authoritative source was found within a reasonable, time-boxed effort (six site/PDF attempts total across this task, spanning both this session and the prior one). Verification instead relies on two forms of evidence already available in the codebase:

1. **Theoretical derivation correctness:** `PATTERNS['Harmonic Minor']` in `minorFamilyCagedPatterns.ts` is generated by `alterAeolianPattern()` applied to the already-verified Aeolian (natural minor) template. Harmonic minor is defined, by standard music theory, as natural minor with a raised 7th degree — exactly the transform `alterAeolianPattern()` performs. Since the Aeolian template itself derives from the Ionian-family template (confirmed above against the Pebber Brown source), and the transform is a mechanical degree remap rather than hand-authored data, correctness of Harmonic Minor's shapes follows from correctness of (a) the Aeolian template and (b) the transform logic — neither of which was modified in this task.
2. **Build-time assertions:** `minorFamilyCagedPatterns.ts` runs the same two-part assertion (interval-membership against the Harmonic Minor interval set, and position-to-position overlap including the 12-fret octave wrap) at import time for every generated position. These pass (see Self-Checks below).

No changes made to `minorFamilyCagedPatterns.ts`.

## Melodic Minor

**Source(s):** None fetched — per the task brief's own allowance, Melodic Minor may be confirmed theoretically rather than via a separate diagram source.

**Result:** `PATTERNS['Melodic Minor']` is generated by the same `alterAeolianPattern()` transform, configured to raise both the 6th and 7th degrees relative to Aeolian — the standard definition of (ascending) melodic minor. Same reasoning as Harmonic Minor above applies: correctness follows from the verified Aeolian template plus the mechanical (unmodified) transform logic, and is corroborated by the same passing build-time assertions. No changes made.

## Phrygian Dominant

**Source(s):** None fetched — Phrygian Dominant is not independently stored data.

**Result:** `PATTERNS['Phrygian Dominant'] = PATTERNS['Harmonic Minor']` is a direct object-reference alias in `minorFamilyCagedPatterns.ts`, reflecting the standard music-theory relationship that Phrygian Dominant is mode V of Harmonic Minor (i.e., the same set of fretboard shapes, only the tonal center/root-relative-degree-labeling differs, which is handled elsewhere by root-fret lookup rather than by shape data). Since Harmonic Minor's shapes are verified above (via theoretical derivation + passing assertions), Phrygian Dominant inherits the same correctness by construction — there is no separate data that could diverge. No changes made.

## Self-Checks (Step 5)

All five self-check scripts ran to silent completion (exit 0, no thrown assertion errors):

```
npx tsx src/lib/ionianCagedPatterns.ts
npx tsx src/lib/minorFamilyCagedPatterns.ts
npx tsx src/lib/bluesBoxPatterns.ts
npx tsx src/lib/cagedScalePatterns.ts
npx tsx src/lib/symmetricScalePatterns.ts
```

`npm run lint` (`tsc --noEmit`) produced only the two pre-existing errors in the untracked stray file `src/pages/Caged 2.tsx` (unrelated to this task, present before this task started — see Task 3's report for the same observation). Zero errors in any file touched by this plan.

## Summary

No lib-file corrections were required. All evidence gathered — direct source confirmation for the Ionian family and Minor Blues/Pentatonic (shape ordering and position-anchor progression), theoretical-derivation correctness plus passing build-time assertions for Major Blues/Harmonic Minor/Melodic Minor/Phrygian Dominant — supports the existing stored pattern data being correct. The one honest gap: full note-for-note diagram transcription (every fret on every string, for every position) was not achievable for any scale family within the tooling available in this session, since almost all teaching sources present this data as images rather than structured text. Where PDFs were available, the WebFetch→local-file→Read workaround extracted genuine (if partial) diagram content; where sources were JPG/PNG only, no equivalent path existed.
