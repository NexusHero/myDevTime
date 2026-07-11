The one container for anything the AI says: gradient hairline (blue→orange) + ✦ chip. Use it for Co-Planner briefings, replan prompts, Auto-Tracker insights, Assistant answers — never for deterministic UI.

```jsx
const { AICallout, Button } = window.MyDevTimeDesignSystem_254296;
<AICallout
  title="Dein Tag: 3 Meetings, 4,5h Fokus möglich."
  action={<Button size="sm">✦ Neu planen</Button>}
>
  Nordwind ist bei 91% Budget — Deep Work priorisiert.
</AICallout>
```

- `compact` for tight spots inside cards.
- Rule: the gradient IS the AI contract — if the AI didn't produce it, don't wrap it.
