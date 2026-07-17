/**
 * Grounded-assistant retrieval core (REQ-020/flagship AI, ADR-0005) — pure and deterministic. The
 * assistant answers ONLY from the caller's own facts; this core decides **which** facts are relevant
 * enough to ground an answer and **whether** the question is answerable at all. Relevance is an
 * IDF-weighted keyword overlap (a rare shared word counts for more than a common one), so the LLM is
 * grounded on the *most relevant* facts, not the whole dump — and when nothing clears the relevance
 * floor, `isOffData` is true and the caller refuses **without** ever calling the model (a cleaner,
 * cheaper off-data refusal). No model here: the LLM only phrases the facts this core selects.
 */

/**
 * Common English/German function words that carry no topical relevance — dropped so a shared "the"
 * never makes a fact look on-topic. Kept small and deterministic; content words do the matching.
 */
const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'you',
  'your',
  'was',
  'this',
  'that',
  'what',
  'with',
  'are',
  'how',
  'much',
  'about',
  'from',
  'out',
  'has',
  'have',
  'had',
  'will',
  'per',
  'not',
  'but',
  'its',
  'their',
  'her',
  'his',
  'our',
  'was',
  'were',
  'been',
  'der',
  'die',
  'das',
  'und',
  'ist',
  'sind',
  'war',
  'wie',
  'was',
  'den',
  'dem',
  'ein',
  'eine',
  'für',
  'mit',
  'auf',
  'von',
  'wie',
  'viel',
])

/** Lowercased content word tokens ≥ 3 chars (German/English), stopwords dropped, for keyword overlap. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

/** Inverse document frequency per token across the fact set: log(1 + N / df). */
function idf(facts: readonly string[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const fact of facts) {
    for (const token of new Set(tokenize(fact))) df.set(token, (df.get(token) ?? 0) + 1)
  }
  const n = facts.length
  const out = new Map<string, number>()
  for (const [token, count] of df) out.set(token, Math.log(1 + n / count))
  return out
}

export interface ScoredFact {
  readonly fact: string
  /** IDF-weighted overlap of the question's tokens with this fact (≥ 0). */
  readonly score: number
}

/**
 * Rank facts by relevance to the question — IDF-weighted overlap of shared tokens — highest first,
 * ties broken by original order (stable). A fact sharing no query token scores 0. Pure.
 */
export function rankFacts(question: string, facts: readonly string[]): ScoredFact[] {
  const weights = idf(facts)
  const qTokens = new Set(tokenize(question))
  return facts
    .map((fact, index) => {
      const seen = new Set<string>()
      let score = 0
      for (const token of tokenize(fact)) {
        if (qTokens.has(token) && !seen.has(token)) {
          seen.add(token)
          score += weights.get(token) ?? 0
        }
      }
      return { fact, score, index }
    })
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
    .map(({ fact, score }) => ({ fact, score }))
}

export interface GroundingOptions {
  /** How many facts to keep to ground the answer (default 6). */
  readonly maxFacts?: number
  /** Minimum relevance score a fact must clear to be included (default 0, i.e. any overlap). */
  readonly minScore?: number
}

/**
 * The most relevant facts to ground an answer: ranked, kept only when they clear `minScore`, capped
 * at `maxFacts`. Returns `[]` when nothing is relevant — the signal the caller must refuse rather
 * than feed the model an irrelevant dump (ADR-0005).
 */
export function selectGroundingFacts(
  question: string,
  facts: readonly string[],
  opts: GroundingOptions = {},
): string[] {
  const maxFacts = opts.maxFacts ?? 6
  const minScore = opts.minScore ?? 0
  return rankFacts(question, facts)
    .filter(s => s.score > minScore)
    .slice(0, maxFacts)
    .map(s => s.fact)
}

/**
 * Whether the question is off-data: no fact clears the relevance floor. When true, the assistant
 * refuses deterministically and never calls the LLM — the cleanest off-data path (ADR-0005).
 */
export function isOffData(
  question: string,
  facts: readonly string[],
  opts: { minScore?: number } = {},
): boolean {
  const grounding: GroundingOptions =
    opts.minScore === undefined ? { maxFacts: 1 } : { maxFacts: 1, minScore: opts.minScore }
  return selectGroundingFacts(question, facts, grounding).length === 0
}
