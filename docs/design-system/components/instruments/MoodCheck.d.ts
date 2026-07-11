/**
 * One-tap momentary mood signal (EMA-style): Gut / Angespannt / Gestresst.
 * One tap → quiet confirmation; feeds the Balance trend as a timestamped
 * point. Max one prompt per day, never blocking.
 */
export interface MoodCheckProps {
  /** Called with 'gut' | 'angespannt' | 'gestresst' on tap. */
  onSelect?: (mood: string) => void
  /** @default "Wie fühlst du dich gerade?" */
  question?: string
}
