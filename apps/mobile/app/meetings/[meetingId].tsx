import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Text } from '../../src/components/core/Text'
import { useTheme } from '../../src/theme/ThemeProvider'

/**
 * Meeting detail is deep-linkable per the nav model (`/meetings/:meetingId`) but
 * its rich view is a later slice — a themed placeholder keeps the route (and its
 * URL/deep link) live in the meantime.
 */
export default function MeetingRoute(): React.JSX.Element {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>()
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg, padding: t.spacing.s5 }}>
      <Text style={{ color: t.color.ink, fontSize: t.fontSize.xl, fontWeight: '700' }}>
        Meeting
      </Text>
      <Text style={{ color: t.color.ink2, marginTop: t.spacing.s3 }}>
        {meetingId ? `#${meetingId}` : 'Kein Meeting ausgewählt.'}
      </Text>
    </View>
  )
}
