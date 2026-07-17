import { formatDuration, formatMoneyMinor, formatPercent } from '@mydevtime/design'
import { postJson } from './http.js'
import { z } from 'zod'
import type { ReportsData } from '../hooks/useReports.js'

/**
 * The grounded-assistant client (M2): the assistant answers only from facts the
 * client derives *deterministically* from its own workspace data and sends along
 * with the question. The LLM phrases them, never invents numbers, and refuses when
 * the answer is not in the facts — so provenance is honest and the module stays
 * workspace-safe (the client only ever sends its own figures). One credit per AI
 * answer.
 */
export const assistantResultSchema = z.object({
  source: z.enum(['deterministic', 'ai-proposal']).catch('deterministic').default('deterministic'),
  refused: z.boolean().default(false),
  charged: z.boolean().default(false),
  text: z.string(),
})
export type AssistantResult = z.infer<typeof assistantResultSchema>

/**
 * Turn the loaded weekly Reports into short factual sentences the assistant can be
 * grounded in. Every figure is formatted by the same pure formatters the UI uses —
 * the assistant sees exactly what the user sees, never a raw or invented number.
 */
export function factsFromReports(data: ReportsData): string[] {
  const facts: string[] = []
  facts.push(`Tracked this week: ${formatDuration(data.totalMs)} h.`)
  facts.push(`Billable this week: ${formatMoneyMinor(data.billableMinor, data.currencyCode)}.`)
  const sign = data.overtimeMs >= 0 ? '+' : '−'
  facts.push(`Overtime balance: ${sign}${formatDuration(Math.abs(data.overtimeMs))} h.`)
  const projects = [...data.byProject].sort((a, b) => b.spentMs - a.spentMs)
  const top = projects[0]
  if (top !== undefined) {
    facts.push(`Top project this week: ${top.name} with ${formatDuration(top.spentMs)} h.`)
  }
  for (const p of projects.slice(0, 6)) {
    facts.push(`Project ${p.name}: ${formatDuration(p.spentMs)} h tracked.`)
  }
  for (const b of data.budgets) {
    facts.push(`Budget ${b.name}: ${formatPercent(b.ratio)} used.`)
  }
  return facts
}

export function parseAssistantResult(value: unknown): AssistantResult {
  return assistantResultSchema.parse(value)
}

/** Ask the grounded assistant a question over the supplied facts. */
export async function askAssistant(
  baseUrl: string,
  question: string,
  facts: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<AssistantResult> {
  return parseAssistantResult(
    await postJson(baseUrl, '/api/ai/assistant', { question, facts }, fetchImpl),
  )
}
