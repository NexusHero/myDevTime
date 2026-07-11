export interface ButtonProps {
  children: React.ReactNode
  /** Visual style. @default 'primary' */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  disabled?: boolean
  fullWidth?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}
