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
