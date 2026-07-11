export interface IconButtonProps {
  icon: React.ReactNode
  /** Accessible label (also used as title tooltip). */
  label: string
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg'
  /** @default 'ghost' */
  variant?: 'ghost' | 'filled'
  active?: boolean
  onClick?: () => void
}
