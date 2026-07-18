import { RulesScreen } from '../../src/screens/RulesScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function RulesRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <RulesScreen onBack={() => onNavigate('profile')} />
}
