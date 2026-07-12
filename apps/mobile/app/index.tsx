import { Redirect } from 'expo-router'

/** The app opens on Today (ux-vision §3). `/` redirects to the canonical `/today`. */
export default function Index(): React.JSX.Element {
  return <Redirect href="/today" />
}
