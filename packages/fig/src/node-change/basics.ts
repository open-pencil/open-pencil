import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import type { Matrix } from '@open-pencil/scene-graph/primitives'

/** The record types Figma names otherwise than the Scene Graph, or keeps as a plain frame. */
const FIGMA_TYPES: Readonly<Partial<Record<SceneNode['type'], string>>> = {
  POLYGON: 'REGULAR_POLYGON',
  GROUP: 'FRAME',
  COMPONENT: 'SYMBOL',
  COMPONENT_SET: 'FRAME',
  CANVAS: 'RECTANGLE'
}

export function mapToFigmaType(type: SceneNode['type']): string {
  return FIGMA_TYPES[type] ?? type
}

/** Figma's matrix for a layer is the Scene Graph's own placement, pivot and reflections included. */
export function computeExportTransform(node: SceneNode): Matrix {
  const [m00, m01, m02, m10, m11, m12] = getNodeLocalMatrix(node)
  return { m00, m01, m02, m10, m11, m12 }
}
