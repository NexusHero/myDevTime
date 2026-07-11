Box plot of daily working hours vs. the daily target (Soll) — use in Reports wherever a distribution says more than a single saldo number.

```jsx
const { BoxPlot } = window.MyDevTimeDesignSystem_254296;
<BoxPlot min={6.2} q1={7.5} median={8.4} q3={9.2} max={10.75} target={8.33} width={300} />
```

- `target` renders as a dashed marker in the live orange (`--live`) with a "Soll h:mm" label; min/median/max get mono labels.
- Values are decimal hours (8.33 = 8:20h); formatting to h:mm happens inside.
- `color` defaults to the accent; pass a project color when the plot is per-project.
