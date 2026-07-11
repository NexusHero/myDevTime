One-tap momentary stress signal for Today — the in-the-moment complement to the weekly CheckinCard (EMA pattern).

```jsx
const { MoodCheck } = window.MyDevTimeDesignSystem_254296;
<MoodCheck onSelect={(mood) => log(mood)} />
```

- Three chips (Gut/Angespannt/Gestresst) with semantic colors; one tap collapses to a confirmation.
- Rules: max one prompt/day, never modal, never blocks a flow; answers are local like all Balance self-reports.
- Good placements: Today (under the tracker), or after punch-out. Not on every screen.
