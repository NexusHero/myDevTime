export interface InputProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: 'text' | 'number' | 'time' | 'date' | 'email'
  /** Use the tabular mono family — for durations, rates, IDs. */
  mono?: boolean
  error?: string
}
