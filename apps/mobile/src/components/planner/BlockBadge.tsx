import { View } from 'react-native'
import { Text } from '../core/Text'
import { Icon } from '../index'

/**
 * A marker on a canvas block (issue #381): recurring, externally synced, tentative, FYI.
 *
 * These used to be typed codes — `↻`, `⇄ OL` — which is precisely why a `<Legend />` had to exist
 * to explain them, and a legend is a UI admitting it failed. A marker now shows a glyph from the
 * icon set and **states its meaning in words** for a screen reader, so the picture and the words
 * carry the same information rather than the picture carrying it alone (REQ-043).
 *
 * Purely presentational: the ink `color` is passed in, because a block's fill is the project
 * colour and the marker has to stay legible on top of it (never assumed — see `readableInk`).
 */
export interface BlockBadgeProps {
  /** Icon name from the shared set. Omit to fall back to `text`. */
  readonly icon?: string
  /** Literal marker text, for a marker that is a word people read (`FYI`) rather than a code. */
  readonly text?: string
  /** What the marker means, spelled out — this is what a screen reader announces. */
  readonly meaning: string
  /** Ink for glyph + border, chosen by the caller to stay readable on the block's fill. */
  readonly color: string
  readonly dotted?: boolean
}

export function BlockBadge({
  icon,
  text,
  meaning,
  color,
  dotted = false,
}: BlockBadgeProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={meaning}
      style={{
        borderWidth: 1,
        borderStyle: dotted ? 'dotted' : 'solid',
        borderColor: color,
        borderRadius: 3,
        paddingHorizontal: 3,
        marginRight: 4,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {icon !== undefined ? (
        <Icon name={icon} size={10} color={color} />
      ) : (
        <Text style={{ fontSize: 8, fontWeight: '800', color }}>{text ?? ''}</Text>
      )}
    </View>
  )
}
