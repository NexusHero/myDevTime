/**
 * The single visual container for AI output: blue→orange gradient hairline
 * (--ai-grad) + ✦ chip. Deterministic UI never wears this treatment —
 * the gradient means "AI proposed this, you decide" (ADR-0005).
 */
export interface AICalloutProps {
  /** Optional bold first line. */
  title?: string;
  /** Body content (text or elements). */
  children?: React.ReactNode;
  /** Optional action element(s), right-aligned (usually Buttons). */
  action?: React.ReactNode;
  /** Tighter padding for inside cards. @default false */
  compact?: boolean;
}
