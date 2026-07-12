/**
 * Vacation account at a glance: remaining days (mono) + segmented year bar
 * (taken → planned → remaining) with labeled legend.
 * @startingPoint section="Instruments" subtitle="Urlaubskonto: Rest, genommen, verplant" viewport="420x140"
 */
export interface LeaveBalanceProps {
  /** Annual entitlement in days (default 30). */
  entitlement?: number;
  /** Days already taken. */
  taken?: number;
  /** Days approved/requested but in the future. */
  planned?: number;
  /** Days carried over from last year (added to entitlement). */
  carryover?: number;
  /** Account label, default "Urlaub". */
  label?: string;
  /** Unit word, default "Tage". */
  unit?: string;
}
export declare function LeaveBalance(props: LeaveBalanceProps): JSX.Element;
