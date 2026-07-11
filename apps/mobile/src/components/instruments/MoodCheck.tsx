import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

type Mood = 'great' | 'good' | 'okay' | 'tired' | 'stuck'

interface MoodCheckProps {
  readonly value?: Mood
  readonly onChange?: (mood: Mood) => void
}

const MOODS: Record<Mood, string> = {
  great: '😄',
  good: '😊',
  okay: '😐',
  tired: '😴',
  stuck: '😖',
}

export function MoodCheck({ value, onChange }: MoodCheckProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.s3, justifyContent: 'space-around' }}>
      {(Object.keys(MOODS) as Mood[]).map(mood => (
        <Pressable
          key={mood}
          onPress={() => onChange?.(mood)}
          style={{ opacity: value === mood ? 1 : 0.5, padding: t.spacing.s2 }}
        >
          <Text style={{ fontSize: 28 }}>{MOODS[mood]}</Text>
        </Pressable>
      ))}
    </View>
  )
}
