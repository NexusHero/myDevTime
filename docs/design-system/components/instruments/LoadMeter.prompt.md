Weekly strain meter for the Balance feature — green→amber→red track with a needle, zone label + score. Always pair it with its auditable signals and (if elevated) an AICallout proposing recovery.

```jsx
const { LoadMeter } = window.MyDevTimeDesignSystem_254296;
<LoadMeter score={64} width={300} />
```

- Zones: <45 ok, 45–69 erhöht, ≥70 kritisch — thresholds live in the component.
- The score is deterministic (overtime trend, Pausen, Abend-Sessions, Meeting-Anteil); show those signals next to the meter so the number stays auditable.
- Copy rule: never "Burnout-Diagnose" — it's Belastung/Drift, and the AI only *proposes* recovery (AICallout), never prescribes.
