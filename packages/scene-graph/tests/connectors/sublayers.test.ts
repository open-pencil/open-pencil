import { describe, expect, test } from 'bun:test'

import { connectorDash, connectorLineStyle, connectorLineStyleFields, connectorStroke } from '@open-pencil/scene-graph/connectors'

describe('connector line style', () => {
  test("FigJam's dash is longer for a thick line", () => {
    expect(connectorDash(4)).toEqual([16, 10])
    expect(connectorDash(8)).toEqual([40, 24])
  })

  test('a restyle keeps what it leaves out and reads back as set', () => {
    const line = { strokes: [connectorStroke()] }
    const thick = { ...line, ...connectorLineStyleFields(line, { weight: 8, dashed: true }) }
    expect(connectorLineStyle(thick)).toMatchObject({ weight: 8, dashed: true })
    expect(thick.strokes[0]).toMatchObject({ cap: 'ROUND', join: 'ROUND' })
    const solid = connectorLineStyleFields(thick, { dashed: false })
    expect(solid).toMatchObject({ strokeWeight: 8, dashPattern: [] })
  })

  test('a new colour alone keeps a dash of its own', () => {
    const line = { strokes: [{ ...connectorStroke(), dashPattern: [6, 4] }] }
    const red = connectorLineStyleFields(line, { color: { r: 1, g: 0, b: 0, a: 1 } })
    expect(red.dashPattern).toEqual([6, 4])
    expect(red.strokes?.[0]?.dashPattern).toEqual([6, 4])
    // A new weight takes FigJam's dash for it.
    expect(connectorLineStyleFields(line, { weight: 8 }).dashPattern).toEqual([40, 24])
  })
})
