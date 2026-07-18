import { Redirect } from 'expo-router'

/**
 * The app opens on the **Planner** — the calendar is the stage (design v20, `main.jsx` default
 * screen = planner). `/` redirects to the canonical `/planner`.
 */
export default function Index(): React.JSX.Element {
  return <Redirect href="/planner" />
}
