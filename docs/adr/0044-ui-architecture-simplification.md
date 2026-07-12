# ADR 0044: UI Architecture Simplification Strategy

## Status

**Proposed**

## Context

Following the core architecture simplification (ADR-0043), the UI layer across `apps/mobile` and `@mydevtime/design` requires a similar reduction in "accidental complexity."

Currently, the project hand-rolls a massive, production-grade custom design system from scratch (ADR-0030). Building accessible, cross-platform components (buttons, inputs, modals, layout primitives) using bare `react-native-web` requires immense manual effort to map ARIA roles, handle focus/hover states, and maintain performance. Additionally, complex animations are handled manually via `react-native-reanimated` (ADR-0041), and responsive navigation is built custom without a standard router.

For a solo developer or small team, maintaining this custom infrastructure slows down feature delivery and risks subpar web accessibility and desktop performance compared to the native mobile experience.

## Decision

We propose the following UI architecture simplifications:

1. **Adopt a Universal UI Framework (e.g., Tamagui)**:
   - Retire the practice of building raw UI components (buttons, inputs, forms) from scratch using `View` and `Text`.
   - Integrate a modern Universal UI library like **Tamagui** (or Gluestack) that acts as the foundation.
   - We will inject our existing design tokens (Sovereign, Ember, Blueprint) into this framework, preserving our unique visual identity while offloading the maintenance of Web ARIA accessibility, pseudo-states (hover/focus), and responsive styling.

2. **Simplify Animations with Moti**:
   - Instead of writing low-level `react-native-reanimated` shared values and worklets for standard UI transitions (mount/unmount, hover states, layout shifts), adopt **Moti**.
   - Moti wraps Reanimated with a declarative API similar to Framer Motion, heavily reducing boilerplate.

3. **Standardize Navigation via Expo Router**:
   - Retire the custom "Responsive Nav Shell".
   - Adopt **Expo Router** to handle deep-linking, browser history, and standard layouts (tabs for mobile, sidebars for desktop) natively.

4. **Address the Web Semantic HTML Gap**:
   - By leveraging a mature UI framework (Tamagui), we ensure better semantic HTML output (e.g., using proper `<button>`, `<header>`, `<main>` tags on the web instead of generic `<div dir="auto">` wrappers from `react-native-web`), closing the accessibility gap between native and desktop web.

## Consequences

- The `apps/mobile/src/components/` directory will see a massive reduction in code size. Many custom components will be replaced by generic, theme-injected framework components.
- The learning curve shifts from "learning our custom components" to "learning the chosen UI framework (Tamagui) and Moti".
- Web accessibility and keyboard navigation will improve significantly out of the box.
- The `react-native-reanimated` setup remains but will mostly be abstracted behind Moti for standard UI work.
