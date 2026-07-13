# 49. Abandon Offline-First Architecture

Date: 2026-07-13

## Status

Accepted

## Context

We previously adopted an offline-first architecture (ADR-0040, ADR-0043, ADR-0046) using `expo-sqlite`, `PowerSync`, and a local Drizzle ORM store (`@mydevtime/local-db`) to allow the mobile app to function without an internet connection and synchronize in the background.

However, during implementation and testing, it became clear that this approach added significant complexity:
- The dual-mode data fetching (online vs offline) complicated the frontend hooks significantly.
- Maintaining schema parity and sync logic between the server and the local SQLite database increased development overhead.
- Testing the frontend required extensive mocking of the local persistence layer (`localStorage` in JSDOM, SQLite in React Native).
- The offline requirement was determined to be a "nice-to-have" rather than a core requirement for the initial MVP, making the architectural cost disproportionate to the user value.

Additionally, to verify the simplified online-only architecture in a production-like environment, we needed a reliable way to deploy both the API and the web build locally.

## Decision

1. **Remove Offline-First Logic**: We are abandoning the offline-first approach and the local database. The application will return to a strictly online-only architecture where the frontend communicates directly with the backend API.
2. **Purge Dependencies**: We have removed `expo-sqlite`, `wa-sqlite`, `@powersync/react-native`, and the internal `@mydevtime/local-db` package.
3. **Remove Sync Backend**: The `SyncModule` and all PowerSync-related synchronization logic have been removed from the NestJS backend.
4. **Local Production Environment**: To properly test the online-only frontend against the backend locally, we introduced Dockerfiles for both the API (`node:22-alpine`) and the Web build (`nginx:alpine`), orchestrated via `docker-compose.yml`.

## Consequences

- **Pros**: 
  - Massive reduction in code complexity and bundle size.
  - Faster feature development since state is no longer synchronized locally.
  - Easier testability (standard HTTP mocking instead of SQLite/Sync mocking).
  - Clean local production-like test environment via Docker Compose.
- **Cons**: 
  - The application will not function without an active internet connection.
  - We lose optimistic UI updates that were provided "for free" by the local database, requiring us to manage loading states and optimistic updates via TanStack Query (ADR-0047).
