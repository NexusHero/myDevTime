/**
 * Test shim for `@shopify/flash-list` (ADR-0027, mirrors the react-native-svg /
 * reanimated mocks). The shipped package carries native/Flow syntax Vitest does
 * not transform, and virtualization is irrelevant to render tests. This renders
 * the list eagerly (header · rows or empty · footer) with the same prop contract
 * the app uses — enough for a tree to mount and assert on.
 *
 * It follows the svg mock's pattern precisely: `require('react')` +
 * `React.createElement` (no JSX, no `react-native` import), because a file under
 * the repo-root mocks dir can only resolve modules that way.
 */
const React = require('react') as typeof import('react')

export type ListRenderItemInfo<T> = { readonly item: T; readonly index: number }
export type ListRenderItem<T> = (info: ListRenderItemInfo<T>) => React.ReactElement | null

type Slot = React.ComponentType | React.ReactElement | null | undefined

interface FlashListProps<T> {
  readonly data?: readonly T[] | null
  readonly renderItem?: ListRenderItem<T> | null
  readonly keyExtractor?: (item: T, index: number) => string
  readonly estimatedItemSize?: number
  readonly ListHeaderComponent?: Slot
  readonly ListFooterComponent?: Slot
  readonly ListEmptyComponent?: Slot
  readonly contentContainerStyle?: unknown
}

function renderSlot(slot: Slot): React.ReactNode {
  if (slot === null || slot === undefined) return null
  if (React.isValidElement(slot)) return slot
  return React.createElement(slot as React.ComponentType)
}

export function FlashList<T>(props: FlashListProps<T>): React.ReactElement {
  const items = props.data ?? []
  const body =
    items.length === 0
      ? [renderSlot(props.ListEmptyComponent)]
      : items.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
            props.renderItem ? props.renderItem({ item, index }) : null,
          ),
        )
  return React.createElement(
    React.Fragment,
    null,
    renderSlot(props.ListHeaderComponent),
    ...body,
    renderSlot(props.ListFooterComponent),
  )
}
