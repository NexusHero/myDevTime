import { registerRootComponent } from 'expo'
import App from './App'
import { registerPwa } from './src/web/registerPwa'

// Web/PWA: link the manifest + register the offline service worker (no-op on native).
registerPwa()

registerRootComponent(App)
