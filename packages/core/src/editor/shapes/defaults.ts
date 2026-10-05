import type { Fill, NodeType, SceneNode, Stroke } from '@open-pencil/scene-graph'

import {
  BLACK,
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  DEFAULT_STROKE_WEIGHT,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE
} from '#core/constants'

const BLACK_FILL: Fill = { type: 'SOLID', color: BLACK, opacity: 1, visible: true }
const BLACK_STROKE: Stroke = { ...BLACK_FILL, weight: DEFAULT_STROKE_WEIGHT, align: 'CENTER' }

/**
 * What a new layer starts with, as Figma gives it from a drawing tool and from the plugin API:
 * frames and components white (frames clipping their content), shapes light grey, lines and
 * vectors a black 1 px stroke, and text black.
 */
export function newLayerDefaults(type: NodeType): Partial<SceneNode> {
  switch (type) {
    case 'FRAME':
      return { fills: [{ ...DEFAULT_FRAME_FILL }], clipsContent: true }
    case 'COMPONENT':
      return { fills: [{ ...DEFAULT_FRAME_FILL }] }
    case 'SECTION':
      return {
        fills: [{ ...SECTION_DEFAULT_FILL }],
        strokes: [{ ...SECTION_DEFAULT_STROKE }],
        cornerRadius: 5
      }
    case 'RECTANGLE':
    case 'ELLIPSE':
      return { fills: [{ ...DEFAULT_SHAPE_FILL }] }
    case 'POLYGON':
      return { fills: [{ ...DEFAULT_SHAPE_FILL }], pointCount: 3 }
    case 'STAR':
      return { fills: [{ ...DEFAULT_SHAPE_FILL }], pointCount: 5, starInnerRadius: 0.38 }
    case 'LINE':
    case 'VECTOR':
      return { fills: [], strokes: [{ ...BLACK_STROKE }] }
    case 'TEXT':
      return { fills: [{ ...BLACK_FILL }] }
    default:
      return {}
  }
}
