import { StyleSheet, Text, View } from 'react-native'
import type { Screen } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { TodayScreen } from '../screens/TodayScreen'
import { ProjectsScreen } from '../screens/ProjectsScreen'

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
  absences: 'Absences',
  settings: 'Settings',
  credits: 'Credits',
  assistant: 'Assistant',
}

/**
 * Renders the real screen for a route, falling back to the scaffold placeholder
 * for screens not yet ported (later slices of #11). Today and Projects are live;
 * the rest arrive screen-by-screen.
 */
export function ScreenView({ screen }: { screen: Screen }): React.JSX.Element {
  if (screen === 'today') return <TodayScreen />
  if (screen === 'projects') return <ProjectsScreen />
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
