# myDevTime Design System

**myDevTime** is cross-platform time tracking for developers and freelancers — iOS, Android
and Web from one codebase, positioned to out-differentiate Tyme (time tracking) and Tactiq
(meeting AI) with a concept neither owns: the app is not a logbook, it is a **Co-Planner**
for the developer's day. This design system is the visual language for that product.

This is a **from-scratch visual identity** built for myDevTime specifically — not a straight
port of its sister product **myJob** (a recruiting suite, DACH market). See "A note on the
logo" below for why.

## Sources

Built from the owner's direction (Suhay Sevinc) plus these two GitHub repositories:

- **[NexusHero/myDevTime](https://github.com/NexusHero/myDevTime)** — the product itself.
  Read: `README.md`, `docs/design/ux-vision.md` (the binding UX vision — Day Canvas,
  Co-Planner, the Island, command palette, instrument-style stats), `docs/adr/0011-ai-co-planner-and-design-language.md`,
  `packages/design/src/` (the settled tokens/palette/theme/nav as TypeScript — `tokens.ts`,
  `palette.ts`, `theme.ts`), `docs/design/brand/` (an earlier icon/wordmark exploration),
  `spikes/ui-prototype/README.md` (the validated click-through spike).
- **[NexusHero/Resume](https://github.com/NexusHero/Resume)** — the sister product, **myJob**
  (recruiting). Read for its design system at `design/myjob/` (tokens, components, readme) —
  this is where the **Blueprint** accent theme and the Space Grotesk/Inter/JetBrains Mono
  font trio are ported from, for direct family resemblance between the two products.

If you have access to either repo, go read the source directly — especially
`docs/design/ux-vision.md` in myDevTime (the product's binding design brief) and
`design/myjob/readme.md` in Resume (myJob's own design system, written the same way this one
is). Both explain intent this document only summarizes.

## Product & brand context

myDevTime unifies "Tyme-class" fast time tracking with a full German work-time story
(clock-in/out, breaks, overtime, signable monthly reports) and "Tactiq-class" meeting
transcription/AI, then adds a layer neither competitor has: a deterministic planning engine
that proposes the day, shows drift live against actuals, and reviews the evening — the **Day
Canvas**. One rule governs everything: deterministic logic decides anything that reaches a
timesheet or invoice; AI proposes, parses, explains, with visible provenance, but never acts
as the bookkeeper.

The brand brief for this system (owner, German, paraphrased): make the design as
differentiating as the feature set — colour, type and logo carry real weight. Ship as a
swappable-theme system like myJob's (Blueprint/Signal/Graphite), not a single fixed palette,
so **Sovereign Blue** (the new flagship), **Ember** (the amber "now" accent already validated
in the binding UX vision) and **Blueprint** (myJob's steel blue, ported 1:1) can be compared
side by side, in both light and dark mode.

## A note on the logo — my honest take

myJob's existing mark is three ascending bars in a rounded square — a generic "growth /
analytics" glyph you'll find on hundreds of SaaS dashboards. It doesn't encode anything
specific to recruiting. myDevTime already had a nicer attempt in `docs/design/brand/` (three
project-colored blocks + an amber "now" playhead) — closer, but the three flat bars still read
as a bar chart, not as *this* product's core idea.

**This system ships a new mark instead: "The Now-Split" v2** (`assets/logo/`) — one block cut
in two by the live "now" playhead. The left half is solid white on a royal-blue tile —
**actual**, committed reality. The right half is a dashed outline — **ghost**, the Co-Planner's
proposed plan. The playhead between them — a vertical tick and dot in the live orange
(`#FF5320`) — *is* "now". This is not decoration — it is the exact idea the whole product hangs
on ("plan and reality share one surface... drift is visible, not a report you look up later" —
ux-vision §2.1, §4). The mark is built to be **animated**: the splash sting
(`guidelines/brand-splash.html`) springs the tile in, slides the actual block, sweeps the
playhead and pulses the dot — app-store-ready and lively. It keeps the rounded-square tile
convention myJob used, so the products still read as siblings.

## Content fundamentals

- **Language & register:** Product UI and docs mix English chrome labels (Today, Planner,
  Reports) with German product/domain language in Co-Planner copy, matching the bilingual DACH
  reality already established in myJob. Address the user informally (**du-Form**) — see the
  briefing example below.
- **Tone:** calm, precise, administrative-but-human. State facts and next steps; never hype,
  never emoji.
  - Yes: *„Dein Tag: 3 Meetings, 4,5h Fokus möglich. Vorschlag?“* · *„Rest des Tages neu
    planen?“*
  - No: *„Wow! Dein Tag ist optimiert! 🚀“* · *„Revolutioniere dein Zeitmanagement!“* · bare
    *„Ein Fehler ist aufgetreten.“* (always say what to do next).
- **Numbers are the product.** Every duration, amount and count renders in the tabular mono
  family in every theme — `03:42:18`, `78%`, `+12%`. This is the one place typography carries a
  brand signature, regardless of which accent theme is active.
- **AI provenance is a copy rule, not just a visual one.** Ghost/ Co-Planner output always
  identifies itself as a proposal ("Vorschlag") and never claims to have already acted.
- **Casing:** sentence case for headings and buttons; UPPERCASE + wide tracking reserved for
  small mono kickers only (stat labels), never full sentences.
- **Emoji:** none. Status is carried by color/shape (rings vs. bars, good/critical tone), never
  by emoji or exclamation.

## Visual foundations

- **Theme architecture:** one token system, two independent axes — `data-theme` (accent:
  `blueprint` **default** per ADR-0023 / `sovereign` / `ember`) × `data-mode` (`light` default /
  `dark`), exactly mirroring myJob's Blueprint/Signal/Graphite + light/dark pattern ("einfach
  wie das andere Repo"). Any component works unmodified under all six combinations.
- **Sovereign** (royal blue `#3654E0` + white) is the flagship default. **Ember** (`#ff5320`)
  is the same vivid signal orange as `--live`, promoted to a full accent theme — evolved from
  the amber in the binding UX vision, pushed to GetYourGuide-level energy. **Blueprint**
  (`#2563EB`) is myJob's steel blue ported 1:1 — for buyers who want the two products to feel
  like one family. (Its original fixed dark "ink shell" sidebar was retired in July 2026 as
  dated; all themes now share the floating light/dark nav rail, and myJob kinship carries
  through accent + type only.)
- **The Live/Now color (`--live`, vivid orange `#ff5320`)** is theme-independent and is the
  brand's energy signature: the running timer, the big start/stop button, the planner's
  now-line, the recording dot and the logo's playhead are ALWAYS this orange, in every theme.
  Royal blue carries trust and structure; live orange carries "right now". This blue+orange
  duo is the deliberate compromise between the original Königsblau brief and the
  GetYourGuide-style boldness the owner asked for.
- **Typography:** all themes use **Clash Display** (ITF Free Font License, self-hosted) for
  display — titles, hero numbers, wordmark — a confident grotesk that is far less overused than
  Space Grotesk; **JetBrains Mono** for numerals; plain system-sans body for a light native-app
  feel. The Blueprint theme swaps display→**Space Grotesk** and body→**Inter** (myJob 1:1).
  All webfonts self-hosted in `fonts/`.
- **Color:** neutrals are a shared slate scale across all three themes (family resemblance
  independent of accent). The **project palette** — **12 CVD-safe categorical colors per mode**
  (ADR-0026, `palette.ts` 1:1, FNV-1a-assigned) — is the *only* other saturated color allowed on
  screen; never reused for chrome. Status is two-value only: **good** / **critical**, around a
  neutral baseline — no rainbow status scales. Soft status/accent fills are **absolute hexes**
  pre-blended over the default background (ADR-0026 §3), never rgba — predictable WCAG contrast
  on every elevation.
  - **Two percentages that must never look alike**, same principle as myJob's Match vs.
    Progress: **budget consumption** is a RADIAL ring (rides the project color, warns at 80%,
    critical at 100%); **overtime balance** is a LINEAR gauge centered on zero (good/critical
    tone only). Shape first, color second, so the distinction survives a theme swap.
- **Backgrounds:** flat surfaces only. No photography, no illustration, no mesh gradients. The
  *only* gradients in the whole system are the AI signature (`--ai-grad`, semantic — marks AI
  output) and the brand splash screen's radial glow — both purely functional, not decorative.
- **Borders & radii:** hairline 1px borders throughout. Radii step by purpose, never freely
  chosen: `chip` 6px, `block` 10px (inputs, day blocks), `card` 14px, `xl` 20px (hero surfaces),
  `pill` 999px (buttons, badges, the Island). Buttons and the Island are always fully pill-shaped.
- **Shadows:** soft, low-contrast, slate-tinted on light (never pure black); deepen to true-black
  based shadows on dark mode. Four steps: `xs → sm → md → lg`, no fifth.
- **Motion:** two purposes, two curves. `--ease-out` (calm) for chrome — hovers, fades, tab
  underlines. `--ease-spring` (gentle overshoot) exclusively for the Day Canvas and the Island —
  "motion is physics, not decoration" (ux-vision §4): blocks settle with a short spring when
  dropped, the Island morphs (not swaps) between collapsed/expanded. 140–320ms, nothing longer
  in the daily loop; both curves respect `prefers-reduced-motion` in real product code.
- **Hover / press:** buttons lift 1px + gain a soft shadow, never scale up. Switches/checkboxes
  transition color, never bounce. Focus draws an accent border + a soft glow ring
  (`0 0 0 3px var(--accent-soft)`), same convention as myJob.
- **Transparency & blur:** used sparingly, only on the Island (a floating dark pill with a real
  drop shadow, no blur needed since it never sits over other content) and the Blueprint theme's
  topbar chrome (ported convention). Working surfaces stay opaque.
- **Ghost vs. actual — the one visual rule unique to this product:** AI/Co-Planner proposals are
  *never* filled with a solid color. They are always a dashed outline. This is the provenance
  signal — a design that fills a ghost block solid fails review, however pretty (ux-vision §4,
  §5).

## Iconography

No pre-existing icon set was provided in either source repo for myDevTime, so this system
ships its **own brand line-icon set** as a real component: `Icon` (`components/core/Icon.jsx`)
— 23 hand-built glyphs on a 24×24 grid, 2px stroke, round caps, `currentColor`: navigation
(today/timer/planner/projects/reports/meetings/profile/assistant), timer controls
(play/pause/stop/record), actions (plus/check/x/search/export/edit) and misc
(mic/break/settings/chevrons). `AppShell` consumes this set. Extend `ICON_PATHS` on the same
grid rather than importing a mismatched CDN set. No emoji, no icon font, no filled or
multicolor icons. (myJob's own 24×24 feather-style set was deliberately not reused — the two
products share construction rules, not glyphs.)

## Fonts

`fonts/` self-hosts everything: **Clash Display** (Medium/Semibold/Bold, ITF Free Font License
— free for commercial use, sourced from Fontshare's official web files) is the brand display
face. The Space Grotesk / Inter / JetBrains Mono `.woff2` files are copied verbatim from
myJob's repo (`Resume/design/fonts/`, SIL OFL): JetBrains Mono is the numeral face in all
themes; Space Grotesk + Inter serve the Blueprint theme's myJob-1:1 fidelity.

## Iconography assets & intentional additions

- `assets/logo/` — the full "Now-Split" mark: `icon.svg` (dark tile), `icon-light.svg`,
  `icon-mono.svg` (currentColor, for recoloring per theme), `mark-glyph.svg` (untiled),
  `favicon.svg` (simplified, no dashes — legible at 16px), `wordmark.svg`,
  `lockup-horizontal.svg`, `splash.svg`.
- **Intentional additions beyond a literal source inventory** (myDevTime had no shipped
  component library, only a validated UX-vision doc, so this system authors the standard set a
  product like this needs): `Button`, `IconButton`, `Badge`, `Card`, `Input`, `Select`,
  `Switch`, `Checkbox`, `Tabs` — conventional primitives sized to the brand. `DayBlock` and
  `Island` are the signature primitives *specified* by the UX vision (§2.1, §2.3).
  `BudgetRing`, `OvertimeGauge`, `WeekSparkline`, `Heatmap`, `StatTile` implement the
  "instrument-style stats" (§2.5) verbatim. `AppShell` implements the fixed IA (§3) and mirrors
  `@mydevtime/design`'s `chromeForWidth`/`PHONE_TABS`/`SIDEBAR_ITEMS` exactly.

## Index / manifest

**Foundations**
- `styles.css` — the single entry point consumers link. `@import` manifest only.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `themes.css`
  (accent swap), `modes.css` (light/dark), `base.css`.
- `fonts/` — self-hosted Space Grotesk / Inter / JetBrains Mono (Blueprint theme only).
- `guidelines/` — specimen cards for the Design System tab: `colors-accents`, `colors-live`
  (the theme-independent live/now orange), `colors-ai` (the AI signature gradient),
  `colors-neutral`, `colors-modes`, `colors-status`,
  `colors-project`, `type-families`, `type-scale`, `spacing-scale`, `spacing-radii`,
  `effects-shadows`, `effects-motion`, `brand-logo`, `brand-splash` (animated logo sting),
  `brand-voice`.
- `assets/logo/` — the full mark family (see above).

**Components** (`components/`, namespace `window.MyDevTimeDesignSystem_254296`)
- `core/` — `Button`, `IconButton`, `Badge`, `Card`, `Icon` (the brand line-icon set),
  `EmptyState` (calm empty-state pattern — icon disc + fact + next step, no illustrations),
  `AICallout` (the single container for AI output: blue→orange gradient hairline + ✦ chip;
  deterministic UI never wears the gradient — it's the visual "AI proposes, you decide"
  contract, ADR-0005), `AIAskBar` (the omnipresent "ask your data" bar — AI reachable on
  every screen with scope chips and grounded inline answers, not just in the Assistant tab).
- `forms/` — `Input`, `Select`, `Switch`, `Checkbox`.
- `canvas/` — `DayBlock` (the Day Canvas time-block primitive, actual/ghost/meeting),
  `Island` (persistent live-state pill).
- `instruments/` — `BudgetRing`, `OvertimeGauge`, `WeekSparkline`, `Heatmap`, `StatTile`,
  `BoxPlot` (Tagesarbeitszeit-Verteilung vs. Soll — der verständliche Ersatz für ein abstraktes
  Saldo-Gauge in Reports), `LoadMeter` (Belastungs-Skala für das Balance-Feature: Score aus
  deterministischen Signalen — Überstunden-Trend, Pausen, Abend-Sessions, Meeting-Anteil —
  nie eine Diagnose; bei erhöhter Zone schlägt die KI per `AICallout` Erholung vor, z. B.
  meetingfreien Tag + Feierabend-Ghost), `CheckinCard` (wöchentlicher 2-Fragen-Check-in im
  OLBI-Kurzform-Stil — Erschöpfung + Abschalten auf 5er-Skalen; Selbstauskunft × passive
  Signale ist das wissenschaftlich ehrliche Belastungssignal, die Antworten bleiben lokal),
  `MoodCheck` (Moment-Stress per Ein-Tap — Gut/Angespannt/Gestresst, EMA-Muster; erscheint
  NICHT als stehendes Widget, sondern nur im Ausstempel-Moment als transiente Zeile, nie modal).
  Der Balance-Bereich in Reports zeigt zusätzlich den 10-Wochen-Trend (Linie = passive
  Signale, Quadrate = Check-ins) — Burnout ist ein Prozess, keine Momentaufnahme.
- `navigation/` — `AppShell` (sidebar/tabs posture), `Tabs`.
- Each component: `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`; one `*.card.html`
  thumbnail per directory.

**UI kit** (`ui_kits/devtime/`) — **myDevTime Workspace**. Seven desktop screens (Today/Day
Canvas + hero tracker + Auto-Tracker + idle hint + focus streak, Planner week-Gantt **with the
Task-Inbox rail — where imported tickets from ALL connectors land (Jira, Linear, GitHub —
managed in Profile → Integrations)**: built for volume (search, tag + source
filters, project groups, own scroll pane, per-row source badge); "Planen" drops a ticket as a ghost into the next
free slot, closing the loop Jira → ghost → tracked → time back on the ticket, Absence
— Urlaubskonto/LeaveBalance, Krank, Gleitzeit-AZK, Jahresübersicht with BW public holidays,
Antrag flow, AI Brückentag proposal —, Projects
with budget rings, Reports instruments, Meetings with transcripts + AI insights + Jira/Linear/
Slack export, Profile/Settings) behind one `AppShell`, with a live theme + light/dark switcher
so all six palette combinations compare in place. The Island appears bottom-center on every
screen except Today (there the hero tracker carries the live state — never two clocks at once).
Plus `mobile.html` — the phone posture (5 bottom tabs, NL Quick-Add, floating Island), same IA
per ux-vision §3; tablet/desktop use the sidebar posture shown in `index.html`. And
`onboarding.html` — the first-run flow (logo sting → Sollzeit stepper → first project / import
from Toggl/Clockify/CSV → Auto-Tracker opt-in with privacy statements → done). One decision per
step, every data-touching step skippable, bounded layout.

**Other** — `SKILL.md` (Agent-Skills wrapper), this `readme.md`.

> The compiler generates `_ds_bundle.js`, `_ds_manifest.json` and `_adherence.oxlintrc.json` —
> never edit those by hand.
