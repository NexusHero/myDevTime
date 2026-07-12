import { WorkTimeScreen } from '../../src/screens/WorkTimeScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function WorkTimeRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <WorkTimeScreen onBack={() => onNavigate('profile')} />
}
