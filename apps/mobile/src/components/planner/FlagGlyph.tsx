import Svg, { Path } from 'react-native-svg'

/**
 * The pennant/Wimpel glyph that marks an **event** (holiday, company event, info)
 * throughout the Planner month/year facets (design v6). Events never count toward
 * load and never block — the flag is their consistent, work-free signature.
 */
export function FlagGlyph({
  color,
  size = 10,
}: {
  readonly color: string
  readonly size?: number
}): React.JSX.Element {
  return (
    <Svg width={(size * 8) / 10} height={size} viewBox="0 0 8 10">
      <Path
        d="M1 0.5 V9.5 M1 1 H7 L5.4 2.9 L7 4.8 H1"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  )
}
