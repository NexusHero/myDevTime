export interface BudgetRingProps {
  /** 0-100+ (values over 100 clamp visually and switch to critical tone). */
  percent?: number
  size?: number
  color?: string
}
