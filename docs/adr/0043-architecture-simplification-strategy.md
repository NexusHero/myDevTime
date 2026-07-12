# ADR 0043: Architecture Simplification Strategy

## Status

**Proposed**

## Context

The current architecture—specifically the custom offline-first SQLite synchronization engine and the hand-written React Native application shell—imposes a very high maintenance burden on a small team. 
Currently, the codebase relies on raw `expo-sqlite` and custom `wa-sqlite` mappings for persistence in `@mydevtime/local-db` (leading to type-safety issues and ESLint failures like `no-explicit-any`), hand-rolled responsive navigation without a modern file-based router, and a fully custom Delta-Sync implementation between the offline database and the PostgreSQL backend.

While the "Pure Domain Core" (ADR-0005) and NestJS backend (ADR-0025) provide an excellent foundation for business logic, the infrastructure around the mobile client and synchronization is exhibiting "accidental complexity."

To increase development speed (Time-to-Market) and improve type safety across the stack without sacrificing the core architectural goals, several key simplifications are proposed.

## Decision

We propose the following phased simplifications:

1. **Adopt Drizzle ORM on the Client (`@mydevtime/local-db`)**: 
   - We will replace raw SQL strings and manual type mappings in our local SQLite wrappers with Drizzle ORM, which now natively supports `expo-sqlite`. 
   - This provides end-to-end type safety (reusing schemas from `packages/shared`) and immediately resolves existing ESLint typing errors in the SQLite adapter.

2. **Adopt Expo Router**:
   - We will replace the custom "ThemeProvider + responsive nav shell" with **Expo Router**.
   - Expo Router provides native-feeling file-based routing and out-of-the-box layout support for handling phone tabs and desktop sidebars responsively.

3. **Adopt TanStack Query (React Query)**:
   - For all remote server state that is not covered by the offline database, we will use TanStack Query.
   - This standardizes caching, background refetching, and offline-mutation queues, replacing custom `useEffect` fetch logic.

4. **Re-evaluate Custom Sync vs. Local-first Platforms**:
   - Building a deterministic delta-sync engine with conflict resolution is a multi-year effort. We will spike the usage of local-first sync platforms (like **PowerSync** or **ElectricSQL**) that sit transparently between PostgreSQL and local SQLite.
   - If the spike proves successful, we will deprecate the custom `/sync` modules and heavily reduce the manual synchronization logic.

## Consequences

- The `@mydevtime/local-db` package will undergo a rewrite to use `drizzle-orm`.
- Thousands of lines of custom routing and sync logic can potentially be deleted.
- The UI layer will depend heavily on Expo Router concepts rather than our own custom navigation shell.
- NestJS backend (ADR-0025) and Pure Domain Logic (ADR-0005) remain unaffected and intact.
