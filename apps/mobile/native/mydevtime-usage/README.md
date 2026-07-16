# `mydevtime-usage` — native Android app-usage capture (scaffold)

The native adapter for the Auto-Tracker's real per-app tracking on **Android**
(REQ-042, [ADR-0058](../../../../docs/adr/0058-native-app-usage-capture.md)). It reads
per-app cumulative foreground time from `UsageStatsManager` and exposes it to JS behind
the `NativeUsageModule` port.

> **Status: documented scaffold, not a running feature.** The JS adapter that turns the
> native readings into spans (`apps/mobile/src/autotracker/nativeUsage.ts`) is real and
> unit-tested. The native module here compiles and runs **only** inside an Expo Dev
> Client / prebuild build with the `PACKAGE_USAGE_STATS` grant, and has **not** been
> built or verified on a device in this repo's environment. The managed / Expo Go build
> never loads it — `platformCapture` falls back to the honest null adapter.

## What's here

- `expo-module.config.json` — registers the Android module with Expo autolinking.
- `android/src/main/java/com/mydevtime/usage/MydevtimeUsageModule.kt` — the
  `UsageStatsManager` reader (`hasPermission` / `requestPermission` / `query`).

## Activating it (on a machine that can build a Dev Client)

1. **Move the module into the app** so Expo autolinks it, e.g. `apps/mobile/modules/mydevtime-usage/`,
   and add the JS entry `index.ts` below.
2. **Declare the permission** — in `app.json` add to `android.permissions`:
   `"android.permission.PACKAGE_USAGE_STATS"` (it is a special access grant the user
   toggles in Settings, which `requestPermission()` opens).
3. **Prebuild + Dev Client**: `npx expo prebuild -p android` then `eas build --profile development -p android` (or a local `expo run:android`). Expo Go cannot load native modules.
4. **Register the module** — add the JS entry below and import it once at app start
   (e.g. from `App.tsx`), so it calls `registerNativeUsageModule` at load. Nothing else
   changes: `platformCapture` already routes Android to `nativeUsageCapture(module)`,
   which polls `query()` and feeds `diffUsage`'s spans into the same deterministic
   `summarizeActivity` the web adapter uses.

## The JS entry (`index.ts`) to add on activation

```ts
import { requireNativeModule } from 'expo-modules-core'
import {
  registerNativeUsageModule,
} from '../../src/autotracker/capture'
import type { NativeUsageModule } from '../../src/autotracker/nativeUsage'

// The autolinked native module, typed against the port, registered with the capture
// seam at import. Consent + session gating and the local-only stance are enforced
// upstream (useAutoTracker / ADR-0057/0058).
const native = requireNativeModule('MydevtimeUsage') as NativeUsageModule
registerNativeUsageModule(native)
export default native
```

## Privacy

Capture stays **consent- and session-gated** (the `autoTracker` opt-in, only while a
timer runs) and **local-only** — spans are summarized on-device by the deterministic
core and never uploaded (the server ingest was deliberately rejected on data-protection
grounds; see ADR-0058). App-usage is behaviour-near data, so it stays where it was
observed.
