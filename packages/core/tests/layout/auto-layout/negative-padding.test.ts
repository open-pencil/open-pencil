import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { computeAllLayouts } from '#core/layout'

type Padding = Partial<
  Pick<SceneNode, 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'>
>

function frameWith(
  layout: Partial<SceneNode>,
  padding: Padding,
  childSizes: readonly (readonly [number, number])[],
  childLayout: Partial<SceneNode> = {}
) {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  const children = childSizes.map(([width, height]) => {
    const child = childLayout.layoutMode ? figma.createFrame() : figma.createRectangle()
    child.resize(width, height)
    frame.appendChild(child)
    graph.updateNode(child.id, childLayout)
    return child
  })
  graph.updateNode(frame.id, { ...layout, ...padding })
  computeAllLayouts(graph, graph.getPages()[0].id)
  const node = (id: string) => graph.getNode(id) as SceneNode
  return {
    frame: node(frame.id),
    children: children.map((child) => node(child.id))
  }
}

function fixed(layoutMode: 'HORIZONTAL' | 'VERTICAL', width: number, height: number) {
  return {
    layoutMode,
    width,
    height,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  } satisfies Partial<SceneNode>
}

function fixedRow(layoutDirection: 'LTR' | 'RTL') {
  return { ...fixed('HORIZONTAL', 100, 50), layoutDirection, itemSpacing: 0 }
}

function fixedChildRows(layoutDirection: 'LTR' | 'RTL') {
  return {
    layoutMode: 'HORIZONTAL',
    layoutDirection,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  } satisfies Partial<SceneNode>
}

const TWO_SQUARES = [
  [20, 20],
  [20, 20]
] as const

describe('negative auto layout padding moves children past the frame edge', () => {
  test('a negative top pads a row’s cross axis above the frame', () => {
    const { children } = frameWith(
      { ...fixed('HORIZONTAL', 64, 64), primaryAxisAlign: 'CENTER', counterAxisAlign: 'MIN' },
      { paddingTop: -32 },
      [[24, 24]]
    )
    expect(children[0]).toMatchObject({ x: 20, y: -32 })
  })

  test('a row centres across the box its negative top padding grows', () => {
    const { children } = frameWith(
      { ...fixed('HORIZONTAL', 64, 64), counterAxisAlign: 'CENTER' },
      { paddingTop: -32 },
      [[24, 24]]
    )
    expect(children[0]).toMatchObject({ x: 0, y: 4 })
  })

  test('a row aligned to its bottom sits past a negative bottom padding', () => {
    const { children } = frameWith(
      { ...fixed('HORIZONTAL', 64, 64), counterAxisAlign: 'MAX' },
      { paddingBottom: -32 },
      [[24, 24]]
    )
    expect(children[0]).toMatchObject({ x: 0, y: 72 })
  })

  test('a column aligned to its end sits past a negative bottom padding', () => {
    const { children } = frameWith(
      { ...fixed('VERTICAL', 64, 64), primaryAxisAlign: 'MAX', counterAxisAlign: 'CENTER' },
      { paddingTop: -6, paddingBottom: -6 },
      [[64, 16]]
    )
    expect(children[0]).toMatchObject({ x: 0, y: 54 })
  })

  test('a hugging row starts its children before its left edge', () => {
    const { children } = frameWith(
      {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 0
      },
      { paddingLeft: -10 },
      [
        [40, 20],
        [40, 20]
      ]
    )
    expect(children.map((child) => child.x)).toEqual([-10, 30])
  })

  test('a negative trailing padding keeps a negative gap between children', () => {
    const { frame, children } = frameWith(
      {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: -6
      },
      { paddingRight: -4 },
      [
        [40, 20],
        [40, 20],
        [40, 20]
      ]
    )
    expect(children.map((child) => child.x)).toEqual([0, 34, 68])
    expect(frame.width).toBe(104)
  })

  test('a negative gap leaves a hugging row with one child as wide as no gap does', () => {
    const row = (itemSpacing: number) =>
      frameWith(
        {
          layoutMode: 'HORIZONTAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          itemSpacing
        },
        { paddingRight: -1 },
        [[4, 4]]
      ).frame.width
    expect(row(-6)).toBe(row(0))
  })

  test('right-to-left rows inside a left-to-right row keep the row’s left edge', () => {
    const { children } = frameWith(
      fixedRow('LTR'),
      { paddingLeft: -10, paddingRight: -6 },
      TWO_SQUARES,
      fixedChildRows('RTL')
    )
    expect(children.map((child) => child.x)).toEqual([-10, 10])
  })

  test('left-to-right rows inside a right-to-left row keep the row’s right edge', () => {
    const { children } = frameWith(
      fixedRow('RTL'),
      { paddingLeft: -10, paddingRight: -6 },
      TWO_SQUARES,
      fixedChildRows('LTR')
    )
    expect(children.map((child) => child.x)).toEqual([86, 66])
  })
})

const FOUR_SQUARES = [
  [40, 40],
  [40, 40],
  [40, 40],
  [40, 40]
] as const

function fixedWrap(spacing: Pick<Partial<SceneNode>, 'itemSpacing' | 'counterAxisSpacing'> = {}) {
  return {
    ...fixed('HORIZONTAL', 100, 100),
    layoutWrap: 'WRAP',
    itemSpacing: 0,
    ...spacing
  } satisfies Partial<SceneNode>
}

function positions(children: readonly SceneNode[]) {
  return children.map((child) => [child.x, child.y])
}

describe('a wrapping frame wraps its rows in the box its negative padding grows', () => {
  test('its first row starts past the top-left corner', () => {
    const { children } = frameWith(
      { ...fixed('HORIZONTAL', 100, 50), layoutWrap: 'WRAP', itemSpacing: 0 },
      { paddingLeft: -10, paddingTop: -8 },
      TWO_SQUARES
    )
    expect(positions(children)).toEqual([
      [-10, -8],
      [10, -8]
    ])
  })

  test('a row fits as many children as the widened box holds', () => {
    const { children } = frameWith(
      fixedWrap({ counterAxisSpacing: 4 }),
      { paddingLeft: -10, paddingRight: -10, paddingTop: -5, paddingBottom: -5 },
      FOUR_SQUARES
    )
    expect(positions(children)).toEqual([
      [-10, -5],
      [30, -5],
      [70, -5],
      [-10, 39]
    ])
  })

  test('a negative right padding and gap fit a fourth child in the row exactly', () => {
    const { children } = frameWith(fixedWrap({ itemSpacing: -10 }), { paddingRight: -30 }, [
      ...FOUR_SQUARES,
      [40, 40]
    ])
    expect(positions(children)).toEqual([
      [0, 0],
      [30, 0],
      [60, 0],
      [90, 0],
      [0, 40]
    ])
  })

  test('every row starts past a negative left padding, next to a negative gap', () => {
    const { children } = frameWith(
      fixedWrap({ itemSpacing: -10 }),
      { paddingLeft: -10 },
      FOUR_SQUARES
    )
    expect(positions(children)).toEqual([
      [-10, 0],
      [20, 0],
      [50, 0],
      [-10, 40]
    ])
  })
})
