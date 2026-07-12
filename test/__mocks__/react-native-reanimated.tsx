/**
 * Test shim for `react-native-reanimated` (aliased in vitest.config). The real
 * package needs the native/worklet runtime (`__DEV__`, JSI) that jsdom cannot
 * provide, so component render tests use this minimal stand-in: it evaluates the
 * derived worklet once as plain JS, which is all a render assertion needs. The
 * UI-thread ticking itself is verified on device (ADR-0027), outside the gate.
 */
type Updater<T> = () => T

export const useSharedValue = <T,>(initial: T): { value: T } => ({ value: initial })
export const useDerivedValue = <T,>(fn: Updater<T>): { value: T } => ({ value: fn() })
export const useAnimatedProps = <T,>(fn: Updater<T>): T => fn()
export const withRepeat = <T,>(value: T): T => value
export const withTiming = <T,>(value: T): T => value
export const Easing = { linear: (t: number): number => t }

const Animated = {
  createAnimatedComponent: <C,>(component: C): C => component,
}

export default Animated
