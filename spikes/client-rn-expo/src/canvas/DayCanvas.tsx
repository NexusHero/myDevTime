import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { DEFAULT_GEOM, minToY, snap, type Block } from './layout.js'

/**
 * Q4 surface: the Day Canvas direct-manipulation prototype (ADR-0011). Each block
 * is dragged by a pan gesture whose per-frame math runs in a Reanimated worklet
 * on the UI thread — the JS thread is untouched while dragging, which is how RN
 * holds 60fps. The worklet calls the SAME pure `snap()` from layout.ts (tested
 * separately); `runOnJS` commits the final position back to React state only on
 * release. A handful of blocks here is enough to feel the gesture fidelity on a
 * device.
 */
const g = DEFAULT_GEOM
const SEED: Block[] = [
  { id: 'a', startMin: 540, endMin: 600 }, // 09:00–10:00
  { id: 'b', startMin: 630, endMin: 720 }, // 10:30–12:00
  { id: 'c', startMin: 810, endMin: 870 }, // 13:30–14:30
]

function DraggableBlock({
  block,
  onCommit,
}: {
  block: Block
  onCommit: (id: string, startMin: number) => void
}): React.JSX.Element {
  const translateY = useSharedValue(0)
  const baseTop = minToY(block.startMin, g)

  const pan = Gesture.Pan()
    .onUpdate(e => {
      'worklet'
      translateY.value = e.translationY
    })
    .onEnd(e => {
      'worklet'
      const snappedStart = snap(block.startMin + e.translationY / g.pxPerMin, g)
      translateY.value = (snappedStart - block.startMin) * g.pxPerMin
      runOnJS(onCommit)(block.id, snappedStart)
    })

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const height = (block.endMin - block.startMin) * g.pxPerMin
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.block, { top: baseTop, height }, style]}>
        <Text style={styles.blockLabel}>{block.id.toUpperCase()}</Text>
      </Animated.View>
    </GestureDetector>
  )
}

export function DayCanvas(): React.JSX.Element {
  const [blocks, setBlocks] = useState<Block[]>(SEED)
  const commit = (id: string, startMin: number): void => {
    setBlocks(bs =>
      bs.map(b => (b.id === id ? { ...b, endMin: startMin + (b.endMin - b.startMin), startMin } : b)),
    )
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Day Canvas · drag blocks (60fps target)</Text>
      <View style={styles.canvas}>
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} style={[styles.hourLine, { top: h * 60 * g.pxPerMin }]}>
            <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}:00</Text>
          </View>
        ))}
        {blocks.map(b => (
          <DraggableBlock key={b.id} block={b} onCommit={commit} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8 },
  h1: { fontSize: 18, fontWeight: '700' },
  canvas: { flex: 1, position: 'relative', marginLeft: 48 },
  hourLine: { position: 'absolute', left: -48, right: 0, height: 1, backgroundColor: '#eee' },
  hourLabel: { position: 'absolute', left: 0, top: -7, fontSize: 10, color: '#aaa' },
  block: {
    position: 'absolute',
    left: 8,
    right: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 6,
    opacity: 0.9,
  },
  blockLabel: { color: 'white', fontWeight: '700' },
})
