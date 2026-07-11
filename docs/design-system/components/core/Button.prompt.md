The primary interactive control — always fully pill-shaped, never a sharp-cornered button.

```jsx
<Button variant="primary" onClick={start}>Start timer</Button>
<Button variant="secondary" icon={<PauseIcon/>}>Pause</Button>
<Button variant="ghost" size="sm">Skip</Button>
```

Variants: `primary` (accent fill), `secondary` (bordered, neutral), `ghost` (text-only, for low-emphasis actions inside dense rows), `danger` (destructive). Hover lifts 1px + gains a soft shadow — no scale-up, no bounce.
