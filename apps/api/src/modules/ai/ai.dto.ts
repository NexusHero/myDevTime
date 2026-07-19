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

/** Broad work category and complexity — the two dimensions of the deterministic baseline (REQ-041). */
const taskCategory = z.enum(['feature', 'bug', 'chore', 'research', 'meeting'])
const taskComplexity = z.enum(['trivial', 'small', 'medium', 'large', 'xlarge'])

/**
 * The AI task-estimate review request (REQ-041, #90): the task's category + complexity (the
 * deterministic baseline's inputs), an optional note, and optional comparable past samples the
 * client already tracked. The server computes the baseline range and the LLM may only *adjust*
 * within a multiple of it — the number is a proposal the client confirms via `setTaskEstimate`
 * (ADR-0005); nothing is written here.
 */
export class EstimateDto extends createZodDto(
  z.object({
    category: taskCategory.optional(),
    complexity: taskComplexity.optional(),
    note: z.string().max(500).optional(),
    samples: z
      .array(
        z.object({
          category: taskCategory,
          complexity: taskComplexity,
          actualMinutes: z.number().int().nonnegative(),
        }),
      )
      .max(50)
      .optional(),
  }),
) {}

/**
 * The Evening Companion request (design v14 §H, ADR-0005): the day's raw, already-computed signals
 * plus an optional recent load-score history for the baseline. The server runs the deterministic
 * wellbeing core (`reviewDay` + `computeBaseline`) over these — free — and only then, optionally,
 * lets the LLM narrate around those grounded facts. Nothing is written or planned (proposal-only).
 */
export class EveningCompanionDto extends createZodDto(
  z.object({
    day: z.object({
      plannedMinutes: z.number().int().nonnegative(),
      actualMinutes: z.number().int().nonnegative(),
      overtimeMinutes: z.number().int().nonnegative(),
      breakShortfallMinutes: z.number().int().nonnegative(),
      meetingCount: z.number().int().nonnegative(),
      backToBackMeetingCount: z.number().int().nonnegative(),
      /** Optional self-reported mood, 1 (low)…5 (high). Absent when the user did not log it. */
      moodScore: z
        .number()
        .int()
        .refine((n): n is 1 | 2 | 3 | 4 | 5 => n >= 1 && n <= 5, 'moodScore must be 1–5')
        .optional(),
      /** Signed drift of actual vs plan (`actual − planned`); positive means over the plan. */
      planDriftMinutes: z.number().int(),
      isAbsenceDay: z.boolean(),
    }),
    /** Recent days (oldest→newest) as `{ loadScore, weekday }`, for the person's own baseline. */
    history: z
      .array(
        z.object({
          loadScore: z.number(),
          weekday: z.number().int().min(0).max(6),
        }),
      )
      .max(120)
      .optional(),
  }),
) {}

/**
 * The meeting-insights request (REQ-026, #33): a transcript (segments the client captured with
 * consent — live audio capture is out of scope, #31/#32) plus an optional focus that biases what
 * an AI summary emphasises. The server extracts grounded facts and confirmed-only action-item
 * proposals deterministically; nothing is written to a timesheet/task (ADR-0005).
 */
export class MeetingInsightsDto extends createZodDto(
  z.object({
    segments: z
      .array(
        z.object({
          speaker: z.string().min(1).max(120).optional(),
          startMs: z.number().int().nonnegative().optional(),
          endMs: z.number().int().nonnegative().optional(),
          text: z.string().min(1).max(2000),
        }),
      )
      .max(500),
    customPrompt: z.string().min(1).max(500).optional(),
  }),
) {}
