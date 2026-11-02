import type { SceneGraph } from '@open-pencil/scene-graph'

const LINEAR_MODES = ['LINEAR_BURN', 'LINEAR_DODGE'] as const

const solid = (r: number, g: number, b: number) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity: 1,
  visible: true
})

function addBackdrops(graph: SceneGraph, pageId: string): void {
  const colors = [solid(0.2, 0.45, 0.85), solid(0.55, 0.55, 0.55), solid(0.9, 0.6, 0.2)]
  for (const [index, fill] of colors.entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Backdrop ${index}`,
      x: 60 + index * 160,
      y: 60,
      width: 160,
      height: 320,
      fills: [fill]
    })
  }
}

export function createLinearBlendScene(graph: SceneGraph, pageId: string): void {
  addBackdrops(graph, pageId)
  const paint = solid(0.5, 0.35, 0.6)
  for (const [row, blendMode] of LINEAR_MODES.entries()) {
    const y = 90 + row * 150
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} layer`,
      x: 80,
      y,
      width: 420,
      height: 36,
      blendMode,
      fills: [paint]
    })
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} fill`,
      x: 80,
      y: y + 46,
      width: 420,
      height: 36,
      fills: [{ ...paint, blendMode }]
    })
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} stroke`,
      x: 92,
      y: y + 98,
      width: 396,
      height: 12,
      fills: [],
      strokes: [{ ...paint, weight: 12, align: 'OUTSIDE', blendMode }]
    })
    // A thin bar casting a blended shadow below it into the gap before the next row.
    graph.createNode('RECTANGLE', pageId, {
      name: `${blendMode} shadow`,
      x: 80,
      y: y + 124,
      width: 420,
      height: 6,
      fills: [paint],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { ...paint.color },
          offset: { x: 0, y: 10 },
          radius: 0,
          spread: 0,
          visible: true,
          blendMode,
          showShadowBehindNode: false
        }
      ]
    })
  }
}
