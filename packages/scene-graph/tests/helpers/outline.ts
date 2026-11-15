import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { hitsShape } from '@open-pencil/scene-graph/outline'

// Measured in Figma 126.6.12 with real clicks (scratch/pr-oracle/stroke-hit*.ts): a click selects a
// shape inside the area a showing fill covers or on the band a showing stroke draws, either grown
// by 3.5 screen pixels, and a shape whose paints show nothing is never selected by a click.
export const PAD = 3.5

export const fill = (overrides: Partial<Fill> = {}): Fill => ({
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  ...overrides
})

export const stroke = (
  weight: number,
  align: Stroke['align'] = 'CENTER',
  overrides: Partial<Stroke> = {}
): Stroke => ({
  ...fill({ color: { r: 0, g: 0, b: 0, a: 1 } }),
  weight,
  align,
  ...overrides
})

/** A Figma geometry blob for straight contours, each closed. */
export function contoursBlob(contours: Array<Array<[number, number]>>): Uint8Array {
  const size = contours.reduce((sum, contour) => sum + contour.length * 9 + 1, 0)
  const blob = new Uint8Array(size)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const contour of contours) {
    for (const [index, [x, y]] of contour.entries()) {
      blob[offset++] = index === 0 ? 1 : 2
      view.setFloat32(offset, x, true)
      view.setFloat32(offset + 4, y, true)
      offset += 8
    }
    blob[offset++] = 0
  }
  return blob
}

/** An open path along the x axis from 0 to `length`. */
export function straight(length: number) {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: length, y: 0 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

/** A page to add layers to, and a click test at the click pad. */
export function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const add = (type: SceneNode['type'], props: Partial<SceneNode>) =>
    graph.createNode(type, page, props)
  const hits = (node: SceneNode, x: number, y: number, pad = PAD) =>
    hitsShape(graph, node, x, y, pad)
  return { graph, add, hits }
}

/** An open curve from (0, 75) to (300, 75) bowing up to its apex at (150, 0). */
export function curve(add: ReturnType<typeof setup>['add'], strokes: Stroke[], fills: Fill[] = []) {
  return add('VECTOR', {
    width: 300,
    height: 75,
    fills,
    strokes,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 75 },
        { x: 300, y: 75 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 100, y: -100 }, tangentEnd: { x: -100, y: -100 } }
      ],
      regions: []
    }
  })
}
