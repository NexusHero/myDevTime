export interface BadgeProps {
  children: React.ReactNode;
  /** @default 'neutral' */
  tone?: 'neutral' | 'accent' | 'good' | 'crit' | 'warn';
  /** @default 'md' */
  size?: 'sm' | 'md';
}
