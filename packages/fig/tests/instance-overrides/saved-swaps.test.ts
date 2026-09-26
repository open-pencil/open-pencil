import { describe, expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from './fixtures/saved-swap-paths.json'

// Figma Save local copy capture; live oracle recorded before saving.
// Only the probe's source nodes and semantic fields are retained here.
const changes = fixture as NodeChange[]

describe('Figma-authored saved swaps', () => {
  test('uses the replacement default for an untouched top-level swap', () => {
    const result = interpretInstance(changes, '10965:1263')
    expect(result.mainComponentId).toBe('10965:1261')
    expect(result.properties.size).toEqual({ x: 160, y: 64 })
    expect(result.children[0].properties.textData?.characters).toBe('Replacement label')
  })

  test('reads explicit retained size, opacity and text rather than inferring preservation', () => {
    const result = interpretInstance(changes, '10965:1266')
    expect(result.properties.size).toEqual({ x: 120, y: 50 })
    expect(result.properties.opacity).toBeCloseTo(0.6)
    expect(result.children[0].properties.textData?.characters).toBe('Edited label')
  })

  test('replays preserved inherited text onto the replacement child path', () => {
    const result = interpretInstance(changes, '10965:1272').children[0]
    expect(result.sourceId).toBe('10965:1270')
    expect(result.properties.size).toEqual({ x: 100, y: 40 })
    expect(result.mainComponentId).toBe('10965:1261')
    expect(result.children[0].sourceId).toBe('10965:1262')
    expect(result.children[0].properties.textData?.characters).toBe('Inherited edit')
  })

  test('does not carry old text to a replacement when the saved override is absent', () => {
    const result = interpretInstance(changes, '10965:1276').children[0]
    expect(result.properties.size).toEqual({ x: 100, y: 40 })
    expect(result.mainComponentId).toBe('10965:1261')
    expect(result.children[0].properties.textData?.characters).toBe('Replacement label')
  })
})
