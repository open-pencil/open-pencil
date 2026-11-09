import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { graphOf } from '#core/figma-api/graph'

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

  // Measured in Figma desktop 126.
  test('appending a child already there moves it to the end of the row', () => {
    const api = createAPI()
    const row = hugRow(api)
    const first = api.createRectangle()
    first.resize(40, 20)
    row.appendChild(first)
    const second = api.createRectangle()
    second.resize(60, 30)
    row.appendChild(second)
    row.appendChild(first)
    expect([second.x, first.x]).toEqual([0, 70])
    expect([row.width, row.height]).toEqual([110, 30])
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
    const next = new FigmaAPI(graphOf(api))
    expect(next.getNodeById(row.id)?.width).toBe(90)
  })

  test('reading again without edits does no layout work', () => {
    const api = createAPI()
    const row = hugRow(api)
    const child = api.createRectangle()
    row.appendChild(child)
    expect(row.width).toBe(child.width)

    let updates = 0
    const unbind = graphOf(api).onNodeEvents({ updated: () => updates++ })
    void row.width
    void child.x
    void row.absoluteTransform
    unbind()
    expect(updates).toBe(0)
  })
})

// Figma desktop lays out as a script edits: once a label is in a Hug button, the button already
// has its hugged size, so a layer placed against it stays where the script put it, though the
// script never read the button. `layout/auto-layout/absolute/constraints.test.ts` records the
// same button in Figma.
describe('geometry writes after edits', () => {
  function button(api: ReturnType<typeof createAPI>) {
    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.paddingLeft = frame.paddingRight = 16
    frame.paddingTop = frame.paddingBottom = 12
    frame.layoutSizingHorizontal = 'HUG'
    frame.layoutSizingVertical = 'HUG'
    const label = api.createRectangle()
    label.resize(60, 24)
    frame.appendChild(label)
    return frame
  }

  test('a badge placed in a Hug button before any read stays where the script put it', () => {
    const api = createAPI()
    const frame = button(api)
    const badge = api.createFrame()
    badge.resize(24, 24)
    frame.appendChild(badge)
    badge.layoutPositioning = 'ABSOLUTE'
    badge.constraints = { horizontal: 'MAX', vertical: 'MIN' }
    // 92 - 15.5: against the button's hugged width, without reading it first.
    badge.x = 76.5
    badge.y = -8.5
    expect([frame.width, frame.height]).toEqual([92, 48])
    expect([badge.x, badge.y]).toEqual([76.5, -8.5])
  })

  test('a layer stretched across a Hug button before any read keeps the size the script set', () => {
    const api = createAPI()
    const frame = button(api)
    const bar = api.createRectangle()
    frame.appendChild(bar)
    bar.layoutPositioning = 'ABSOLUTE'
    bar.constraints = { horizontal: 'STRETCH', vertical: 'MIN' }
    bar.x = 0
    bar.resize(92, 2)
    expect([bar.x, bar.width]).toEqual([0, 92])
  })

  test('resizing a Hug button before any read moves its badge from the hugged size', () => {
    const api = createAPI()
    const frame = button(api)
    const badge = api.createFrame()
    badge.resize(24, 24)
    frame.appendChild(badge)
    badge.layoutPositioning = 'ABSOLUTE'
    badge.constraints = { horizontal: 'MAX', vertical: 'MIN' }
    badge.x = 76.5
    // The button is 92 wide when the script resizes it, so the badge moves by 200 - 92.
    frame.resize(200, 48)
    expect(badge.x).toBe(76.5 + 108)
  })

  test('a layer pinned left and top waits for the next read, so a build lays out once', () => {
    const api = createAPI()
    const row = hugRow(api)
    const child = api.createRectangle()
    child.resize(40, 20)
    row.appendChild(child)
    const pinned = api.createRectangle()
    row.appendChild(pinned)
    pinned.layoutPositioning = 'ABSOLUTE'
    pinned.x = 300
    // Nothing has laid the row out yet: it still has the size it was made at.
    expect(graphOf(api).getNode(row.id)?.width).toBe(100)
    expect(row.width).toBe(40)
  })
})
