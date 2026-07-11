# ADR 0032. Connector token vault — encrypted-at-rest OAuth tokens behind a narrow port

## Status

Accepted (owner decision) — the secret-storage foundation for the connectors layer (dev/chat/
calendar integrations: GitHub, Jira, GitLab, Linear, Slack, Teams, Google, Zoom …). Settles one of
the five open connector decisions; the others — GitHub App vs OAuth App, the ASR provider
(ADR-0009 / spike #31), and the connector rollout order — remain open for discussion.

## Context

Almost every dev-relevant integration authenticates with **OAuth 2.0**, not a user-pasted API key:
the user clicks "Connect with GitHub/Jira/Slack", authorises, and the app receives per-user
**access + refresh tokens** it must store and later use on the user's behalf. These tokens are
high-value secrets (they can read code, issues, messages, calendars). The current "Integrationen"
screen only toggles local state — there is no real token layer, which is exactly why it is a
façade.

Requirements: encrypt at rest; refresh + rotate; revoke; isolate by workspace; never log; keys
never in source. The concrete key-management backend (cloud KMS vs a self-hosted AEAD key) is a
deployment detail that must be swappable without touching features.

## Decision

1. **One narrow `TokenVault` port** is the only surface a connector feature sees —
   `get(workspaceId, userId, connector)`, `put`, `delete`, `withFreshAccessToken` (transparent
   refresh). The crypto/storage backend is confined to a single adapter (ports & adapters, skill
   §2.2); nothing upstream imports a KMS/crypto type.
2. **Encrypted at rest via envelope encryption.** Each token record gets a per-record data key;
   the data key is sealed by a master key held in a **cloud KMS in production** (or an app AEAD key
   from the environment for dev/self-host). Persisted: ciphertext + wrapped data key + nonce —
   **plaintext is never stored**. Encryption is **AEAD** (e.g. XChaCha20-Poly1305 / AES-GCM) so
   tampering is detected.
3. **Refresh & revoke.** Access tokens are treated as short-lived and refreshed through the port;
   refresh tokens are rotated on use; "disconnect" deletes the record **and** calls the provider's
   revoke endpoint.
4. **Workspace isolation by construction.** Every vault row carries a non-optional `workspaceId`
   (and `userId`); negative isolation tests are part of the vault's suite, like every other entity.
5. **Secrets discipline.** Master keys / client secrets come from the environment or KMS only,
   never source; tokens never appear in logs or RFC-7807 error bodies.

The KMS-vs-libsodium/age backend choice is a **Trial** detail selected at composition time; the
port makes it reversible.

## Consequences

- **De-fakes the integration layer's token half:** one audited place for all connector secrets,
  swappable backend, workspace-isolated.
- **DSGVO-aligned** (encryption at rest + hard delete) — plugs into the privacy package (REQ-020).
- **Cost:** an encryption/KMS dependency and key-management ops (rotation, access control).
- **Open (deferred, does not block the port):** which KMS (AWS/GCP/self-host); token-refresh
  scheduling; whether to cache decrypted access tokens in memory and for how long.
- **Pairs with ADR-0033** (scopes & consent): the vault stores *what* was granted; ADR-0033
  governs *how little* is requested and *whether* the user consented.
