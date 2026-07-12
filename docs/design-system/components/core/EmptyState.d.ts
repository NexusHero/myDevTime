/**
 * Calm empty state: icon disc + title + hint + optional action, dashed frame.
 * No illustrations, no confetti — trust is the aesthetic (ux-vision §5).
 */
export interface EmptyStateProps {
  /** Icon name from the brand set. @default "plus" */
  icon?: string;
  /** One sentence: what's empty. */
  title: string;
  /** One sentence: the next step. */
  hint?: string;
  /** Optional action element (usually a Button). */
  action?: React.ReactNode;
  /** Tighter padding for sidebars/cards. @default false */
  compact?: boolean;
}
