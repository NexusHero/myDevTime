# @mydevtime/mobile — reserved

The client (iOS + Android + Web from one codebase) is
**React Native + Expo** ([ADR-0004](../../docs/adr/0004-react-native-expo-client.md)),
now **Accepted (provisional)**: the cross-platform spike
([issue #1](https://github.com/NexusHero/myDevTime/issues/1),
[findings](../../docs/spikes/0001-client-rn-expo.md)) resolved the architecture,
offline-first/sync-fit, react-native-web, and Day-Canvas-60fps risks with
machine-checked evidence and found no Flutter-fallback trigger.

**Client code may now proceed here.** One residual gate remains before the
"provisional" qualifier is dropped: the on-device checklist (C1–C7 in the
findings) must be signed off on real iOS/Android hardware and two desktop
browsers. This folder stays a README until the first client issue is picked up.

- Validated prototype (the load-bearing logic, machine-tested):
  [`spikes/client-rn-expo`](../../spikes/client-rn-expo/README.md)
- Clickable UI reference the real client implements against:
  [`spikes/ui-prototype`](../../spikes/ui-prototype) and
  [`docs/design/ux-vision.md`](../../docs/design/ux-vision.md)
