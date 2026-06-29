# Codex Prompt — Tuning-Aware Fretboard

Paste the following as your opening message to Codex:

---

I need you to implement a feature in my GuitarMaster React app. The full plan is at:

`docs/superpowers/plans/2026-06-29-tuning-aware-fretboard.md`

Read that file first — it is your complete requirements. Follow it exactly, task by task.

**Summary of what you're building:**

The `Fretboard` component in `src/components/Fretboard.tsx` is currently hardcoded to standard guitar tuning (E A D G B E). The Dictionary page has a tuning selector (Open G, Open D, Drop D, etc.) that already changes the audio but doesn't change the visual fretboard. Your job is to make the fretboard reflect the selected tuning visually.

**The change is small — two files, two tasks:**

1. Add `tuning?: Tuning` prop to `Fretboard.tsx` (default `STANDARD_TUNING`), and pass it through to every `getFretNote()` call inside the component.
2. Pass `tuning={currentTuning}` into the `<Fretboard>` render in `Dictionary.tsx`.

**Key facts:**

- `getFretNote(stringIndex, fret, tuning?)` in `src/lib/audio.ts` already accepts a tuning argument — you are just threading it through, not reimplementing note math.
- `Tuning` and `STANDARD_TUNING` are in `src/types.ts`.
- `Dictionary.tsx` already has `const [currentTuning, setCurrentTuning] = useState<Tuning>(TUNINGS['Standard'])` — you just wire it into the Fretboard prop.
- All other pages (Ear Training, Scale Positions, CAGED, etc.) do NOT get this change — they stay standard tuning. The `tuning` prop is optional and defaults to `STANDARD_TUNING`, so no other call sites need updating.
- Lint command: `npm run lint` (runs `tsc --noEmit`). Must pass with zero errors before each commit.
- No new dependencies. No new files. Only modify `Fretboard.tsx` and `Dictionary.tsx`.

**After both tasks, verify manually:**
1. `npm run dev`
2. Go to the Dictionary → Scales tab
3. Change the tuning selector to "Open G"
4. Confirm the open-string dots now show D, G, D, G, B, D instead of E, A, D, G, B, E
5. Confirm scale dots reposition correctly
6. Switch back to Standard — confirm it reverts

Follow the plan file step by step. Commit after each task. Do not modify any other files.
