export interface HeatmapProps {
  weeks?: number
  /** weeks*7 values, 0-1 intensity. Random demo data if omitted. */
  data?: number[]
  color?: string
}
