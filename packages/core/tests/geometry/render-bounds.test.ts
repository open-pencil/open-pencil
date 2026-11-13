import { beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportBounds } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'

type Rectangle = ReturnType<FigmaAPI['createRectangle']>

const solid = (r: number, g: number, b: number) => [{ type: 'SOLID' as const, color: { r, g, b } }]

function shadow(radius: number, spread: number, offset = { x: 5, y: -3 }) {
  return {
    type: 'DROP_SHADOW' as const,
    visible: true,
    color: { r: 0, g: 0, b: 0, a: 0.5 },
    offset,
    radius,
    spread,
    blendMode: 'NORMAL' as const
  }
}

function blur(type: 'LAYER_BLUR' | 'BACKGROUND_BLUR', radius: number) {
  return { type, visible: true, radius, blurType: 'NORMAL' as const }
}

beforeAll(() => registerTestFont())

// Figma desktop 126 (2026-11-05): each layer's absoluteRenderBounds, which its 1x PNG export
// matches to the pixel, as x, y, width, height on the page.
describe('render bounds as Figma measures them', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const rectangle = (setUp?: (rect: Rectangle) => void) => {
    const rect = figma.createRectangle()
    rect.x = 3
    rect.y = 4
    rect.resize(10, 20)
    rect.fills = solid(1, 0, 0)
    setUp?.(rect)
    return rect
  }
  const frame = (clipsContent: boolean) => {
    const container = figma.createFrame()
    container.resize(50, 50)
    container.fills = solid(1, 1, 1)
    container.clipsContent = clipsContent
    const child = figma.createRectangle()
    container.appendChild(child)
    child.x = 40
    child.y = 40
    child.resize(30, 30)
    child.fills = solid(0, 1, 0)
    return [container, child] as const
  }
  const [clipping, clipped] = frame(true)
  const inGroup = [
    rectangle(),
    rectangle((rect) => {
      rect.x = 30
      rect.effects = [shadow(4, 0)]
    })
  ]
  const cases: Array<[string, { id: string }, number[]]> = [
    [
      'a layer blur grows by its radius',
      rectangle((rect) => (rect.effects = [blur('LAYER_BLUR', 8)])),
      [-5, -4, 26, 36]
    ],
    [
      'a background blur adds nothing',
      rectangle((rect) => (rect.effects = [blur('BACKGROUND_BLUR', 8)])),
      [3, 4, 10, 20]
    ],
    [
      'an inner shadow adds nothing',
      rectangle((rect) => {
        rect.effects = [
          {
            ...shadow(8, 0, { x: 5, y: 5 }),
            type: 'INNER_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 1 }
          }
        ]
      }),
      [3, 4, 10, 20]
    ],
    [
      'a shadow shrinks by a negative spread',
      rectangle((rect) => (rect.effects = [shadow(4, -2)])),
      [3, -1, 17, 25]
    ],
    [
      'a sharp shadow moves by its offset',
      rectangle((rect) => (rect.effects = [shadow(0, 0, { x: 10, y: 0 })])),
      [3, 4, 20, 20]
    ],
    [
      'a centred stroke grows by half its weight',
      rectangle((rect) => {
        rect.strokes = solid(0, 0, 1)
        rect.strokeWeight = 4
        rect.strokeAlign = 'CENTER'
      }),
      [1, 2, 14, 24]
    ],
    [
      'an inside stroke adds nothing',
      rectangle((rect) => {
        rect.strokes = solid(0, 0, 1)
        rect.strokeWeight = 4
        rect.strokeAlign = 'INSIDE'
      }),
      [3, 4, 10, 20]
    ],
    ['a frame that clips is its box', clipping, [0, 0, 50, 50]],
    ['a layer in a frame that clips is held to its box', clipped, [40, 40, 10, 10]],
    ['a frame that does not clip takes in its children', frame(false)[0], [0, 0, 70, 70]],
    ['a group is what its layers draw', figma.group(inGroup, figma.currentPage), [3, -3, 46, 28]]
  ]

  const shadowed = (node: { effects: unknown }) => {
    node.effects = [shadow(4, 0)]
  }
  const groupWithShadow = figma.group(
    [rectangle(), rectangle((rect) => (rect.x = 30))],
    figma.currentPage
  )
  shadowed(groupWithShadow)
  const shadowedFrame = (filled: boolean, x: number) => {
    const [container] = frame(false)
    container.x = x
    if (!filled) container.fills = []
    shadowed(container)
    return container
  }
  const text = (setUp: (node: ReturnType<FigmaAPI['createText']>) => void) => {
    const node = figma.createText()
    node.fontSize = 24
    node.characters = 'AB'
    setUp(node)
    return node
  }
  const [outsideFrame] = frame(true)
  outsideFrame.x = 300
  const outside = [figma.createRectangle(), figma.createRectangle()]
  outside.forEach((rect, index) => {
    outsideFrame.appendChild(rect)
    rect.resize(10, 10)
    rect.x = 60 + index * 20
    rect.y = 60 - index * 60
  })
  const outsideGroup = figma.group(outside, outsideFrame)
  cases.push(
    ['a group casts its shadow from its layers', groupWithShadow, [3, -3, 46, 28]],
    [
      'a frame with no fill casts its shadow from its children',
      shadowedFrame(false, 100),
      [100, 0, 79, 71]
    ],
    [
      'a filled frame casts its shadow from its box and children',
      shadowedFrame(true, 200),
      [200, -7, 79, 78]
    ]
  )

  test('a text paints with a fill or a stroke, and draws nothing with neither', () => {
    const bare = text((node) => (node.fills = []))
    expect(bare.absoluteRenderBounds).toBeNull()
    expect(exportBounds(graph, [bare.id])).toBeNull()
    const stroked = text((node) => {
      node.fills = []
      node.strokes = solid(1, 0, 0)
      node.strokeWeight = 2
    })
    expect(stroked.absoluteRenderBounds).not.toBeNull()
    // An emoji draws apart from the fills, so a text of one paints with none.
    const emoji = text((node) => {
      node.characters = '\u{1F600}'
      node.fills = []
    })
    expect(emoji.absoluteRenderBounds).not.toBeNull()
    expect(exportBounds(graph, [emoji.id])).not.toBeNull()
  })

  test('layers all outside the frame that clips them draw nothing', () => {
    expect(figma.getNodeById(outsideGroup.id)?.absoluteRenderBounds).toBeNull()
    expect(exportBounds(graph, [outsideGroup.id])).toBeNull()
  })

  for (const [name, node, figmaBounds] of cases) {
    test(name, () => {
      const proxy = figma.getNodeById(node.id) as Rectangle
      const render = proxy.absoluteRenderBounds
      expect(render && [render.x, render.y, render.width, render.height]).toEqual(figmaBounds)
      const exported = exportBounds(graph, [node.id])
      expect(
        exported && [
          exported.minX,
          exported.minY,
          exported.maxX - exported.minX,
          exported.maxY - exported.minY
        ]
      ).toEqual(figmaBounds)
    })
  }

  test('a turned layer takes the box around it', () => {
    const turned = rectangle((rect) => (rect.rotation = 30))
    const render = turned.absoluteRenderBounds
    const rounded = (values: number[]) => values.map((value) => +value.toFixed(2))
    expect(render && rounded([render.x, render.y, render.width, render.height])).toEqual([
      3, -1, 18.66, 22.32
    ])
    const exported = exportBounds(graph, [turned.id])
    expect(
      exported &&
        rounded([
          exported.minX,
          exported.minY,
          exported.maxX - exported.minX,
          exported.maxY - exported.minY
        ])
    ).toEqual([3, -1, 18.66, 22.32])
  })
})

describe('render bounds under a mask', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const rectangle = (x: number, y: number, width: number, height: number) => {
    const rect = figma.createRectangle()
    rect.x = x
    rect.y = y
    rect.resize(width, height)
    rect.fills = solid(1, 0, 0)
    return rect
  }
  const box = (bounds: ReturnType<typeof exportBounds>) =>
    bounds && [bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY]
  const masked = (layers: Rectangle[], maskIndexes: number[]) => {
    for (const index of maskIndexes) {
      layers[index].isMask = true
    }
    return figma.group(layers, figma.currentPage)
  }

  // Figma desktop, live: a masked run is bounded by its masks, whatever the masked layers reach.
  test('a mask bounds the layers above it by its own box, wider or narrower than them', () => {
    const scrolled = masked([rectangle(10, 10, 100, 50), rectangle(20, -5000, 60, 6000)], [0])
    expect(box(exportBounds(graph, [scrolled.id]))).toEqual([10, 10, 100, 50])
    const nothingAbove = masked([rectangle(5000, 0, 10, 10), rectangle(5000, 0, 100, 100)], [1])
    expect(box(exportBounds(graph, [nothingAbove.id]))).toEqual([5000, 0, 100, 100])
  })

  test('a frame exports its own size when a mask clips the content scrolled past it', () => {
    const screen = figma.createFrame()
    screen.x = 500
    screen.resize(200, 100)
    screen.fills = solid(1, 1, 1)
    screen.clipsContent = false
    const list = masked([rectangle(10, 10, 100, 50), rectangle(20, -5000, 60, 6000)], [0])
    screen.appendChild(list)
    expect(box(exportBounds(graph, [screen.id]))).toEqual([500, 0, 200, 100])
  })

  test('layers below a mask stay whole and the next mask starts a new run', () => {
    const below = rectangle(990, 0, 10, 10)
    const firstMask = rectangle(1000, 0, 20, 20)
    const firstMasked = rectangle(1000, 0, 400, 20)
    const secondMask = rectangle(1100, 100, 20, 20)
    const secondMasked = rectangle(1000, 100, 400, 400)
    const group = masked([below, firstMask, firstMasked, secondMask, secondMasked], [1, 3])
    expect(box(exportBounds(graph, [group.id]))).toEqual([990, 0, 130, 120])
  })

  test('a fully transparent mask still counts its box', () => {
    const below = rectangle(2990, 0, 5, 5)
    const transparentMask = rectangle(3000, 0, 200, 200)
    const hidden = rectangle(3000, 0, 200, 200)
    const alone = masked([below, transparentMask, hidden], [1])
    transparentMask.opacity = 0
    expect(box(exportBounds(graph, [alone.id]))).toEqual([2990, 0, 210, 200])

    const clearMask = rectangle(3000, 1000, 200, 200)
    const mask = rectangle(3000, 1000, 20, 20)
    const held = masked([clearMask, mask, rectangle(3000, 1000, 200, 200)], [0, 1])
    clearMask.opacity = 0
    expect(box(exportBounds(graph, [held.id]))).toEqual([3000, 1000, 200, 200])
  })

  test('a shadow cast into a mask from layers outside it counts', () => {
    const mask = rectangle(4000, 0, 100, 100)
    const caster = figma.group([rectangle(4000, 200, 100, 100)], figma.currentPage)
    caster.effects = [shadow(0, 0, { x: 0, y: -200 })]
    const group = figma.group([mask, caster], figma.currentPage)
    mask.isMask = true
    expect(box(exportBounds(graph, [group.id]))).toEqual([4000, 0, 100, 100])
  })

  test('a shadowed group with a layer far outside a mask keeps to the mask', () => {
    const mask = rectangle(6000, 0, 400, 400)
    const caster = figma.group(
      [rectangle(6010, 10, 8, 8), rectangle(9000, 3000, 8, 8)],
      figma.currentPage
    )
    caster.effects = [shadow(4, 0, { x: 0, y: 0 })]
    const group = figma.group([mask, caster], figma.currentPage)
    mask.isMask = true
    expect(box(exportBounds(graph, [group.id]))).toEqual([6000, 0, 400, 400])
  })

  test("a mask's own shadow reaches only as far as its box and the layers it masks", () => {
    const narrow = rectangle(7000, 0, 100, 100)
    narrow.effects = [shadow(10, 0, { x: 0, y: 20 })]
    const tall = masked([narrow, rectangle(7025, -1000, 50, 2000)], [0])
    expect(box(exportBounds(graph, [tall.id]))).toEqual([7000, 0, 100, 130])
    const lone = rectangle(8000, 0, 100, 100)
    lone.effects = [shadow(10, 0, { x: 0, y: 20 })]
    const dot = masked([lone, rectangle(8040, 40, 1, 1)], [0])
    expect(box(exportBounds(graph, [dot.id]))).toEqual([8000, 0, 100, 100])
  })

  test('a hidden layer after a mask ends its run, as on the canvas', () => {
    const first = rectangle(9000, 0, 100, 100)
    first.effects = [shadow(0, 0, { x: 0, y: -50 })]
    const hidden = rectangle(9000, 0, 10, 10)
    const group = masked(
      [first, hidden, rectangle(9200, 200, 10, 10), rectangle(9200, -1000, 10, 2000)],
      [0, 2]
    )
    hidden.visible = false
    expect(box(exportBounds(graph, [group.id]))).toEqual([9000, 0, 210, 210])
  })

  test('a hidden mask masks nothing', () => {
    const group = masked([rectangle(2000, 0, 10, 10), rectangle(2000, 0, 100, 100)], [0])
    const [mask] = group.children
    mask.visible = false
    expect(box(exportBounds(graph, [group.id]))).toEqual([2000, 0, 100, 100])
  })
})

// Figma desktop (2026-11-14): a component set clips its variants as a frame does; a section never
// clips, even one an import marked as clipping.
describe('render bounds of containers that clip', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const solidFill = {
    type: 'SOLID' as const,
    color: { r: 1, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true
  }
  const overflowing = (type: 'COMPONENT_SET' | 'SECTION', x: number) => {
    const container = graph.createNode(type, page, {
      x,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true
    })
    graph.createNode('RECTANGLE', container.id, {
      x: 50,
      y: 0,
      width: 100,
      height: 50,
      fills: [solidFill]
    })
    return container
  }
  const box = (bounds: ReturnType<typeof exportBounds>) =>
    bounds && [bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY]

  test('a component set clips a variant past its edge', () => {
    const set = overflowing('COMPONENT_SET', 10000)
    expect(box(exportBounds(graph, [set.id]))).toEqual([10000, 0, 100, 100])
  })

  test('a section shows a layer past its edge', () => {
    const section = overflowing('SECTION', 11000)
    expect(box(exportBounds(graph, [section.id]))?.[2]).toBe(150)
  })
})
