# ADR 0009: Meeting-Capture Channel & ASR Provider

## Status

Proposed — to be confirmed by the meeting-capture spike
([#31](https://github.com/NexusHero/myDevTime/issues/31)) before the transcription pipeline
(REQ-025, [#32](https://github.com/NexusHero/myDevTime/issues/32)) is built.

## Context

ADR-0008 puts meeting transcription in 1.0. Tactiq solves capture with a Chrome extension
reading web-meeting captions/audio — but myDevTime's client is a React Native app plus
react-native-web (ADR-0004), used on phones and tablets where a desktop browser extension does
not exist. The capture channel decides cost structure, platform coverage (Google Meet, MS Teams,
Zoom, in-person), consent mechanics, and how much infrastructure a solo developer has to run.

Candidate channels:

1. **Browser extension** (Tactiq's path): captures captions/tab audio for web meetings; cheap
   per meeting, desktop-web only, a fourth client surface to maintain.
2. **Meeting bot** (Recall.ai-style service or self-run): a participant bot joins the call;
   covers all three platforms uniformly incl. mobile-joined meetings; visible in the
   participant list (consent-friendly); per-minute service cost.
3. **Platform transcript APIs**: Meet/Teams/Zoom native recording/transcript APIs; no capture
   infrastructure, but tenant-admin permissions and paid workspace tiers often required —
   questionable for freelancers on the free tiers of these platforms.
4. **Mobile in-person recording**: the app records via the device mic for on-site meetings;
   unique vs. Tactiq, strictest consent burden, mobile-battery/background constraints.

ASR (where the channel yields audio rather than text): hosted providers (OpenAI
Whisper/gpt-4o-transcribe, Deepgram, AssemblyAI, …) differ in de/en quality, diarization,
streaming vs. batch, and cost per audio-hour. Per ADR-0005 discipline the provider sits behind
one `TranscriptionPort` adapter, provider/model as configuration.

## Decision

Deferred to the spike (#31) — this ADR fixes the *decision frame*, not the winner:

- Evaluate channels in the order **meeting bot → browser extension → platform APIs**, with
  **mobile in-person recording** assessed as an additive later channel, not a 1.0 gate.
- Selection criteria, weighted for a solo developer: platform coverage per unit of build+run
  effort, cost per meeting-hour (feeds #29/#34), consent visibility, and reliability.
- Whatever wins, the pipeline consumes `TranscriptionPort` + a channel-agnostic
  `CaptureSession` contract, so a second channel later is an adapter, not a redesign.

## Consequences

- #32 (pipeline) is blocked on the spike's outcome; #33 (AI insights) only needs stored
  transcripts and can be specified against the transcript entity regardless of channel.
- If a paid capture/ASR service wins, a real per-minute marginal cost enters the unit economics
  — the credit cost table (#34) and pricing (#29) must absorb it explicitly.
- This ADR is edited exactly once — from Proposed to Accepted with the chosen channel/provider
  filled in by the spike PR — or superseded if the spike overturns the frame.
