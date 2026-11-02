import type { Fill, NodeType, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { DEFAULT_STROKE_WEIGHT } from '@open-pencil/scene-graph/constants'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'
import { figJamColor, figJamPairedStroke } from '@open-pencil/scene-graph/figjam'
import { SHAPE_WITH_TEXT_SIZE } from '@open-pencil/scene-graph/generated'

import {
  BLACK,
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  SECTION_CORNER_RADIUS,
  SECTION_DEFAULT_FILLS,
  SECTION_DEFAULT_STROKE,
  type InterfaceTheme
} from '#core/constants'
import type { EditorState } from '#core/editor/types'

/** The theme a document's new layers are painted for: a FigJam board is always light. */
export function layerTheme(
  state: Pick<EditorState, 'documentKind' | 'theme'>
): InterfaceTheme | undefined {
  return state.documentKind === 'board' ? 'light' : state.theme
}

const BLACK_FILL: Fill = { type: 'SOLID', color: BLACK, opacity: 1, visible: true }
const BLACK_STROKE: Stroke = { ...BLACK_FILL, weight: DEFAULT_STROKE_WEIGHT, align: 'CENTER' }
/** FigJam's shape tool paints a new shape in its palette's white, with white's 4 px outline. */
const SHAPE_WITH_TEXT_FILL: Fill = {
  type: 'SOLID',
  color: figJamColor('white'),
  opacity: 1,
  visible: true
}
const SHAPE_WITH_TEXT_STROKE: Stroke = {
  type: 'SOLID',
  color: figJamPairedStroke('white', 'fill'),
  opacity: 1,
  visible: true,
  weight: 4,
  align: 'CENTER'
}

/**
 * What a new layer starts with, as Figma gives it from a drawing tool and from the plugin API:
 * frames and components white (frames clipping their content), shapes light grey, lines and
 * vectors a black 1 px stroke, text black, sections filled for the interface `theme`, and shapes
 * with text as FigJam's shape tool places them.
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
    case 'SHAPE_WITH_TEXT':
      return {
        fills: copyFills([SHAPE_WITH_TEXT_FILL]),
        strokes: copyStrokes([SHAPE_WITH_TEXT_STROKE]),
        width: SHAPE_WITH_TEXT_SIZE,
        height: SHAPE_WITH_TEXT_SIZE,
        shapeWithTextType: 'SQUARE'
      }
    default:
      return {}
  }
}
