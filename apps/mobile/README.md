# @mydevtime/mobile — reserved, gated

The client (iOS + Android + Web from one codebase) is proposed as
**React Native + Expo** ([ADR-0004](../../docs/adr/0004-react-native-expo-client.md)),
but that ADR is **Proposed, not Accepted** — it is gated on the cross-platform
device spike ([issue #1](https://github.com/NexusHero/myDevTime/issues/1)) and
the Day-Canvas gesture-quality check.

**No client code may be added here until ADR-0004 is Accepted.** This folder is
intentionally a README only, so the workspace layout is visible without shipping
a client stack the spike hasn't yet validated (Flutter is the named fallback).

The clickable UI reference the real client implements against lives in
[`spikes/ui-prototype`](../../spikes/ui-prototype) and
[`docs/design/ux-vision.md`](../../docs/design/ux-vision.md).
