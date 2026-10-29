import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { renderNodesToSVG } from '#core/io/formats/svg'

test('styled text runs are written together, with no whitespace drawn between them', () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: 'Bold',
    width: 100,
    height: 20,
    styleRuns: [
      { start: 0, length: 1, style: {} },
      { start: 1, length: 3, style: { fontWeight: 700 } }
    ]
  })

  const svg = renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false })

  expect(svg).toMatch(/<text [^>]*><tspan>B<\/tspan><tspan font-weight="700">old<\/tspan><\/text>/)
})
