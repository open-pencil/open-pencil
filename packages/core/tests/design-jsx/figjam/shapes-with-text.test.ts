import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'

const BOARD = `
  <Frame name="Board" w={900} h={400}>
    <Shape x={0} y={0} bg="#FFC943" stroke="#000000">Start</Shape>
    <Shape name="Check" x={300} y={0} kind="diamond" w={240} h={160} rounded={0}>Valid?</Shape>
  </Frame>`

describe('shapes with text in design JSX', () => {
  test('are made as the shape tool makes them, named by their label', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, BOARD)
    const [square, diamond] = graph.getChildren(getNodeOrThrow(graph, result.id).id)
    expect(square).toMatchObject({
      type: 'SHAPE_WITH_TEXT',
      shapeWithTextType: 'SQUARE',
      name: 'Start',
      autoRename: true,
      width: 176,
      height: 176,
      cornerRadius: 6
    })
    expect(shapeWithTextLabel(graph, square)?.text).toBe('Start')
    expect(diamond).toMatchObject({
      shapeWithTextType: 'DIAMOND',
      name: 'Check',
      autoRename: false,
      width: 240,
      height: 160,
      shapeUserHeight: 160,
      shapeTruncates: false,
      cornerRadius: 0
    })
  })

  test('write back as Shape elements', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, BOARD)
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain('<Shape bg="#FFC943" stroke="#000000">Start</Shape>')
    expect(jsx).toContain(
      '<Shape name="Check" x={300} kind="diamond" w={240} h={160} rounded={0}>Valid?</Shape>'
    )
    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('write the size they were given, not the size their label grew them to', async () => {
    const graph = new SceneGraph()
    const label = 'A label long enough to need more lines than a small square holds'
    const [result] = await renderJSX(graph, `<Shape w={120} h={120}>${label}</Shape>`)
    const shape = getNodeOrThrow(graph, result.id)
    expect([shape.width, shape.height]).toEqual([120, expect.any(Number)])
    expect(shape.height).toBeGreaterThan(120)
    expect(sceneNodeToJSX(result.id, graph)).toContain('w={120} h={120}')
  })

  test('truncate keeps the height and cuts the label off, and writes back', async () => {
    const graph = new SceneGraph()
    const label = 'A label long enough to need more lines than a small square holds'
    const [result] = await renderJSX(graph, `<Shape w={120} h={120} truncate>${label}</Shape>`)
    const shape = getNodeOrThrow(graph, result.id)
    expect(shape).toMatchObject({ height: 120, shapeTruncates: true })
    expect(shapeWithTextLabel(graph, shape)?.textTruncation).toBe('ENDING')
    expect(sceneNodeToJSX(result.id, graph)).toContain('w={120} h={120} truncate')
    // The height it keeps is written, even where the height it was given differs, as a file can.
    graph.updateNode(shape.id, { shapeUserHeight: 90 })
    expect(sceneNodeToJSX(result.id, graph)).toContain('w={120} h={120} truncate')
  })

  test('a prop of the wrong kind warns and is left out', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, '<Shape kind="blob" w={0}>Hi</Shape>')
    expect(result.warnings).toEqual([
      expect.stringContaining(
        'Unknown kind "blob" on <shape> is ignored; expected square, ellipse'
      ),
      'Invalid w 0 on <shape> is ignored; expected >0.'
    ])
    expect(getNodeOrThrow(graph, result.id)).toMatchObject({
      shapeWithTextType: 'SQUARE',
      width: 176
    })
  })

  test('take FigJam text sizes and typefaces for their label, and write them back', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Shape textSize="large" typeface="technical">Deploy</Shape>'
    )
    const label = shapeWithTextLabel(graph, getNodeOrThrow(graph, result.id))
    expect(label).toMatchObject({ fontSize: 40, fontFamily: 'Roboto Mono' })
    expect(sceneNodeToJSX(result.id, graph)).toContain('textSize="large" typeface="technical"')
  })
})
