import { NullNotification, type NotificationPort } from './port.js'

/**
 * Web adapter for the NotificationPort (ADR-0071 P2, REQ-069): the browser `Notification`
 * API, feature-detected — Safari on iOS, permissions-stripped browsers, and non-window
 * contexts simply get the Null port. The vendor API is confined to this file (SKILL §2.2)
 * and every call is wrapped so a misbehaving browser can degrade the port, never crash the
 * app: permission failures read as "denied", a failed construction is a silent non-delivery
 * (the in-app surfaces still carry the nudge).
 */
export function createWebNotificationPort(): NotificationPort {
  if (typeof Notification === 'undefined') return NullNotification
  return {
    available: true,

    async requestPermission(): Promise<boolean> {
      try {
        return (await Notification.requestPermission()) === 'granted'
      } catch {
        return false
      }
    },

    notify(n: { title: string; body?: string }): Promise<void> {
      try {
        if (Notification.permission === 'granted') {
          new Notification(n.title, n.body === undefined ? undefined : { body: n.body })
        }
      } catch {
        // Silent non-delivery — the caller's in-app surface remains the fallback.
      }
      return Promise.resolve()
    },
  }
}
