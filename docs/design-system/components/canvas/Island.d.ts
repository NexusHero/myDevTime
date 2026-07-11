export interface IslandAction {
  label: string
  onClick?: () => void
}
export interface IslandProps {
  running?: boolean
  /** Tabular mono elapsed time, e.g. "00:42:11". */
  elapsed?: string
  punched?: boolean
  expanded?: boolean
  onToggle?: () => void
  actions?: IslandAction[]
}
