import { describe, expect, it, test } from 'bun:test'
import { pick } from 'es-toolkit'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '#core-tests/helpers/assert'
import { findByName, PROPERTY_CASES } from '#core-tests/helpers/property-cases'

describe('attribute string round-trip', () => {
  it.each([
    // Unescaped, this name would inject `w={999}` into the exported frame.
    'a" w={999} x="',
    'Fish &amp; chips',
    'Back\\slash',
    'Two\nlines',
    'Tab\there',
    'Plain name'
  ])('keeps the layer name %p', async (name) => {
    const g = new SceneGraph()
    const [source] = await renderJSX(g, '<Frame w={10} h={10} />')
    getNodeOrThrow(g, source.id).name = name
    const [result] = await renderJSX(g, sceneNodeToJSX(source.id, g))
    expect(getNodeOrThrow(g, result.id)).toMatchObject({ name, width: 10 })
  })
})

describe('text content round-trip', () => {
  it.each([
    'Curly {braces} and <tags>',
    'Fish &amp; chips',
    'Line one\nLine two',
    '  padded  ',
    'Back\\slash',
    'Tab\there'
  ])('keeps the text %p', async (text) => {
    const g = new SceneGraph()
    const [source] = await renderJSX(g, '<Text color="#000">Placeholder</Text>')
    getNodeOrThrow(g, source.id).text = text
    const [result] = await renderJSX(g, sceneNodeToJSX(source.id, g))
    expect(getNodeOrThrow(g, result.id).text).toBe(text)
  })
})

test('size limits are limits, not a width', async () => {
  const graph = new SceneGraph()
  const [defaultWidth] = await renderJSX(graph, '<Frame h={10} />')
  const [limited] = await renderJSX(graph, '<Frame h={10} maxW={400} />')
  const width = (id: string | undefined) => graph.getNode(expectDefined(id, 'frame'))?.width
  expect(graph.getNode(expectDefined(limited, 'frame').id)?.maxWidth).toBe(400)
  expect(width(limited?.id)).toBe(width(defaultWidth?.id))
})

describe('design JSX export round trip', () => {
  test.each(PROPERTY_CASES.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    async (_, testCase) => {
      const graph = new SceneGraph()
      const source = expectDefined(graph.getPages()[0], 'source page')
      const target = graph.addPage('Rendered')
      const { rootId, target: targetName } = testCase.build(graph, source.id)

      const jsx = sceneNodeToJSX(rootId, graph)
      const [rendered] = await renderJSX(graph, jsx, { parentId: target.id })
      const renderedRoot = expectDefined(rendered, 'render result').id

      const original = findByName(graph, rootId, targetName)
      const copy = findByName(graph, renderedRoot, targetName)
      expect(pick(copy, testCase.fields)).toEqual(pick(original, testCase.fields))
      // Everything the export wrote comes back, so exporting the copy changes nothing.
      expect(sceneNodeToJSX(renderedRoot, graph)).toBe(jsx)
    }
  )
})
