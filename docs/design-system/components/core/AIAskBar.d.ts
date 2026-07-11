/**
 * Omnipresent "ask your data" bar — AI reachable on every screen. Gradient
 * hairline pill + ✦ chip + scope chips + inline grounded answer. Answers
 * are scripted per screen in previews; in product they come from the
 * deterministic query tools (read-only, 1 credit).
 */
export interface AIAskBarProps {
  /** Input placeholder. @default "Frag deine Daten …" */
  placeholder?: string
  /** Which data scopes this screen's answers draw from (shown as chips). @default ["Projekte","Zeiten","Budgets"] */
  scopes?: string[]
  /** Map of suggested question → scripted answer; keys render as suggestion chips. */
  answers?: Record<string, string>
  /** Fallback answer for free-typed questions. */
  defaultAnswer?: string
}
