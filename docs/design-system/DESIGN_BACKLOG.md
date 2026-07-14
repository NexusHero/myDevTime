# DevTime — Konsolidiertes Maßnahmen-Backlog (Stand 14.7.2026)

## Status: vollständig abgearbeitet ✅

## A — Planner-Feinschliff ✅
1. **Resize-Handle** ✅ Blockdauer per Unterkante ziehen, 15-min-Raster, min 0:15.
2. **Hover-Pop bei Lanes** ✅ gequetschter Block klappt beim Hover auf volle Spaltenbreite (zIndex + Schatten).
3. **Überbuchungs-Hinweis** ✅ „2× parallel"-Badge im Tageskopf; FYI-Blöcke & Pausen zählen nicht als Konflikt.

## B — Freelancer-Kernlücken ✅
4. **Abrechnungs-Flow** ✅ Kunden-Ebene in Projects; „Abrechnung erstellen"-Drawer: Zeitraum, Positionen abwählbar (nicht-billable vorab abgewählt), Live-Summe h/€, PDF/CSV-Export, als abgerechnet markiert, mit Undo.
5. **Billable-Toggle** ✅ €-Knopf im Hero-Tracker (Today).
6. **Schnell-Nachtrag** ✅ war vorhanden (NL Quick-Add auf Today).
7. **Idle-Detection** ✅ „40 min inaktiv (12:20–13:00)"-Karte auf Today: Behalten / Als Pause / Verwerfen, je mit Undo.
8. **Kunde → Projekt-Hierarchie** ✅ Finanzo AG (2 Projekte, Retainer 78€/h), Nordwind (Fixed), Atlas (T&M), Intern (nicht abrechenbar).

## C — Product-Owner-Punkte ✅
9. **Empty States** ✅ „Minute 1"-Preview-Toggle im Projects-Header zeigt den Erster-Start-Zustand (EmptyState-Komponente).
10. **Undo-Toast** ✅ global in app.jsx (`window.dtToast(msg, onUndo)`) — wired an Idle-Aktionen, Abrechnung, Task-Einplanen im Planner.

## Früher erledigt (nicht wiederholen)
Überbuchung mit Lane-Layout, RSVP-Status (zugesagt/Vorbehalt/FYI), Outlook-Sync Stufe 1+2, Replan-Flow, Kapazitäts-Check, Task-Inbox mit Drag, Rückstau-×-Belastung-Chart, Balance/Stress inkl. Check-in, Abwesenheitsmodul, Splash + Logo + Icon-Set, Phone-Version.

## Nächste Session
Backlog leer — neue Punkte aus User-Tests sammeln.
