/**
 * FigJam's shape-with-text kinds, as Figma names them in `.fig` files and in its plugin API
 * (`ShapeWithTextNode.shapeType`). Each kind is drawn from its size here, so rendering, hit
 * testing, export and connectors share one outline.
 */
export const SHAPE_WITH_TEXT_TYPES = [
  'SQUARE',
  'ELLIPSE',
  'DIAMOND',
  'TRIANGLE_UP',
  'TRIANGLE_DOWN',
  'ROUNDED_RECTANGLE',
  'PARALLELOGRAM_RIGHT',
  'PARALLELOGRAM_LEFT',
  'ENG_DATABASE',
  'ENG_QUEUE',
  'ENG_FILE',
  'ENG_FOLDER',
  'TRAPEZOID',
  'PREDEFINED_PROCESS',
  'SHIELD',
  'DOCUMENT_SINGLE',
  'DOCUMENT_MULTIPLE',
  'MANUAL_INPUT',
  'HEXAGON',
  'CHEVRON',
  'PENTAGON',
  'OCTAGON',
  'STAR',
  'PLUS',
  'ARROW_LEFT',
  'ARROW_RIGHT',
  'SUMMING_JUNCTION',
  'OR',
  'SPEECH_BUBBLE',
  'INTERNAL_STORAGE'
] as const

export type ShapeWithTextType = (typeof SHAPE_WITH_TEXT_TYPES)[number]

const KNOWN = new Set<string>(SHAPE_WITH_TEXT_TYPES)

export function isShapeWithTextType(value: unknown): value is ShapeWithTextType {
  return typeof value === 'string' && KNOWN.has(value)
}

/**
 * The kinds as FigJam's Shapes panel offers them, in its order: Basic, then Flowchart. Together
 * they are every kind.
 */
export const SHAPE_WITH_TEXT_GROUPS = {
  basic: [
    'SQUARE',
    'ELLIPSE',
    'DIAMOND',
    'TRIANGLE_UP',
    'TRIANGLE_DOWN',
    'ROUNDED_RECTANGLE',
    'PENTAGON',
    'OCTAGON',
    'PLUS',
    'ARROW_LEFT',
    'ARROW_RIGHT',
    'CHEVRON',
    'STAR',
    'SPEECH_BUBBLE'
  ],
  flowchart: [
    'PARALLELOGRAM_RIGHT',
    'PARALLELOGRAM_LEFT',
    'ENG_DATABASE',
    'ENG_QUEUE',
    'ENG_FILE',
    'ENG_FOLDER',
    'DOCUMENT_SINGLE',
    'DOCUMENT_MULTIPLE',
    'PREDEFINED_PROCESS',
    'SHIELD',
    'TRAPEZOID',
    'MANUAL_INPUT',
    'HEXAGON',
    'INTERNAL_STORAGE',
    'OR',
    'SUMMING_JUNCTION'
  ]
} as const satisfies Record<string, readonly ShapeWithTextType[]>
