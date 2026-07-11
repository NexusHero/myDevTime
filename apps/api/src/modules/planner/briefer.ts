import type { Provider } from '@nestjs/common'
import type { DayPlan } from '@mydevtime/domain'
import { LLM, LlmUnavailableError, type LlmPort } from '../ai/contract.js'

/**
 * The AI day-briefing (REQ-031 follow-up, M8, ADR-0011/0029). A short morning
 * coaching text over the *already-placed* plan — it explains and advises, it never
 * places time (that is the deterministic `buildDayPlan` core's job, ADR-0005). The
 * planner depends on THIS port, never the LLM directly (DIP), and everything
 * degrades to a factual deterministic summary when the provider is down or the
 * caller opts out — so a briefing is always produced, differentiated by real load.
 */
export interface BriefingResult {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly text: string
}

export interface PlanBriefer {
  brief(plan: DayPlan, opts: { allowAi: boolean }): Promise<BriefingResult>
}

export const PLAN_BRIEFER = Symbol('PLAN_BRIEFER')

function meetingsCount(plan: DayPlan): number {
  return plan.blocks.filter(b => b.kind === 'meeting').length
}

function hours(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${String(m)} min`
  if (m === 0) return `${String(h)} h`
  return `${String(h)} h ${String(m)} min`
}

/**
 * The always-available fallback: a factual German summary of the plan's numbers.
 * Pure and reproducible — the same plan always yields the same briefing.
 */
export function deterministicBriefing(plan: DayPlan): string {
  const meetings = meetingsCount(plan)
  const parts: string[] = [
    `Heute: ${hours(plan.plannedFocusMin)} Fokus geplant, ${String(meetings)} ${
      meetings === 1 ? 'Termin' : 'Termine'
    }.`,
  ]
  if (plan.droppedAnchors.length > 0) {
    parts.push(
      `${String(plan.droppedAnchors.length)} ${
        plan.droppedAnchors.length === 1
          ? 'Termin überschneidet sich'
          : 'Termine überschneiden sich'
      } und ${plan.droppedAnchors.length === 1 ? 'wurde' : 'wurden'} nicht eingeplant.`,
    )
  }
  if (plan.unplacedMin > 0) {
    parts.push(
      `${hours(plan.unplacedMin)} Backlog fanden keinen Platz — priorisiere oder verschiebe.`,
    )
  } else if (meetings > 0 && plan.plannedFocusMin > 0) {
    parts.push('Der Tag geht auf: Fokus und Termine passen ins Fenster.')
  }
  return parts.join(' ')
}

function buildPrompt(plan: DayPlan): string {
  const meetings = meetingsCount(plan)
  const focusBlocks = plan.blocks.filter(b => b.kind === 'focus').map(b => b.label)
  return [
    'Du bist ein ruhiger Planungs-Coach. Fasse den bereits fix geplanten Tag in 2–3',
    'kurzen deutschen Sätzen zusammen und gib EINEN konkreten Entlastungs-Tipp, wenn',
    'der Tag dicht ist. Du verschiebst nichts selbst und erfindest keine Termine —',
    'du kommentierst nur die folgenden Fakten:',
    `- Geplante Fokuszeit: ${String(plan.plannedFocusMin)} min`,
    `- Termine: ${String(meetings)}`,
    `- Backlog ohne Platz: ${String(plan.unplacedMin)} min`,
    `- Überschneidende, nicht eingeplante Termine: ${String(plan.droppedAnchors.length)}`,
    `- Fokus-Themen: ${focusBlocks.length > 0 ? focusBlocks.join(', ') : '—'}`,
  ].join('\n')
}

/**
 * The LLM-backed briefer over the provider-agnostic `LlmPort`. Never throws on the
 * AI path: an unavailable provider, a thrown call, or an empty completion all fall
 * back to the deterministic summary.
 */
export class LlmPlanBriefer implements PlanBriefer {
  constructor(private readonly llm: LlmPort) {}

  private fallback(plan: DayPlan): BriefingResult {
    return { source: 'deterministic', text: deterministicBriefing(plan) }
  }

  async brief(plan: DayPlan, opts: { allowAi: boolean }): Promise<BriefingResult> {
    if (!opts.allowAi || plan.blocks.length === 0) return this.fallback(plan)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.fallback(plan)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(plan) }],
        maxOutputTokens: 200,
        temperature: 0.4,
      })
      const text = result.text.trim()
      return text.length === 0 ? this.fallback(plan) : { source: 'ai-proposal', text }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.fallback(plan)
      return this.fallback(plan) // the briefing never fails the request
    }
  }
}

/** The always-deterministic briefer (used when no LLM is configured). */
export class DeterministicPlanBriefer implements PlanBriefer {
  brief(plan: DayPlan, _opts?: { allowAi: boolean }): Promise<BriefingResult> {
    return Promise.resolve({ source: 'deterministic', text: deterministicBriefing(plan) })
  }
}

/** Binds the `PLAN_BRIEFER` port to the LLM-backed briefer over the configured `LlmPort`. */
export const planBrieferProvider: Provider = {
  provide: PLAN_BRIEFER,
  inject: [LLM],
  useFactory: (llm: LlmPort): PlanBriefer => new LlmPlanBriefer(llm),
}
