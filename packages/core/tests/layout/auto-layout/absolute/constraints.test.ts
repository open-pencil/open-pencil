import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { FigmaAPI } from '#core/figma-api'

// Each case repeats a Figma desktop 126 plugin API script; the numbers are what Figma reported.
// Both lay out a script's edits before it reads or places a layer.

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
    grown: [183.25, 64, 152.376359, -11.333333, 47.804348, 32],
    shrunk: [52, 48, 43.23913, -8.5, 13.565217, 24]
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

test('undoing a previewed edit leaves the badge where the next layout finds it', () => {
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
    x: 76.5,
    y: -8.5,
    width: 24,
    height: 24,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'SCALE'
  })
  // A typed or scrubbed panel value is a preview, committed as one step with the layout it made.
  const preview = editor.beginNodePreview('Change width')
  preview.update(label.id, { width: 151.25 })
  preview.commit()
  expect(frame.width).toBe(183.25)
  editor.undoAction()
  expect([frame.width, badge.x, badge.width]).toEqual([92, 76.5, 24])
  // Laying the page out again, as any later edit does, must not move it from the undone size.
  editor.runLayoutForNode(frame.id)
  expect([frame.width, badge.x, badge.width]).toEqual([92, 76.5, 24])
  editor.redoAction()
  editor.runLayoutForNode(frame.id)
  expect(frame.width).toBe(183.25)
  expect(badge.x).toBeCloseTo(152.376359, 5)
  editor.dispose()
})

// Figma desktop, 2026-11-08: two layers grouped and taken out of the flow of the Hug button, both
// with the constraints of the case. A group owns no constraints, so its layers keep theirs.
describe('a group that ignores auto layout', () => {
  function badgeGroup(figma: FigmaAPI, horizontal: ConstraintName, vertical: ConstraintName) {
    const { frame, label } = button(figma)
    const a = figma.createRectangle()
    a.resize(10, 10)
    const b = figma.createRectangle()
    b.resize(14, 14)
    for (const layer of [a, b]) {
      frame.appendChild(layer)
      layer.layoutPositioning = 'ABSOLUTE'
      layer.constraints = { horizontal, vertical }
    }
    a.x = 70
    a.y = -6
    b.x = 80
    b.y = -2
    const group = figma.group([a, b], frame)
    group.layoutPositioning = 'ABSOLUTE'
    group.x = 70
    group.y = -6
    const read = () => [group.x, group.y, group.width, group.height]
    return { frame, label, read }
  }

  test('stays where it is as its Hug frame grows and shrinks', () => {
    for (const name of ['MAX/MIN', 'CENTER/CENTER', 'STRETCH/STRETCH', 'SCALE/SCALE'] as const) {
      const figma = new FigmaAPI(new SceneGraph())
      const [horizontal, vertical] = name.split('/') as [ConstraintName, ConstraintName]
      const { frame, label, read } = badgeGroup(figma, horizontal, vertical)
      label.resize(151.25, 40)
      expect([frame.width, frame.height, ...read()]).toEqual([183.25, 64, 70, -6, 24, 18])
      label.resize(20, 24)
      expect([frame.width, frame.height, ...read()]).toEqual([52, 48, 70, -6, 24, 18])
    }
  })

  test('has its layers follow their constraints as its fixed frame is resized', () => {
    const cases = {
      'MAX/MIN': [170, -6, 24, 18],
      'CENTER/CENTER': [120, 4, 24, 18],
      'STRETCH/STRETCH': [70, -6, 124, 38],
      'SCALE/SCALE': [146.08696, -8.5, 50.086945, 25.5]
    } as const
    for (const [name, expected] of Object.entries(cases)) {
      const figma = new FigmaAPI(new SceneGraph())
      const [horizontal, vertical] = name.split('/') as [ConstraintName, ConstraintName]
      const { frame, read } = badgeGroup(figma, horizontal, vertical)
      frame.layoutSizingHorizontal = 'FIXED'
      frame.layoutSizingVertical = 'FIXED'
      frame.resize(192, 68)
      read().forEach((value, i) => expect(value).toBeCloseTo(expected[i], 4))
    }
  })
})
