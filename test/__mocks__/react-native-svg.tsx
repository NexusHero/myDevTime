/**
 * Mock shim for react-native-svg in the Vitest environment.
 *
 * react-native-svg's commonjs entry (`lib/commonjs/index.js`) internally
 * require('react-native'), loading the real React Native package whose index.js
 * contains Flow-typed re-exports (`import typeof ...`) that Node cannot parse.
 * Even with resolve.alias mapping react-native → react-native-web, the alias
 * is bypassed because the require() call inside the already-loaded commonjs
 * bundle resolves through Node's native module system, not Vite's resolver.
 *
 * This shim replaces the entire package via resolve.alias so the real
 * react-native-svg (and its problematic transitive require) is never loaded.
 * Each SVG element is mapped to a simple React forwardRef wrapping the
 * corresponding HTML <svg> / SVG DOM element, which is sufficient for
 * component-tree assertions in tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const React = require('react') as typeof import('react')

function createSvgComponent(tag: string) {
  const Component = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
    React.createElement(tag, { ...props, ref }),
  )
  Component.displayName = tag.charAt(0).toUpperCase() + tag.slice(1)
  return Component
}

export const Svg = createSvgComponent('svg')
export const Circle = createSvgComponent('circle')
export const Rect = createSvgComponent('rect')
export const Path = createSvgComponent('path')
export const Line = createSvgComponent('line')
export const Polyline = createSvgComponent('polyline')
export const Polygon = createSvgComponent('polygon')
export const Ellipse = createSvgComponent('ellipse')
export const G = createSvgComponent('g')
export const Text = createSvgComponent('text')
export const TSpan = createSvgComponent('tspan')
export const Defs = createSvgComponent('defs')
export const LinearGradient = createSvgComponent('linearGradient')
export const RadialGradient = createSvgComponent('radialGradient')
export const Stop = createSvgComponent('stop')
export const ClipPath = createSvgComponent('clipPath')
export const Mask = createSvgComponent('mask')
export const Use = createSvgComponent('use')
export const ForeignObject = createSvgComponent('foreignObject')
export const Marker = createSvgComponent('marker')
export const Pattern = createSvgComponent('pattern')
export const Image = createSvgComponent('image')

export default Svg
