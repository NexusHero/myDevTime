---
name: mydevtime-design
description: Use this skill to generate well-branded interfaces and assets for myDevTime, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key things to remember about this system:
- Three accent themes (`data-theme="sovereign|ember|blueprint"`) × two modes (`data-mode="light|dark"`) — always pick or ask which combination to design in; don't assume Sovereign+light.
- **`--live` (vivid orange #FF5320)** is theme-independent: the running timer, start/stop button, planner now-line, REC dot and the logo playhead are ALWAYS this orange, in every theme. Royal blue = structure/trust; live orange = "right now". Never use `--live` for anything that isn't live.
- Display type is **Clash Display** (titles, hero numbers, wordmark) in all themes; body is system sans; numerals are JetBrains Mono. (Blueprint theme: Space Grotesk display + Inter body, myJob 1:1.)
- **`--ai-grad` (Blau → Violett → Orange)** is the AI signature, theme-independent like `--live`: every piece of AI output (Co-Planner briefing, replan prompt, Auto-Tracker insight, Assistant answer, the Assistant nav item) wears the gradient — as hairline border via `AICallout` or as ✦ chip. Deterministic UI never wears it; the gradient is the visual contract "AI proposes, you decide" (ADR-0005).
- Balance/strain (LoadMeter) is deterministic drift-for-your-body: signals (Überstunden-Trend, Pausen, Abend-Sessions, Meeting-Anteil) are always shown next to the score, recovery comes as an AI *proposal* (AICallout), and the copy never claims a diagnosis. The self-report half is `CheckinCard` (2 questions, weekly) plus `MoodCheck` (one-tap momentary mood on Today, max once/day); all self-reports stay local, and the AI may correlate self-report with passive signals but never infers feelings from work data alone.
- Never fill a "ghost"/Co-Planner-proposal block with a solid color — dashed outline only, that's the provenance signal.
- Numbers (durations, amounts, counts) always render in the mono family, tabular, in every theme.
- The logo is `assets/logo/` — "The Now-Split" v2 mark (white actual block + dashed ghost + orange playhead on a royal-blue tile). It is built to animate — see `guidelines/brand-splash.html` for the splash sting. Don't reuse myJob's bar-chart mark for myDevTime; they're intentionally different marks that share only the rounded-square tile convention.
