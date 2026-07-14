# myDevTime — Usertest-Wiederholung (3 Profile) nach M1–M10

**Datum:** 2026-07-11 · **KI-Provider:** Google Gemini 2.5 Flash (echter Key, live) · **Blickwinkel:** Kunde
**Vergleich:** dieselbe Methodik wie der Erst-Test — die echten, verdrahteten Produkt-Codepfade
live gegen Gemini, plus Kundensicht-Audit. Der Key lag nur im Scratchpad, nie im Repo/Commit/PR.

## Ergebnis in einem Satz

**Alle Headline-Befunde des Erst-Tests sind geschlossen.** Die bezahlte KI liefert jetzt für jedes
Profil echten Wert, Überbuchung wird sichtbar gewarnt, der Assistent antwortet geerdet (und lehnt
ehrlich ab), Integrationen sind ehrlich statt Fassade, und die Demo-Signale sind als „Vorschau"
gekennzeichnet.

---

## Re-Test der Personas (live gegen Gemini) — alle grün

| # | Erst-Befund | Maßnahme | Re-Test-Ergebnis |
|---|---|---|---|
| **M1** | Co-Planner-KI immer `deterministic` (Structured-Output-Bug) | Schema durchreichen + Fences strippen | ✅ Lena & Hannes: `source=ai-proposal` |
| **M2** | KI-Assistent = Mock (2 Antworten) | Geerdeter Assistent über eigene Daten | ✅ antwortet aus Fakten („Finanzo") **und** lehnt Out-of-Data-Fragen ehrlich ab |
| **M3** | Integrationen = Fassade („Verbunden" ohne OAuth) | TokenVault + Consent + ehrlicher Status | ✅ Badges: Verbunden/Verbinden/**Geplant** statt Fake |
| **M4** | Überbuchung verschluckt (Meetings weg) | `droppedAnchors` + „Tag überbucht"-Warnung | ✅ Hannes: 1 überlappender Termin gemeldet, 270 min Backlog als „ohne Platz" |
| **M5** | Today-Co-Planner = Demo, nicht persistent | An echten Planner gehängt (accept/replan persistiert) | ✅ Today rendert echten Plan; „Alle übernehmen" persistiert Status |
| **M6** | NL-Parser erkennt „PROJ-142"/„logo" nicht | Ticket-Keys + Katalog-Vokabular | ✅ `PROJ-142 → projectHint`, `logo → Logo` |
| **M7** | Deko wirkt live | „Vorschau"-Badges auf Demo-Karten | ✅ Reports-Demo, Status-Pills, Auto-Tracker, Meetings markiert |
| **M8** | Differenziertes KI-Briefing nicht verdrahtet | Echtes Briefing über den Plan | ✅ Lena & Hannes bekommen unterschiedliche, last-gerechte Briefings |
| **M9** | Pause nur visuell | Segment-basierte echte Pause | ✅ pausiert stoppt Segment, Resume zählt kumulativ weiter |
| **M10** | Toggles nicht persistiert | `preferences`-Modul (jsonb pro Workspace+User) | ✅ Settings-Toggles überleben Reload |

**Degradation weiter intakt:** ohne Provider fällt alles sauber auf den deterministischen Kern
zurück (Briefing, Labeling, Assistent) — die KI ist Zusatz, nie Voraussetzung (ADR-0005).

### Beispiel-Differenzierung der Briefings (live)
- **Lena (Low):** „Dieser Tag ist klar strukturiert und …" — ruhig.
- **Hannes (Hardcore):** „Dein Tag ist mit … sehr dicht … Entlastung: Vendor Call delegieren oder
  Roadmap-Workshop verschieben." — genau die Beratung, die im Erst-Test fehlte.

---

## Screenshots für das Designsystem (Skalierung nach Datendichte)

Abgelegt in diesem Ordner, für Claude Design:

| Datei | Inhalt |
|---|---|
| `density-all.png` | Today (Day Canvas), drei Profile nebeneinander — Low/Medium/Hardcore |
| `density-low-lena.png` | Lena: 1 Termin, 2 Einträge, entspannt (Play-Button, „Im Plan") |
| `density-medium-max.png` | Max: 3 Termine, 6 Einträge, laufender Timer, Jira-Ticket `PROJ-142` |
| `density-hardcore-hannes.png` | Hannes: 6 Blöcke, **12 Einträge**, „Tag überbucht"-Warnung (M4), 4,5 h ohne Platz |
| `reports-density.png` | Berichte skalieren mit der Projektzahl (1 → 4 → 8 Projekte in der Verteilung) |

Die Screenshots zeigen bewusst denselben Screen bei wenig / mittel / viel Daten: Co-Planner-Blöcke,
Eintragsliste und die Überbuchungs-Warnung wachsen mit der Last; die Summen-Kacheln bleiben stabil.
Blueprint-Akzent, Light-Mode, echte Design-Tokens (Farben/Spacing/Radius/Mono-Ziffern).

---

## Was solide bleibt ✅
Timer (jetzt mit echter Pause), NL-Quick-Add (+ Ticket/Projekt-Erkennung), Projekte/Aufgaben,
Reports (Woche live, Rest als Vorschau markiert), Work-time, Absences, Credits, Co-Planner-Vorschlag
+ Abend-Review + echtes Briefing, geerdeter Assistent, ehrliche Integrationen, persistierte Settings.
Der deterministische Kern trägt — die KI ist jetzt echter, sichtbarer Zusatz obendrauf.
