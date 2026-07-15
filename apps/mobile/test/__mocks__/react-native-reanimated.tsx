/**
 * Test shim for `react-native-reanimated` (aliased in vitest.config). The real
 * package needs the native/worklet runtime (`__DEV__`, JSI) that jsdom cannot
 * provide, so component render tests use this minimal stand-in: it evaluates the
 * derived worklet once as plain JS, which is all a render assertion needs. The
 * UI-thread ticking itself is verified on device (ADR-0027), outside the gate.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// This shim is an alias target resolved from the repo root, where neither
// `react-native` (aliased) nor `react-native-web` is a resolvable dependency.
// `react` is, so `Animated.View` is a dependency-free passthrough that just
// renders its children — enough for render assertions (the wrapper's animated
// style is irrelevant; motion is verified on device, ADR-0027/0048).
const React = require('react') as typeof import('react')

type Updater<T> = () => T

export const useSharedValue = <T,>(initial: T): { value: T } => ({ value: initial })
export const useDerivedValue = <T,>(fn: Updater<T>): { value: T } => ({ value: fn() })
export const useAnimatedProps = <T,>(fn: Updater<T>): T => fn()
export const useAnimatedStyle = <T,>(fn: Updater<T>): T => fn()
export const withRepeat = <T,>(value: T): T => value
export const withTiming = <T,>(value: T): T => value
export const withDelay = <T,>(_delay: number, value: T): T => value
export const Easing = {
  linear: (t: number): number => t,
  inOut: (fn: (t: number) => number) => fn,
  ease: (t: number): number => t,
}

/**
 * The motion pass (design v4) gates every animation behind the OS reduced-motion
 * setting. In the render-test env we always report reduced motion ON, so all
 * animated instruments render at their final/rest state — component assertions
 * see real values (e.g. "62%"), never a mid-animation frame, and the infinite
 * loops (Island pulse, tracker breathing) never mount. On-device motion is
 * verified outside the gate (ADR-0027/0048).
 */
export const useReducedMotion = (): boolean => true

const AnimatedView = ({ children }: { children?: React.ReactNode }): React.ReactNode =>
  React.createElement(React.Fragment, null, children)

const Animated = {
  createAnimatedComponent: <C,>(component: C): C => component,
  View: AnimatedView,
}

export default Animated
