# @mydevtime/design

The settled **visual language** ([`docs/design/ux-vision.md`](../../docs/design/ux-vision.md) §4)
as pure, platform-agnostic TypeScript — the token foundation of the design system
([#11](https://github.com/NexusHero/myDevTime/issues/11), Phase A). Values are lifted 1:1 from
the validated UI prototype ([`spikes/ui-prototype`](../../spikes/ui-prototype)).

No React, no React Native imports — so it is held to the ≥90% coverage bar like the domain core
and consumed identically by React Native and react-native-web (ADR-0004).

## What's here

| Module | Exports |
|--------|---------|
| `tokens` | `spacing` (8-pt grid), `fontSize`, `radius`, `motion` (150–250 ms), `fontFamily` (UI sans + mono numerals), `touchTarget` (44 pt) — theme-independent |
| `palette` | `dark` / `light` `Palette`s (near-black surfaces, one "Ember" accent) + the CVD-checked `projectColors` |
| `theme` | `theme(mode)` → a resolved `Theme` bundling palette + scales; `themes.{dark,light}` pre-resolved |
| `projects` | `projectColor(id, mode)` — **deterministic** id→color (FNV-1a hash), stable across sessions and theme flips: the data is the color |
| `contrast` | WCAG `contrastRatio` / `meetsAA` — the a11y contract is a test (`contrast.test.ts` asserts ink-on-surface clears AA in both themes, so a token tweak that breaks contrast fails the build) |
| `nav` | The app-shell route map (ux-vision §3 IA): `ROUTES`, `PHONE_TABS`, `SIDEBAR_ITEMS`, and pure `buildPath` / `parsePath` — a deep-link route for every screen (the AI assistant & OS quick actions link into these) |
| `responsive` | Pure width→layout: `layoutForWidth` (phone/tablet/desktop) and `chromeForWidth` → `{ navMode: tabs \| sidebar, splitView }` — tabs on phone, sidebar + split-view on tablet/web |

## Usage

```ts
import { theme, projectColor, buildPath, parsePath, chromeForWidth } from '@mydevtime/design'

const t = theme('dark')
t.color.accent      // '#e8a33d'
t.spacing.s4        // 16
projectColor('proj-42', 'dark')       // stable categorical color for that project

buildPath('project', { projectId: 'p1' }) // '/projects/p1'
parsePath('/projects/p1')                 // { screen: 'project', params: { projectId: 'p1' } }
chromeForWidth(375)                        // { layout:'phone', navMode:'tabs', splitView:false }
```

The React Native `ThemeProvider`, the rendered navigation shell, and the component set (the
Island, ghost blocks, canvas primitives) are the **next phases** of #11 and consume this package;
they live in `apps/mobile` once that Expo app is scaffolded.
