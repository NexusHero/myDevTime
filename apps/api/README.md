# @mydevtime/api

Node.js + TypeScript backend, built as a **modular monolith**
([ADR-0003](../../docs/adr/0003-node-typescript-backend.md)).

**Status: placeholder.** The real skeleton lands in
[issue #3](https://github.com/NexusHero/myDevTime/issues/3):

- module layout: `auth` · `tracking` · `sync` · `automation` · `ai` · `billing`,
  each behind an interface with no cross-module concrete imports;
- 12-factor configuration (no literals for endpoints/keys/model names);
- persistence choice (database + migration tool) recorded as its own ADR;
- `/health`, structured PII-free logging, generated OpenAPI.

Do not add feature code here before #3 sets these seams.
