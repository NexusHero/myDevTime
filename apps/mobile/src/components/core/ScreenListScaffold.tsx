import { View } from 'react-native'
import { FlashList, type ListRenderItem } from '@shopify/flash-list'
import { useTheme } from '../../theme/ThemeProvider'

interface ScreenListScaffoldProps<T> {
  /** Fixed chrome that stays put while the body scrolls (title, hero). */
  readonly header: React.ReactNode
  /** The virtualized rows — the only part whose cost grows with the data. */
  readonly data: readonly T[]
  readonly renderItem: ListRenderItem<T>
  readonly keyExtractor: (item: T, index: number) => string
  /** Mean row height (px) FlashList uses to schedule off-screen rows. */
  readonly estimatedItemSize: number
  /** Non-list content that scrolls *above* the rows (cards, section labels). */
  readonly listHeader?: React.ReactNode
  /** Non-list content that scrolls *below* the rows (footnotes). */
  readonly listFooter?: React.ReactNode
  /** Shown in place of the rows when `data` is empty. */
  readonly listEmpty?: React.ReactNode
}

/**
 * The bounded-screen frame (ADR-0035 / design v1) for screens whose body is a
 * **long, unbounded list** — the credit ledger, a task's entry history. Same
 * contract as `ScreenScaffold` (a fixed header + exactly one scroll pane), but the
 * pane is a **virtualized `FlashList`** (§Perf, ADR-0045): only the visible rows
 * mount, so a multi-thousand-row history scrolls in constant cost instead of
 * mounting every row up front. Non-list content rides along as the list
 * header/footer so there is never a `FlashList` nested inside a `ScrollView`.
 */
export function ScreenListScaffold<T>({
  header,
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize,
  listHeader,
  listFooter,
  listEmpty,
}: ScreenListScaffoldProps<T>): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: t.color.bg }}>
      <View
        style={{
          paddingTop: t.spacing.s5,
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s3,
        }}
      >
        {header}
      </View>
      <FlashList
        data={data as T[]}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={estimatedItemSize}
        ListHeaderComponent={listHeader ? () => <>{listHeader}</> : undefined}
        ListFooterComponent={listFooter ? () => <>{listFooter}</> : undefined}
        ListEmptyComponent={listEmpty ? () => <>{listEmpty}</> : undefined}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s5,
        }}
      />
    </View>
  )
}
