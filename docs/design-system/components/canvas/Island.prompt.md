One persistent pill carrying live state (timer + punch status), same information architecture on every platform (ux-vision §2.3). Collapsed = glance; tap expands to quick actions. Morphs corner radius + size, never a hard swap. The full punch loop (Pause / Stop / Ausstempeln / Einstempeln) belongs in `actions` — the user must never have to change screens to punch out.

```jsx
// Phone: floating, bottom-center above the tab bar
<Island running elapsed="00:42:11" punched expanded={open} onToggle={() => setOpen(!open)}
  actions={[{label:'Pause'},{label:'Stop'},{label:'Ausstempeln'}]} />

// Desktop: docked into the sidebar footer — never overlaps the working surface
<Island posture="docked" running elapsed="00:42:11" punched expanded={open} onToggle={() => setOpen(!open)}
  actions={[{label:'Pause'},{label:'Stop'},{label:'Ausstempeln'}]} />
```

`posture="docked"` renders full-width with a live-orange glow while running; `floating` (default) is the free pill.
