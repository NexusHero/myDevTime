import { Alert, Platform } from 'react-native'

/**
 * Cross-platform confirmation for a destructive action. On native this uses the
 * OS dialog via `Alert.alert`; on react-native-web `Alert.alert` is a no-op, so we
 * fall back to `window.confirm`. `onConfirm` runs only when the user confirms — the
 * caller never mutates state without a positive answer (honest destructive flows).
 */
export function confirmDestructive(opts: {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly onConfirm: () => void
}): void {
  const { title, message, confirmLabel, onConfirm } = opts
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm()
    }
    return
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}
