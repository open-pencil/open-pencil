import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import type { Matrix } from '@open-pencil/scene-graph/primitives'

export function mapToFigmaType(type: SceneNode['type']): string {
  switch (type) {
    case 'FRAME':
      return 'FRAME'
    case 'RECTANGLE':
      return 'RECTANGLE'
    case 'ROUNDED_RECTANGLE':
      return 'ROUNDED_RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'POLYGON':
      return 'REGULAR_POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'BOOLEAN_OPERATION':
      return 'BOOLEAN_OPERATION'
    case 'GROUP':
      return 'FRAME'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'SYMBOL'
    case 'COMPONENT_SET':
      return 'FRAME'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    case 'STICKY':
      return 'STICKY'
    default:
      return 'RECTANGLE'
  }
}

/** Figma's matrix for a layer is the Scene Graph's own placement, pivot and reflections included. */
export function computeExportTransform(node: SceneNode): Matrix {
  const [m00, m01, m02, m10, m11, m12] = getNodeLocalMatrix(node)
  return { m00, m01, m02, m10, m11, m12 }
}
