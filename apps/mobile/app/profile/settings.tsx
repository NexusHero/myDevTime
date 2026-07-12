import { SettingsScreen } from '../../src/screens/SettingsScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function SettingsRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <SettingsScreen onBack={() => onNavigate('profile')} />
}
