import type { FlowShape } from '@open-pencil/mermaid'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

/** How a FigJam shape stands for a Mermaid one: its kind, and whether it is drawn upside down. */
export interface FigJamShape {
  type: ShapeWithTextType
  flipY?: boolean
  /** Whether Mermaid draws it as wide as it is tall, as circles. */
  round?: boolean
}

const SQUARE: FigJamShape = { type: 'SQUARE' }
const ROUNDED: FigJamShape = { type: 'ROUNDED_RECTANGLE' }
const CIRCLE: FigJamShape = { type: 'ELLIPSE', round: true }
const DATABASE: FigJamShape = { type: 'ENG_DATABASE' }
const DOCUMENT: FigJamShape = { type: 'DOCUMENT_SINGLE' }

/**
 * The FigJam shape each Mermaid shape becomes: the same figure where FigJam has one, else the
 * nearest, and a plain rectangle for figures FigJam has nothing like.
 */
const FIGJAM_SHAPES: Record<FlowShape, FigJamShape> = {
  rect: SQUARE,
  rounded: ROUNDED,
  stadium: ROUNDED,
  'fr-rect': { type: 'PREDEFINED_PROCESS' },
  cyl: DATABASE,
  'lin-cyl': DATABASE,
  datastore: DATABASE,
  'h-cyl': { type: 'ENG_QUEUE' },
  folder: { type: 'ENG_FOLDER' },
  circle: CIRCLE,
  'dbl-circ': CIRCLE,
  'sm-circ': CIRCLE,
  'fr-circ': CIRCLE,
  'f-circ': CIRCLE,
  'cross-circ': { type: 'SUMMING_JUNCTION', round: true },
  ellipse: { type: 'ELLIPSE' },
  diam: { type: 'DIAMOND' },
  hex: { type: 'HEXAGON' },
  'lean-r': { type: 'PARALLELOGRAM_RIGHT' },
  'lean-l': { type: 'PARALLELOGRAM_LEFT' },
  'trap-b': { type: 'TRAPEZOID' },
  'trap-t': { type: 'TRAPEZOID', flipY: true },
  tri: { type: 'TRIANGLE_UP' },
  'flip-tri': { type: 'TRIANGLE_DOWN' },
  doc: DOCUMENT,
  'lin-doc': DOCUMENT,
  'tag-doc': DOCUMENT,
  docs: { type: 'DOCUMENT_MULTIPLE' },
  'sl-rect': { type: 'MANUAL_INPUT' },
  'win-pane': { type: 'INTERNAL_STORAGE' },
  'notch-pent': { type: 'PENTAGON' },
  delay: ROUNDED,
  odd: SQUARE,
  flag: SQUARE,
  text: SQUARE,
  'notch-rect': SQUARE,
  'lin-rect': SQUARE,
  'div-rect': SQUARE,
  'st-rect': SQUARE,
  'tag-rect': SQUARE,
  'bow-rect': SQUARE,
  'curv-trap': SQUARE,
  fork: SQUARE,
  hourglass: SQUARE,
  brace: SQUARE,
  'brace-r': SQUARE,
  braces: SQUARE,
  bolt: SQUARE,
  bang: SQUARE,
  cloud: SQUARE,
  bucket: SQUARE,
  console: SQUARE,
  browser: SQUARE,
  person: SQUARE
}

export function figJamShape(shape: FlowShape): FigJamShape {
  return FIGJAM_SHAPES[shape]
}
