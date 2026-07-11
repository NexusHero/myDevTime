The brand's own line-icon set (24px grid, 2px stroke, round caps, currentColor) — use for every glyph need instead of emoji or CDN icon sets.

```jsx
const { Icon } = window.MyDevTimeDesignSystem_254296;
<Icon name="timer" size={20} />
<span style={{ color: 'var(--live)' }}><Icon name="record" size={16} /></span>
```

- Color via CSS `color` on the parent (currentColor).
- 23 glyphs: navigation (today/planner/projects/reports/meetings/profile/assistant), timer controls (play/pause/stop/record/timer), actions (plus/check/x/search/export/edit), misc (mic/break/settings/chevrons).
- New glyphs: add the path to `ICON_PATHS` on the same 24px/2px-stroke grid.
