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
