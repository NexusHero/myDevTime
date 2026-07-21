/**
 * The `preferences` module's public surface (module-boundary rule, ADR-0025 §seams):
 * other modules may READ a user's stored preferences — the consent gates (mood memory,
 * meeting capture) and Sevi's proactivity/quiet-hours live here — but never reach the
 * write path or the storage internals; mutation stays behind `PUT /api/preferences`.
 */
export { getPreferences } from './service.js'
export type { Preferences } from './preferences.js'
