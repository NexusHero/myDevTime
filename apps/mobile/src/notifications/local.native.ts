import { NullNotification, type NotificationPort } from './port.js'

/**
 * Native adapter for the NotificationPort (ADR-0071 P2, REQ-069) — **deferred**. The intended
 * implementation is `expo-notifications` (device-local, offline, no server-push
 * infrastructure), lazily imported inside the port methods so the vendor module never loads on
 * platforms without it. Adding the dependency requires the Expo versioned-package registry
 * (`expo install expo-notifications`), which this environment cannot reach — so, per the
 * port's contract, iOS/Android honestly report `available: false` and degrade to the in-app
 * surfaces instead of shipping a half-wired vendor. When the dependency lands, only this file
 * changes: same factory, same three members, vendor types still confined here (SKILL §2.2).
 */
export function createNativeNotificationPort(): NotificationPort {
  return NullNotification
}
