import { describe, expect, test } from 'bun:test'

import { autoFrame, pageId, rect } from '#core-tests/helpers/layout'

import { computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('counterAxisAlignContent', () => {
  test('SPACE_BETWEEN distributes wrapped rows evenly', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP',
      counterAxisAlignContent: 'SPACE_BETWEEN' as const
    })
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // 3 rows of 40px each = 120px total, 300 - 120 = 180px free space
    // SPACE_BETWEEN: first row at 0, last row at 260
    expect(children[0].y).toBe(0)
    expect(children[2].y).toBe(260)
    // Middle row centered: (0 + 260) / 2 = 130
    expect(children[1].y).toBe(130)
  })

  test('AUTO (default) packs wrapped rows at start', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP'
    })
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(40)
    expect(children[2].y).toBe(80)
  })
  // Live Figma, 2026-11-16: AUTO packs a wrapping row's lines together where it aligns its children.
  test('AUTO places one line where the frame aligns its children', () => {
    for (const [align, y] of [
      ['MIN', 0],
      ['CENTER', 287.5],
      ['MAX', 575]
    ] as const) {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 100,
        height: 600,
        layoutWrap: 'WRAP',
        counterAxisAlign: align
      })
      rect(graph, frame.id, 50, 25)
      rect(graph, frame.id, 50, 25)

      computeLayout(graph, frame.id)

      expect([align, ...graph.getChildren(frame.id).map((child) => child.y)]).toEqual([align, y, y])
    }
  })

  test('AUTO keeps several lines together where the frame aligns its children', () => {
    for (const [align, y] of [
      ['CENTER', 220],
      ['MAX', 440]
    ] as const) {
      const graph = new SceneGraph()
      const frame = autoFrame(graph, pageId(graph), {
        width: 200,
        height: 600,
        layoutWrap: 'WRAP',
        counterAxisAlign: align
      })
      rect(graph, frame.id, 150, 80)
      rect(graph, frame.id, 150, 80)

      computeLayout(graph, frame.id)

      expect([align, ...graph.getChildren(frame.id).map((child) => child.y)]).toEqual([
        align,
        y,
        y + 80
      ])
    }
  })
})
