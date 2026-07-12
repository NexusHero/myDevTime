import { ProjectsScreen } from '../../src/screens/ProjectsScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function ProjectsRoute(): React.JSX.Element {
  const { onNavigate } = useShellNav()
  return <ProjectsScreen onNavigate={onNavigate} />
}
