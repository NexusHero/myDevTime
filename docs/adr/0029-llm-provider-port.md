# ADR 0029: A Provider-Agnostic LLM Port — OpenAI, Anthropic (Claude), Gemini & Ollama as Adapters

## Status

Accepted — the port that unblocks the AI layer (REQ-013/014/015/026). Applies the ports & adapters
rule of the process skill (§2.2) and the deterministic-core discipline of
[ADR-0005](0005-deterministic-core-llm-assist.md) to the LLM as a volatile vendor. Does not
supersede anything; it fixes the seam every AI feature builds on. The ASR/meeting-capture port is a
separate decision ([ADR-0009](0009-meeting-capture-asr-approach.md)).

**Amended 2026-07-10** (see *Amendment* below): the four providers are realized through **one
library-backed adapter over the Vercel AI SDK**, not four hand-written per-vendor adapters. The port
— the contract in this ADR — is unchanged; only the *how* behind it is refined.

## Context

The 1.0 scope commits to an own AI layer — natural-language time entry (REQ-013), AI categorization
proposals (REQ-014), a grounded assistant (REQ-015), meeting insights (REQ-026), Co-Planner labeling
([ADR-0011](0011-ai-co-planner-and-design-language.md)) — all of it **proposal-only** on top of the
deterministic core (ADR-0005). None of it has shipped because the LLM vendor was never fixed, and
picking one vendor would be exactly the lock-in ADR-0005 §2.2 warns against.

Owner decision (2026-07-10): **OpenAI, Ollama, Gemini and Anthropic (Claude) must all work**, and the
**framework must stay LLM-provider-agnostic** — a provider is a runtime choice, not a code-wide
commitment. Reasons the four span the space we need:

- **Anthropic (Claude)** and **OpenAI** — frontier hosted quality for the assistant and insights.
- **Google Gemini** — an alternative hosted rail (pricing/availability/region hedge, long context).
- **Ollama** — local/self-hosted models for privacy-sensitive workspaces, offline dev, and a zero-cost
  test rail. Its presence forces the abstraction to assume *no* hosted-only feature (function-calling
  shapes, token accounting) leaks upstream.

## Decision

- **One narrow `LlmPort`** is the only LLM surface the rest of the app sees (`ai` module). It exposes
  a single `complete(request)` returning provider-agnostic `{ text, usage, provider, model }`, an
  `available()` probe, and a stable `provider` tag. Structured output (the JSON-schema'd *proposals*
  the core validates) and token `usage` (which debits the credit ledger, REQ-027) are first-class on
  the port so no feature reaches for a vendor-specific shape.
- **Four launch adapters, one file each** — `openai`, `anthropic`, `gemini`, `ollama` — under
  `ai/llm/adapters/`. Each confines its SDK/HTTP types and auth to that file and translates to/from the
  port types. **Nothing upstream imports a vendor type** (skill §2.2). Adding a provider is a new
  adapter + a config case; it touches no feature code.
- **Provider is configuration.** `LLM_PROVIDER` + per-provider `LLM_MODEL`, API key (hosted) or base URL
  (Ollama) select the adapter at composition time. Models are pinned per config, never hard-coded in a
  feature.
- **Graceful degradation is the default, not an afterthought.** When no provider is configured or the
  chosen one is unreachable, a `NullLlm` adapter answers `available() = false` and refuses `complete`
  with a typed `LlmUnavailableError`. Every AI feature must handle that path — the deterministic core
  (timers, budgets, exports, plans, the credit ledger) never depends on the LLM being up (ADR-0005).
- **The LLM only proposes.** Per ADR-0005 an `LlmResult` is a proposal/parse/explanation, always marked
  and provenance-stamped, never a value written to a timesheet/budget/plan without the core validating
  it. The port has no "mutate state" capability by construction.
- **Credits, not raw calls.** Features gate on the credit ledger (REQ-027) and record `usage` after a
  call; the port surfaces `inputTokens`/`outputTokens` uniformly so billing is provider-independent.

Out of scope here (own follow-ups): streaming responses (an additive port method), tool/function
calling beyond structured output, embeddings/RAG retrieval, and the concrete adapters' SDK wiring +
live contract tests — this ADR ships the **port and the Null default**; the four real adapters land with
the features that need them (REQ-013/014/015/026).

## Consequences

- The AI features (REQ-013/014/015/026) are unblocked and start against the port, not a vendor — they
  can be built and tested with the `NullLlm` / a fake before any key exists.
- Vendor risk is contained: a provider outage, price change, or deprecation is an adapter/config change,
  never a feature rewrite. Ollama gives a free, deterministic-enough local rail for CI-adjacent testing.
- Token accounting is uniform, so the credit ledger (REQ-027) prices every provider the same way and the
  visible balance stays honest across rails.
- One cost: the port is a lowest-common-denominator surface. Provider-specific superpowers (e.g. a
  vendor's native tool-use protocol) are reached only by widening the port deliberately (a new ADR-worthy
  method), never by leaking a vendor type — we accept slightly less provider-specific polish for zero
  lock-in, consistent with ADR-0005 §2.2.

## Amendment (2026-07-10): one library-backed adapter, not four hand-written ones

The original **Decision** called for "four launch adapters, one file each" — a hand-written `openai`,
`anthropic`, `gemini` and `ollama` adapter under `ai/llm/adapters/`. On review that reinvents a
commodity: **provider-agnostic dispatch is exactly what a maintained library already does.** Writing
four SDK adapters ourselves would re-implement, and then have to maintain, the multi-provider glue that
the [Vercel AI SDK](https://sdk.vercel.ai) (`ai` + `@ai-sdk/openai` / `@ai-sdk/anthropic` /
`@ai-sdk/google`) ships and keeps current.

**What changes:** the four providers are now served by a **single library-backed adapter**,
`ai/llm/vercel-llm.ts`, which implements `LlmPort` over one `generateText` call and selects the vendor
from config. Ollama is reached through its OpenAI-compatible endpoint (a base URL on the OpenAI
factory), so it needs no separate adapter. This bullet supersedes the "four adapters, one file each"
bullet of the Decision.

**What does *not* change — and is the whole point:**

- **The port is still the contract.** `LlmPort` (this ADR's Decision) is untouched. Features depend on
  it, never on the library. The library is an *implementation detail behind* the port, not a
  replacement for it — which is precisely the distinction between an agnostic **library** and an
  architectural **seam**. We keep the seam; we let the library do the plumbing.
- **Vendor confinement holds (skill §2.2).** The SDK's types and every `@ai-sdk/*` import live *only*
  in `vercel-llm.ts`. Nothing upstream — services, controllers, the domain core — imports a vendor or
  a library type. `check:domain-purity` still guards the domain.
- **Provider is still configuration.** `LLM_PROVIDER` + `LLM_MODEL` + `LLM_API_KEY` / `LLM_BASE_URL`
  select the vendor at composition time (`readLlmConfig` → `VercelLlm`, else `NullLlm`). Keys are read
  from the environment, never from source.
- **Graceful degradation still default.** No/unknown provider, or a missing hosted key, resolves the
  `NullLlm`; any provider error inside `complete` is normalized to `LlmUnavailableError` so every
  feature's non-AI path (ADR-0005) fires uniformly.
- **The LLM still only proposes.** REQ-013's `NlEntryService` re-parses the completion through the
  deterministic core; a result never bypasses validation.

**New trade-off:** we take on the Vercel AI SDK as a dependency — its abstractions and version churn —
in exchange for not maintaining four adapters. Because the port is unchanged, that bet is reversible by
one file: swapping the library (LiteLLM, a raw-SDK adapter, a self-hosted gateway) or adding a
provider it doesn't cover is a change to `vercel-llm.ts` alone, invisible to every feature. Streaming,
tool/function calling and embeddings/RAG remain out of scope (own follow-ups) and would widen the port
deliberately, never leak a library type.
