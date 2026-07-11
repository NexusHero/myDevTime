Calm empty state for any surface with nothing to show yet — icon disc, one line of state, one line of next step, optional action button. Never an illustration.

```jsx
const { EmptyState, Button } = window.MyDevTimeDesignSystem_254296;
<EmptyState icon="projects" title="Noch keine Projekte"
  hint="Lege dein erstes Projekt an — Budget und Stundensatz kannst du später ergänzen."
  action={<Button size="sm">Neues Projekt</Button>} />
```

- `icon` from the brand Icon set; `compact` for use inside cards/sidebars.
- Copy rule: state fact + next step, du-Form, no exclamation marks.
