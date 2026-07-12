import { ProfileScreen } from '../../src/screens/ProfileScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function ProfileRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <ProfileScreen onNavigate={onNavigate} />
}
