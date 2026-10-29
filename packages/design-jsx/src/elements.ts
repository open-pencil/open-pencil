import { difference } from 'es-toolkit/array'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { REKA_ELEMENTS, rekaRole } from './behaviours'
import { connectorBindingTarget, renderConnectorNode } from './connectors'
import {
  DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES,
  DESIGN_JSX_SPAN_PROPERTY_NAMES,
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
  DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES
} from './definitions'
import {
  connectorPropsSchema,
  ownLayerPropsSchema,
  placedOwnLayerPropsSchema,
  shapeLayerPropsSchema,
  shapePropsSchema,
  stickyPropsSchema,
  type ElementPropsSchema
} from './schema'
import { renderShapeNode } from './shapes-with-text'
import { renderStickyNode } from './stickies'
import type { TreeNode } from './tree'

/** How an element that draws a layer of its own, such as a sticky note, renders it. */
export interface OwnLayerRenderer {
  /** The layer props it takes, made into fields as any layer's are. */
  layer: ElementPropsSchema
  render(graph: SceneGraph, tree: TreeNode, parentId: string, layer: Partial<SceneNode>): SceneNode
  /** The layer a variable binding of `field` goes on, when not the element's own. */
  bindingTarget?(graph: SceneGraph, node: SceneNode, field: string): string
}

/**
 * One design JSX element: what JSX names it, what it makes, the props it takes, and which layers
 * export writes as it. The renderer, the export, the prop checks, the streaming preview, and the
 * authoring reference all read this list rather than keeping their own.
 */
export type DesignJSXElementDefinition = {
  name: string
  /** The type its tree nodes carry, such as `frame`. */
  runtimeType: string
  description: string
  /** The layer a plain element makes; an element rendered its own way, such as `Icon`, has none. */
  nodeType?: NodeType
  /** The props it takes; every layer prop when left out. */
  props?: readonly string[]
  /** The props it takes and what each holds, for an element that reads them by this schema. */
  schema?: ElementPropsSchema
  /** How it draws its own layer, for an element that does. */
  ownLayer?: OwnLayerRenderer
  /** The layers export writes as this element. */
  writes?: readonly NodeType[]
}

function rekaDescription(namespace: string, part: string): string {
  const role = rekaRole(`${namespace}.${part}`)
  if (role?.role === 'root')
    return `A main component that behaves as Reka UI's ${namespace} ${part}.`
  if (role?.role === 'input') return `The text layer of a ${namespace}'s text property.`
  return `The ${namespace} ${part}, drawn by a slot of its component.`
}

/** A Reka UI element as the element list describes it. */
function rekaElementDefinitions(): DesignJSXElementDefinition[] {
  return Object.entries(REKA_ELEMENTS).flatMap(([namespace, parts]) =>
    Object.keys(parts).map((part) => {
      const type = `${namespace}.${part}`
      return { name: type, runtimeType: type, description: rekaDescription(namespace, part) }
    })
  )
}

export const DESIGN_JSX_ELEMENTS: DesignJSXElementDefinition[] = [
  {
    name: 'Frame',
    runtimeType: 'frame',
    description: 'A frame or auto-layout container.',
    nodeType: 'FRAME',
    // A set and an instance read back as frames: JSX cannot name what they come from.
    writes: ['FRAME', 'COMPONENT_SET', 'INSTANCE']
  },
  {
    name: 'Text',
    runtimeType: 'text',
    description: 'A text layer.',
    nodeType: 'TEXT',
    writes: ['TEXT']
  },
  {
    name: 'Span',
    runtimeType: 'text-span',
    description: 'Characters inside a Text, styled apart from the rest.',
    props: ['key', ...DESIGN_JSX_SPAN_PROPERTY_NAMES]
  },
  {
    name: 'Paragraph',
    runtimeType: 'text-paragraph',
    description: 'One paragraph of a Text, plain or a list item.',
    props: ['key', ...DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES]
  },
  {
    name: 'Rectangle',
    runtimeType: 'rectangle',
    description: 'A rectangle layer.',
    nodeType: 'RECTANGLE',
    writes: ['RECTANGLE', 'ROUNDED_RECTANGLE']
  },
  {
    name: 'Ellipse',
    runtimeType: 'ellipse',
    description: 'An ellipse layer.',
    nodeType: 'ELLIPSE',
    writes: ['ELLIPSE']
  },
  {
    name: 'Line',
    runtimeType: 'line',
    description: 'A line layer.',
    nodeType: 'LINE',
    writes: ['LINE']
  },
  {
    name: 'Star',
    runtimeType: 'star',
    description: 'A star layer.',
    nodeType: 'STAR',
    writes: ['STAR']
  },
  {
    name: 'Polygon',
    runtimeType: 'polygon',
    description: 'A polygon layer.',
    nodeType: 'POLYGON',
    writes: ['POLYGON']
  },
  {
    name: 'Vector',
    runtimeType: 'vector',
    description: 'A vector layer.',
    nodeType: 'VECTOR',
    writes: ['VECTOR']
  },
  {
    name: 'Group',
    runtimeType: 'group',
    description: 'A group of layers.',
    nodeType: 'GROUP',
    writes: ['GROUP']
  },
  {
    name: 'Section',
    runtimeType: 'section',
    description: 'A canvas section.',
    nodeType: 'SECTION',
    writes: ['SECTION']
  },
  {
    name: 'Component',
    runtimeType: 'component',
    description: 'A reusable component.',
    nodeType: 'COMPONENT',
    writes: ['COMPONENT']
  },
  {
    name: 'ComponentSet',
    runtimeType: 'component-set',
    description: 'A component variant set.',
    nodeType: 'COMPONENT_SET'
  },
  { name: 'Instance', runtimeType: 'instance', description: 'An instance of a component.' },
  { name: 'View', runtimeType: 'frame', description: 'An alias for Frame.', nodeType: 'FRAME' },
  {
    name: 'Rect',
    runtimeType: 'rectangle',
    description: 'An alias for Rectangle.',
    nodeType: 'RECTANGLE'
  },
  { name: 'Icon', runtimeType: 'icon', description: 'An Iconify icon.' },
  {
    name: 'Sticky',
    runtimeType: 'sticky',
    description: 'A FigJam sticky note; its text is the body.',
    schema: stickyPropsSchema,
    ownLayer: { layer: placedOwnLayerPropsSchema, render: renderStickyNode },
    writes: ['STICKY']
  },
  {
    name: 'Shape',
    runtimeType: 'shape',
    description: 'A FigJam shape with text; its text is the label.',
    schema: shapePropsSchema,
    ownLayer: { layer: shapeLayerPropsSchema, render: renderShapeNode },
    writes: ['SHAPE_WITH_TEXT']
  },
  {
    name: 'Connector',
    runtimeType: 'connector',
    description:
      'A FigJam connector between two layers of the same JSX, named by `from` and `to`, or points.',
    schema: connectorPropsSchema,
    ownLayer: {
      layer: ownLayerPropsSchema,
      render: renderConnectorNode,
      bindingTarget: connectorBindingTarget
    },
    writes: ['CONNECTOR']
  },
  ...rekaElementDefinitions()
]

/** Props an inline `<svg>` takes besides a layer's: its markup's view box and body. */
const SVG_PROPERTY_NAMES = ['viewBox', 'body'] as const

/**
 * Lowercase tags JSX also accepts, as HTML names them, with the layer each makes; they are
 * not written back.
 */
const INTRINSIC_ELEMENTS: Readonly<Record<string, NodeType | null>> = {
  componentset: 'COMPONENT_SET',
  div: 'FRAME',
  main: 'FRAME',
  header: 'FRAME',
  footer: 'FRAME',
  nav: 'FRAME',
  article: 'FRAME',
  aside: 'FRAME',
  span: 'TEXT',
  p: 'TEXT',
  h1: 'TEXT',
  h2: 'TEXT',
  h3: 'TEXT',
  h4: 'TEXT',
  h5: 'TEXT',
  h6: 'TEXT',
  // Inline SVG markup, which the artwork service draws.
  svg: null
}

/** Paragraph props describe a paragraph of a text, never a layer, unless a text sets them too. */
const LAYER_PROPS: ReadonlySet<string> = new Set<string>(
  difference(
    DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
    difference(DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES, DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES)
  )
)

const BY_RUNTIME_TYPE = new Map(
  DESIGN_JSX_ELEMENTS.map((element): [string, DesignJSXElementDefinition] => [
    element.runtimeType,
    element
  ]).reverse()
)

const PROPS_BY_RUNTIME_TYPE = new Map<string, ReadonlySet<string>>([
  ['svg', new Set([...LAYER_PROPS, ...SVG_PROPERTY_NAMES])],
  ...DESIGN_JSX_ELEMENTS.flatMap((element): [string, ReadonlySet<string>][] => {
    const props = element.schema ? Object.keys(element.schema.entries) : element.props
    return props ? [[element.runtimeType, new Set(props)]] : []
  })
])

const TAG_BY_NODE_TYPE = new Map(
  DESIGN_JSX_ELEMENTS.flatMap((element) =>
    (element.writes ?? []).map((type): [NodeType, string] => [type, element.name])
  )
)

/** The layer an element of `runtimeType` makes, for an element without its own renderer. */
export function elementNodeType(runtimeType: string): NodeType | undefined {
  return BY_RUNTIME_TYPE.get(runtimeType)?.nodeType ?? INTRINSIC_ELEMENTS[runtimeType] ?? undefined
}

/** The props an element of `runtimeType` takes. */
export function elementProps(runtimeType: string): ReadonlySet<string> {
  return PROPS_BY_RUNTIME_TYPE.get(runtimeType) ?? LAYER_PROPS
}

const BY_NAME = new Map(
  DESIGN_JSX_ELEMENTS.map((element): [string, DesignJSXElementDefinition] => [
    element.name,
    element
  ])
)

/**
 * The props an element written `<name>` takes, as the renderer checks them, for an editor that
 * checks them as they are typed; null for a name that is no element, and for an instance, which
 * also takes its component's properties by name.
 */
export function elementPropsByName(name: string): ReadonlySet<string> | null {
  const element = BY_NAME.get(name)
  if (!element) return Object.hasOwn(INTRINSIC_ELEMENTS, name) ? elementProps(name) : null
  return element.runtimeType === 'instance' ? null : elementProps(element.runtimeType)
}

/** The schema an element of `runtimeType` reads its props by, if it has one. */
export function elementSchema(runtimeType: string): ElementPropsSchema | undefined {
  return BY_RUNTIME_TYPE.get(runtimeType)?.schema
}

/** How an element of `runtimeType` draws its own layer, if it does. */
export function elementOwnLayer(runtimeType: string): OwnLayerRenderer | undefined {
  return BY_RUNTIME_TYPE.get(runtimeType)?.ownLayer
}

/** The element export writes a layer of `type` as, if any. */
export function elementTag(type: NodeType): string | undefined {
  return TAG_BY_NODE_TYPE.get(type)
}

/**
 * `const Frame = 'frame', …`: the element names a JSX string's code can use, bound to their
 * runtime types. Reka UI elements, named `Switch.Root`, are bound by their namespaces.
 */
export function elementBindings(): string {
  return DESIGN_JSX_ELEMENTS.filter((element) => !element.name.includes('.'))
    .map((element) => `const ${element.name} = '${element.runtimeType}'`)
    .join('\n')
}
