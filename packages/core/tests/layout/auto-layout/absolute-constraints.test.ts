import { describe, expect, test } from 'bun:test'

import { createEditor } from '#core/editor'
import { FigmaAPI } from '#core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Each case repeats a Figma desktop 126 plugin API script; the numbers are what Figma reported.
// Figma lays out as a script edits, while ours lays out when geometry is read, so the cases read
// a frame's size where Figma would already have laid it out.

function button(figma: FigmaAPI) {
  const frame = figma.createFrame()
  frame.layoutMode = 'HORIZONTAL'
  frame.paddingLeft = frame.paddingRight = 16
  frame.paddingTop = frame.paddingBottom = 12
  frame.layoutSizingHorizontal = 'HUG'
  frame.layoutSizingVertical = 'HUG'
  const label = figma.createRectangle()
  label.resize(60, 24)
  frame.appendChild(label)
  expect([frame.width, frame.height]).toEqual([92, 48])
  return { frame, label }
}

const CASES = {
  'MAX/MIN': {
    grown: [183.25, 64, 167.5, -8.5, 24, 24],
    shrunk: [52, 48, 36.5, -8.5, 24, 24]
  },
  'CENTER/CENTER': {
    grown: [183.25, 64, 122.5, -0.5, 24, 24],
    shrunk: [52, 48, 56.5, -8.5, 24, 24]
  },
  'STRETCH/STRETCH': {
    grown: [183.25, 64, 76.5, -8.5, 115, 40],
    shrunk: [52, 48, 76.5, -8.5, 16, 24]
  },
  'SCALE/SCALE': {
    grown: [183.25, 64, 152.375, -11.3359375, 47.804348, 32],
    shrunk: [52, 48, 43.2421875, -8.5, 13.565217, 24]
  },
  'MIN/MAX': {
    grown: [183.25, 64, 76.5, 7.5, 24, 24],
    shrunk: [52, 48, 76.5, -8.5, 24, 24]
  }
} as const

describe('a layer that ignores auto layout follows its constraints as its Hug frame resizes', () => {
  for (const [name, expected] of Object.entries(CASES)) {
    test(name, () => {
      const figma = new FigmaAPI(new SceneGraph())
      const { frame, label } = button(figma)
      const badge = figma.createFrame()
      badge.resize(24, 24)
      frame.appendChild(badge)
      badge.layoutPositioning = 'ABSOLUTE'
      badge.x = frame.width - 15.5
      badge.y = -8.5
      const [horizontal, vertical] = name.split('/') as [ConstraintName, ConstraintName]
      badge.constraints = { horizontal, vertical }
      const read = () => [frame.width, frame.height, badge.x, badge.y, badge.width, badge.height]
      expect(read()).toEqual([92, 48, 76.5, -8.5, 24, 24])
      label.resize(151.25, 40)
      read().forEach((value, i) => expect(value).toBeCloseTo(expected.grown[i], 5))
      label.resize(20, 24)
      read().forEach((value, i) => expect(value).toBeCloseTo(expected.shrunk[i], 5))
    })
  }

  test('Right and Left & right move by the parent size rounded to whole pixels', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const rows: number[][] = []
    for (const horizontal of ['STRETCH', 'CENTER'] as const) {
      const { frame, label } = button(figma)
      frame.paddingTop = frame.paddingBottom = 12
      const badge = figma.createFrame()
      badge.resize(24.5, 24)
      frame.appendChild(badge)
      badge.layoutPositioning = 'ABSOLUTE'
      badge.x = 76.5
      badge.y = 0
      badge.constraints = { horizontal, vertical: 'MIN' }
      expect(badge.x).toBe(76.5)
      for (const width of [70.3, 71.9, 95.5, 60]) {
        label.resize(width, 24)
        rows.push([badge.x, badge.width])
      }
    }
    expect(rows).toEqual([
      [76.5, 34.5],
      [76.5, 36.5],
      [76.5, 60.5],
      [76.5, 24.5],
      [81.5, 24.5],
      [82.5, 24.5],
      [94.5, 24.5],
      [76.5, 24.5]
    ])
  })

  test('a Fill frame carries its badge when the row around it resizes', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const outer = figma.createFrame()
    outer.layoutMode = 'HORIZONTAL'
    outer.layoutSizingHorizontal = 'FIXED'
    outer.layoutSizingVertical = 'FIXED'
    outer.resize(200, 60)
    const inner = figma.createFrame()
    outer.appendChild(inner)
    inner.layoutMode = 'HORIZONTAL'
    inner.layoutSizingHorizontal = 'FILL'
    inner.layoutSizingVertical = 'FIXED'
    inner.resize(inner.width, 40)
    const badge = figma.createFrame()
    badge.resize(20, 20)
    inner.appendChild(badge)
    badge.layoutPositioning = 'ABSOLUTE'
    badge.x = inner.width - 12
    badge.y = -8
    badge.constraints = { horizontal: 'MAX', vertical: 'MIN' }
    expect(inner.width).toBe(200)
    const rows = [400, 150].map((width) => {
      outer.resize(width, 60)
      return [inner.width, badge.x]
    })
    expect(rows).toEqual([
      [400, 388],
      [150, 138]
    ])
  })

  test('a stretched overlay places its own children by their constraints', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const { frame, label } = button(figma)
    const overlay = figma.createFrame()
    frame.appendChild(overlay)
    overlay.layoutPositioning = 'ABSOLUTE'
    overlay.resize(100, 56)
    overlay.x = -4
    overlay.y = -4
    overlay.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' }
    const dot = figma.createRectangle()
    dot.resize(10, 10)
    overlay.appendChild(dot)
    dot.x = 80
    dot.y = 40
    dot.constraints = { horizontal: 'MAX', vertical: 'MAX' }
    expect(overlay.width).toBe(100)
    label.resize(160, 50)
    expect([frame.width, frame.height]).toEqual([192, 74])
    expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([-4, -4, 200, 82])
    expect([dot.x, dot.y]).toEqual([180, 66])
  })

  test('a stretched overlay with auto layout lays out again', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const { frame, label } = button(figma)
    const overlay = figma.createFrame()
    frame.appendChild(overlay)
    overlay.layoutPositioning = 'ABSOLUTE'
    overlay.x = -10
    overlay.y = 0
    overlay.layoutMode = 'HORIZONTAL'
    overlay.primaryAxisAlignItems = 'MAX'
    overlay.layoutSizingHorizontal = 'FIXED'
    overlay.layoutSizingVertical = 'FIXED'
    overlay.resize(112, 30)
    overlay.constraints = { horizontal: 'STRETCH', vertical: 'MIN' }
    const chip = figma.createRectangle()
    chip.resize(20, 20)
    overlay.appendChild(chip)
    expect(chip.x).toBe(92)
    label.resize(140, 24)
    expect([frame.width, overlay.x, overlay.width, chip.x]).toEqual([172, -10, 192, 172])
  })
})

type ConstraintName = 'MIN' | 'MAX' | 'CENTER' | 'STRETCH' | 'SCALE'

test('a frame resized by hand, then set to Hug, moves its badge from the size it was given', () => {
  const figma = new FigmaAPI(new SceneGraph())
  const { frame } = button(figma)
  frame.layoutSizingHorizontal = 'FIXED'
  frame.resize(200, 48)
  const badge = figma.createFrame()
  badge.resize(24, 24)
  frame.appendChild(badge)
  badge.layoutPositioning = 'ABSOLUTE'
  badge.x = 184
  badge.constraints = { horizontal: 'MAX', vertical: 'MIN' }
  expect(frame.width).toBe(200)
  frame.layoutSizingHorizontal = 'HUG'
  expect([frame.width, badge.x]).toEqual([92, 76])
})

test('a badge keeps its place through editing the label and undoing it', () => {
  const editor = createEditor()
  const { graph } = editor
  const frame = graph.createNode('FRAME', editor.state.currentPageId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12
  })
  const label = graph.createNode('RECTANGLE', frame.id, { width: 60, height: 24 })
  editor.runLayoutForNode(frame.id)
  const badge = graph.createNode('FRAME', frame.id, {
    x: 84,
    y: -8,
    width: 24,
    height: 24,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: 'MAX'
  })
  editor.updateNodeWithUndo(label.id, { width: 150 })
  expect([frame.width, badge.x]).toEqual([182, 174])
  editor.undoAction()
  expect([frame.width, badge.x]).toEqual([92, 84])
  editor.redoAction()
  expect([frame.width, badge.x]).toEqual([182, 174])
  editor.dispose()
})
