import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/** Wire DTOs for the `ai` module (REQ-013, ADR-0025). */
export class NlEntryDto extends createZodDto(
  z.object({
    text: z.string().min(1).max(500),
    /**
     * Project/ticket names the client knows from its own workspace catalog, used
     * to resolve a bare name like "logo" or a ticket key to a project hint. The
     * client supplies its vocabulary so the `ai` module needs no `tracking` coupling.
     */
    knownProjects: z.array(z.string().min(1).max(120)).max(500).optional(),
  }),
) {}

/**
 * The grounded-assistant request (M2): a question plus the caller's own factual
 * context (figures the client derived deterministically from its workspace data).
 * The assistant answers only from these facts — it never sees another workspace.
 */
export class AssistantDto extends createZodDto(
  z.object({
    question: z.string().min(1).max(500),
    facts: z.array(z.string().min(1).max(400)).max(100),
  }),
) {}

/** Smart-Add (K6): a single free-text phrase plus the client's project vocabulary. */
export class SmartAddDto extends createZodDto(
  z.object({
    text: z.string().min(1).max(500),
    knownProjects: z.array(z.string().min(1).max(120)).max(500).optional(),
  }),
) {}

/**
 * A grounded insight request (KI1–KI4): which feature, plus the caller's own facts (the
 * numbers/notes the client derived deterministically). The LLM only phrases these.
 */
export class InsightDto extends createZodDto(
  z.object({
    kind: z.enum(['coach', 'quote', 'invoice', 'meeting']),
    facts: z.array(z.string().min(1).max(600)).max(100),
    /**
     * Optional user focus (REQ-026): lets the caller bias what the insight emphasises
     * (e.g. "focus on decisions about the budget"). It can steer emphasis only — the
     * grounding rules ("only from the facts, invent nothing") always win.
     */
    customPrompt: z.string().min(1).max(500).optional(),
  }),
) {}

/**
 * The AI categorization batch (REQ-012, #17): uncategorized entries (a stable client key
 * plus the note/source the client already has) and the client's project vocabulary. The
 * LLM proposes a project **only out of `knownProjects`** — never an invented one — and
 * every result is a proposal the user confirms client-side (ADR-0005).
 */
export class CategorizeDto extends createZodDto(
  z.object({
    items: z
      .array(
        z.object({
          key: z.string().min(1).max(100),
          note: z.string().max(500).optional(),
          source: z.string().max(40).optional(),
        }),
      )
      .max(100),
    knownProjects: z.array(z.string().min(1).max(120)).max(500).optional(),
  }),
) {}

/**
 * A dev-tool export run (REQ-035, ADR-0035): the destination tool plus the confirmed
 * items to push. Posting an item here IS its confirmation — the client only submits
 * items the user confirmed in the preview. `dedupeKey` is the stable idempotency
 * handle; a re-run never double-posts (the recorded ledger feeds the seen-set).
 */
export class ExportRunDto extends createZodDto(
  z.object({
    target: z.string().min(1).max(40),
    items: z
      .array(
        z.object({
          dedupeKey: z.string().min(1).max(200),
          label: z.string().min(1).max(300),
          /** Optional body/description forwarded to the target tool. */
          payload: z.string().max(2000).optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
) {}

/** One grouped standup line: a project/task label and its tracked duration (ms). */
const standupLine = z.object({
  label: z.string().min(1).max(200),
  ms: z.number().int().nonnegative(),
})

/**
 * The AI standup request (REQ-014): the caller's own grouped durations for yesterday/today
 * plus any typed blockers. The server arranges these into a slot-protected report and the LLM
 * narrates around the numbers — it never invents one. The client supplies its own facts, so the
 * `ai` module stays free of `tracking`/`worktime` coupling and workspace-safe by construction.
 */
export class StandupDto extends createZodDto(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    yesterday: z.array(standupLine).max(100).optional(),
    today: z.array(standupLine).max(100).optional(),
    blockers: z.array(z.string().min(1).max(300)).max(20).optional(),
  }),
) {}
