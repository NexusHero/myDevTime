# ADR 0006: Monetization — Subscription Billing via Stripe (Web) + Store In-App Purchases

## Status

Accepted

## Context

ADR-0002 adopts Tackle's commercial model: a subscription product, not a one-time purchase. The
app ships on three rails (web, App Store, Play Store), and the platforms dictate the payment
constraints: Apple and Google require their in-app purchase systems for digital subscriptions
sold inside the apps (15–30 % fee), while web checkout is free to use any provider. A single
"one source of truth" payments provider therefore does not exist for this product shape — the
design problem is keeping *entitlements* consistent while *payment rails* differ. Tyme itself
monetizes via store IAP; Tackle via web subscription. myDevTime needs both.

## Decision

- **Web:** Stripe (Checkout + Billing) for subscription purchase and self-service management.
- **iOS / Android:** native store subscriptions (StoreKit 2 / Play Billing), because policy
  requires it for in-app digital goods.
- **One internal entitlement service** in the backend (ADR-0003 `billing` module) is the single
  source of truth for "what plan does this account have": it consumes Stripe webhooks and
  App Store/Play server notifications, normalizes them into provider-agnostic entitlement records
  (`free | pro`, period, source), and every feature gate in every client asks only this service —
  never a payment SDK.
- Payment-provider SDKs are volatile third-party surface per the process skill §2.2: one adapter
  file per provider behind one `PaymentProviderPort` interface.
- Free tier + one paid **Pro** plan at launch (exact pricing is a launch-milestone decision
  recorded as its own ADR before store submission).

## Alternatives considered

- **Stripe only + web-only purchase** (apps read-only for subscription state): allowed by store
  policy in some configurations but a hostile upgrade UX on mobile, and policy details shift —
  rejected as the primary plan, kept as fallback if IAP integration cost explodes.
- **RevenueCat** (unified IAP + Stripe abstraction): genuinely attractive for a solo developer;
  deferred — the entitlement service keeps our domain model provider-agnostic, so adopting
  RevenueCat later is an adapter swap, not a redesign. Reassess when IAP work actually starts.
- **One-time purchase (classic Tyme model):** does not fund ongoing LLM/API costs; rejected.

## Consequences

- Entitlements, not payments, are the domain concept — clients and feature gates stay clean of
  provider logic, and cross-rail edge cases (bought on iOS, uses web) are handled in one place.
- Three webhook/notification integrations must be built and tested (Stripe, Apple, Google); each
  is an adapter with replay-safe, idempotent event handling.
- Store fees make mobile-acquired subscriptions less profitable than web ones — accepted cost of
  presence on both stores.
- The AI layer's variable costs (ADR-0005) map onto the plan structure: free tier gets
  deterministic features + capped AI usage; Pro lifts the caps. Enforcement lives in the same
  entitlement service.
