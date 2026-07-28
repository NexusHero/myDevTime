# ADR-0077 — Travel map & geocoding: the decision frame

- **Status:** Proposed — the vendor is chosen by the travel-map spike
  ([#376](https://github.com/NexusHero/myDevTime/issues/376)) before any map SDK enters the repo.
  Until then a travel detail shows its route as text and **no map at all**.
- **Date:** 2026-07-28
- **Deciders:** NexusHero
- **Relates:** ADR-0005 (deterministic core), ADR-0004 (RN + Expo, one codebase),
  ADR-0058/0059 (location privacy: endpoints only, never streamed), design v20 §G4,
  issues [#374](https://github.com/NexusHero/myDevTime/issues/374),
  [#372](https://github.com/NexusHero/myDevTime/issues/372)

## Context

A travel entry's detail now reads out what the trip *is*: `From → To`, its distance, its mode, and
the worktime it earns (priced by `packages/domain/travel`). The design (v20 §G4) also asks for a
**map** of the route.

That is not a rendering task. `TravelLeg.from`/`to` are documented as *place labels — a name, not
raw coordinates*. A map needs coordinates, so it needs **geocoding**, and geocoding is an external
vendor call. Three consequences follow, none of them cosmetic:

1. **Privacy.** A trip's endpoints are frequently a home address. Geocoding sends that address to a
   third party. ADR-0058/0059 already constrain location to the *endpoints* and forbid streaming;
   nothing yet says whether an endpoint may leave the device at all, or under what consent.
2. **Cost.** Geocoding and static-map rendering are metered per request. A per-entry map on a list
   of trips multiplies quickly, and myDevTime's monetisation is credit-visible (ADR-0008): an
   invisible per-view cost does not fit it.
3. **One codebase.** ADR-0004 commits to iOS + Android + Web from one codebase. Native map views
   (MapKit, Google Maps SDK) and web tile renderers are different technologies; a static rendered
   image is the only shape that is trivially identical on all three.

No map library exists in the repo today, and no decision has been taken. Adding one now would mean
guessing all three answers at once.

## Decision

**Frame the decision here; take it in a spike; ship the text route-read-out meanwhile.**

Concretely, and binding regardless of which vendor wins:

- **No map SDK, tile provider or geocoder enters the repo before the spike closes.** A travel detail
  that cannot show a map shows *no map* — not a placeholder, not a grey box, not a stock image.
  Silence over pretence, the same rule the rest of the entry detail follows (#372).
- **When it lands it is a port, not a dependency.** One narrow interface (geocode a place label →
  coordinates; render a route between two coordinates → a static image reference) with a **Null
  adapter as the default**, exactly as the LLM (ADR-0029), calendar-sync (§F6-3) and notification
  ports are built. Vendor types stay confined to a single adapter file; nothing upstream imports
  them. The port's *shape* is deliberately not fixed here — an interactive-tiles winner and a
  static-image winner need different interfaces, and choosing the interface before the winner is
  how a port becomes a leaky abstraction.
- **Nothing the map produces may reach a number that matters.** Distance stays user-entered
  (ADR-0005); a geocoded route may *propose* a distance, marked as a proposal with provenance, and
  the user confirms it. A map-derived kilometre never silently reaches a timesheet, an invoice or a
  mileage claim.
- **Geocoding is consent-gated per workspace, off by default.** No address leaves the device until
  the user has said yes, and the consent text names the vendor.

### What the spike must answer

| Question | Why it decides the shape |
|---|---|
| Static rendered image vs interactive map | Decides whether one adapter can serve all three platforms (ADR-0004) |
| Vendor (e.g. OSM/Nominatim + a static tile renderer, Mapbox, Google, Apple) | Licence terms differ on caching and on storing geocoding results |
| May a geocoding result be cached/stored? | If not, every view is a paid call — which changes the cost model entirely |
| Per-request cost at expected volume | Whether it can be absorbed or must become a credit-metered feature (ADR-0008) |
| Self-hosted option viable? | Removes the address-egress problem outright, at an ops cost |
| Degraded behaviour | Confirms the Null adapter is genuinely sufficient, not a stopgap |

## Consequences

- **Enabled:** the travel detail is useful *today* — route, distance, mode and credited worktime,
  all deterministic and all from data the user entered — without waiting on a vendor decision.
- **Accepted:** no map for now. This is the honest state and it is visible as such; the detail does
  not hint at a map it cannot draw.
- **Deferred, not dropped:** the map is the spike's deliverable, and this ADR is superseded (not
  edited) once the winner is known.
- **Constraint carried forward:** whatever wins, a map-derived number is a proposal. That keeps
  ADR-0005 intact through a feature whose whole appeal is that it looks authoritative.
- **Risk if ignored:** bolting a vendor SDK straight into the drawer would put an address-egress
  path, an unmetered cost and a platform-specific view into the client in one commit — the exact
  three things the ports rule exists to prevent.
