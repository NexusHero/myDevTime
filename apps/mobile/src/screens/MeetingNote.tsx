import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { meetingNotesFacts } from '@mydevtime/domain'
import { Text } from '../components/core/Text'
import { Card, InsightCard } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Manual meeting note → grounded follow-ups (REQ-054, design v13 KI4). The user types
 * their own meeting notes — real, consent-first data — and the deterministic
 * `meetingNotesFacts` core turns them into ordered fact lines the grounded LLM phrases into
 * follow-up actions (violet, credit-metered, honest refusal — via `InsightCard`). No ASR,
 * no fabricated transcript: auto-capture (ADR-0009) is a future adapter feeding the same
 * core. Notes stay on this screen; nothing is written until the user acts on a proposal.
 */
export function MeetingNote(): React.JSX.Element {
  const t = useTheme()
  const [notes, setNotes] = useState('')
  const facts = meetingNotesFacts(notes)

  return (
    <View style={{ gap: t.spacing.s3 }}>
      <Card>
        <Text style={{ fontSize: t.fontSize.md, fontWeight: '700', color: t.color.ink }}>
          Meeting notes
        </Text>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
          Jot what was decided and who owns what — one point per line. Follow-ups are grounded only
          in what you type.
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={'- @alex to send the deck\n- Decide hosting by Friday\n- Fix the flaky test'}
          placeholderTextColor={t.color.ink3}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Meeting notes"
          style={{
            marginTop: t.spacing.s3,
            minHeight: 108,
            padding: t.spacing.s3,
            borderRadius: t.radius.block,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            color: t.color.ink,
            fontSize: t.fontSize.sm,
          }}
        />
      </Card>

      <InsightCard
        kind="meeting"
        title="Follow-ups"
        subtitle="Grounded in your notes above"
        cta="Suggest follow-ups"
        facts={facts}
      />
    </View>
  )
}
