/**
 * Deterministic categorization rules engine (REQ-011, ADR-0005) — pure and side-effect-free.
 * A rule is an **ordered, versioned matcher → action**: the first rule (by `order`) whose matcher
 * fits an entry wins, and its action proposes a categorization (project / task / tags / billable).
 * The engine only ever *proposes* — like every non-deterministic-looking automation it produces a
 * review preview the caller applies, and every applied change records `rule:<id>@<version>`
 * provenance so a booked number can always be traced to the exact rule version that set it. LLMs
 * may *suggest* new rules elsewhere; this engine itself is pure code, exhaustively testable, and
 * never calls out.
 */

/** The entry fields a matcher can test — a narrow, read-only projection of a time entry. */
export interface RuleSubject {
  /** Free-text note (may be empty). */
  readonly note?: string
  /** Current project id, if any. */
  readonly projectId?: string | null
  /** Provenance source of the entry (`timer`/`manual`/`calendar`/…). */
  readonly source?: string
  /** Minute-of-day the entry started (0–1439), if known. */
  readonly startMin?: number
  /** ISO weekday 1–7 (Mon–Sun), if known. */
  readonly weekday?: number
}

/**
 * A matcher condition. All present conditions must hold (AND). Every condition is a pure predicate
 * over `RuleSubject`; absent conditions are ignored, so an empty matcher matches everything.
 */
export interface RuleMatcher {
  /** Case-insensitive substring the note must contain. */
  readonly noteContains?: string
  /** The entry's source must equal this. */
  readonly sourceIs?: string
  /** Match only entries that have no project yet (categorize the uncategorized). */
  readonly projectIsEmpty?: boolean
  /** The start minute must fall in `[fromMin, toMin)` (half-open). */
  readonly startWithin?: { readonly fromMin: number; readonly toMin: number }
  /** The weekday must be one of these (ISO 1–7). */
  readonly weekdayIn?: readonly number[]
}

/** What a matched rule proposes. Absent fields leave that facet unchanged. */
export interface RuleAction {
  readonly setProjectId?: string
  readonly setTaskId?: string
  readonly addTags?: readonly string[]
  readonly setBillable?: boolean
}

export interface Rule {
  readonly id: string
  /** Monotonic version; bump on every edit so provenance pins the exact logic (`rule:id@version`). */
  readonly version: number
  /** Evaluation order — lower runs first; the first match wins. Ties break by id for determinism. */
  readonly order: number
  readonly matcher: RuleMatcher
  readonly action: RuleAction
  /** A disabled rule is skipped (kept for history/provenance stability). */
  readonly enabled?: boolean
}

/** The provenance stamp for a rule application: `rule:<id>@<version>`. */
export function ruleProvenance(rule: Pick<Rule, 'id' | 'version'>): string {
  return `rule:${rule.id}@${String(rule.version)}`
}

function lower(s: string | undefined): string {
  return (s ?? '').toLowerCase()
}

/** Whether a matcher fits a subject — pure AND over the present conditions. */
export function matches(matcher: RuleMatcher, subject: RuleSubject): boolean {
  if (matcher.noteContains !== undefined) {
    if (!lower(subject.note).includes(matcher.noteContains.toLowerCase())) return false
  }
  if (matcher.sourceIs !== undefined && subject.source !== matcher.sourceIs) return false
  if (matcher.projectIsEmpty === true) {
    if (subject.projectId != null && subject.projectId !== '') return false
  }
  if (matcher.startWithin !== undefined) {
    const m = subject.startMin
    if (m === undefined || m < matcher.startWithin.fromMin || m >= matcher.startWithin.toMin) {
      return false
    }
  }
  if (matcher.weekdayIn !== undefined) {
    if (subject.weekday === undefined || !matcher.weekdayIn.includes(subject.weekday)) return false
  }
  return true
}

/** The order rules evaluate in: by `order`, then `id` for a stable tie-break. Disabled rules dropped. */
export function orderedRules(rules: readonly Rule[]): Rule[] {
  return rules
    .filter(r => r.enabled !== false)
    .slice()
    .sort((a, b) =>
      a.order === b.order ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.order - b.order,
    )
}

/** The result of evaluating the rule set against one subject. */
export interface RuleMatch {
  readonly ruleId: string
  readonly action: RuleAction
  /** `rule:<id>@<version>` — stamped on every entry the action is applied to. */
  readonly provenance: string
}

/**
 * Evaluate the ordered rule set against one subject: the **first** matching rule wins (later rules
 * never override an earlier match — order is intent). Returns `null` when nothing matches. Pure.
 */
export function evaluate(subject: RuleSubject, rules: readonly Rule[]): RuleMatch | null {
  for (const rule of orderedRules(rules)) {
    if (matches(rule.matcher, subject)) {
      return { ruleId: rule.id, action: rule.action, provenance: ruleProvenance(rule) }
    }
  }
  return null
}

/** One row of a dry-run preview: the entry key, and what (if anything) a rule proposes for it. */
export interface DryRunRow<K> {
  readonly key: K
  readonly match: RuleMatch | null
}

/**
 * Preview the rule set over many subjects **without applying anything** — the "dry-run" the user
 * reviews before committing (REQ-011). Each row carries the caller's key and the winning match (or
 * `null`). Deterministic and allocation-only: nothing is written, exactly as ADR-0005 requires of
 * every proposal surface.
 */
export function dryRun<K>(
  subjects: readonly { readonly key: K; readonly subject: RuleSubject }[],
  rules: readonly Rule[],
): DryRunRow<K>[] {
  const ordered = orderedRules(rules)
  return subjects.map(({ key, subject }) => {
    for (const rule of ordered) {
      if (matches(rule.matcher, subject)) {
        return {
          key,
          match: { ruleId: rule.id, action: rule.action, provenance: ruleProvenance(rule) },
        }
      }
    }
    return { key, match: null }
  })
}
