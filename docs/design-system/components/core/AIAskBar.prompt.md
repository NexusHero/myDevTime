The "ask your data anywhere" bar — put one on any screen so the AI is reachable in context, not just in the Assistant tab. Gradient hairline = AI signature.

```jsx
const { AIAskBar } = window.MyDevTimeDesignSystem_254296;
<AIAskBar
  scopes={['Zeiten', 'Budgets']}
  answers={{
    "Wo wird's diese Woche eng?": 'Donnerstag ist mit 9,3h geplant über deinem Soll (8:20h) — und Nordwind hat nur noch 7,2h Budget.',
  }}
/>
```

- `answers` keys render as tappable suggestion chips; free input falls back to `defaultAnswer`.
- Tailor `scopes` + `answers` to the screen (Planner: Zeiten/Budgets; Reports: Projekte/Umsatz).
- Every answer carries the provenance footnote automatically.
