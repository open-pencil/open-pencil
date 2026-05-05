import {
  BLACK,
  BLUE,
  GRAY_200,
  GREEN,
  ORANGE,
  PURPLE,
  RED,
  TEAL,
  WHITE,
  gradient,
  solid,
  thinStroke
} from '@/app/demo/colors'
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
    fills: [solid(WHITE)]
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
    fills: [solid(WHITE)]
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
    fills: [solid(WHITE)]
  })

  const typoFrame = store.createShape('FRAME', 700, 660, 300, 120)
  graph.updateNode(typoFrame, {
    name: 'Typography',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
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
    { text: 'CAPTION · OVERLINE', size: 10, weight: 500 }
  ]
  for (const t of typoItems) {
    const tid = store.createShape('TEXT', 0, 0, 260, t.size + 4, typoFrame)
    graph.updateNode(tid, {
      name: t.text.split(' ')[0],
      text: t.text,
      fontSize: t.size,
      fontWeight: t.weight,
      fills: [solid(BLACK)]
    })
  }

  const shapes = [
    {
      type: 'ELLIPSE' as const,
      x: 1060,
      fill: gradient([
        { color: PURPLE, position: 0 },
        { color: BLUE, position: 1 }
      ])
    },
    {
      type: 'RECTANGLE' as const,
      x: 1160,
      fill: gradient([
        { color: GREEN, position: 0 },
        { color: TEAL, position: 1 }
      ])
    },
    {
      type: 'ELLIPSE' as const,
      x: 1260,
      fill: gradient([
        { color: ORANGE, position: 0 },
        { color: RED, position: 1 }
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
