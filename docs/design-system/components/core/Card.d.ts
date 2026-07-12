export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** @default true */
  padding?: boolean;
  style?: React.CSSProperties;
}
