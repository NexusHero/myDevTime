import { describe, expect, it } from 'vitest'
import TestRenderer from 'react-test-renderer'
import { StyleSheet, Text as RNText } from 'react-native'
import { Text } from './Text.js'

/**
 * `Text` resolves a role's base font family + weight into a concrete face for the
 * Blueprint webfonts, or leaves system fonts alone (ADR-0022 font-loading slice).
 * A regression let system-font text (Sovereign/Ember accents — `fontFamily:
 * 'System'`) fall through `resolveFontFamily` to `undefined` and get misread as "a
 * custom face was resolved", nulling `fontWeight` and silently un-bolding every
 * screen title on those two accents. These pin the family/weight resolution for
 * both font worlds so that class of bug can't reappear unnoticed.
 */
describe('Text', () => {
  it('SystemFamily_BoldWeight_PreservesWeight', () => {
    const renderer = TestRenderer.create(
      <Text style={{ fontFamily: 'System', fontWeight: '700' }}>Title</Text>,
    )
    const flat = StyleSheet.flatten(renderer.root.findByType(RNText).props.style)
    expect(flat).toMatchObject({ fontFamily: undefined, fontWeight: '700' })
  })

  it('SystemMonospace_PreservesWeight', () => {
    const renderer = TestRenderer.create(
      <Text style={{ fontFamily: 'monospace', fontWeight: '600' }}>1:23:45</Text>,
    )
    const flat = StyleSheet.flatten(renderer.root.findByType(RNText).props.style)
    expect(flat).toMatchObject({ fontFamily: 'monospace', fontWeight: '600' })
  })

  it('BlueprintFamily_BoldWeight_ResolvesConcreteFaceAndNullsWeight', () => {
    const renderer = TestRenderer.create(
      <Text style={{ fontFamily: 'Inter_400Regular', fontWeight: '700' }}>Title</Text>,
    )
    const flat = StyleSheet.flatten(renderer.root.findByType(RNText).props.style)
    expect(flat).toMatchObject({ fontFamily: 'Inter_700Bold', fontWeight: 'normal' })
  })

  it('NoFamilySet_PreservesWeight', () => {
    const renderer = TestRenderer.create(<Text style={{ fontWeight: '700' }}>Title</Text>)
    const flat = StyleSheet.flatten(renderer.root.findByType(RNText).props.style)
    expect(flat).toMatchObject({ fontFamily: undefined, fontWeight: '700' })
  })
})
