import { DEMO_COLORS, gradient, solid, thinStroke } from '@/app/demo/colors'
import type { EditorStore } from '@/app/editor/session'

export function createStandaloneShapes(store: EditorStore) {
  const { graph } = store

  const grad1 = store.createShape('FRAME', 60, 660, 180, 120)
  graph.updateNode(grad1, {
    name: 'Gradient Card',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 0.99, g: 0.37, b: 0.33, a: 1 }, position: 0 },
        { color: { r: 0.93, g: 0.18, b: 0.65, a: 1 }, position: 0.5 },
        { color: { r: 0.55, g: 0.28, b: 0.96, a: 1 }, position: 1 }
      ])
    ]
  })
  const gradText = store.createShape('TEXT', 20, 80, 140, 20, grad1)
  graph.updateNode(gradText, {
    name: 'Label',
    text: 'Linear Gradient',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.white)]
  })

  const grad2 = store.createShape('FRAME', 260, 660, 180, 120)
  graph.updateNode(grad2, {
    name: 'Ocean',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 0.04, g: 0.82, b: 0.67, a: 1 }, position: 0 },
        { color: { r: 0.13, g: 0.45, b: 0.96, a: 1 }, position: 1 }
      ])
    ]
  })
  const grad2Text = store.createShape('TEXT', 20, 80, 140, 20, grad2)
  graph.updateNode(grad2Text, {
    name: 'Label',
    text: 'Ocean Breeze',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.white)]
  })

  const grad3 = store.createShape('FRAME', 460, 660, 180, 120)
  graph.updateNode(grad3, {
    name: 'Sunset',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 1, g: 0.6, b: 0.2, a: 1 }, position: 0 },
        { color: { r: 0.96, g: 0.26, b: 0.21, a: 1 }, position: 1 }
      ])
    ]
  })
  const grad3Text = store.createShape('TEXT', 20, 80, 140, 20, grad3)
  graph.updateNode(grad3Text, {
    name: 'Label',
    text: 'Warm Sunset',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.white)]
  })

  const typoFrame = store.createShape('FRAME', 700, 660, 320, 164)
  graph.updateNode(typoFrame, {
    name: 'Typography & OpenType',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.white)],
    strokes: thinStroke(DEMO_COLORS.gray200),
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 6,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 20
  })
  const typoItems = [
    { text: 'Heading', size: 24, weight: 700 },
    { text: 'Subheading', size: 16, weight: 600 },
    { text: 'Body text — The quick brown fox jumps.', size: 13, weight: 400 },
    {
      text: 'Ligatures off — office affine',
      size: 13,
      weight: 500,
      features: [{ tag: 'LIGA', enabled: false }]
    },
    {
      text: 'Raw OT tags — DLIG on · KERN off',
      size: 11,
      weight: 500,
      features: [
        { tag: 'DLIG', enabled: true },
        { tag: 'KERN', enabled: false }
      ]
    }
  ]
  for (const t of typoItems) {
    const tid = store.createShape('TEXT', 0, 0, 280, t.size + 4, typoFrame)
    graph.updateNode(tid, {
      name: t.text.split(' ')[0],
      text: t.text,
      fontSize: t.size,
      fontWeight: t.weight,
      fontFeatures: t.features ?? [],
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      fills: [solid(DEMO_COLORS.black)]
    })
  }

  const shapes = [
    {
      type: 'ELLIPSE' as const,
      x: 1060,
      fill: gradient([
        { color: DEMO_COLORS.purple, position: 0 },
        { color: DEMO_COLORS.blue, position: 1 }
      ])
    },
    {
      type: 'RECTANGLE' as const,
      x: 1160,
      fill: gradient([
        { color: DEMO_COLORS.green, position: 0 },
        { color: DEMO_COLORS.teal, position: 1 }
      ])
    },
    {
      type: 'ELLIPSE' as const,
      x: 1260,
      fill: gradient([
        { color: DEMO_COLORS.orange, position: 0 },
        { color: DEMO_COLORS.red, position: 1 }
      ])
    }
  ]
  for (const s of shapes) {
    const id = store.createShape(s.type, s.x, 680, 80, 80)
    graph.updateNode(id, {
      name: s.type === 'ELLIPSE' ? 'Circle' : 'Square',
      cornerRadius: s.type === 'RECTANGLE' ? 16 : 0,
      fills: [s.fill]
    })
  }
}
