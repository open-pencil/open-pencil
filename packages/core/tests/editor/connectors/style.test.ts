import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { boundEndpoint, buildConnectorSublayers, connectorSublayers } from '@open-pencil/scene-graph/connectors'
import { figJamColor } from '@open-pencil/scene-graph/figjam'

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const from = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
  const to = editor.graph.createNode('RECTANGLE', page, { x: 400, y: 0, width: 100, height: 100 })
  const connector = editor.graph.createNode('CONNECTOR', page, {
    connectorStart: boundEndpoint(from.id),
    connectorEnd: boundEndpoint(to.id)
  })
  buildConnectorSublayers(editor.graph, connector)
  const line = () =>
    expectDefined(
      connectorSublayers(editor.graph, expectDefined(editor.graph.getNode(connector.id)))
    ).line
  return { editor, connector, line }
}

// Values measured in FigJam's connector colour and line menus.
describe("FigJam's connector line menu", () => {
  test('a palette colour draws the line in it, as one step', () => {
    const { editor, connector, line } = setup()
    editor.setConnectorColor([connector.id], 'red')
    expect(line().strokes[0]?.color).toEqual(figJamColor('red'))
    editor.undo.undo()
    expect(line().strokes[0]?.color).not.toEqual(figJamColor('red'))
  })

  test('a dash follows the weight: 16/10 thin, 40/24 thick, on the stroke and the line', () => {
    const { editor, connector, line } = setup()
    editor.setConnectorDashed([connector.id], true)
    expect(line().strokes[0]).toMatchObject({ weight: 4, dashPattern: [16, 10] })
    expect(line().dashPattern).toEqual([16, 10])
    editor.setConnectorThick([connector.id], true)
    expect(line().strokes[0]).toMatchObject({ weight: 8, dashPattern: [40, 24] })
    editor.setConnectorDashed([connector.id], false)
    expect(line().strokes[0]?.dashPattern).toEqual([])
    expect(line().strokeWeight).toBe(8)
  })
})
