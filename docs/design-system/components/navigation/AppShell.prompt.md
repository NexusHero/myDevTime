The one shared shell — sidebar posture promotes Meetings to top-level (desktop/tablet); tabs posture is the five-tab phone bar (ux-vision §3 IA, matches `chromeForWidth`).

```jsx
<AppShell posture="sidebar" active="today" onNavigate={go}>
  <TodayScreen />
</AppShell>
```
