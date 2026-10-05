import { describe, expect, test } from 'bun:test'

import { sceneNodesToTailwindJSX } from '#dom-css/index'

import { makeGraph, pageId } from './helpers'

const INK = { r: 0.07, g: 0.09, b: 0.15, a: 1 }

describe('Tailwind JSX with tokens', () => {
  test('names theme tokens as utilities and other tokens as variables', () => {
    const graph = makeGraph()
    graph.addCollection({
      id: 'brand',
      name: 'Brand',
      modes: [{ modeId: 'one', name: 'One' }],
      defaultModeId: 'one',
      variableIds: []
    })
    for (const [id, name, value, scopes] of [
      ['gutter', 'Gutter', 16, ['GAP'] as const],
      ['ink', 'Ink', INK, ['FRAME_FILL'] as const],
      ['outline', 'Outline', INK, [] as const]
    ] as const) {
      graph.addVariable({
        id,
        name,
        type: typeof value === 'number' ? 'FLOAT' : 'COLOR',
        collectionId: 'brand',
        valuesByMode: { one: value },
        scopes: [...scopes],
        // A name outside Tailwind's namespaces declares no utility.
        codeSyntax: id === 'outline' ? { WEB: 'var(--brand-outline)' } : undefined,
        description: '',
        hiddenFromPublishing: false
      })
    }
    const card = graph.createNode('FRAME', pageId(graph), {
      width: 80,
      height: 40,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: INK }],
      strokes: [
        { type: 'SOLID', visible: true, opacity: 1, color: INK, weight: 1, align: 'INSIDE' }
      ],
      boundVariables: {
        itemSpacing: 'gutter',
        'fills/0/color': 'ink',
        'strokes/0/color': 'outline'
      }
    })

    const code = sceneNodesToTailwindJSX(graph, [card.id])

    expect(code).toContain('gap-gutter')
    expect(code).toContain('bg-ink')
    expect(code).toContain('border-(--brand-outline)')
  })
})
