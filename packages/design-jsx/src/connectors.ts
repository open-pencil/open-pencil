import { compact, countBy } from 'es-toolkit/array'
import { camelCase } from 'es-toolkit/string'
import type * as v from 'valibot'

import { es } from '@open-pencil/emit'
import type { ConnectorEndpoint, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import {
  boundEndpoint,
  CONNECTOR_COLOR,
  CONNECTOR_NAME,
  CONNECTOR_STROKE_WEIGHT,
  connectorRouteEnds,
  connectorStroke,
  connectorSublayers,
  createConnector,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { CONNECTOR_LINE, CONNECTOR_SIDE, STROKE_CAP } from './enums'
import { Reference } from './export/value'
import { isLayerRef, type LayerRefs } from './refs'
import { connectorPropsSchema, readElementProps } from './schema'
import { plainTextOf, type TreeNode } from './tree'

/**
 * `<Connector from="A" to="B">`: a FigJam connector whose ends name other layers of the same
 * JSX, or give `{ x, y }` points in its parent. Ends resolve once the whole tree is rendered, and
 * the connector routes once it is laid out.
 */
export const CONNECTOR_ELEMENT = 'connector'

type ConnectorPropValues = v.InferOutput<typeof connectorPropsSchema>

/**
 * Makes the connector an element describes, with `layer`'s fields, its ends free until
 * `resolveConnectorEnds`.
 */
export function renderConnectorNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  layer: Partial<SceneNode>
) {
  const props = readElementProps(connectorPropsSchema, tree.props)
  const parent = graph.getNode(parentId)
  const connector = createConnector(
    graph,
    parentId,
    {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(0, 0),
      lineType: props.line,
      startCap: props.startCap ?? 'NONE',
      endCap: props.endCap ?? 'ARROW_LINES',
      text: plainTextOf(tree)
    },
    {
      ...layer,
      // A connector is drawn between layers, not placed by its parent's auto layout.
      ...(parent && parent.layoutMode !== 'NONE' && { layoutPositioning: 'ABSOLUTE' as const })
    }
  )
  const lineLayer = connectorSublayers(graph, connector)?.line
  if (lineLayer) styleLine(graph, lineLayer, props)
  return connector
}

/** The layer a connector's variable binding goes on: its line for the stroke, else itself. */
export function connectorBindingTarget(graph: SceneGraph, connector: SceneNode, field: string) {
  const onLine = field.startsWith('strokes/') || field === 'strokeWeight'
  return (onLine && connectorSublayers(graph, connector)?.line.id) || connector.id
}

/** Restyles the line by `stroke`, `strokeWidth`, and `dashPattern`; each left out keeps FigJam's. */
function styleLine(graph: SceneGraph, line: SceneNode, props: ConnectorPropValues) {
  const [stroke = connectorStroke()] = line.strokes
  const color = props.stroke ?? stroke.color
  const weight = props.strokeWidth ?? stroke.weight
  const dashPattern = props.dashPattern ?? line.dashPattern
  graph.updateNode(line.id, {
    // The stroke draws with its own dash, and files keep the line's.
    strokes: [{ ...stroke, color, weight, dashPattern: [...dashPattern] }],
    strokeWeight: weight,
    dashPattern
  })
}

/**
 * The layers JSX writes under `rootIds`, in order, each before its descendants: the layers a
 * connector or sticky note generates are not, so an end never names them.
 */
export function layersUnder(graph: SceneGraph, rootIds: readonly string[]): SceneNode[] {
  const layers: SceneNode[] = []
  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    layers.push(node)
    if (!isGeneratedFrame(node)) for (const childId of node.childIds) visit(childId)
  }
  for (const id of rootIds) visit(id)
  return layers
}

/** A connector end's prop as a warning quotes it. */
function endSource(prop: string, value: unknown): string {
  if (isLayerRef(value)) return `${prop}={ref}`
  return `${prop}="${String(value)}"`
}

/**
 * Binds the ends of connectors rendered from `trees` to the layers they refer to: a `ref()` a
 * layer was marked with, or a name among `rootIds`' layers, the first of a name winning. Returns
 * warnings for ends that refer to no layer, and for names that more than one layer has.
 */
export function resolveConnectorEnds(
  graph: SceneGraph,
  rootIds: readonly string[],
  connectors: ReadonlyArray<{ node: SceneNode; tree: TreeNode }>,
  refs: LayerRefs
): string[] {
  if (connectors.length === 0) return []
  const named = new Map<string, string[]>()
  for (const layer of layersUnder(graph, rootIds)) {
    if (layer.type === 'CONNECTOR') continue
    const ids = named.get(layer.name)
    if (ids) ids.push(layer.id)
    else named.set(layer.name, [layer.id])
  }
  const warnings: string[] = []
  const endpoint = (
    prop: 'from' | 'to',
    props: ConnectorPropValues,
    written: TreeNode['props'],
    straight: boolean
  ) => {
    const value = props[prop]
    let id: string | undefined
    if (isLayerRef(value)) id = refs.layerOf(value)
    else if (typeof value === 'object') return freeEndpoint(value.x, value.y)
    else if (typeof value === 'string') {
      const ids = named.get(value) ?? []
      if (ids.length > 1) {
        warnings.push(
          `<Connector> ${endSource(prop, value)} names ${ids.length} layers and joins the first; mark the one to join with ref().`
        )
      }
      id = ids.at(0)
    }
    if (!id) {
      const missing = isLayerRef(value) ? 'refers to no layer' : 'names no layer'
      warnings.push(`<Connector> ${endSource(prop, written[prop])} ${missing}.`)
      return null
    }
    const side = props[prop === 'from' ? 'fromSide' : 'toSide']
    return boundEndpoint(id, straight ? 'CENTER' : (side ?? 'AUTO'))
  }
  for (const { node, tree } of connectors) {
    const straight = node.connectorLineType === 'STRAIGHT'
    const props = readElementProps(connectorPropsSchema, tree.props)
    const start = endpoint('from', props, tree.props, straight)
    const end = endpoint('to', props, tree.props, straight)
    graph.updateNode(node.id, {
      ...(start && { connectorStart: start }),
      ...(end && { connectorEnd: end })
    })
  }
  return warnings
}

/** `card1` for a layer named "Card": a name a declaration can take, numbered to stay unique. */
function refName(layerName: string, taken: Set<string>): string {
  const camel = camelCase(layerName)
  const base = es.isIdentifierName(camel) ? camel : 'layer'
  let count = 1
  while (taken.has(`${base}${count}`)) count++
  const name = `${base}${count}`
  taken.add(name)
  return name
}

/** What an export of connectors writes: the layers under its roots, and how ends name them. */
export interface ConnectorExportScope {
  roots: ReadonlySet<string>
  /**
   * The layers connector ends join whose name another layer of the export has too, so the name
   * would not say which: each with the `ref()` the export declares for it, or `null` when the
   * export declares nothing and such an end is written as the point it is drawn at.
   */
  refs: ReadonlyMap<string, string | null>
}

/**
 * Plans how the connectors under `rootIds` write their ends. With `declare`, a joined layer
 * whose name is not unique gets a `ref()` the export declares before its JSX.
 */
export function connectorExportScope(
  graph: SceneGraph,
  rootIds: readonly string[],
  declare: boolean
): ConnectorExportScope {
  const layers = layersUnder(graph, rootIds)
  const connectors = layers.filter((layer) => layer.type === 'CONNECTOR')
  const refs = new Map<string, string | null>()
  if (connectors.length === 0) return { roots: new Set(rootIds), refs }
  const joined = new Set(
    connectors.flatMap((connector) => [
      connector.connectorStart?.nodeId,
      connector.connectorEnd?.nodeId
    ])
  )
  const named = countBy(
    layers.filter((layer) => layer.type !== 'CONNECTOR'),
    (layer) => layer.name
  )
  const taken = new Set<string>()
  for (const layer of layers) {
    if (!joined.has(layer.id) || (named[layer.name] ?? 0) < 2) continue
    refs.set(layer.id, declare ? refName(layer.name, taken) : null)
  }
  return { roots: new Set(rootIds), refs }
}

/** `const card1 = ref()` for each ref the scope declares, one per line. */
export function connectorRefDeclarations(scope: ConnectorExportScope): string {
  return compact([...scope.refs.values()])
    .map((name) => `const ${name} = ref()`)
    .join('\n')
}

/** How a connector end is written: by its layer's name or ref, or as the point it is drawn at. */
type EndTarget = { layer: SceneNode; ref?: string } | { point: Vector }

function endTarget(
  graph: SceneGraph,
  endpoint: ConnectorEndpoint,
  drawn: Vector | undefined,
  scope: ConnectorExportScope | undefined
): EndTarget {
  const layer = endpoint.nodeId ? graph.getNode(endpoint.nodeId) : undefined
  if (!layer) return { point: endpoint.position }
  const exported =
    !scope || graph.closest(layer.id, (ancestor) => scope.roots.has(ancestor.id)) !== undefined
  const ref = scope?.refs.get(layer.id)
  if (exported && ref !== null) return { layer, ref }
  return { point: drawn ?? endpoint.position }
}

/**
 * A connector's props as `<Connector>` writes them, its ends by the names of their layers, or by
 * the refs `scope` declares for layers whose names are not unique. An end on a layer outside the
 * export, or one the scope gives no ref, is written as the point it is drawn at.
 */
export function connectorProps(
  graph: SceneGraph,
  node: SceneNode,
  scope?: ConnectorExportScope
): Array<[string, unknown]> {
  const drawn = connectorRouteEnds(graph, node)
  const target = (endpoint: ConnectorEndpoint | null, at: Vector | undefined) =>
    endpoint ? endTarget(graph, endpoint, at, scope) : null
  const start = target(node.connectorStart, drawn?.start)
  const end = target(node.connectorEnd, drawn?.end)
  const value = (written: EndTarget | null) => {
    if (!written) return null
    if ('point' in written) return { x: written.point.x, y: written.point.y }
    return written.ref ? new Reference(written.ref) : written.layer.name
  }
  const side = (endpoint: ConnectorEndpoint | null, written: EndTarget | null) => {
    if (!endpoint || !written || 'point' in written) return undefined
    const magnet = endpoint.magnet
    if (magnet !== 'TOP' && magnet !== 'RIGHT' && magnet !== 'BOTTOM' && magnet !== 'LEFT') {
      return undefined
    }
    return CONNECTOR_SIDE.print(magnet)
  }
  const props: Array<[string, unknown]> = [
    ['name', node.name === CONNECTOR_NAME ? undefined : node.name],
    ['from', value(start)],
    ['to', value(end)],
    ['fromSide', side(node.connectorStart, start)],
    ['toSide', side(node.connectorEnd, end)],
    [
      'line',
      node.connectorLineType === 'ELBOWED'
        ? undefined
        : CONNECTOR_LINE.print(node.connectorLineType)
    ],
    [
      'startCap',
      node.connectorStartCap === 'NONE' ? undefined : STROKE_CAP.print(node.connectorStartCap)
    ],
    [
      'endCap',
      node.connectorEndCap === 'ARROW_LINES' ? undefined : STROKE_CAP.print(node.connectorEndCap)
    ]
  ]
  const line = connectorSublayers(graph, node)?.line
  const stroke = line?.strokes[0]
  if (stroke && colorToHex(stroke.color) !== colorToHex(CONNECTOR_COLOR)) {
    props.push(['stroke', colorToHex(stroke.color)])
  }
  if (stroke && stroke.weight !== CONNECTOR_STROKE_WEIGHT)
    props.push(['strokeWidth', stroke.weight])
  if (line && line.dashPattern.length > 0) props.push(['dashPattern', [...line.dashPattern]])
  if (node.opacity < 1) props.push(['opacity', Math.round(node.opacity * 100) / 100])
  if (!node.visible) props.push(['visible', false])
  return props.filter(([, value]) => value !== undefined && value !== null)
}

/** The label a connector writes as its children. */
export function connectorLabel(graph: SceneGraph, node: SceneNode): string {
  return connectorSublayers(graph, node)?.label.text ?? ''
}
