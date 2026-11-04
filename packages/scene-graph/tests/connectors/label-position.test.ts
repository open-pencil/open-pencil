import { describe, expect, test } from 'bun:test'

import type { ConnectorLabelPosition } from '@open-pencil/scene-graph'
import {
  connectorLabelPositionAt,
  placeConnectorLabel,
  routeConnector,
  type ConnectorRouteEnd
} from '@open-pencil/scene-graph/connectors'

/**
 * Labels FigJam placed on 2026-10-23 after they were dragged, on connectors from a 160 px shape at
 * the origin, with their default caps and a weight of 4: "detour" (a 67 × 41 plate), "hi"
 * (31 × 41) and "a longer label" (118 × 41).
 */
const shape = (x: number, y: number, cap: 'ROUND' | 'ARROW_LINES'): ConnectorRouteEnd => ({
  box: { x, y, width: 160, height: 160 },
  point: { x: 0, y: 0 },
  magnet: 'AUTO',
  cap,
  outline: 2
})
const level = routeConnector('ELBOWED', shape(0, 0, 'ROUND'), shape(480, 0, 'ARROW_LINES'), 4)
const elbow = routeConnector('ELBOWED', shape(0, 0, 'ROUND'), shape(480, 320, 'ARROW_LINES'), 4)
const DETOUR = { width: 67, height: 41 }

function placed(
  pieces: typeof level,
  size: { width: number; height: number },
  position: ConnectorLabelPosition
) {
  const layout = placeConnectorLabel(pieces, size, position)
  if (!layout) throw new Error('No plate placed')
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    plate: [round(layout.plate.x), round(layout.plate.y)],
    line: layout.pieces.map(({ from, to }) => [round(from.x), round(from.y), round(to.x), round(to.y)])
  }
}

describe('a dragged label sits where FigJam keeps it', () => {
  test('along a straight line, cutting it', () => {
    expect(
      placed(level, DETOUR, { section: 'MIDDLE_TO_END', offset: 0.6616183, offAxis: 'NONE' }).line
    ).toEqual([
      [168, 80, 386.7, 80],
      [453.7, 80, 471.5, 80]
    ])
    // Near the start the plate covers the line up to it.
    expect(
      placed(level, DETOUR, { section: 'MIDDLE_TO_START', offset: 0.7893803, offAxis: 'NONE' })
        .line
    ).toEqual([[233.5, 80, 471.5, 80]])
  })

  test('beside a straight line, which runs on uncut', () => {
    const position = { section: 'MIDDLE_TO_END', offset: 0.396971 } as const
    expect(placed(level, DETOUR, { ...position, offAxis: 'ABOVE' })).toEqual({
      plate: [346.5, 18.5],
      line: [[168, 80, 471.5, 80]]
    })
    expect(placed(level, DETOUR, { ...position, offAxis: 'BELOW' }).plate).toEqual([346.5, 100.5])
  })

  test('along an elbow by length, onto any of its segments', () => {
    const along = (section: ConnectorLabelPosition['section'], offset: number) =>
      placed(elbow, DETOUR, { section, offset, offAxis: 'NONE' }).plate
    expect(along('MIDDLE_TO_START', 0.2574374)).toEqual([286.5, 139])
    expect(along('MIDDLE_TO_START', 0.7680386)[0]).toBeCloseTo(206.87, 0)
    expect(along('MIDDLE_TO_END', 0.8359569)).toEqual([386.9, 379.5])
  })

  test('beside an elbow segment, farther out the wider the plate across it', () => {
    const beside = (size: { width: number; height: number }, offAxis: 'ABOVE' | 'BELOW') =>
      placed(elbow, size, { section: 'MIDDLE_TO_START', offset: 0, offAxis }).plate
    // Above a downward run is to its right; FigJam keeps these plates within 0.3 px.
    expect(beside(DETOUR, 'ABOVE')[0]).toBeCloseTo(345.5, 0)
    expect(beside(DETOUR, 'BELOW')[0]).toBeCloseTo(227.5, 0)
    expect(beside({ width: 31, height: 41 }, 'ABOVE')[0]).toBeCloseTo(338.5, 0)
    expect(beside({ width: 118, height: 41 }, 'ABOVE')[0]).toBeCloseTo(356, 0)
    expect(
      placed(elbow, DETOUR, { section: 'MIDDLE_TO_END', offset: 1, offAxis: 'ABOVE' }).plate
    ).toEqual([438, 338.5])
  })
})

describe('dragging a label', () => {
  const at = (x: number, y: number) => connectorLabelPositionAt(level, DETOUR, { x, y })

  test('takes the nearest point of the line as a share of the way from its middle', () => {
    expect(at(380, 80)).toMatchObject({ section: 'MIDDLE_TO_END', offAxis: 'NONE' })
    expect(at(380, 80)?.offset).toBeCloseTo(0.39697, 3)
    expect(at(200, 80)).toMatchObject({ section: 'MIDDLE_TO_START', offAxis: 'NONE' })
    // Past an end it stays at the end.
    expect(at(700, 80)?.offset).toBe(1)
  })

  test('leaves the line once farther from it than FigJam lets it be', () => {
    expect(at(380, 110)?.offAxis).toBe('NONE')
    expect(at(380, 114)?.offAxis).toBe('BELOW')
    expect(at(380, 20)?.offAxis).toBe('ABOVE')
    expect(
      connectorLabelPositionAt(elbow, DETOUR, { x: 380, y: 239.75 })
    ).toMatchObject({ section: 'MIDDLE_TO_START', offset: 0, offAxis: 'ABOVE' })
  })
})
