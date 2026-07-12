/**
 * Weekly 2-question self-report check-in (OLBI-short-form style):
 * exhaustion + detachment, 5-step scales, one save button. Complements
 * the passive LoadMeter signals — the AI correlates both sources and
 * never infers feelings from work data alone.
 */
export interface CheckinCardProps {
  /** Called with { exhaustion: 1–5, detachment: 1–5 } on save. */
  onDone?: (answers: { exhaustion: number; detachment: number }) => void;
  /** Tighter padding for embedding inside another card. @default false */
  compact?: boolean;
}
