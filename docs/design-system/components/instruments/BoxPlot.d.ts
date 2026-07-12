/**
 * Box plot of daily working hours — median/quartile/extremes with the daily
 * target (Soll) as a dashed live-orange marker. The honest replacement for an
 * abstract overtime gauge: you see where your typical day actually lands.
 */
export interface BoxPlotProps {
  /** Shortest day, in decimal hours. */
  min?: number;
  /** 25th percentile. */
  q1?: number;
  /** Median day. */
  median?: number;
  /** 75th percentile. */
  q3?: number;
  /** Longest day. */
  max?: number;
  /** Daily target (Soll), e.g. 8.33 for 8:20h. */
  target?: number;
  /** Scale lower bound (hours). Defaults to fit the data. */
  lo?: number;
  /** Scale upper bound (hours). Defaults to fit the data. */
  hi?: number;
  /** @default 300 */
  width?: number;
  /** Box color. @default var(--accent) */
  color?: string;
}
