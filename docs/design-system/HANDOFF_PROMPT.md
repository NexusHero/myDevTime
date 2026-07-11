# Prompt für Opus / Claude Code — myDevTime-Design 1:1 übernehmen

> Kopiere alles unterhalb der Linie als Prompt. Lege vorher den Ordner dieses
> Design-Systems (Download aus diesem Projekt) ins Repo, z. B. unter
> `design-system/`, oder installiere SKILL.md als Agent Skill.

---

Du bist Senior Product Engineer und implementierst das **myDevTime-Design-System exakt 1:1** in unserer App. Das System liegt unter `design-system/` (readme.md, SKILL.md, tokens/, components/, assets/, ui_kits/). Es ist die verbindliche Design-Quelle — nicht Inspiration, sondern Spezifikation.

**Bevor du irgendetwas baust:**
1. Lies `design-system/readme.md` komplett (Kontext, Visual Foundations, Iconography, Komponenten-Index).
2. Lies `design-system/SKILL.md` (verbindliche Regeln).
3. Schau dir `ui_kits/devtime/` an — die Screens (TodayScreen, PlannerScreen, ProjectsScreen, ReportsScreen, MeetingsScreen, AssistantScreen, ProfileScreen, phone.jsx) sind die Referenz-Implementierung. Bei jeder Unsicherheit: dort nachschlagen und exakt übernehmen.

**Nicht verhandelbare Regeln:**
- **Tokens statt Werte.** Jede Farbe, jeder Radius, jeder Schatten, jede Dauer kommt aus `tokens/*.css` (via `styles.css`). Keine hartkodierten Hex-Werte, keine eigenen Grautöne, kein Runden von Werten auf „schönere" Zahlen.
- **Drei Themes × zwei Modi**: `data-theme="sovereign|ember|blueprint"` × `data-mode="light|dark"` auf dem Root-Element. Alles muss in allen 6 Kombinationen funktionieren.
- **`--live` (Orange #ff5320) ist theme-unabhängig** und heißt ausschließlich „jetzt/laufend": laufender Timer, Now-Linie, REC-Punkt, Logo-Playhead. Niemals dekorativ verwenden.
- **`--ai-grad` ist die AI-Signatur**: JEDER KI-Output (Vorschläge, Briefings, Insights, Assistant-Antworten) trägt den Blau→Violett→Orange-Gradient — als Hairline via `AICallout`/`AIAskBar` oder als ✦-Chip. Deterministische UI trägt ihn NIE. Der Gradient ist der visuelle Vertrag „KI schlägt vor, du entscheidest".
- **Ghost-Blöcke** (KI-/Plan-Vorschläge) sind IMMER gestrichelte Outlines, nie gefüllt — erst nach Annahme werden sie solide.
- **Zahlen sind das Produkt**: alle Zeiten/Beträge/Prozente in `--font-mono` (JetBrains Mono) mit `font-variant-numeric: tabular-nums`. Überschriften in `--font-display` (Clash Display per @font-face aus `fonts/`), UI-Text System-Sans.
- **Icons nur aus `components/core/Icon.jsx`** (24px-Raster, 2px-Stroke, currentColor). Neue Glyphen im selben Raster in ICON_PATHS ergänzen — nie Lucide/Heroicons/Emoji mischen.
- **Logo-Assets nur aus `assets/logo/`** verwenden (icon.svg, icon-light.svg, icon-mono.svg, mark-glyph.svg, favicon.svg). Logo nie nachzeichnen oder verändern; der Playhead bleibt orange.
- **Komponenten wiederverwenden statt nachbauen**: Button, Card, Badge, DayBlock, Island, BudgetRing, BoxPlot, LoadMeter, CheckinCard, MoodCheck, AICallout, AIAskBar, EmptyState, AppShell usw. aus `components/` — jede hat ein `.prompt.md` mit Usage-Beispiel. API respektieren, nicht forken.
- **Balance-Feature-Ethik**: Belastung nie als Diagnose formulieren; passive Signale immer sichtbar neben dem Score; Selbstauskünfte (CheckinCard, MoodCheck) bleiben lokal; die KI korreliert nur, sie folgert nie Gefühle aus Arbeitsdaten allein.
- **Copy**: Deutsch, du-Form, ruhig und präzise, keine Ausrufezeichen, kein Emoji. Empty States = Fakt + nächster Schritt (siehe `EmptyState.prompt.md`).
- **Motion**: Dauern/Easings aus `tokens/effects.css` (`--dur-fast/med/slow`, `--ease-out`, `--ease-spring`). Ghost-Einflug mit Spring, Button-Press scale(0.92), Count-ups bei Kennzahlen. `prefers-reduced-motion` respektieren.

**Arbeitsweise:**
- Baue Screen für Screen gegen die Referenz in `ui_kits/devtime/` und vergleiche visuell in allen Themes + Modi, Desktop und Mobile (Referenz: `phone.jsx` — Tab-Bar mit Pill-Active-State, Island über der Tab-Bar).
- Wenn etwas im Design-System nicht definiert ist: NICHT erfinden. Kurz nachfragen oder als offene Frage markieren.
- Liefere am Ende eine Checkliste: welche Screens/Komponenten übernommen, welche Tokens verwendet, wo abgewichen (sollte leer sein) und warum.
