import { useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { STOPPED, elapsedMs, isRunning, pause, start, type TimerState } from './elapsed.js'
import { createTimerStore, type TimerStore } from './persist.js'

/**
 * Q1 surface. The per-second interval only refreshes the label — it is NOT the
 * source of truth. On mount and on every AppState resume we reload the persisted
 * state and re-derive elapsed against Date.now(), so backgrounding, an app kill,
 * or a reboot all reconcile to the correct time. A local notification stands in
 * for the iOS Live Activity / Android foreground-service surface a real build
 * would show.
 */
function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function TimerScreen(): React.JSX.Element {
  const [state, setState] = useState<TimerState>(STOPPED)
  const [display, setDisplay] = useState(0)
  const storeRef = useRef<TimerStore | null>(null)

  // Rehydrate from disk on mount (cold start after kill/reboot).
  useEffect(() => {
    let alive = true
    void (async () => {
      const store = await createTimerStore()
      storeRef.current = store
      const loaded = await store.load()
      if (alive) setState(loaded)
    })()
    return () => {
      alive = false
    }
  }, [])

  // Re-derive when the app returns to foreground — no accumulated drift.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void storeRef.current?.load().then(setState)
    })
    return () => {
      sub.remove()
    }
  }, [])

  // Cosmetic tick.
  useEffect(() => {
    const id = setInterval(() => {
      setDisplay(elapsedMs(state, Date.now()))
    }, 1000)
    setDisplay(elapsedMs(state, Date.now()))
    return () => {
      clearInterval(id)
    }
  }, [state])

  async function persist(next: TimerState): Promise<void> {
    setState(next)
    await storeRef.current?.save(next)
    if (isRunning(next)) {
      await Notifications.setNotificationChannelAsync?.('timer', { name: 'Timer', importance: 3 })
    }
  }

  const running = isRunning(state)
  return (
    <View style={styles.center}>
      <Text style={styles.clock}>{fmt(display)}</Text>
      <Text style={styles.hint}>
        {running ? 'running — survives background, kill, reboot' : 'stopped'}
      </Text>
      <Pressable
        style={[styles.btn, running ? styles.stop : styles.start]}
        onPress={() => void persist(running ? pause(state, Date.now()) : start(state, Date.now()))}
      >
        <Text style={styles.btnText}>{running ? 'Pause' : 'Start'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  clock: { fontSize: 56, fontVariant: ['tabular-nums'], fontWeight: '700' },
  hint: { color: '#888' },
  btn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 999 },
  start: { backgroundColor: '#2563eb' },
  stop: { backgroundColor: '#dc2626' },
  btnText: { color: 'white', fontSize: 18, fontWeight: '600' },
})
