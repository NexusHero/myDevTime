import { useLocalSearchParams } from 'expo-router'
import { TaskScreen } from '../../src/screens/TaskScreen'
import { useShellNav } from '../../src/shell/useShellNav'

export default function TaskRoute(): React.JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  const { onNavigate } = useShellNav()
  return <TaskScreen taskId={taskId ?? ''} onNavigate={onNavigate} />
}
