import { z } from 'zod'

/**
 * A wire date field (ADR-0025). Behaves like `z.coerce.date()` — accepts an ISO
 * string (or any Date-parseable string) or an epoch-millis number and parses it
 * to a `Date`, rejecting values that don't resolve to a valid date — but, unlike a
 * bare `z.coerce.date()`, its input is a representable `string | number`, so
 * `nestjs-zod` can emit it into the OpenAPI document (a raw `ZodDate` throws
 * "Date cannot be represented in JSON Schema"). The union's input schema is the
 * wire shape; the piped `coerce.date` is the parsed domain value.
 */
export const wireDate = z.union([z.string(), z.number()]).pipe(z.coerce.date())
