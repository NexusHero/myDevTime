import { AbsencesScreen } from '../../src/screens/AbsencesScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function AbsencesRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <AbsencesScreen onBack={() => onNavigate('profile')} />
}
