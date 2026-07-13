import { Platform } from 'react-native'

/**
 * Progressive-web-app registration for the web build (REQ-023, ADR-0004): link the
 * manifest, set the theme colour, and register the offline service worker. Called
 * once from `index.ts`, so it never runs in the component render tests. Web-only
 * and defensive — a no-op on native and where the browser APIs are absent.
 */
export function registerPwa(): void {
  if (Platform.OS !== 'web') return

  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = 'manifest.webmanifest'
    document.head.appendChild(link)
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#2563EB'
    document.head.appendChild(meta)
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('sw.js')
    })
  }
}
