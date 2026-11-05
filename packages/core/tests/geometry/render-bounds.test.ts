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
