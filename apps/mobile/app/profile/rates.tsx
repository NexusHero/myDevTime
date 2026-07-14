import { RatesScreen } from '../../src/screens/RatesScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function RatesRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <RatesScreen onBack={() => onNavigate('profile')} />
}
