import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { DEFAULT_STICKY_COLOR, STICKY_COLORS, stickySublayers } from '@open-pencil/scene-graph/generated'
import { SceneGraph } from '@open-pencil/scene-graph'

const BOARD = `
  <Frame name="Board" w={900} h={400}>
    <Sticky x={0} y={0} color="yellow" author="Ada">Ship it</Sticky>
    <Sticky name="Risks" x={300} y={0} color="#FF0000" wide textSize="large" author="Lin" authorVisible={false}>Fonts</Sticky>
  </Frame>`

describe('sticky notes in design JSX', () => {
  test('are made as the sticky tool makes them, named by their body', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, BOARD)
    const [plain, styled] = graph.getChildren(getNodeOrThrow(graph, result.id).id)
    expect(plain).toMatchObject({
      type: 'STICKY',
      name: 'Ship it',
      autoRename: true,
      x: 0,
      width: 240
    })
    expect(plain.fills[0]?.color).toEqual(STICKY_COLORS.yellow)
    const layers = stickySublayers(graph, plain)
    expect([layers?.body.text, layers?.author.text, layers?.author.visible]).toEqual([
      'Ship it',
      'Ada',
      true
    ])
    expect(styled).toMatchObject({ name: 'Risks', autoRename: false, width: 416 })
    const styledLayers = stickySublayers(graph, styled)
    expect([styledLayers?.body.fontSize, styledLayers?.author.visible]).toEqual([40, false])
  })

  test('write back as Sticky elements', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, BOARD)
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain('<Sticky color="yellow" author="Ada">Ship it</Sticky>')
    expect(jsx).toContain(
      '<Sticky name="Risks" x={300} color="#FF0000" author="Lin" authorVisible={false} wide textSize="large">Fonts</Sticky>'
    )
    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('keep a name given in the JSX, even one that matches the body', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, '<Sticky name="Ship it">Ship it</Sticky>')
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain('name="Ship it"')
    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(getNodeOrThrow(again, reread.id).autoRename).toBe(false)
  })

  test('a prop of the wrong kind warns and is left out', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Sticky color="sparkle" wide="yes" scale={0} textSize="giant">Hi</Sticky>'
    )
    expect(result.warnings).toEqual([
      'Unknown color "sparkle" on <sticky> is ignored; expected white, gray, red, orange, yellow, green, teal, blue, violet, pink, or a colour.',
      'Invalid wide "yes" on <sticky> is ignored; expected boolean.',
      'Unknown textSize "giant" on <sticky> is ignored; expected small, medium, large, extraLarge, huge.',
      'Invalid scale 0 on <sticky> is ignored; expected >0.'
    ])
    const sticky = getNodeOrThrow(graph, result.id)
    expect(sticky).toMatchObject({ type: 'STICKY', width: 240 })
    expect(sticky.fills[0]?.color).toEqual(DEFAULT_STICKY_COLOR)
  })

  test('take layer props as any layer does: a variable binds, and a placed note in auto layout is absolute', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'numbers',
      name: 'Numbers',
      modes: [{ modeId: 'base', name: 'Base' }],
      defaultModeId: 'base',
      variableIds: []
    })
    graph.addVariable({
      id: 'var-faded',
      name: 'Faded',
      type: 'FLOAT',
      collectionId: 'numbers',
      valuesByMode: { base: 0.5 },
      description: '',
      hiddenFromPublishing: false
    })
    const [result] = await renderJSX(
      graph,
      `<Frame name="Board" flex="col" w={600} h={600}>
  <Sticky opacity={designVar('var-faded')}>Faded</Sticky>
  <Sticky x={300} y={40}>Placed</Sticky>
</Frame>`
    )
    expect(result.warnings ?? []).toEqual([])
    const [faded, placed] = graph.getChildren(result.id)
    expect(faded.opacity).toBe(0.5)
    expect(faded.boundVariables.opacity).toBe('var-faded')
    expect(placed).toMatchObject({ x: 300, y: 40, layoutPositioning: 'ABSOLUTE' })
  })

  test('join connectors to themselves, never to the layers they generate', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      `<Frame name="Board" w={900} h={400}>
  <Sticky x={0} y={0}>Ship it</Sticky>
  <Text name="Text" x={600} y={0}>Done</Text>
  <Connector from="Ship it" to="Text" />
</Frame>`
    )
    const [sticky, text, connector] = graph.getChildren(result.id)
    // The note's body is named as the layer the connector names, and is not joined.
    expect(stickySublayers(graph, sticky)?.body.name).toBe('Text')
    expect(result.warnings ?? []).toEqual([])
    expect(connector.connectorStart?.nodeId).toBe(sticky.id)
    expect(connector.connectorEnd?.nodeId).toBe(text.id)
  })

  test('take a FigJam typeface for their body, and write it back', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, '<Sticky typeface="bookish">Notes</Sticky>')
    const body = stickySublayers(graph, getNodeOrThrow(graph, result.id))?.body
    expect(body?.fontFamily).toBe('Merriweather')
    expect(sceneNodeToJSX(result.id, graph)).toContain('typeface="bookish"')
  })
})
