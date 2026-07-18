# Spike #31 findings (desk part) — meeting capture & ASR provider evaluation

**Issue:** [#31](https://github.com/NexusHero/myDevTime/issues/31) (blocks
[#32](https://github.com/NexusHero/myDevTime/issues/32)) · **Decides:**
[ADR-0009](../adr/0009-meeting-capture-asr-approach.md) · **Requirement:** REQ-025 ·
**Seam already in the repo:** [`apps/api/src/modules/ai/transcription/`](../../apps/api/src/modules/ai/transcription/port.ts)

## Verdict — **recommend self-hosted faster-whisper as the privacy-default adapter, with one hosted EU-processing provider behind the same port as fallback; ADR-0009 stays Proposed until the external evaluation runs**

This document is the half of spike #31 that can be done at the desk: restating the decision
frame, checking what the repo already guarantees, and evaluating the realistic ASR options
against the frame's criteria. The half that intrinsically needs the outside world — vendor
accounts and API keys, a GPU/CPU host, real de/en meeting audio for a word-error-rate
comparison, and on-device capture entitlements — is listed as an explicit handback at the end.
**ADR-0009's winner is not filled in by this document**; per that ADR's own rule it flips from
Proposed to Accepted exactly once, in the PR that lands the live adapter with real-audio
evidence.

## The decision frame (restated from ADR-0009)

ADR-0009 fixes the frame, not the winner:

- **Channels**, evaluated in the order *meeting bot → browser extension → platform transcript
  APIs*, with **mobile in-person recording** assessed as an additive later channel, not a 1.0
  gate.
- **Criteria, weighted for a solo developer:** platform coverage per unit of build+run effort,
  cost per meeting-hour (feeds pricing #29 and the credit table #34), consent visibility, and
  reliability.
- Whatever wins, the pipeline consumes `TranscriptionPort` plus a channel-agnostic capture
  contract, so a second channel later is an adapter, not a redesign.

To evaluate ASR *providers* inside that frame, the criteria concretely become: **cost model**
(per-minute marginal cost vs. fixed host cost — a real marginal cost must be absorbed by
#29/#34 per ADR-0009's consequences), **latency/streaming** (batch turnaround vs. live
captions), **privacy/GDPR posture** (where audio is processed, EU residency, whether a DPA and
no-training terms are available — meeting audio is the most sensitive data this product will
ever touch), **diarization** (speaker labels; the domain type already carries an optional
`speaker` field), and **fit with the existing port** (what shape of adapter it needs).

## What is already true in the repo (the spike does not start from zero)

- **The port isolates the vendor.**
  [`apps/api/src/modules/ai/transcription/port.ts`](../../apps/api/src/modules/ai/transcription/port.ts)
  defines the one narrow interface: `transcribe(audio: AudioInput): Promise<readonly TranscriptSegment[]>`
  plus a cheap `available()`. `AudioInput` is a neutral `{ base64, mimeType }` wrapper — vendor
  SDK/auth types are confined to the single adapter file, per skill §2.2. The neutral output
  type [`TranscriptSegment`](../../packages/domain/src/meetings/transcript.ts) already has an
  **optional `speaker` field**, so a diarizing provider plugs in without a type change and a
  non-diarizing one simply omits it.
- **Graceful degradation is the default.**
  [`null-transcription.ts`](../../apps/api/src/modules/ai/transcription/null-transcription.ts)
  ships as the configured-nothing adapter (`available()` false, `transcribe()` rejects with
  `TranscriptionUnavailableError`), and
  [`service.ts`](../../apps/api/src/modules/ai/transcription/service.ts)'s
  `planMeetingInsights` degrades to an empty `unavailable` result instead of throwing
  (ADR-0005). A provider outage can never break the deterministic core.
- **The consent-first gate exists and is enforced before any ASR call** (REQ-025).
  `planMeetingInsights` checks `gates.consented` first and returns `no-consent` without
  touching the port;
  [`service.test.ts`](../../apps/api/src/modules/ai/transcription/service.test.ts) proves
  "without consent, nothing is produced *even with a working ASR*". The stored opt-in is the
  `meetingConsent` preference — default **false** in
  [`apps/api/src/modules/preferences/preferences.ts`](../../apps/api/src/modules/preferences/preferences.ts),
  served over `GET/PUT /api/preferences`
  ([`preferences.controller.ts`](../../apps/api/src/modules/preferences/preferences.controller.ts)),
  toggled by the user in
  [`SettingsScreen.tsx`](../../apps/mobile/src/screens/SettingsScreen.tsx). Per-capability
  connector consent (ADR-0033,
  [`connectors/consent.ts`](../../apps/api/src/modules/connectors/consent.ts)) generalises the
  same rule and already models a `capture` capability.
- **Pro/credit gating is wired**: meeting insights are Pro-gated and cost one credit charged
  only on a confirmed task (`MEETING_INSIGHTS_CREDIT_COST` in `service.ts`) — the hook where a
  per-minute vendor cost would have to surface in #34.
- **The client surface is honest about the gap**:
  [`MeetingsScreen.tsx`](../../apps/mobile/src/screens/MeetingsScreen.tsx) shows notes +
  grounded follow-ups today and states "Auto-capture with a transcript is coming
  (consent-first)".

Consequence for the evaluation: the current port is **batch-shaped** (one audio blob in, all
segments out) and **server-side**. A streaming provider's live-caption advantage is unusable
until the port grows a streaming method, and an on-device recogniser inverts the topology
(transcription would happen in the client, not behind this server port). Both facts weigh in
the scoring below.

## Options against the frame

| Option | Cost model | Latency / streaming | Privacy / GDPR (EU) | Diarization | Fit with the existing port |
|---|---|---|---|---|---|
| **On-device: iOS `SFSpeechRecognizer` / Android `SpeechRecognizer`** | Free (OS-provided) | Near-live captions | Best possible when the on-device mode is active; but availability of on-device recognition varies by OS version/language, and the default path may still send audio to Apple/Google servers | None | **Poor** — transcription would run in the RN client, not behind the server `TranscriptionPort`; needs a client-side port + upload of segments; quality/length limits (iOS notably restricts continuous recognition) make it a capture-assist, not the pipeline engine |
| **OpenAI Whisper API** (`whisper-1` / `gpt-4o-transcribe`) | Per-minute, roughly $0.006/min ≈ $0.36/audio-hour (verify at signup) | Batch upload; minutes-scale turnaround, no true streaming for the classic endpoint | US processing by default; DPA + no-training available on API terms, but **no EU residency guarantee** for the standard endpoint | None built in | **Best-in-class fit**: file/base64 in, text+timestamps out — a ~50-line adapter |
| **Deepgram** | Per-minute, order $0.004–0.008/min pre-paid tiers (verify) | **Real streaming** (WebSocket) and batch | US-based; DPA available; EU processing only via enterprise/self-hosted arrangements — weak default posture | **Yes** (built-in) | Batch fits today; the streaming strength is wasted until the port grows a streaming method |
| **AssemblyAI** | Per-hour, order $0.12–0.37/audio-hour depending on tier (verify) | Batch + streaming | **Has an explicit EU processing option** (EU endpoint) — the strongest hosted GDPR story of the group; DPA available | **Yes** (built-in) | Batch fits the port directly; diarization populates `speaker` for free |
| **Self-hosted whisper.cpp / faster-whisper** | No per-minute marginal cost; fixed host cost (a CPU box handles batch small/medium models; a modest GPU for large/fast) + ops time | Batch; minutes-scale on CPU, near-real-time on GPU; no managed streaming | **Best**: audio never leaves infrastructure we control; EU-hostable by choice; no vendor DPA needed | Not built in — needs WhisperX/pyannote alongside (extra moving part) | Clean fit: same batch shape; adapter calls our own inference endpoint; provider/model stay configuration |

(Prices are order-of-magnitude from public price lists as of writing and are **explicitly part
of the handback to re-verify at account signup** — they feed #29/#34 and must not be baked in
from a doc.)

## Reasoning to a recommendation

1. **Privacy dominates for this product.** Meeting audio is the most sensitive input in the
   whole system, the product's own consent bar is deliberately high (REQ-025 is a
   non-negotiable), and the target market includes EU freelancers. An architecture whose
   *default* ships raw meeting audio to a US processor makes every sales/consent conversation
   harder. Self-hosting flips that: audio stays on infrastructure we control, EU-located by
   choice.
2. **Cost model matches the credit economics.** ADR-0009 warns that a paid per-minute service
   pushes a real marginal cost into #29/#34. Self-hosted faster-whisper has ~zero marginal
   cost per meeting-hour — credits then price *value*, not vendor pass-through — at the price
   of a fixed host and ops effort. For a solo developer the ops burden is real but bounded:
   faster-whisper behind a small HTTP shim is a stateless service, and the pipeline is batch
   (a queued job that takes minutes is fine; nothing user-blocking waits on it).
3. **The port makes "and a hosted fallback" nearly free.** Because everything upstream sees
   only `TranscriptionPort`, a second adapter selected by config is exactly the ADR-0029
   pattern already used for the LLM. The right fallback is the hosted provider with the best
   EU story — **AssemblyAI's EU processing endpoint** on current knowledge (to be confirmed in
   the external evaluation; OpenAI Whisper is the simplest alternative if EU processing is
   waived for fallback-only traffic with a DPA). Fallback keeps availability honest: if the
   self-hosted box is down, `available()` on the fallback decides, and if both are down the
   flow already degrades gracefully.
4. **Diarization is optional by type, so it does not pick the winner.** `TranscriptSegment.speaker`
   is optional; v1 can ship without speaker labels and add WhisperX/pyannote (or lean on the
   fallback provider's diarization) later without touching any upstream code.
5. **Streaming is not a v1 criterion.** The port is batch; the product feature (transcript →
   facts → confirmed-only action items) is post-meeting, not live captions. Choosing a vendor
   for streaming strength (Deepgram) would optimise a capability the port cannot express yet.
6. **On-device recognisers are a channel aid, not the engine.** They matter for the *mobile
   in-person* channel (live on-screen feedback while recording), which ADR-0009 already scopes
   as additive-later. The stored, insight-feeding transcript should come from the one
   server-side port so quality, language coverage, and provenance are uniform across channels.

**Recommendation:** default adapter = **self-hosted faster-whisper** (EU-hosted, batch, model
size as configuration), plus **one hosted fallback adapter** behind the same
`TranscriptionPort` (AssemblyAI-EU as the working hypothesis), selected by config per
ADR-0029's provider pattern. On the *channel* half of the frame, the desk finding is that the
existing `AudioInput` seam is nearest to **recorded-audio upload** (in-person/mobile or
uploaded meeting recordings), while the frame's first-ranked channel (**meeting bot**) needs a
live trial of a bot service against real Meet/Teams/Zoom calls — that trial is external and
stays open; nothing in the recommendation forecloses it, since a bot channel also terminates
in audio handed to the same port.

## Residual — the external handback (why ADR-0009 stays Proposed)

None of the following can be done from this repo/CI:

1. **Vendor accounts / API keys** for the hosted candidates (AssemblyAI, Deepgram, OpenAI) —
   including confirming current pricing for #29/#34 and obtaining DPA/no-training terms and
   the EU-processing option in writing.
2. **A host for faster-whisper** — an EU-located CPU/GPU box (or container on the existing
   deployment, ADR-0056) to measure real turnaround per meeting-hour and hosting cost.
3. **Real-audio evaluation** — a small de/en meeting-audio set, run through each candidate,
   compared on word-error-rate, timestamps quality, and (where offered) diarization accuracy.
   This is the evidence the ADR-0009 status flip requires.
4. **On-device capture entitlements** for the in-person channel: iOS microphone permission +
   background-audio mode, Android foreground-service microphone type — all need a real EAS
   dev-client build and physical devices (same class of gap as the
   [on-device checklist](../mobile/on-device-checklist.md)).
5. **Meeting-bot channel trial** (frame rank 1): a bot service trial against live Meet, Teams,
   and Zoom calls, checking join reliability and consent visibility in the participant list.

When those land: implement the winning adapter file (e.g.
`apps/api/src/modules/ai/transcription/faster-whisper.ts` — vendor/API types confined there),
wire provider selection by config, and flip ADR-0009 Proposed → Accepted in that same PR with
the measured evidence, unblocking #32's remaining capture-side work.
