import { describe, expect, test } from 'bun:test'

import { createStandaloneShapes } from '@/app/demo/sections/standalone'
import { createEditorStore } from '@/app/editor/session'

describe('demo document', () => {
  test('showcases imported OpenType and text decoration features', () => {
    const store = createEditorStore()

    createStandaloneShapes(store)

    const nodes = [...store.graph.getAllNodes()]
    const ligatures = nodes.find((node) => node.name === 'Ligatures')
    const rawTags = nodes.find((node) => node.name === 'Raw')
    const wavy = nodes.find((node) => node.name === 'Wavy')
    const dotted = nodes.find((node) => node.name === 'Dotted')

    expect(ligatures?.fontFeatures).toEqual([{ tag: 'LIGA', enabled: false }])
    expect(rawTags?.fontFeatures).toEqual([
      { tag: 'DLIG', enabled: true },
      { tag: 'KERN', enabled: false }
    ])
    expect(wavy).toMatchObject({
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 1.6
    })
    expect(wavy?.textDecorationFills[0]?.type).toBe('SOLID')
    expect(dotted).toMatchObject({
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'DOTTED',
      textDecorationThickness: 2
    })
    expect(dotted?.textDecorationFills[0]?.type).toBe('SOLID')
  })
})
