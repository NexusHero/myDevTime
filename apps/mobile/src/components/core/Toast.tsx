import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Transient toast (design v20). A single, self-dismissing confirmation pill at the bottom-center —
 * the app's answer to the design's global `dtToast(msg)` (e.g. "Timer running on …" when the day
 * timer starts). Deliberately minimal: one message at a time (a newer toast replaces the current),
 * auto-dismisses, and never blocks. It confirms an action that already happened — it never *is* the
 * action, so it invents no state (ADR-0005). Reach it anywhere below `ToastProvider` via `useToast`.
 */

export interface ToastApi {
  /** Show a transient message. A newer call replaces the one on screen. */
  readonly show: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** The confirmation pill; renders nothing when there is no active message. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (ctx === null) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

/** How long a toast lingers before it dismisses itself. */
const TOAST_MS = 3200

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useTheme()
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setMessage(null)
  }, [])

  const show = useCallback((next: string) => {
    const trimmed = next.trim()
    if (trimmed.length === 0) return
    if (timer.current !== null) clearTimeout(timer.current)
    setMessage(trimmed)
    timer.current = setTimeout(() => {
      timer.current = null
      setMessage(null)
    }, TOAST_MS)
  }, [])

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message !== null && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}
        >
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={message}
            accessibilityLiveRegion="polite"
            style={{
              marginBottom: t.spacing.s5,
              maxWidth: 480,
              paddingHorizontal: t.spacing.s4,
              paddingVertical: t.spacing.s3,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.ink,
              borderWidth: 1,
              borderColor: t.color.border,
              elevation: 12,
            }}
          >
            <Text
              numberOfLines={2}
              style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.bg }}
            >
              {message}
            </Text>
          </Pressable>
        </View>
      )}
    </ToastContext.Provider>
  )
}
