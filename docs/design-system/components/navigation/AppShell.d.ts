export interface AppShellProps {
  /** @default 'sidebar' */
  posture?: 'sidebar' | 'tabs';
  /** Route ids to show; defaults to the fixed IA (ux-vision §3). */
  items?: string[];
  active?: string;
  onNavigate?: (id: string) => void;
  children?: React.ReactNode;
}
