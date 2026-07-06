# UI-Prototyp (Spike) — Day Canvas, Island, Co-Planer

Klickbarer **UI-only**-Prototyp der [UX-Vision](../../docs/design/ux-vision.md) — React + Vite +
TypeScript, Mock-Daten, kein Backend, keine Persistenz. Arbeitet Issue **#39** zu (Prototyp-Gate
vor dem Design-System #11); die Produktions-Clients entstehen per ADR-0004 in React Native.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html — ein einziges, teilbares HTML-File
```

## Was der Prototyp zeigt

| Konzept (ux-vision) | Umsetzung |
|---|---|
| **Day Canvas** §2.1 | Heute-Ansicht: Stundenraster, Anwesenheits-Spur (Stempelrahmen + Pausen), Projekt-/Meeting-Blöcke, Lücken-Hints, Jetzt-Linie mit Zeit-Chip (simulierte Uhr ab 13:37, tickt live) |
| **Co-Planer** §2.2 | Briefing-Karte + Ghost-Blöcke (gestrichelt/schraffiert) mit Übernehmen/Verwerfen, einzeln oder alle — Provenance-Chip bleibt nach Übernahme |
| **Island** §2.3 | Schwebende Pill: laufender Timer (tickt), Stempelstatus; expandiert zu Quick-Actions (Timer, Pause, Stempeln) |
| **Command Palette** §2.4 | ⌘K/Ctrl+K: Navigation, Aktionen, NL-Schnelleintrag („45m Code Review“, „2h Finanzo Doku gestern“) mit Parse-Vorschau |
| **Instrumente** §2.5 | Berichte: Stat-Tiles, Überstunden-Gauge, Budget-Ringe (Warnstufen 80/100 %), Stunden-Balken mit Legende, 12-Wochen-Heatmap; Projekt-Sparklines |
| Arbeitszeit (ADR-0010) | Netto-Anwesenheit, Abdeckungs-Quote, Pausenregel-Karte (ArbZG-Preset), Urlaubs-Kachel, Abwesenheits-Overlay im Planer |
| Meetings (ADR-0008/0009) | Transkript-Liste, AI-Insights mit Credit-Kennzeichnung, eigene Prompts, Consent-Status |

Design-Tokens in [`src/styles.css`](src/styles.css): Dark-first + Light (Toggle in der Sidebar,
`data-theme` auf `<html>`), 8-pt-Grid, System-Schriften (bewusst — die RN-App nutzt native
Fonts), Mono-Ziffern für alle Zeiten, Akzent „Ember“ `#E8A33D` nur für Jetzt/Live/Primäraktionen.
Projektfarben sind eine **validierte kategoriale Palette** (Lightness-Band, Chroma, CVD-ΔE ≥ 32,
Kontrast ≥ 3:1 — je Theme eigene Stufen).

## Bewusst nicht drin (gehört in #39/#1, nicht in diesen Spike)

Drag/Stretch/Split der Blöcke (Micro-Interaction-Spec + RN-Gesten-Beweis), echte
NL-Parser-Qualität, Wochen-Drag im Planer, Onboarding, Settings/Profil.
