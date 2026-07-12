# ADR 0039: App Performance Optimizations (Reanimated & FlashList)

## Status

Accepted

## Context

As the myDevTime app transitions to a local-first SQLite architecture (ADR-0038), it becomes capable of storing thousands of time entries, projects, and shifts directly on the user's device. 
However, standard React Native patterns lead to severe performance bottlenecks at scale:
1. **The Timer**: `useTimer` updates a React state every second (`setElapsedMs`), causing the entire `TodayScreen` to re-render 60 times a minute. This consumes battery and CPU.
2. **Lists**: Rendering hundreds of projects or timeline entries using `.map()` inside a standard `<ScrollView>` creates a massive component tree that exhausts memory and causes scroll lag.
3. **Database Queries**: Fetching all time entries via `getAllAsync` to perform a JavaScript `.reduce` or `for`-loop (e.g., to calculate total worked hours) requires serializing thousands of objects across the JS bridge.
4. **Foreign Keys**: SQLite lacks default indexes on foreign keys, causing full table scans for basic relationship queries (like `WHERE shift_id = ?`).

## Decision

To ensure 60/120 FPS performance regardless of data size, we adopt four strict performance measures:

1. **react-native-reanimated for High-Frequency State**: The live ticking timer must not trigger React component re-renders. We introduce a `ReanimatedTimer` component that receives a start timestamp and updates the text directly on the native UI thread using Reanimated shared values.
2. **@shopify/flash-list for Large Collections**: Any list that can grow beyond 20 items (e.g., Projects, Task Catalog, Timeline) must use `<FlashList>`. This recycles views and prevents memory exhaustion.
3. **SQL Aggregations**: Mathematical aggregations (`SUM()`, `COUNT()`) must be pushed down to SQLite via `execAsync` or `getFirstAsync`. We do not fetch arrays of rows to sum them up in JavaScript.
4. **SQLite Indexes**: All foreign keys (`project_id`, `task_id`) and frequently filtered/sorted columns (`started_at`) receive a `CREATE INDEX` in `schema.ts`.

## Consequences

- We add `react-native-reanimated` and `@shopify/flash-list` as core dependencies.
- Reanimated requires a babel plugin (`react-native-reanimated/plugin`).
- Complex JS mapping logic for reporting is removed in favor of clean SQL queries.
- Scrolling performance becomes O(1) in memory, and timer updates have zero JS thread cost.
