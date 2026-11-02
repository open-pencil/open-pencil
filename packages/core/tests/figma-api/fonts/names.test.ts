import { beforeAll, describe, expect, test } from 'bun:test'

import { asTextNode, registerTestFont } from '#core-tests/helpers/figma-api'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await registerTestFont()
  await fontManager.familyFaces('Inter')
  const api = new FigmaAPI(new SceneGraph())
  for (const style of ['SemiBold', 'Bold']) await api.loadFontAsync({ family: 'Inter', style })
})

function text() {
  const graph = new SceneGraph()
  const node = asTextNode(new FigmaAPI(graph).createText())
  node.characters = 'Hello'
  return { graph, node, raw: () => graph.getNode(node.id) }
}

// Measured in Figma desktop (2026-10-28): `fontName.style` is the font's own name for the face.
describe('font style names', () => {
  test('reads plain italic as "Italic", as fonts name it', () => {
    const { node } = text()
    node.fontName = { family: 'Inter', style: 'Italic' }
    expect(node.fontName).toMatchObject({ family: 'Inter', style: 'Italic' })
  })

  test('reads the name a file gives a face', () => {
    const { graph, node } = text()
    graph.updateNode(node.id, { fontStyle: 'Semi Bold', fontWeight: 600 })
    expect(node.fontName).toMatchObject({ style: 'Semi Bold' })
    expect(node.getRangeFontName(0, 2)).toMatchObject({ style: 'Semi Bold' })
  })

  test('takes a name spelled another way as the family’s own name for that face', () => {
    const { node, raw } = text()
    node.fontName = { family: 'Inter', style: 'Semi Bold' }
    expect(raw()).toMatchObject({ fontWeight: 600, italic: false, fontStyle: 'SemiBold' })
    expect(node.fontName).toMatchObject({ style: 'SemiBold' })
  })

  test('a new weight takes its face’s name', () => {
    const { graph, node } = text()
    graph.updateNode(node.id, { fontStyle: 'Semi Bold', fontWeight: 600 })
    node.fontWeight = 700
    expect(node.fontName).toMatchObject({ style: 'Bold' })
  })
})
