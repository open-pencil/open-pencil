import { describe, expect, test } from 'bun:test'

import { createTypographySection } from '@/app/demo/typography/section'
import { createEditorStore } from '@/app/editor/session'

describe('demo document', () => {
  test('showcases OpenType features and native text decorations', async () => {
    const store = createEditorStore()
    const page = store.graph.addPage('Typography')

    await createTypographySection(store.graph, page.id)

    const nodes = [...store.graph.getAllNodes()]
    const sample = (name: string) =>
      nodes.find((node) => node.name === name && node.type === 'TEXT')

    expect(sample('Discretionary ligatures / DLIG ON')?.fontFeatures).toEqual([
      { tag: 'DLIG', enabled: true }
    ])
    expect(sample('Discretionary ligatures / DLIG OFF')?.fontFeatures).toEqual([
      { tag: 'DLIG', enabled: false }
    ])
    expect(sample('Tabular and proportional figures / TNUM ON · PNUM OFF')?.fontFeatures).toEqual([
      { tag: 'TNUM', enabled: true },
      { tag: 'PNUM', enabled: false }
    ])

    expect(sample('Wavy underline')).toMatchObject({
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 1.6
    })
    expect(sample('Wavy underline')?.textDecorationFills[0]?.type).toBe('SOLID')
    expect(sample('Dotted underline')).toMatchObject({
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'DOTTED',
      textDecorationThickness: 2
    })
    expect(sample('Dotted underline')?.textDecorationFills[0]?.type).toBe('SOLID')
  })
})
