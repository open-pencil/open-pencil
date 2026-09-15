import type { SceneGraph, SceneNode, Vector } from '@open-pencil/scene-graph'

type FixtureNode = Pick<
  SceneNode,
  'type' | 'name' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'
>

export function nestedGeometryData(flipX = false, flipY = false) {
  const section: FixtureNode = {
    type: 'SECTION',
    name: 'Rotated section',
    x: 140,
    y: 140,
    width: 500,
    height: 350,
    rotation: 25,
    flipX,
    flipY: false
  }
  const frame: FixtureNode = {
    type: 'FRAME',
    name: 'Nested frame',
    x: 100,
    y: 100,
    width: 220,
    height: 120,
    rotation: -55,
    flipX: false,
    flipY
  }
  return { section, frame }
}

export function nestedGeometryFixture(
  graph: SceneGraph,
  parentId: string,
  flipX = false,
  flipY = false
) {
  const data = nestedGeometryData(flipX, flipY)
  const section = graph.createNode('SECTION', parentId, data.section)
  const frame = graph.createNode('FRAME', section.id, data.frame)
  return { section, frame }
}

/** Independent scalar oracle, not the production matrix/geometry implementation. */
export function applyFixtureTransform(node: FixtureNode, point: Vector): Vector {
  const pivotX = node.type === 'LINE' ? 0 : node.width / 2
  const pivotY = node.type === 'LINE' ? 0 : node.height / 2
  const x = point.x - pivotX
  const y = point.y - pivotY
  const angle = (node.rotation * Math.PI) / 180
  const rotatedX = pivotX + x * Math.cos(angle) - y * Math.sin(angle)
  const rotatedY = pivotY + x * Math.sin(angle) + y * Math.cos(angle)
  return {
    x: node.x + (node.flipX ? node.width - rotatedX : rotatedX),
    y: node.y + (node.flipY ? node.height - rotatedY : rotatedY)
  }
}
