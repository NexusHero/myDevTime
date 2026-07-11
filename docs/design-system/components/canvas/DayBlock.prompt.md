The core primitive of the Day Canvas (ux-vision §2.1) — "time is material", rendered as a touchable block, not a table row.

```jsx
<DayBlock label="Finanzo Review" time="09:00–10:30" kind="actual" color="var(--project-1)" />
<DayBlock label="Deep work" time="13:00–15:00" kind="ghost" color="var(--project-2)" onAccept={accept} onDismiss={dismiss} />
```

Never fill a ghost block with a solid color — the dashed/outline treatment IS the provenance signal that this is an AI proposal, not committed reality.
