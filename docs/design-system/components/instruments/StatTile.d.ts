export interface StatTileProps {
  label: string;
  value: string | number;
  /** Percent change; sign controls good/crit coloring. */
  delta?: number;
  /** Render value in mono. @default true */
  mono?: boolean;
}
