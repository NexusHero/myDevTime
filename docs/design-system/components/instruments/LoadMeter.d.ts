/**
 * Weekly strain meter (green→amber→red) fed by deterministic signals —
 * overtime trend, skipped breaks, late sessions, meeting share. Drift made
 * visible for your body instead of your plan; never a medical diagnosis.
 */
export interface LoadMeterProps {
  /** Strain score 0–100 (computed from the deterministic signals). @default 42 */
  score?: number
  /** Override the zone label ("Im grünen Bereich" / "Erhöht" / "Kritisch"). */
  label?: string
  /** @default 300 */
  width?: number
}
