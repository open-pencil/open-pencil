import type {
  ConnectorEndpoint,
  ConnectorLineType,
  SceneNode,
  StrokeCap
} from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorSublayers,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { FigmaNodeProxy, NodeProxyHost } from '#core/figma-api/proxy'

/** Magnets Figma's plugin API takes with an `endpointNodeId`. */
const PLUGIN_MAGNETS = new Set(['NONE', 'AUTO', 'TOP', 'LEFT', 'BOTTOM', 'RIGHT', 'CENTER'])

/** Caps Figma lets a connector end take; its entity-relationship caps are not drawn here. */
const CONNECTOR_CAPS: readonly StrokeCap[] = [
  'NONE',
  'ARROW_EQUILATERAL',
  'ARROW_LINES',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
]
/** The line types a connector takes. */
const CONNECTOR_LINE_TYPES: readonly ConnectorLineType[] = ['ELBOWED', 'STRAIGHT', 'CURVED']
const ENTITY_RELATIONSHIP_CAPS = new Set([
  'ERD_ZERO_OR_ONE',
  'ERD_EXACTLY_ONE',
  'ERD_ZERO_OR_MORE',
  'ERD_ONE_OR_MORE',
  'ERD_ONE',
  'ERD_MANY'
])

type ConnectorEnd = 'connectorStart' | 'connectorEnd'

function connector(target: ProxyThis, internals: NodeProxyInternals): SceneNode | null {
  const node = raw(target, internals)
  return node.type === 'CONNECTOR' ? node : null
}

/** Applies a connector edit and routes it again, so geometry read next sees the new route. */
function editConnector(
  target: ProxyThis,
  internals: NodeProxyInternals,
  changes: Partial<SceneNode>
) {
  updateNode(target, internals, changes)
  const node = connector(target, internals)
  if (node) layoutConnector(graph(target, internals), node)
}

/**
 * An end as Figma's plugin API reports it; a free end names the page it lies on, and an end
 * pinned to a point of a section reports the magnet as `EDGE`.
 */
function pluginEndpoint(target: ProxyThis, internals: NodeProxyInternals, end: ConnectorEnd) {
  const node = raw(target, internals)
  const endpoint = node[end]
  if (!endpoint) return undefined
  const position = { ...endpoint.position }
  if (endpoint.nodeId === null) {
    return { endpointNodeId: graph(target, internals).pageOf(node.id) ?? '', position }
  }
  if (endpoint.magnet === 'NONE') return { endpointNodeId: endpoint.nodeId, position }
  const magnet = endpoint.magnet === 'ABSOLUTE' ? 'EDGE' : endpoint.magnet
  return { endpointNodeId: endpoint.nodeId, magnet }
}

interface PluginEndpoint {
  endpointNodeId?: string
  magnet?: string
  position?: Vector
}

/** Reads an end a script sets, refusing what Figma refuses with its messages. */
function sceneEndpoint(
  target: ProxyThis,
  internals: NodeProxyInternals,
  end: ConnectorEnd,
  value: PluginEndpoint
): ConnectorEndpoint {
  const setter = `in set_${end}`
  const scene = graph(target, internals)
  const node = raw(target, internals)
  const { endpointNodeId, magnet, position } = value
  const page = scene.pageOf(node.id)
  if (endpointNodeId === undefined || endpointNodeId === page) {
    if (!position) throw new Error(`${setter}: Invalid endpoint`)
    return freeEndpoint(position.x, position.y)
  }
  const bound = scene.getNode(endpointNodeId)
  if (!bound || bound.id === node.id || scene.pageOf(bound.id) !== page) {
    throw new Error(`${setter}: Invalid endpointNodeId`)
  }
  if (position) return { nodeId: bound.id, magnet: 'NONE', position: { ...position } }
  if (!magnet || !PLUGIN_MAGNETS.has(magnet)) throw new Error(`${setter}: Invalid magnet`)
  if (node.connectorLineType === 'STRAIGHT' && magnet !== 'CENTER' && magnet !== 'NONE') {
    throw new Error(
      `${setter}: Straight connector endpoints may only use the CENTER or NONE magnets.`
    )
  }
  return boundEndpoint(bound.id, magnet as ConnectorEndpoint['magnet'])
}

function endAccessor(internals: NodeProxyInternals, end: ConnectorEnd) {
  return {
    get(this: ProxyThis) {
      return connector(this, internals) ? pluginEndpoint(this, internals, end) : undefined
    },
    set(this: ProxyThis, value: PluginEndpoint) {
      if (!connector(this, internals)) return
      editConnector(this, internals, { [end]: sceneEndpoint(this, internals, end, value) })
    }
  }
}

function capAccessor(
  internals: NodeProxyInternals,
  field: 'connectorStartCap' | 'connectorEndCap'
) {
  const property =
    field === 'connectorStartCap' ? 'connectorStartStrokeCap' : 'connectorEndStrokeCap'
  return {
    get(this: ProxyThis): StrokeCap | undefined {
      return connector(this, internals)?.[field]
    },
    set(this: ProxyThis, value: string) {
      if (!connector(this, internals)) return
      if (ENTITY_RELATIONSHIP_CAPS.has(value)) {
        throw new Error(`in set_${property}: ${value} is not supported`)
      }
      const cap = CONNECTOR_CAPS.find((candidate) => candidate === value)
      if (!cap) {
        throw new Error(
          `in set_${property}: Property "${property}" failed validation: Invalid enum value. Expected ${CONNECTOR_CAPS.map((name) => `'${name}'`).join(' | ')}, received '${value}'`
        )
      }
      editConnector(this, internals, { [field]: cap })
    }
  }
}

/** A connector made straight attaches by its layers' centres, as Figma moves its magnets. */
function straightEnd(endpoint: ConnectorEndpoint | null): ConnectorEndpoint | null {
  if (!endpoint?.nodeId || endpoint.magnet === 'NONE') return endpoint
  return { ...endpoint, magnet: 'CENTER' }
}

function plate(target: ProxyThis, internals: NodeProxyInternals): FigmaNodeProxy | undefined {
  const node = connector(target, internals)
  const layer = node && connectorSublayers(graph(target, internals), node)?.labelBackground
  return layer ? (target[internals.api] as NodeProxyHost).wrapNode(layer.id) : undefined
}

/**
 * `ConnectorNode`'s members: its ends, line type, caps, and its label's plate as `textBackground`;
 * `text` is shared with sticky notes. Each edit routes the connector again.
 */
export function installConnectorNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    connectorStart: endAccessor(internals, 'connectorStart'),
    connectorEnd: endAccessor(internals, 'connectorEnd'),
    connectorStartStrokeCap: capAccessor(internals, 'connectorStartCap'),
    connectorEndStrokeCap: capAccessor(internals, 'connectorEndCap'),
    connectorLineType: {
      get(this: ProxyThis): ConnectorLineType | undefined {
        return connector(this, internals)?.connectorLineType
      },
      set(this: ProxyThis, value: ConnectorLineType) {
        const node = connector(this, internals)
        if (!node) return
        if (!CONNECTOR_LINE_TYPES.includes(value)) {
          throw new Error(
            `in set_connectorLineType: Property "connectorLineType" failed validation: Invalid enum value. Expected ${CONNECTOR_LINE_TYPES.map((name) => `'${name}'`).join(' | ')}, received '${value}'`
          )
        }
        const straight = value === 'STRAIGHT'
        editConnector(this, internals, {
          connectorLineType: value,
          ...(straight && {
            connectorStart: straightEnd(node.connectorStart),
            connectorEnd: straightEnd(node.connectorEnd)
          })
        })
      }
    },
    textBackground: {
      get(this: ProxyThis): FigmaNodeProxy | undefined {
        return plate(this, internals)
      }
    }
  })
}
