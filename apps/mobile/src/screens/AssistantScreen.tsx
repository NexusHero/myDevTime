import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Button, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Assistant — the grounded, read-only helper (ux-vision §2.4, #20). It answers
 * only from the workspace's own data through deterministic query tools; every
 * figure it shows comes from the aggregation, never the model (ADR-0005). It
 * proposes and deep-links, it never mutates state, and it refuses cleanly when a
 * question falls outside the data. One credit per question.
 */
interface ChatMsg {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly refusal?: boolean
}

const SCRIPT: readonly ChatMsg[] = [
  { role: 'user', text: 'Where am I over budget?' },
  {
    role: 'assistant',
    text: 'Finanzo is at 92% of its 40h monthly budget (36.8h booked) — the only project past 80%. Huber CMS sits at 54%, everything else is under half.',
  },
  { role: 'user', text: 'Draft my standup for today.' },
  {
    role: 'assistant',
    text: 'Yesterday: 6.4h across Finanzo auth (2.5h), conflict tests (1.5h) and reviews. Today’s plan: sprint review at 14:00 and the tombstone story. No blockers flagged.',
  },
]

export function AssistantScreen(): React.JSX.Element {
  const t = useTheme()
  const [msgs, setMsgs] = useState<readonly ChatMsg[]>(SCRIPT)
  const [input, setInput] = useState('')

  const send = (text: string): void => {
    if (!text.trim()) return
    setMsgs(m => [
      ...m,
      { role: 'user', text },
      {
        role: 'assistant',
        text: 'In this preview I answer the example questions. In the product the assistant answers any question about your times, projects, budgets and meetings through deterministic query tools — 1 credit per question.',
      },
    ])
    setInput('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s3,
          gap: t.spacing.s3,
        }}
      >
        <Text
          style={{
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
          }}
        >
          ✦ Assistant
        </Text>
        <Badge tone="neutral">your data · read-only</Badge>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s4,
          gap: t.spacing.s3,
        }}
      >
        {msgs.map((m, i) => (
          <Bubble key={`${m.role}-${String(i)}`} msg={m} />
        ))}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: t.color.border,
          backgroundColor: t.color.surface,
          padding: t.spacing.s4,
          gap: t.spacing.s3,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          {['Where am I over budget?', 'Draft my standup'].map(s => (
            <Button key={s} size="sm" variant="ghost" onPress={() => send(s)}>
              {s}
            </Button>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.s2 }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Ask about your times, budgets, meetings … · 1 credit"
              value={input}
              onChangeText={setInput}
            />
          </View>
          <Button onPress={() => send(input)}>Send</Button>
        </View>
      </View>
    </View>
  )
}

function Bubble({ msg }: { msg: ChatMsg }): React.JSX.Element {
  const t = useTheme()
  const isUser = msg.role === 'user'
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        padding: t.spacing.s3,
        borderRadius: t.radius.card,
        backgroundColor: isUser ? t.color.accent : t.color.surface,
        borderWidth: isUser ? 0 : 1,
        borderColor: t.color.border,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: t.fontSize.sm,
          lineHeight: 20,
          color: isUser ? t.color.accentText : t.color.ink,
        }}
      >
        {msg.text}
      </Text>
      {!isUser && !msg.refusal && (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
          Figures from the deterministic aggregation · never the model
        </Text>
      )}
    </View>
  )
}
