Weekly 2-question check-in (exhaustion + detachment, 5-step scales, OLBI-short-form style) — the self-report half of the Balance feature.

```jsx
const { CheckinCard } = window.MyDevTimeDesignSystem_254296;
<CheckinCard onDone={({ exhaustion, detachment }) => save(...)} />
```

- Always pair with the passive LoadMeter: self-report × work data is the honest signal; neither alone.
- Shows "bleibt auf deinem Gerät" — check-in answers are local/private by contract.
- After save it collapses to a one-line confirmation; don't nag more than weekly.
