export interface DayBlockProps {
  label: string;
  /** e.g. "09:00 – 10:30" */
  time: string;
  /** actual = solid/reality, ghost = Co-Planner proposal, meeting = pinned event. @default 'actual' */
  kind?: 'actual' | 'ghost' | 'meeting';
  /** Project color (categorical palette) or a status color. */
  color?: string;
  height?: number;
  /** Ghost blocks only. */
  onAccept?: () => void;
  onDismiss?: () => void;
}
