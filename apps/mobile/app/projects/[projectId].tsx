import { useLocalSearchParams } from 'expo-router'
import { ProjectScreen } from '../../src/screens/ProjectScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function ProjectRoute(): React.JSX.Element {
  const { projectId } = useLocalSearchParams<{ projectId: string }>()
  const { onNavigate } = useShellNav()
  return (
    <ProjectScreen
      projectId={projectId ?? ''}
      onNavigate={onNavigate}
      onBack={() => onNavigate('projects')}
    />
  )
}
