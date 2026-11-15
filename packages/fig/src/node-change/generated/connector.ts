import { pick } from 'es-toolkit'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, isUnsetGuid, UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import type {
  ConnectorControlPoint,
  ConnectorEndpoint,
  ConnectorLabelPosition,
  ConnectorLineType,
  ConnectorMagnet,
  SceneGraph,
  SceneNode,
  StrokeCap
} from '@open-pencil/scene-graph'
import {
  buildConnectorSublayers,
  connectorRouteEnds,
  connectorSublayers
} from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { nodeChangeToProps } from '../convert'
import { createFillPaints, createStrokePaints, exportedStyleReference } from '../export/context'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'
import type { GeneratedFrameCodec } from './codec'
import { placement, shaped, sublayerRecord, textSublayer } from './entries'
import {
  derivedFrameEntriesOf,
  generatedSlotPath,
  generationOverridesOf,
  type GeneratedEntry
} from './records'

export const CONNECTOR_SLOTS = { line: 0, label: 1, labelBackground: 2 } as const

/** The fields a CONNECTOR's own record keeps besides its ends, as Figma writes it. */
const CONNECTOR_RECORD_FIELDS = [
  'guid',
  'parentIndex',
  'phase',
  'type',
  'name',
  'visible',
  'opacity',
  'blendMode',
  'locked',
  'size',
  'transform',
  'autoRename',
  'frameMaskDisabled',
  'exportSettings',
  'pluginData',
  'pluginRelaunchData'
] as const

interface KiwiControlPoint {
  position?: Vector
  axis?: Vector
}

/**
 * A record's control points, in its parent's axes, as points in the connector's own: an elbow's
 * segments along their axes, or a curve's two control points.
 */
function controlPointsOf(value: unknown, origin: Vector): ConnectorControlPoint[] {
  if (!Array.isArray(value)) return []
  return (value as KiwiControlPoint[]).map(({ position, axis }) => ({
    position: { x: (position?.x ?? 0) - origin.x, y: (position?.y ?? 0) - origin.y },
    direction: axis?.x ? 'HORIZONTAL' : 'VERTICAL'
  }))
}

function curveHandlesOf(value: unknown, origin: Vector): [Vector, Vector] | null {
  const points = controlPointsOf(value, origin)
  const first = points.at(0)
  const second = points.at(1)
  return first && second ? [first.position, second.position] : null
}

/** Control points as Figma writes them, in the connector's parent's axes. */
function kiwiControlPoints(points: ConnectorControlPoint[], origin: Vector) {
  return points.map(({ position, direction }) => ({
    position: { x: position.x + origin.x, y: position.y + origin.y },
    axis: direction === 'HORIZONTAL' ? { x: 1, y: 0 } : { x: 0, y: 1 }
  }))
}

const LABEL_SECTIONS: ReadonlySet<string> = new Set<ConnectorLabelPosition['section']>([
  'MIDDLE_TO_START',
  'MIDDLE_TO_END'
])
const LABEL_OFF_AXES: ReadonlySet<string> = new Set<ConnectorLabelPosition['offAxis']>([
  'NONE',
  'ABOVE',
  'BELOW'
])

interface KiwiTextMidpoint {
  section?: string
  offset?: number
  offAxisOffset?: string
}

/** Where a record's label was dragged to, from Figma's `connectorTextMidpoint`. */
function labelPositionOf(value: unknown): ConnectorLabelPosition | null {
  if (!value || typeof value !== 'object') return null
  const { section, offset, offAxisOffset } = value as KiwiTextMidpoint
  if (!section || !LABEL_SECTIONS.has(section) || typeof offset !== 'number') return null
  return {
    section: section as ConnectorLabelPosition['section'],
    offset,
    offAxis:
      offAxisOffset && LABEL_OFF_AXES.has(offAxisOffset)
        ? (offAxisOffset as ConnectorLabelPosition['offAxis'])
        : 'NONE'
  }
}

interface KiwiConnectorEndpoint {
  endpointNodeID?: GUID
  position?: Vector
  magnet?: string
}

/** A connector end as its record names it: the record of the layer it is bound to, if any. */
export interface ConnectorEndpointRecord {
  sourceId: string | null
  magnet: ConnectorMagnet
  position: Vector
}

const MAGNETS: ReadonlySet<string> = new Set<ConnectorMagnet>([
  'NONE',
  'AUTO',
  'AUTO_HORIZONTAL',
  'TOP',
  'RIGHT',
  'BOTTOM',
  'LEFT',
  'CENTER',
  'EDGE',
  'ABSOLUTE'
])

const CAPS: ReadonlySet<string> = new Set<StrokeCap>([
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
])

const LINE_TYPES: ReadonlySet<string> = new Set<ConnectorLineType>([
  'ELBOWED',
  'STRAIGHT',
  'CURVED'
])

function magnetOf(value: string | undefined): ConnectorMagnet {
  return value && MAGNETS.has(value) ? (value as ConnectorMagnet) : 'NONE'
}

function capOf(value: unknown, fallback: StrokeCap): StrokeCap {
  return typeof value === 'string' && CAPS.has(value) ? (value as StrokeCap) : fallback
}

function endpointOf(value: unknown): ConnectorEndpointRecord {
  const endpoint = (value ?? {}) as KiwiConnectorEndpoint
  const guid = endpoint.endpointNodeID
  return {
    sourceId: guid && !isUnsetGuid(guid) ? guidToString(guid) : null,
    magnet: magnetOf(endpoint.magnet),
    position: { x: endpoint.position?.x ?? 0, y: endpoint.position?.y ?? 0 }
  }
}

/**
 * A connector end bound to the layer its record names. An end whose layer is not there, as when a
 * connector is pasted alone, stays free where it was drawn.
 */
function boundEndpoint(
  record: ConnectorEndpointRecord,
  drawn: Vector | undefined,
  layerOf: (sourceId: string) => string | undefined
): ConnectorEndpoint {
  const nodeId = record.sourceId === null ? null : (layerOf(record.sourceId) ?? null)
  if (nodeId || record.sourceId === null) {
    return { nodeId, magnet: record.magnet, position: record.position }
  }
  return { nodeId: null, magnet: 'NONE', position: drawn ?? record.position }
}

function linkConnector(
  graph: SceneGraph,
  connector: SceneNode,
  record: NodeChange,
  layerOf: (sourceId: string) => string | undefined
): void {
  const drawn = connectorRouteEnds(graph, connector)
  graph.updateNode(connector.id, {
    connectorStart: boundEndpoint(endpointOf(record.connectorStart), drawn?.start, layerOf),
    connectorEnd: boundEndpoint(endpointOf(record.connectorEnd), drawn?.end, layerOf)
  })
}

function sublayerProps(
  type: string,
  entry: GeneratedEntry | undefined,
  derived: GeneratedEntry | undefined,
  blobs: Uint8Array[]
): Partial<SceneNode> {
  const {
    nodeType: _type,
    name: _name,
    ...props
  } = nodeChangeToProps(sublayerRecord(type, entry, derived), blobs, 'occurrence')
  return props
}

/**
 * Gives an imported CONNECTOR its line type, caps, and sublayers: the line as Figma last routed
 * it, and its label on its plate. Its ends are linked once their layers exist; one saved without a
 * route is routed by layout, once its label is measured.
 */
function readConnector(
  graph: SceneGraph,
  connector: SceneNode,
  record: NodeChange,
  blobs: Uint8Array[]
): void {
  const overrides = generationOverridesOf(record)
  const derived = derivedFrameEntriesOf(record)
  const { line, label, labelBackground } = CONNECTOR_SLOTS
  const lineType = record.connectorLineStyle
  graph.updateNode(connector.id, {
    fills: [],
    strokes: [],
    connectorLineType:
      typeof lineType === 'string' && LINE_TYPES.has(lineType)
        ? (lineType as ConnectorLineType)
        : 'ELBOWED',
    connectorStartCap: capOf(record.connectorStartCap, 'ROUND'),
    connectorEndCap: capOf(record.connectorEndCap, 'ARROW_LINES'),
    connectorControlPoints: controlPointsOf(record.connectorControlPoints, connector),
    connectorCurveHandles: curveHandlesOf(record.connectorBezierControlPoints, connector),
    connectorLabelPosition: labelPositionOf(record.connectorTextMidpoint)
  })
  const text = overrides.get(label)?.textData?.characters ?? ''
  const plate = sublayerProps(
    'RECTANGLE',
    overrides.get(labelBackground),
    derived.get(labelBackground),
    blobs
  )
  const labelProps = sublayerProps('TEXT', overrides.get(label), derived.get(label), blobs)
  buildConnectorSublayers(graph, connector, {
    line: sublayerProps('VECTOR', overrides.get(line), derived.get(line), blobs),
    labelBackground: { ...plate, visible: text !== '' },
    // Figma places the label inside its plate; here they are siblings.
    label: {
      ...labelProps,
      x: (labelProps.x ?? 0) + (plate.x ?? 0),
      y: (labelProps.y ?? 0) + (plate.y ?? 0),
      visible: text !== ''
    }
  })
}

/**
 * A connector end as Figma writes it. An end bound to a layer the export does not include, as when
 * a connector is copied alone, is written free where it is drawn, as Figma pastes one.
 */
function kiwiConnectorEndpoint(
  context: SceneNodeToKiwiContext,
  endpoint: ConnectorEndpoint | null,
  drawn: Vector | undefined
) {
  const guid = endpoint?.nodeId ? context.nodeIdToGuid?.get(endpoint.nodeId) : undefined
  if (endpoint && (guid || !endpoint.nodeId)) {
    return {
      endpointNodeID: guid ?? { ...UNSET_GUID },
      position: { ...endpoint.position },
      magnet: endpoint.magnet
    }
  }
  return {
    endpointNodeID: { ...UNSET_GUID },
    position: { ...(drawn ?? { x: 0, y: 0 }) },
    magnet: 'NONE'
  }
}

/**
 * Joins the ends of the connectors in `records` to the layers they are bound to, once every layer
 * an export writes has its GUID. A connector written before a layer its end joins found no GUID
 * for that layer and was written free; when the layer turns out to be written too, the end joins
 * it again, as Figma pastes it.
 */
export function relinkConnectorEnds(
  records: readonly KiwiNodeChange[],
  graph: SceneGraph,
  nodeIdToGuid: ReadonlyMap<string, GUID>
): void {
  const recordByGuid = new Map(
    records.flatMap((record) => (record.guid ? [[guidToString(record.guid), record] as const] : []))
  )
  for (const [nodeId, guid] of nodeIdToGuid) {
    const node = graph.getNode(nodeId)
    const record = recordByGuid.get(guidToString(guid))
    if (node?.type !== 'CONNECTOR' || record?.type !== 'CONNECTOR') continue
    for (const [field, endpoint] of [
      ['connectorStart', node.connectorStart],
      ['connectorEnd', node.connectorEnd]
    ] as const) {
      const joined = endpoint?.nodeId ? nodeIdToGuid.get(endpoint.nodeId) : undefined
      if (!endpoint || !joined || !recordByGuid.has(guidToString(joined))) continue
      record[field] = {
        endpointNodeID: { ...joined },
        position: { ...endpoint.position },
        magnet: endpoint.magnet
      }
    }
  }
}

/**
 * A connector's record: its ends, line type, and caps, and its line, label, and label plate as
 * `nodeGenerationData` entries, with the route as drawn under `derivedImmutableFrameData`. As for
 * a sticky note, the derived data is written only when the label is shaped, since Figma draws a
 * connector from it as saved.
 */
function writeConnector(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): KiwiNodeChange {
  const record: KiwiNodeChange = pick(nc, CONNECTOR_RECORD_FIELDS)
  const sublayers = connectorSublayers(context.graph, node)
  if (!sublayers) return record
  const drawn = connectorRouteEnds(context.graph, node)
  record.connectorStart = kiwiConnectorEndpoint(context, node.connectorStart, drawn?.start)
  record.connectorEnd = kiwiConnectorEndpoint(context, node.connectorEnd, drawn?.end)
  record.connectorLineStyle = node.connectorLineType
  record.connectorStartCap = node.connectorStartCap
  record.connectorEndCap = node.connectorEndCap
  if (node.connectorControlPoints.length > 0) {
    record.connectorControlPoints = kiwiControlPoints(node.connectorControlPoints, node)
  }
  if (node.connectorCurveHandles) {
    // Figma gives a curve's control points a horizontal axis, which nothing reads.
    record.connectorBezierControlPoints = kiwiControlPoints(
      node.connectorCurveHandles.map((position) => ({ position, direction: 'HORIZONTAL' })),
      node
    )
  }
  if (node.connectorLabelPosition) {
    const { section, offset, offAxis } = node.connectorLabelPosition
    record.connectorTextMidpoint = { section, offset, offAxisOffset: offAxis }
  }
  record.connectorType = 'MANUAL'
  record.connectorVersion = 1
  const { line, label, labelBackground } = sublayers
  const lineEntry: GeneratedEntry = {
    guidPath: generatedSlotPath(CONNECTOR_SLOTS.line),
    strokePaints: createStrokePaints(context, line),
    strokeWeight: line.strokes[0]?.weight ?? line.strokeWeight,
    strokeCap: 'ROUND',
    cornerRadius: line.cornerRadius,
    dashPattern: [...line.dashPattern]
  }
  const { entry: labelEntry, derived: labelDerived } = textSublayer(
    context,
    CONNECTOR_SLOTS.label,
    label
  )
  const plateEntry: GeneratedEntry = {
    guidPath: generatedSlotPath(CONNECTOR_SLOTS.labelBackground),
    visible: labelBackground.visible,
    fillPaints: createFillPaints(context, labelBackground),
    cornerRadius: labelBackground.cornerRadius
  }
  record.nodeGenerationData = {
    overrides: [lineEntry, labelEntry, plateEntry],
    useFineGrainedSyncing: false,
    diffOnlyRemovals: []
  }
  const lineGeometry: KiwiNodeChange = {}
  context.serializeGeometry(line, lineGeometry, context.blobs, (id) =>
    exportedStyleReference(context, id)
  )
  // Figma places the label inside its plate; here they are siblings.
  labelDerived.transform = {
    m00: 1,
    m01: 0,
    m02: label.x - labelBackground.x,
    m10: 0,
    m11: 1,
    m12: label.y - labelBackground.y
  }
  if (lineGeometry.vectorData && shaped(label, labelDerived)) {
    record.derivedImmutableFrameData = {
      overrides: [
        {
          guidPath: generatedSlotPath(CONNECTOR_SLOTS.line),
          ...placement(line),
          vectorData: lineGeometry.vectorData
        },
        labelDerived,
        {
          guidPath: generatedSlotPath(CONNECTOR_SLOTS.labelBackground),
          ...placement(labelBackground)
        }
      ],
      version: 1
    }
  }
  return record
}

export const CONNECTOR_CODEC: GeneratedFrameCodec = {
  read: readConnector,
  link: linkConnector,
  write: writeConnector
}
