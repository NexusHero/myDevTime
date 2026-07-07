import { describe, expect, it } from 'vitest'
import { asId, type WorkspaceId } from './ids.js'

describe('asId', () => {
  it('AsId_NonEmptyString_ReturnsBrandedValueEqualToInput', () => {
    const raw = 'ws_123'

    const id = asId<'WorkspaceId'>(raw)

    expect(id).toBe(raw)
  })

  it('AsId_EmptyString_ThrowsError', () => {
    const act = (): WorkspaceId => asId<'WorkspaceId'>('')

    expect(act).toThrow(/non-empty/)
  })

  it('AsId_BlankString_ThrowsError', () => {
    const act = (): WorkspaceId => asId<'WorkspaceId'>('   ')

    expect(act).toThrow(/non-empty/)
  })
})
