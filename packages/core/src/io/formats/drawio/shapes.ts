import type { DrawIOStyle } from '@open-pencil/drawio'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

/** What a draw.io vertex becomes: a FigJam shape, text, a section around its cells, or a group. */
export type VertexKind =
  /** A FigJam shape, turned clockwise by `rotation` degrees about its centre. */
  | { type: 'SHAPE_WITH_TEXT'; shape: ShapeWithTextType; rotation: number; stencil: boolean }
  | { type: 'TEXT' }
  | { type: 'SECTION' }
  | { type: 'GROUP' }

/**
 * draw.io shapes, by their `shape` value or stylesheet name, and the FigJam shapes with text that
 * draw them. Flowchart stencils map to the FigJam flowchart shape of the same meaning.
 */
const SHAPES = new Map<string, ShapeWithTextType>([
  ['rectangle', 'SQUARE'],
  ['label', 'SQUARE'],
  ['ellipse', 'ELLIPSE'],
  ['doubleEllipse', 'ELLIPSE'],
  ['rhombus', 'DIAMOND'],
  ['triangle', 'TRIANGLE_UP'],
  ['parallelogram', 'PARALLELOGRAM_RIGHT'],
  ['trapezoid', 'TRAPEZOID'],
  ['hexagon', 'HEXAGON'],
  ['cylinder', 'ENG_DATABASE'],
  ['cylinder3', 'ENG_DATABASE'],
  ['datastore', 'ENG_DATABASE'],
  ['document', 'DOCUMENT_SINGLE'],
  ['process', 'PREDEFINED_PROCESS'],
  ['manualInput', 'MANUAL_INPUT'],
  ['internalStorage', 'INTERNAL_STORAGE'],
  ['step', 'CHEVRON'],
  ['note', 'ENG_FILE'],
  ['folder', 'ENG_FOLDER'],
  ['cross', 'PLUS'],
  ['singleArrow', 'ARROW_RIGHT'],
  ['callout', 'SPEECH_BUBBLE'],
  ['sumEllipse', 'SUMMING_JUNCTION'],
  ['orEllipse', 'OR'],
  ['mxgraph.flowchart.process', 'SQUARE'],
  ['mxgraph.flowchart.decision', 'DIAMOND'],
  ['mxgraph.flowchart.terminator', 'ROUNDED_RECTANGLE'],
  ['mxgraph.flowchart.start_1', 'ELLIPSE'],
  ['mxgraph.flowchart.start_2', 'ELLIPSE'],
  ['mxgraph.flowchart.on-page_reference', 'ELLIPSE'],
  ['mxgraph.flowchart.data', 'PARALLELOGRAM_RIGHT'],
  ['mxgraph.flowchart.database', 'ENG_DATABASE'],
  ['mxgraph.flowchart.stored_data', 'ENG_DATABASE'],
  ['mxgraph.flowchart.direct_data', 'ENG_QUEUE'],
  ['mxgraph.flowchart.document', 'DOCUMENT_SINGLE'],
  ['mxgraph.flowchart.multi-document', 'DOCUMENT_MULTIPLE'],
  ['mxgraph.flowchart.predefined_process', 'PREDEFINED_PROCESS'],
  ['mxgraph.flowchart.manual_input', 'MANUAL_INPUT'],
  ['mxgraph.flowchart.internal_storage', 'INTERNAL_STORAGE'],
  ['mxgraph.flowchart.summing_function', 'SUMMING_JUNCTION'],
  ['mxgraph.flowchart.or', 'OR'],
  ['mxgraph.flowchart.extract_or_measurement', 'TRIANGLE_UP'],
  ['mxgraph.flowchart.merge_or_storage', 'TRIANGLE_DOWN'],
  ['mxgraph.basic.pentagon', 'PENTAGON'],
  ['mxgraph.basic.octagon2', 'OCTAGON'],
  ['mxgraph.basic.star', 'STAR'],
  ['mxgraph.basic.plus', 'PLUS'],
  ['mxgraph.basic.rectCallout', 'SPEECH_BUBBLE'],
  ['mxgraph.basic.oval_callout', 'SPEECH_BUBBLE']
])

/** Stylesheet names that pick a shape, as `ellipse` in `ellipse;whiteSpace=wrap;` does. */
const SHAPE_NAMES = new Set([...SHAPES.keys(), 'text', 'swimlane', 'group', 'image'])

/** The shape a style draws: its `shape`, else the stylesheet style it names, else a rectangle. */
export function shapeName(style: DrawIOStyle): string {
  return style.values.shape ?? style.names.find((name) => SHAPE_NAMES.has(name)) ?? 'rectangle'
}

/** Which way `direction` points, in degrees anticlockwise from pointing right. */
const DIRECTION_TURN = new Map([
  ['east', 0],
  ['north', 90],
  ['west', 180],
  ['south', -90]
])

/**
 * What a vertex becomes. Text stays text; a swimlane, or a vertex its style makes a container,
 * becomes a section holding its cells; a group stays a group. A shape draw.io turns by
 * `direction` keeps its turn. Any other shape, a stencil FigJam has no shape for among them,
 * becomes a rectangle, named after the stencil so it can be found.
 */
export function vertexKind(style: DrawIOStyle, hasChildren: boolean): VertexKind {
  const name = shapeName(style)
  if (name === 'text') return { type: 'TEXT' }
  if (name === 'swimlane' || (hasChildren && style.values.container === '1')) {
    return { type: 'SECTION' }
  }
  if (name === 'group' || (hasChildren && !SHAPES.has(name))) return { type: 'GROUP' }
  let shape = SHAPES.get(name) ?? 'SQUARE'
  const direction = style.values.direction ?? 'east'
  let rotation = 0
  if (shape === 'TRIANGLE_UP' && name === 'triangle') {
    // draw.io's triangle points right; FigJam's points up and turns, clockwise for a positive
    // rotation, to point elsewhere.
    rotation = 90 - (DIRECTION_TURN.get(direction) ?? 0)
    if (rotation === 180) {
      shape = 'TRIANGLE_DOWN'
      rotation = 0
    }
  } else if (shape === 'ARROW_RIGHT' && direction === 'west') shape = 'ARROW_LEFT'
  else if (shape === 'PARALLELOGRAM_RIGHT' && style.values.flipH === '1') {
    shape = 'PARALLELOGRAM_LEFT'
  } else if (shape === 'SQUARE' && style.values.rounded === '1') shape = 'ROUNDED_RECTANGLE'
  return { type: 'SHAPE_WITH_TEXT', shape, rotation, stencil: !SHAPES.has(name) }
}

/**
 * The draw.io style that draws each FigJam shape, the other way round: built-in shapes where
 * draw.io has one, its flowchart and basic stencils otherwise. A shield, which draw.io has no
 * shape for, goes as a rectangle.
 */
const DRAWIO_SHAPES: Record<ShapeWithTextType, Record<string, string>> = {
  SQUARE: {},
  ROUNDED_RECTANGLE: { rounded: '1' },
  ELLIPSE: { shape: 'ellipse', perimeter: 'ellipsePerimeter' },
  DIAMOND: { shape: 'rhombus', perimeter: 'rhombusPerimeter' },
  TRIANGLE_UP: { shape: 'triangle', direction: 'north', perimeter: 'trianglePerimeter' },
  TRIANGLE_DOWN: { shape: 'triangle', direction: 'south', perimeter: 'trianglePerimeter' },
  PARALLELOGRAM_RIGHT: { shape: 'parallelogram', perimeter: 'parallelogramPerimeter' },
  PARALLELOGRAM_LEFT: { shape: 'parallelogram', flipH: '1', perimeter: 'parallelogramPerimeter' },
  ENG_DATABASE: { shape: 'cylinder3' },
  ENG_QUEUE: { shape: 'mxgraph.flowchart.direct_data' },
  ENG_FILE: { shape: 'note' },
  ENG_FOLDER: { shape: 'folder' },
  TRAPEZOID: { shape: 'trapezoid', perimeter: 'trapezoidPerimeter' },
  PREDEFINED_PROCESS: { shape: 'process' },
  SHIELD: {},
  DOCUMENT_SINGLE: { shape: 'document' },
  DOCUMENT_MULTIPLE: { shape: 'mxgraph.flowchart.multi-document' },
  MANUAL_INPUT: { shape: 'manualInput' },
  HEXAGON: { shape: 'hexagon', perimeter: 'hexagonPerimeter2' },
  CHEVRON: { shape: 'step' },
  PENTAGON: { shape: 'mxgraph.basic.pentagon' },
  OCTAGON: { shape: 'mxgraph.basic.octagon2' },
  STAR: { shape: 'mxgraph.basic.star' },
  PLUS: { shape: 'cross' },
  ARROW_LEFT: { shape: 'singleArrow', direction: 'west' },
  ARROW_RIGHT: { shape: 'singleArrow' },
  SUMMING_JUNCTION: { shape: 'sumEllipse', perimeter: 'ellipsePerimeter' },
  OR: { shape: 'orEllipse', perimeter: 'ellipsePerimeter' },
  SPEECH_BUBBLE: { shape: 'callout' },
  INTERNAL_STORAGE: { shape: 'internalStorage' }
}

export function drawioShapeValues(shape: ShapeWithTextType): Record<string, string> {
  return { ...DRAWIO_SHAPES[shape] }
}
