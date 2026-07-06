# myDevTime

Cross-platform time tracking for developers and freelancers — **iOS, Android, and Web** from one
codebase. myDevTime unifies the two best products in the space and adds its own AI layer on top:

- **Tyme-class UX**: fast timers, clients → projects → tasks, budgets & hourly rates, beautiful
  statistics, offline-first with cross-device sync — native-feeling on phone and tablet.
- **Tackle-class automation & billing**: calendar auto-capture (Google/Microsoft), a
  deterministic rules engine with AI-assisted categorization, and billing-grade timesheet exports,
  funded by a web + in-app subscription model.
- **Own AI on top**: natural-language time entry ("2h Finanzo Review gestern"), AI weekly
  summaries & standup reports, and a chat assistant grounded exclusively in your own data.

One principle runs through the whole architecture: **deterministic logic decides everything that
reaches a timesheet or invoice; AI proposes, parses, explains — with recorded provenance — but
never acts as the bookkeeper** ([ADR-0005](docs/adr/0005-deterministic-core-llm-assist.md)).

## Status

Pre-code planning phase: architecture, decisions, and backlog are in place; implementation starts
with milestone M0.

## Documentation

| Document | Content |
|----------|---------|
| [`docs/roadmap.md`](docs/roadmap.md) | Milestones M0–M5, dependency graph, Definition of 1.0, post-1.0 backlog |
| [`docs/architecture.md`](docs/architecture.md) | arc42 architecture documentation incl. the Requirements Register (REQ-001…) |
| [`docs/adr/`](docs/adr/README.md) | Architecture Decision Records + Tech Radar |
| [`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md) | The development process (governance, TDD, SOLID, Definition of Done) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Ways of working, branching, commits |

## Stack (decided so far)

- **Backend:** Node.js + TypeScript, modular monolith ([ADR-0003](docs/adr/0003-node-typescript-backend.md))
- **Clients:** React Native + Expo (iOS/Android/Web) — proposed, gated on a device spike ([ADR-0004](docs/adr/0004-react-native-expo-client.md))
- **Auth:** email/password + Sign in with Google & Apple ([ADR-0007](docs/adr/0007-authentication-email-oauth-sessions.md))
- **Billing:** Stripe on web + StoreKit 2 / Play Billing in the stores, unified by an internal entitlement service ([ADR-0006](docs/adr/0006-subscription-billing-stripe-plus-store-iap.md))

## License

See [LICENSE](LICENSE).
