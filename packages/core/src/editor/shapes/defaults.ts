import type { Fill, NodeType, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { DEFAULT_STROKE_WEIGHT } from '@open-pencil/scene-graph'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'

import {
  BLACK,
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  SECTION_CORNER_RADIUS,
  SECTION_DEFAULT_FILLS,
  SECTION_DEFAULT_STROKE,
  type InterfaceTheme
} from '#core/constants'

const BLACK_FILL: Fill = { type: 'SOLID', color: BLACK, opacity: 1, visible: true }
const BLACK_STROKE: Stroke = { ...BLACK_FILL, weight: DEFAULT_STROKE_WEIGHT, align: 'CENTER' }

/**
 * What a new layer starts with, as Figma gives it from a drawing tool and from the plugin API:
 * frames and components white (frames clipping their content), shapes light grey, lines and
 * vectors a black 1 px stroke, text black, and sections filled for the interface `theme`.
 */
export function newLayerDefaults(
  type: NodeType,
  theme: InterfaceTheme = 'light'
): Partial<SceneNode> {
  switch (type) {
    case 'FRAME':
      return { fills: copyFills([DEFAULT_FRAME_FILL]), clipsContent: true }
    case 'COMPONENT':
      return { fills: copyFills([DEFAULT_FRAME_FILL]) }
    case 'SECTION':
      return {
        fills: copyFills([SECTION_DEFAULT_FILLS[theme]]),
        strokes: copyStrokes([SECTION_DEFAULT_STROKE]),
        cornerRadius: SECTION_CORNER_RADIUS
      }
    case 'RECTANGLE':
    case 'ELLIPSE':
    case 'STAR':
      return { fills: copyFills([DEFAULT_SHAPE_FILL]) }
    case 'POLYGON':
      return { fills: copyFills([DEFAULT_SHAPE_FILL]), pointCount: 3 }
    case 'LINE':
    case 'VECTOR':
      return { fills: [], strokes: copyStrokes([BLACK_STROKE]) }
    case 'TEXT':
      return { fills: copyFills([BLACK_FILL]) }
    default:
      return {}
  }
}
