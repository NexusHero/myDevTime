import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { TimerScreen } from './src/timer/TimerScreen.js'
import { EntriesDashboard } from './src/dashboard/EntriesDashboard.js'
import { DayCanvas } from './src/canvas/DayCanvas.js'

/**
 * Spike #1 shell — a tiny tab switcher over the four proof surfaces (ADR-0004).
 * This is the human-runnable half: `npx expo start` then open on an iOS device,
 * an Android device, and two desktop browsers, and walk the on-device checklist
 * in docs/spikes/0001-client-rn-expo.md. The correctness-critical logic each tab
 * uses is the pure, machine-tested code under src/**/*.ts.
 */
type Tab = 'timer' | 'entries' | 'canvas'
const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'timer', label: 'Timer (Q1)' },
  { key: 'entries', label: 'Dashboard (Q2/Q3)' },
  { key: 'canvas', label: 'Canvas (Q4)' },
]

export default function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('timer')
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="auto" />
      <View style={styles.body}>
        {tab === 'timer' && <TimerScreen />}
        {tab === 'entries' && <EntriesDashboard />}
        {tab === 'canvas' && <DayCanvas />}
      </View>
      <View style={styles.tabbar}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 24,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabLabel: { color: '#888', fontWeight: '600' },
  tabActive: { color: '#2563eb' },
})
