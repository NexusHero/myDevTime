import { CreditsScreen } from '../../src/screens/CreditsScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function CreditsRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <CreditsScreen onBack={() => onNavigate('profile')} />
}
