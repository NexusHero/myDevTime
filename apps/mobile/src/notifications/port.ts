import { Platform } from 'react-native'
import { createWebNotificationPort } from './local.web.js'
import { createNativeNotificationPort } from './local.native.js'

/**
 * The NotificationPort (ADR-0071 P2, REQ-069) — the narrow ports-and-adapters seam (SKILL
 * §2.2) that confines any OS/push notification vendor to a single adapter file. Everything
 * upstream (the nudge scheduler, Sevi's overwork watch) talks to this three-member interface
 * and nothing else; no vendor type ever crosses it. The default is `NullNotification`, so a
 * deployment without a working vendor degrades to in-app-only — never crashing, never
 * pretending a notification was shown (`available` is the honest signal the Settings UI keys
 * off). First adapters are *local* notifications (browser API on web, device-local on native);
 * server push (APNs/FCM/Expo push) is a later, separately-ADR'd step.
 */
export interface NotificationPort {
  /** Whether a real delivery channel exists at all (false ⇒ in-app surfaces only). */
  readonly available: boolean
  /** Ask the OS/browser for permission; resolves false on denial or any vendor failure. */
  requestPermission(): Promise<boolean>
  /** Show one local notification now. A no-op without permission; never throws. */
  notify(n: { title: string; body?: string }): Promise<void>
}

/** The honest default: no channel, no permission, no-op delivery. Total and crash-free. */
export const NullNotification: NotificationPort = {
  available: false,
  requestPermission: () => Promise.resolve(false),
  notify: () => Promise.resolve(),
}

/**
 * The platform's local-notification adapter: the browser Notification API on web, the
 * device-local adapter elsewhere (currently the deferred Null stub — see `local.native.ts`).
 * Both degrade to Null behaviour on any failure, so callers never need a try/catch.
 */
export function createNotificationPort(): NotificationPort {
  return Platform.OS === 'web' ? createWebNotificationPort() : createNativeNotificationPort()
}

export default createNotificationPort
