/**
 * Mermaid's flowchart shapes by their short names, with the other names `@{ shape: … }` accepts
 * for each, from `rendering-util/rendering-elements/shapes.ts` in the pinned Mermaid release
 * (MIT, Copyright (c) 2014 - 2022 Knut Sveidqvist). `bun run generate:mermaid-sources --check`
 * reports when a newer release changes that file.
 */
const SHAPE_NAMES = {
  rect: ['proc', 'process', 'rectangle', 'squareRect'],
  rounded: ['event', 'roundedRect'],
  stadium: ['terminal', 'pill'],
  'fr-rect': ['subprocess', 'subproc', 'framed-rectangle', 'subroutine'],
  cyl: ['db', 'database', 'cylinder'],
  datastore: ['data-store'],
  folder: ['directory'],
  bucket: [],
  console: [],
  browser: [],
  person: [],
  circle: ['circ'],
  bang: [],
  cloud: [],
  diam: ['decision', 'diamond', 'question'],
  hex: ['hexagon', 'prepare'],
  'lean-r': ['lean-right', 'in-out', 'lean_right'],
  'lean-l': ['lean-left', 'out-in', 'lean_left'],
  'trap-b': ['priority', 'trapezoid-bottom', 'trapezoid'],
  'trap-t': ['manual', 'trapezoid-top', 'inv-trapezoid', 'inv_trapezoid'],
  'dbl-circ': ['double-circle', 'doublecircle'],
  text: [],
  'notch-rect': ['card', 'notched-rectangle'],
  'lin-rect': ['lined-rectangle', 'lined-process', 'lin-proc', 'shaded-process'],
  'sm-circ': ['start', 'small-circle', 'stateStart'],
  'fr-circ': ['stop', 'framed-circle', 'stateEnd'],
  fork: ['join', 'forkJoin'],
  hourglass: ['collate'],
  brace: ['comment', 'brace-l'],
  'brace-r': [],
  braces: [],
  bolt: ['com-link', 'lightning-bolt'],
  doc: ['document'],
  delay: ['half-rounded-rectangle'],
  'h-cyl': ['das', 'horizontal-cylinder'],
  'lin-cyl': ['disk', 'lined-cylinder'],
  'curv-trap': ['curved-trapezoid', 'display'],
  'div-rect': ['div-proc', 'divided-rectangle', 'divided-process'],
  tri: ['extract', 'triangle'],
  'win-pane': ['internal-storage', 'window-pane'],
  'f-circ': ['junction', 'filled-circle'],
  'notch-pent': ['loop-limit', 'notched-pentagon'],
  'flip-tri': ['manual-file', 'flipped-triangle'],
  'sl-rect': ['manual-input', 'sloped-rectangle'],
  docs: ['documents', 'st-doc', 'stacked-document'],
  'st-rect': ['procs', 'processes', 'stacked-rectangle'],
  'bow-rect': ['stored-data', 'bow-tie-rectangle'],
  'cross-circ': ['summary', 'crossed-circle'],
  'tag-doc': ['tagged-document'],
  'tag-rect': ['tagged-rectangle', 'tag-proc', 'tagged-process'],
  flag: ['paper-tape'],
  odd: ['rect_left_inv_arrow'],
  'lin-doc': ['lined-document']
} as const satisfies Record<string, readonly string[]>

/**
 * A flowchart node's shape, by Mermaid's short name for it, or `ellipse` for `A(-text-)`, which
 * Mermaid's grammar reads but its renderer refuses (mermaid-js/mermaid#5976).
 */
export type FlowShape = keyof typeof SHAPE_NAMES | 'ellipse'

const SHAPE_BY_NAME = new Map<string, FlowShape>(
  Object.entries(SHAPE_NAMES).flatMap(([shape, aliases]) =>
    [shape, ...aliases].map((name) => [name, shape as FlowShape] as const)
  )
)

/** The shape a name from `@{ shape: … }` stands for, or null for one Mermaid does not know. */
export function shapeNamed(name: string): FlowShape | null {
  return SHAPE_BY_NAME.get(name) ?? null
}

/**
 * The shape each bracket form stands for, by the vertex type Mermaid's grammar gives it: `[ ]` a
 * rectangle, `( )` a rounded one, `([ ])` a stadium, and so on.
 */
const BRACKET_SHAPES: Record<string, FlowShape> = {
  square: 'rect',
  rect: 'rect',
  round: 'rounded',
  ellipse: 'ellipse',
  stadium: 'stadium',
  subroutine: 'fr-rect',
  cylinder: 'cyl',
  circle: 'circle',
  doublecircle: 'dbl-circ',
  diamond: 'diam',
  hexagon: 'hex',
  odd: 'odd',
  trapezoid: 'trap-b',
  inv_trapezoid: 'trap-t',
  lean_right: 'lean-r',
  lean_left: 'lean-l'
}

export function bracketShape(vertexType: string): FlowShape {
  return BRACKET_SHAPES[vertexType] ?? 'rect'
}
