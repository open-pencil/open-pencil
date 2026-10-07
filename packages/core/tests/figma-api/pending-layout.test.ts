import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

function hugRow(api: ReturnType<typeof createAPI>) {
  const row = api.createFrame()
  row.layoutMode = 'HORIZONTAL'
  row.primaryAxisSizingMode = 'AUTO'
  row.counterAxisSizingMode = 'AUTO'
  row.itemSpacing = 10
  return row
}

describe('geometry reads after edits', () => {
  test('a hugging parent reports its new size as soon as a child is added or resized', () => {
    const api = createAPI()
    const row = hugRow(api)
    const first = api.createRectangle()
    first.resize(40, 20)
    row.appendChild(first)
    expect([row.width, row.height]).toEqual([40, 20])

    const second = api.createRectangle()
    second.resize(60, 30)
    row.appendChild(second)
    expect([row.width, row.height]).toEqual([110, 30])
    expect(second.x).toBe(50)

    first.resize(80, 20)
    expect(second.x).toBe(90)
    expect(second.absoluteBoundingBox.x).toBe(row.absoluteBoundingBox.x + 90)
    expect(row.width).toBe(150)
  })

  test('removing a child and changing spacing reflow the rest before the next read', () => {
    const api = createAPI()
    const row = hugRow(api)
    const children = [40, 50, 60].map((width) => {
      const child = api.createRectangle()
      child.resize(width, 20)
      row.appendChild(child)
      return child
    })
    children[0].remove()
    expect(children[1].x).toBe(0)
    row.itemSpacing = 0
    expect(children[2].x).toBe(50)
    expect(row.width).toBe(110)
  })

  test('edits stay recorded when another API opens the same graph before a read', () => {
    const api = createAPI()
    const row = hugRow(api)
    const child = api.createRectangle()
    child.resize(40, 20)
    row.appendChild(child)
    expect(row.width).toBe(40)

    // A script resizes the child and fails before its tool lays the edit out.
    child.resize(90, 20)
    const next = new FigmaAPI(api.graph)
    expect(next.getNodeById(row.id)?.width).toBe(90)
  })

  test('reading again without edits does no layout work', () => {
    const api = createAPI()
    const row = hugRow(api)
    const child = api.createRectangle()
    row.appendChild(child)
    expect(row.width).toBe(child.width)

    let updates = 0
    const unbind = api.graph.onNodeEvents({ updated: () => updates++ })
    void row.width
    void child.x
    void row.absoluteTransform
    unbind()
    expect(updates).toBe(0)
  })
})
