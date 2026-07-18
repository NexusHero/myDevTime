# Maestro E2E flows (mobile) — #27, REQ-022

End-to-end UI flows for the Expo/React Native client, authored with
[Maestro](https://maestro.mobile.dev/). They drive the real app on a simulator/emulator
or a physical device through **accessibility labels that exist in the source**
(`apps/mobile/src`) — no invented screens or labels.

| Flow             | What it exercises                                                        |
| ---------------- | ------------------------------------------------------------------------ |
| `01-auth.yaml`   | Launch, fill email + password, submit sign-in, assert **Today** visible. |
| `02-timer.yaml`  | Sign in, tap **Start**, assert **Stop** (running), **Pause** → **Resume**, then **Stop**. |
| `03-reports.yaml`| Sign in, tap the **Reports** nav item, assert the **Overview** summary segment. |

`appId` is `com.nexushero.mydevtime` (Expo `bundleIdentifier` / Android `package`).

## Accessibility labels the flows rely on (verified in source)

- `Email`, `Password` — login inputs (`screens/LoginScreen.tsx`; `Input.tsx` sets
  `accessibilityLabel={label}`).
- `Sign in` — submit button (`Button.tsx` sets `accessibilityLabel={children}`).
- `Today` — screen title / bottom-tab label (`shell/titles.ts` `SCREEN_TITLES.today`).
- `Start` / `Stop` — primary punch button, `accessibilityLabel={active ? 'Stop' : 'Start'}`
  (`screens/TodayScreen.tsx`). `active = isRunning || paused`, so it stays `Stop` while paused.
- `Pause` / `Resume` — pause button, `accessibilityLabel={paused ? 'Resume' : 'Pause'}`
  (`screens/TodayScreen.tsx`).
- `Reports` — nav item, `accessibilityLabel={SCREEN_TITLES[screen]}` (`shell/ShellChrome.tsx`;
  `reports` is in `PHONE_TABS`).
- `Overview` — the always-present Reports view segment (`screens/ReportsScreen.tsx`).

## Prerequisites

1. **Maestro CLI** installed: `curl -Ls "https://get.maestro.mobile.dev" | bash`.
2. **An installed dev build of the app** on a running simulator/emulator (or device):
   - iOS Simulator / Android Emulator booted, or a device attached.
   - Build & install via EAS: `eas build --profile development --platform ios`
     (or `android`), then install the resulting build; or run a local dev client
     (`pnpm --filter @mydevtime/mobile ios` / `... android`) and keep it installed.
3. **A signed-in-able account**: the flows use `demo@mydevtime.app` / `devpassword`
   (password ≥ 8 chars, per the login schema). Point them at a seeded test account on the
   API the dev build targets, or edit the credentials in the YAML to match your fixture.

## Run

```sh
# All flows against the currently-booted simulator/emulator (or attached device):
maestro test .maestro/

# A single flow:
maestro test .maestro/02-timer.yaml
```

Each flow starts with `launchApp: { clearState: true }` for a logged-out start; the timer
and reports flows re-run the sign-in block only when the login form is present, so they are
self-contained yet tolerate a persisted session.

## CI status — authored, not yet device-verified (handback)

**CI does not run these flows.** The `./test.sh` gate has no iOS Simulator / Android Emulator,
and Maestro requires a running device with the app installed. These flows are therefore
**authored-but-not-yet-device-verified**: the label selectors are all confirmed against source,
but the flows have not been executed end-to-end on a device.

**Device-run is the handback** — the remaining step (on-device checklist, C-series) is to install
an EAS dev build on a simulator/device, run `maestro test .maestro/` against a seeded account, and
record the result. Adjust the demo credentials / any timing (`extendedWaitUntil`) if the target
environment differs.
