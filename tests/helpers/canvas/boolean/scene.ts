import type { SceneGraph } from '@open-pencil/scene-graph'

const STROKE_VARIANTS = [
  { align: 'INSIDE', cornerRadius: 0 },
  { align: 'CENTER', cornerRadius: 0 },
  { align: 'OUTSIDE', cornerRadius: 0 },
  { align: 'OUTSIDE', cornerRadius: 24 }
] as const

export function createBooleanStrokeAlignmentScene(graph: SceneGraph, pageId: string): void {
  for (const [index, { align, cornerRadius }] of STROKE_VARIANTS.entries()) {
    const group = graph.createNode('BOOLEAN_OPERATION', pageId, {
      name: `${align} ${cornerRadius} boolean`,
      x: 72 + index * 152,
      y: 92,
      width: 124,
      height: 104,
      booleanOperation: 'UNION',
      cornerRadius,
      fills: [
        { type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96, a: 1 }, visible: true, opacity: 1 }
      ],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0.96, g: 0.35, b: 0.35, a: 1 },
          weight: 10,
          visible: true,
          opacity: 0.6,
          align
        }
      ]
    })
    graph.createNode('RECTANGLE', group.id, {
      name: `${align} rectangle`,
      x: 0,
      y: 18,
      width: 82,
      height: 70
    })
    graph.createNode('RECTANGLE', group.id, {
      name: `${align} square`,
      x: 42,
      y: 0,
      width: 82,
      height: 104
    })
  }
}
