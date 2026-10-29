import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

// Each case matches Cmd+D or Cmd+V observed in Figma desktop 126.

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor({ getViewportSize: () => ({ width: 800, height: 600 }) })
  return editor.state.currentPageId
}

function node(type: SceneNode['type'], parentId: string, props: Partial<SceneNode> = {}) {
  return editor.graph.createNode(type, parentId, { width: 40, height: 40, ...props })
}

/** Where a layer's centre is drawn on the canvas. */
function worldCenter(layer: SceneNode) {
  const center = Matrix.mapPoint(getWorldMatrix(layer, editor.graph), {
    x: layer.width / 2,
    y: layer.height / 2
  })
  return { x: Math.round(center.x), y: Math.round(center.y) }
}

/** A layer's box on the canvas, rounded to tenths. */
function canvasBox(layer: SceneNode) {
  const box = getAxisAlignedWorldBounds(layer, editor.graph)
  const round = (value: number) => Math.round(value * 10) / 10 + 0
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) }
}

/** A layer's x and y axes on the canvas, rounded, which say how it is turned and flipped. */
function canvasAxes(layer: SceneNode) {
  const [a, c, , b, d] = getWorldMatrix(layer, editor.graph)
  return [a, b, c, d].map((value) => Math.round(value * 1000) / 1000 + 0)
}

/** Where a layer's canvas box starts in a frame's canvas box. */
function offsetIn(layer: SceneNode, frame: SceneNode) {
  const box = getAxisAlignedWorldBounds(layer, editor.graph)
  const outer = getAxisAlignedWorldBounds(frame, editor.graph)
  const round = (value: number) => Math.round(value * 10) / 10 + 0
  return { x: round(box.x - outer.x), y: round(box.y - outer.y) }
}

async function pasteInto(snapshot: Awaited<ReturnType<typeof copy>>, targetId: string) {
  editor.select([targetId])
  await editor.pasteSnapshot(snapshot)
  return selected()
}

function selected() {
  const [id] = editor.state.selectedIds
  const found = editor.graph.getNode(id)
  if (!found) throw new Error('Expected a selected layer')
  return found
}

async function copy(id: string) {
  editor.select([id])
  const payload = await editor.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  return payload.snapshot
}

describe('duplicate placement', () => {
  test('duplicates a layer on top of the original', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200 })
    for (const original of [
      node('RECTANGLE', page, { x: 100, y: 100 }),
      node('FRAME', frame.id, { x: 50, y: 50 })
    ]) {
      editor.select([original.id])
      editor.duplicateSelected()
      expect(selected()).toMatchObject({
        parentId: original.parentId,
        x: original.x,
        y: original.y
      })
    }
  })

  test('puts a duplicated top-level frame in the first free place to its right', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 150 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ x: 240, y: 0 })
  })

  test('skips past top-level layers in the way', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 150 })
    node('FRAME', page, { x: 250, width: 100, height: 100 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ x: 390, y: 0 })
  })

  test('treats a frame in a section as top-level', () => {
    const page = setup()
    const section = node('SECTION', page, { width: 600, height: 300 })
    node('FRAME', section.id, { x: 140, y: 50, width: 100, height: 100 })
    const frame = node('FRAME', section.id, { x: 20, y: 50, width: 100, height: 100 })
    editor.select([frame.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ parentId: section.id, x: 280, y: 50 })
  })

  test('duplicates a multi-selection in place, keeping names', () => {
    const page = setup()
    const a = node('FRAME', page, { name: 'A', width: 100, height: 100 })
    const b = node('FRAME', page, { name: 'B', x: 140, width: 100, height: 100 })
    editor.select([a.id, b.id])
    editor.duplicateSelected()
    const copies = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
    expect(copies.map((n) => [n?.name, n?.x, n?.y])).toEqual([
      ['A', 0, 0],
      ['B', 140, 0]
    ])
  })

  test('duplicates a main component as an instance, but a variant as a variant', () => {
    const page = setup()
    const component = node('COMPONENT', page, { name: 'C', width: 100, height: 100 })
    editor.select([component.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ type: 'INSTANCE', componentId: component.id, name: 'C' })

    const set = node('COMPONENT_SET', page, { y: 300, width: 300, height: 140 })
    const variant = node('COMPONENT', set.id, { name: 'v=a', width: 60, height: 60 })
    editor.select([variant.id])
    editor.duplicateSelected()
    expect(selected()).toMatchObject({ type: 'COMPONENT', parentId: set.id })
  })
})

describe('paste placement', () => {
  test('keeps the offset a layer had inside its frame', async () => {
    const page = setup()
    const source = node('FRAME', page, { width: 200, height: 200 })
    const box = node('RECTANGLE', source.id, { x: 20, y: 30 })
    const target = node('FRAME', page, { x: 300, width: 200, height: 200 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 20, y: 30 })
  })

  test('centers each axis that does not fit in the frame', async () => {
    const page = setup()
    const source = node('FRAME', page, { width: 200, height: 200 })
    const box = node('RECTANGLE', source.id, { x: 150, y: 150 })
    const target = node('FRAME', page, { x: 300, width: 100, height: 100 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 30, y: 30 })
  })

  test('keeps the canvas position of a top-level layer', async () => {
    const page = setup()
    const box = node('RECTANGLE', page, { x: 20, y: 30 })
    const target = node('FRAME', page, { x: 300, width: 200, height: 200 })
    const leaf = node('RECTANGLE', target.id, { x: 100, y: 100 })
    const snapshot = await copy(box.id)
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: page, x: 20, y: 30 })

    // Inside a frame its x falls outside, so only x is centered.
    editor.select([leaf.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: target.id, x: 80, y: 30 })
  })

  test('centers layers that would land out of view', async () => {
    const page = setup()
    const box = node('RECTANGLE', page, { x: 5000, y: 5000 })
    const snapshot = await copy(box.id)
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: page, x: 380, y: 280 })
  })

  test('Paste here centers on the cursor inside the target frame', async () => {
    const page = setup()
    const box = node('RECTANGLE', page)
    const target = node('FRAME', page, { x: 300, y: 100, width: 200, height: 200 })
    const snapshot = await copy(box.id)
    editor.select([target.id])
    await editor.pasteSnapshot(snapshot, { x: 400, y: 200 })
    expect(selected()).toMatchObject({ parentId: target.id, x: 80, y: 80 })
  })

  test('Paste here centers on the cursor inside a rotated or flipped frame', async () => {
    const page = setup()
    const box = node('RECTANGLE', page, { width: 50, height: 30 })
    const target = node('FRAME', page, { x: 300, y: 100, width: 200, height: 200 })
    const snapshot = await copy(box.id)
    for (const transform of [{ rotation: 90 }, { rotation: 0, flipX: true }]) {
      editor.graph.updateNode(target.id, transform)
      editor.select([target.id])
      await editor.pasteSnapshot(snapshot, { x: 420, y: 160 })
      expect(selected().parentId).toBe(target.id)
      expect(worldCenter(selected())).toEqual({ x: 420, y: 160 })
    }
  })

  test('an instance pasted into its own main component lands over it in its parent', async () => {
    const page = setup()
    const card = node('COMPONENT', page, { x: 260, width: 160, height: 100 })
    const instance = editor.graph.createInstance(card.id, page, { x: 460 })
    if (!instance) throw new Error('Expected an instance')
    const snapshot = await copy(instance.id)
    editor.select([card.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ type: 'INSTANCE', parentId: page, x: 260, y: 0 })

    // Inside a frame in the component, the paste climbs to the component's own parent.
    const frame = node('FRAME', card.id, { x: 10, y: 10, width: 100, height: 60 })
    editor.select([frame.id])
    await editor.pasteSnapshot(snapshot)
    expect(selected()).toMatchObject({ parentId: page, x: 240, y: -10 })
    expect(editor.graph.getChildren(card.id).map((child) => child.id)).toEqual([frame.id])
  })

  test('a paste read back from the Figma clipboard lands inside the selected frame', async () => {
    const page = setup()
    const card = node('RECTANGLE', page, { x: 600, y: 600, width: 240, height: 160 })
    const holder = node('FRAME', page, { x: 1000, y: 1000, width: 400, height: 240 })
    editor.state.panX = -900
    editor.state.panY = -900
    editor.select([card.id])
    const { html } = await editor.prepareCopy()
    editor.select([holder.id])
    await editor.pasteFromHTML(html)
    expect(selected()).toMatchObject({ parentId: holder.id, x: 80, y: 40 })
  })
})

// Each case replays a paste into a frame observed in Figma desktop 126, which works in canvas
// boxes: what is rotated or flipped above the layers changes neither their offset nor the rules.
describe('paste orientation', () => {
  /** A page whose view takes in every frame these cases paste into. */
  function wideSetup() {
    const page = setup()
    editor.state.zoom = 0.2
    return page
  }

  function frames(page: string) {
    return {
      turned: node('FRAME', page, { x: 1000, y: 100, width: 300, height: 200, rotation: 30 }),
      upright: node('FRAME', page, { x: 1500, y: 100, width: 300, height: 200 }),
      back: node('FRAME', page, { x: 2000, y: 100, width: 300, height: 200, rotation: -45 }),
      flipped: node('FRAME', page, { x: 2500, y: 100, width: 300, height: 200, flipX: true })
    }
  }

  test('a layer keeps how it is turned and flipped on the canvas, in any frame', async () => {
    const page = wideSetup()
    const { turned, upright, back, flipped } = frames(page)
    const box = node('RECTANGLE', turned.id, { x: 40, y: 50, width: 60, height: 30 })
    const tilted = node('RECTANGLE', turned.id, {
      x: 150,
      y: 80,
      width: 30,
      height: 30,
      rotation: 20
    })
    const axes = canvasAxes(box)
    const snapshot = await copy(box.id)
    for (const target of [upright, back, flipped, turned]) {
      const pasted = await pasteInto(snapshot, target.id)
      expect(pasted.parentId).toBe(target.id)
      expect(canvasAxes(pasted)).toEqual(axes)
      expect(offsetIn(pasted, target)).toEqual(offsetIn(box, turned))
    }

    editor.select([box.id, tilted.id])
    const both = await editor.prepareCopy()
    if (!both.snapshot) throw new Error('Missing snapshot')
    editor.select([upright.id])
    await editor.pasteSnapshot(both.snapshot)
    const pasted = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
    expect(pasted.map((layer) => layer && canvasAxes(layer))).toEqual([
      canvasAxes(box),
      canvasAxes(tilted)
    ])
    expect(pasted.map((layer) => layer && offsetIn(layer, upright))).toEqual([
      offsetIn(box, turned),
      offsetIn(tilted, turned)
    ])
  })

  test('a layer from an upright frame keeps its offset in a turned frame’s canvas box', async () => {
    const page = wideSetup()
    const { turned, upright } = frames(page)
    const small = node('FRAME', page, { x: 3000, y: 100, width: 120, height: 80, rotation: 60 })
    for (const [x, y, width] of [
      [40, 50, 60],
      [220, 160, 60]
    ]) {
      const box = node('RECTANGLE', upright.id, { x, y, width, height: 30 })
      const pasted = await pasteInto(await copy(box.id), turned.id)
      expect(canvasAxes(pasted)).toEqual([1, 0, 0, 1])
      expect(offsetIn(pasted, turned)).toEqual({ x, y })
    }
    // Wider than the frame's box, but starting inside it, so it stays.
    const wide = node('RECTANGLE', upright.id, { x: 50, y: 10, width: 200, height: 30 })
    expect(offsetIn(await pasteInto(await copy(wide.id), small.id), small)).toEqual({
      x: 50,
      y: 10
    })
  })

  test('a top-level layer keeps its canvas place and turn, centred on an axis off the frame', async () => {
    const page = wideSetup()
    const { turned } = frames(page)
    const box = node('RECTANGLE', page, { x: 1200, y: 600, width: 60, height: 30, rotation: 10 })
    const before = canvasBox(box)
    const pasted = await pasteInto(await copy(box.id), turned.id)
    const frame = canvasBox(turned)
    expect(canvasAxes(pasted)).toEqual(canvasAxes(box))
    expect(canvasBox(pasted).x).toBe(before.x)
    expect(canvasBox(pasted).y).toBeCloseTo(frame.y + (frame.height - before.height) / 2, 0)
  })

  test('a layer from a frame is centred only on an axis where it starts past the far edge', async () => {
    const page = wideSetup()
    const source = node('FRAME', page, { x: 1500, y: 100, width: 300, height: 200 })
    const target = node('FRAME', page, { x: 2000, y: 100, width: 120, height: 80 })
    for (const [x, width, expected] of [
      [50, 200, 50],
      [100, 30, 100],
      [119, 30, 119],
      [120, 30, 45],
      [130, 30, 45],
      [200, 30, 45],
      [-20, 60, -20],
      [-50, 30, -50]
    ]) {
      const box = node('RECTANGLE', source.id, { x, y: 10, width, height: 20 })
      expect(await pasteInto(await copy(box.id), target.id)).toMatchObject({ x: expected, y: 10 })
    }
  })

  test('a top-level layer is centred only on an axis where it misses the frame', async () => {
    const page = wideSetup()
    const target = node('FRAME', page, { x: 100, y: 100, width: 120, height: 80 })
    for (const [x, y, width, expected] of [
      [-50, 10, 30, { x: 45, y: 10 }],
      [-10, 10, 30, { x: -10, y: 10 }],
      [130, 10, 30, { x: 45, y: 10 }],
      [100, 10, 30, { x: 100, y: 10 }],
      [10, -50, 30, { x: 10, y: 30 }],
      [10, 100, 30, { x: 10, y: 30 }],
      [50, 10, 200, { x: 50, y: 10 }]
    ] as const) {
      const box = node('RECTANGLE', page, { x: 100 + x, y: 100 + y, width, height: 20 })
      expect(await pasteInto(await copy(box.id), target.id)).toMatchObject(expected)
    }
  })

  /** Copies layers together and pastes them into a frame, giving their places in it. */
  async function pasteTogether(layers: SceneNode[], targetId: string) {
    editor.select(layers.map((layer) => layer.id))
    const { snapshot } = await editor.prepareCopy()
    if (!snapshot) throw new Error('Missing snapshot')
    editor.select([targetId])
    await editor.pasteSnapshot(snapshot)
    return [...editor.state.selectedIds].map((id) => {
      const pasted = editor.graph.getNode(id)
      return pasted && [pasted.x, pasted.y]
    })
  }

  test('layers from one frame move as a block, to the top-left when larger than the frame', async () => {
    const page = wideSetup()
    const source = node('FRAME', page, { x: 1500, y: 100, width: 300, height: 200 })
    const target = node('FRAME', page, { x: 2000, y: 100, width: 120, height: 80 })
    const at = (x: number, y: number, height = 20) =>
      node('RECTANGLE', source.id, { x, y, width: 30, height })
    // The block starts inside, so it stays.
    expect(await pasteTogether([at(20, 10), at(200, 10)], target.id)).toEqual([
      [20, 10],
      [200, 10]
    ])
    // Past the right edge and fitting: centred across only.
    expect(await pasteTogether([at(200, 10), at(250, 10)], target.id)).toEqual([
      [20, 10],
      [70, 10]
    ])
    // Past the right edge and taller than the frame: to its top-left.
    expect(await pasteTogether([at(200, 10), at(200, 150)], target.id)).toEqual([
      [0, 0],
      [0, 140]
    ])
    expect(await pasteTogether([at(200, 10, 160)], target.id)).toEqual([[0, 0]])
    const wide = node('RECTANGLE', source.id, { x: 60, y: 100, width: 200, height: 20 })
    expect(await pasteTogether([wide], target.id)).toEqual([[0, 0]])
  })

  test('a top-level layer larger than the frame is centred both ways once it misses it', async () => {
    const page = wideSetup()
    const target = node('FRAME', page, { x: 100, y: 100, width: 120, height: 80 })
    const wide = node('RECTANGLE', page, { x: 110, y: 0, width: 200, height: 20 })
    const tall = node('RECTANGLE', page, { x: 300, y: 110, width: 30, height: 160 })
    expect(await pasteTogether([wide], target.id)).toEqual([[-40, 30]])
    expect(await pasteTogether([tall], target.id)).toEqual([[45, -40]])
  })

  test('a frame child and a page-level layer copied together are placed each from its own place', async () => {
    const page = wideSetup()
    const source = node('FRAME', page, { x: 1000, y: 100, width: 300, height: 200 })
    const child = node('RECTANGLE', source.id, { x: 40, y: 50, width: 60, height: 30 })
    const loose = node('RECTANGLE', page, { x: 1100, y: 400, width: 60, height: 30 })
    const target = node('FRAME', page, { x: 1500, y: 100, width: 400, height: 400 })
    for (const order of [
      [child, loose],
      [loose, child]
    ]) {
      const places = await pasteTogether(order, target.id)
      const byName = order.map((layer, index) => [layer.id, places[index]])
      expect(Object.fromEntries(byName)).toEqual({ [child.id]: [40, 50], [loose.id]: [170, 300] })
    }
  })
})

// Repeats Figma desktop 126: a paste with nothing selected.
describe('paste with nothing selected', () => {
  function sourceSetup() {
    const page = setup()
    editor.state.zoom = 0.2
    const frame = node('FRAME', page, { x: 1000, y: 100, width: 300, height: 200 })
    const box = node('RECTANGLE', frame.id, { x: 40, y: 50, width: 60, height: 30 })
    return { page, frame, box }
  }

  async function pasteWithNothingSelected(snapshot: Awaited<ReturnType<typeof copy>>) {
    editor.select([])
    await editor.pasteSnapshot(snapshot)
    return selected()
  }

  test('a layer copied out of a frame or section goes back into it', async () => {
    const { page, frame, box } = sourceSetup()
    expect(await pasteWithNothingSelected(await copy(box.id))).toMatchObject({
      parentId: frame.id,
      x: 40,
      y: 50
    })
    const section = node('SECTION', page, { x: 1400, y: 100, width: 400, height: 300 })
    const inSection = node('RECTANGLE', section.id, { x: 30, y: 40 })
    expect(await pasteWithNothingSelected(await copy(inSection.id))).toMatchObject({
      parentId: section.id,
      x: 30,
      y: 40
    })
  })

  test('it keeps its place on the canvas from when it was copied, even after the frame moved', async () => {
    const { frame, box } = sourceSetup()
    const snapshot = await copy(box.id)
    editor.graph.updateNode(frame.id, { y: 500 })
    expect(await pasteWithNothingSelected(snapshot)).toMatchObject({
      parentId: frame.id,
      x: 40,
      y: -350
    })
  })

  test('out of view it goes onto the page, in the middle of the view', async () => {
    const { page, box } = sourceSetup()
    const snapshot = await copy(box.id)
    editor.state.panX = -20000
    editor.state.panY = -20000
    const pasted = await pasteWithNothingSelected(snapshot)
    expect(pasted.parentId).toBe(page)
    expect(worldCenter(pasted)).toEqual({ x: 102000, y: 101500 })
  })

  test('a layer whose frame is gone goes onto the page where it was', async () => {
    const { page, frame, box } = sourceSetup()
    const snapshot = await copy(box.id)
    editor.graph.deleteNode(frame.id)
    expect(await pasteWithNothingSelected(snapshot)).toMatchObject({
      parentId: page,
      x: 1040,
      y: 150
    })
  })
})
