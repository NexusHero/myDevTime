export interface IslandAction { label: string; onClick?: () => void; }
export interface IslandProps {
  running?: boolean;
  /** Tabular mono elapsed time, e.g. "00:42:11". */
  elapsed?: string;
  punched?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  actions?: IslandAction[];
  /** 'floating' = free pill, bottom-center (phone). 'docked' = full-width sidebar-footer status slot (desktop) — never overlaps content. */
  posture?: 'floating' | 'docked';
}
