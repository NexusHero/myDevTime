export interface OvertimeGaugeProps {
  /** Signed hours; negative = under target. */
  hours?: number;
  /** Scale bound (hours at the gauge's full extent). @default 20 */
  max?: number;
}
