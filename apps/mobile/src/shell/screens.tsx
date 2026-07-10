import { StyleSheet, View } from 'react-native'
import { Text } from '../components/core/Text'
import type { Screen } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { TodayScreen } from '../screens/TodayScreen'
import { ProjectsScreen } from '../screens/ProjectsScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { PlannerScreen } from '../screens/PlannerScreen'
import { MeetingsScreen } from '../screens/MeetingsScreen'
import { AssistantScreen } from '../screens/AssistantScreen'
import { AbsencesScreen } from '../screens/AbsencesScreen'
import { WorkTimeScreen } from '../screens/WorkTimeScreen'
import { CreditsScreen } from '../screens/CreditsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { ProjectScreen } from '../screens/ProjectScreen'
import { TaskScreen } from '../screens/TaskScreen'

/**
 * Human labels for every deep-linkable screen (ux-vision §3). The rendered
 * screens are placeholders in this scaffold — real Today/Planner/… views land in
 * later phases of #11; the point here is that the shell, theme, and nav model
 * wire together end-to-end on iOS, Android, and web.
 */
export const SCREEN_TITLES: Record<Screen, string> = {
  today: 'Today',
  planner: 'Planner',
  projects: 'Projects',
  project: 'Project',
  task: 'Task',
  reports: 'Reports',
  meetings: 'Meetings',
  meeting: 'Meeting',
  profile: 'Profile',
  worktime: 'Work time',
  absences: 'Absences',
  settings: 'Settings',
  credits: 'Credits',
  assistant: 'Assistant',
}

/**
 * Renders the real screen for a route, falling back to the scaffold placeholder
 * for screens not yet ported (later slices of #11). The five phone tabs (Today,
 * Planner, Projects, Reports, Profile), Meetings, the Assistant, and the Profile
 * drill-downs (Absences, Credits, Settings) are live; `onNavigate` lets a screen
 * open another through the shell's active-screen model (the sub-screens use it to
 * return to Profile). The remaining detail screens arrive screen-by-screen.
 */
export function ScreenView({
  screen,
  params = {},
  onNavigate,
}: {
  screen: Screen
  params?: Record<string, string>
  onNavigate: (screen: Screen, params?: Record<string, string>) => void
}): React.JSX.Element {
  const toProfile = (): void => onNavigate('profile')
  if (screen === 'today') return <TodayScreen />
  if (screen === 'planner') return <PlannerScreen />
  if (screen === 'projects') return <ProjectsScreen onNavigate={onNavigate} />
  if (screen === 'project')
    return (
      <ProjectScreen
        projectId={params.projectId ?? ''}
        onNavigate={onNavigate}
        onBack={() => onNavigate('projects')}
      />
    )
  if (screen === 'task') return <TaskScreen taskId={params.taskId ?? ''} onNavigate={onNavigate} />
  if (screen === 'reports') return <ReportsScreen />
  if (screen === 'meetings') return <MeetingsScreen />
  if (screen === 'assistant') return <AssistantScreen />
  if (screen === 'profile') return <ProfileScreen onNavigate={onNavigate} />
  if (screen === 'worktime') return <WorkTimeScreen onBack={toProfile} />
  if (screen === 'absences') return <AbsencesScreen onBack={toProfile} />
  if (screen === 'credits') return <CreditsScreen onBack={toProfile} />
  if (screen === 'settings') return <SettingsScreen onBack={toProfile} />
  return <PlaceholderScreen screen={screen} />
}

export function PlaceholderScreen({ screen }: { screen: Screen }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg, padding: t.spacing.s5 }]}>
      <Text style={{ color: t.color.ink, fontSize: t.fontSize.xl, fontWeight: '700' }}>
        {SCREEN_TITLES[screen]}
      </Text>
      <View
        style={{
          marginTop: t.spacing.s4,
          padding: t.spacing.s4,
          borderRadius: t.radius.card,
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: t.color.border,
        }}
      >
        <Text style={{ color: t.color.ink2 }}>Scaffold placeholder — {t.mode} theme.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
