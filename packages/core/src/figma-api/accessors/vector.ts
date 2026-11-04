import type {
  HandleMirroring,
  VectorNetwork as SceneVectorNetwork,
  VectorRegion as SceneVectorRegion,
  VectorSegment,
  VectorVertex,
  WindingRule
} from '@open-pencil/scene-graph'
import { parsePluginVectorPath } from '@open-pencil/scene-graph/parse-path'
import {
  mergeVectorNetworks,
  normalizeVectorNetwork,
  transformVectorNetwork,
  validateVectorNetwork,
  vectorNetworkPaths
} from '@open-pencil/scene-graph/vector-network'

import {
  graph,
  prepareFollowedFieldEdit,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { parseFigmaPaints, toFigmaPaint, type FigmaPaint } from '#core/figma-api/paints'
import { geometryBlobToSVGPath } from '#core/io/formats/svg/paths'
import { computeAccurateBounds } from '#core/vector/curve-math'

export interface FigmaVectorPath {
  readonly windingRule: WindingRule | 'NONE'
  readonly data: string
}

interface FigmaVectorRegion {
  readonly windingRule: WindingRule
  readonly loops: ReadonlyArray<ReadonlyArray<number>>
  readonly fills?: readonly FigmaPaint[]
  readonly fillStyleId?: string
}

export interface FigmaVectorNetwork {
  readonly vertices: readonly VectorVertex[]
  readonly segments: readonly (Omit<VectorSegment, 'tangentStart' | 'tangentEnd'> & {
    readonly tangentStart?: VectorSegment['tangentStart']
    readonly tangentEnd?: VectorSegment['tangentEnd']
  })[]
  readonly regions?: readonly FigmaVectorRegion[]
}

const EMPTY_NETWORK: SceneVectorNetwork = { vertices: [], segments: [], regions: [] }
const HANDLE_MIRRORING_VALUES = new Set<HandleMirroring>(['NONE', 'ANGLE', 'ANGLE_AND_LENGTH'])

function networkFromVectorPaths(paths: readonly FigmaVectorPath[]): SceneVectorNetwork {
  const networks: SceneVectorNetwork[] = []
  for (let index = 0; index < paths.length; index++) {
    const path: unknown = paths[index]
    if (typeof path !== 'object' || path === null || !('data' in path)) {
      throw new TypeError(`vectorPaths[${index}].data must be a string`)
    }
    const data = path.data
    if (typeof data !== 'string') {
      throw new TypeError(`vectorPaths[${index}].data must be a string`)
    }
    const windingRule: unknown = 'windingRule' in path ? path.windingRule : undefined
    if (windingRule !== 'NONZERO' && windingRule !== 'EVENODD' && windingRule !== 'NONE') {
      throw new TypeError(`vectorPaths[${index}].windingRule is invalid`)
    }
    const parsed = parsePluginVectorPath(data, windingRule)
    if (!parsed.ok) throw new TypeError(`Invalid vector path: ${parsed.error}`)
    if (parsed.network.segments.length > 0) networks.push(parsed.network)
  }
  return networks.length > 0 ? mergeVectorNetworks(networks) : structuredClone(EMPTY_NETWORK)
}

function normalizeInputNetwork(value: FigmaVectorNetwork): SceneVectorNetwork {
  const regions = value.regions ?? []
  return normalizeVectorNetwork({
    vertices: value.vertices.map((vertex) => ({ ...vertex })),
    segments: value.segments.map((segment) => ({
      ...segment,
      tangentStart: {
        x: segment.tangentStart?.x ?? 0,
        y: segment.tangentStart?.y ?? 0
      },
      tangentEnd: {
        x: segment.tangentEnd?.x ?? 0,
        y: segment.tangentEnd?.y ?? 0
      }
    })),
    regions: regions.map(sceneRegion)
  })
}

/** A region as the network stores it, with paints of its own only when Figma's names them. */
function sceneRegion(region: FigmaVectorRegion): SceneVectorRegion {
  const scene: SceneVectorRegion = {
    windingRule: region.windingRule,
    loops: region.loops.map((loop) => [...loop])
  }
  if (region.fills !== undefined)
    scene.fills = parseFigmaPaints(region.fills, 'set_vectorNetwork', 'vectorNetwork')
  if (region.fillStyleId) scene.fillStyleId = region.fillStyleId
  return scene
}

function validateRegionPaintMetadata(regions: readonly FigmaVectorRegion[]): void {
  for (let index = 0; index < regions.length; index++) {
    const region = regions[index]
    if (region.fills !== undefined && !Array.isArray(region.fills)) {
      throw new TypeError(`vectorNetwork.regions[${index}].fills must be an array`)
    }
    if (region.fillStyleId !== undefined && typeof region.fillStyleId !== 'string') {
      throw new TypeError(`vectorNetwork.regions[${index}].fillStyleId must be a string`)
    }
  }
}

/** The network as the layer's path; its fill geometry rebuilds from it when next needed. */
function setGeometry(
  target: ProxyThis,
  internals: NodeProxyInternals,
  network: SceneVectorNetwork
): void {
  const node = raw(target, internals)
  const bounds = computeAccurateBounds(network)
  const hasGeometry = network.vertices.length > 0
  const normalized = hasGeometry
    ? transformVectorNetwork([1, 0, -bounds.x, 0, 1, -bounds.y, 0, 0, 1], network)
    : structuredClone(EMPTY_NETWORK)

  updateNode(target, internals, {
    x: hasGeometry ? node.x + bounds.x : node.x,
    y: hasGeometry ? node.y + bounds.y : node.y,
    width: hasGeometry ? bounds.width : 0,
    height: hasGeometry ? bounds.height : 0,
    vectorNetwork: normalized,
    fillGeometry: [],
    strokeGeometry: []
  })
}

/** A vector inside an instance draws its component's path, which Figma refuses to override. */
function prepareVectorDataEdit(
  target: ProxyThis,
  internals: NodeProxyInternals,
  setter: string | null
): void {
  prepareFollowedFieldEdit(graph(target, internals), raw(target, internals), setter, 'vector-data')
}

/** Checks the network before readying the edit, so a rejected one leaves a slot unclaimed. */
function assignVectorNetwork(
  target: ProxyThis,
  internals: NodeProxyInternals,
  value: FigmaVectorNetwork,
  setter: string | null
): void {
  const errors = validateVectorNetwork(value)
  if (errors.length > 0) throw new TypeError(`Invalid vectorNetwork: ${errors.join('; ')}`)
  validateRegionPaintMetadata(value.regions ?? [])
  const network = normalizeInputNetwork(value)
  prepareVectorDataEdit(target, internals, setter)
  setGeometry(target, internals, network)
}

function readVectorPaths(
  target: ProxyThis,
  internals: NodeProxyInternals
): readonly FigmaVectorPath[] {
  const node = raw(target, internals)
  const paths =
    node.vectorNetwork && node.vectorNetwork.segments.length > 0
      ? vectorNetworkPaths(node.vectorNetwork)
      : node.fillGeometry.map((geometry) => ({
          windingRule: geometry.windingRule,
          data: geometryBlobToSVGPath(geometry.commandsBlob, null)
        }))
  return Object.freeze(paths.map((path) => Object.freeze(path)))
}

function readVectorNetwork(target: ProxyThis, internals: NodeProxyInternals): FigmaVectorNetwork {
  const node = raw(target, internals)
  const network = node.vectorNetwork ?? EMPTY_NETWORK
  const vertices = network.vertices.map((vertex) =>
    Object.freeze({
      ...vertex,
      strokeCap: vertex.strokeCap ?? node.strokeCap,
      strokeJoin: vertex.strokeJoin ?? node.strokeJoin,
      cornerRadius: vertex.cornerRadius ?? 0,
      handleMirroring: vertex.handleMirroring ?? 'NONE'
    })
  )
  const segments = network.segments.map((segment) =>
    Object.freeze({
      ...segment,
      tangentStart: Object.freeze({ ...segment.tangentStart }),
      tangentEnd: Object.freeze({ ...segment.tangentEnd })
    })
  )
  const sourceRegions = (network as Partial<SceneVectorNetwork>).regions ?? []
  // A region without paints of its own reads the layer's, as in Figma.
  const regions = sourceRegions.map((region) =>
    Object.freeze({
      windingRule: region.windingRule,
      loops: Object.freeze(region.loops.map((loop) => Object.freeze([...loop]))),
      fillStyleId: region.fillStyleId ?? '',
      fills: Object.freeze((region.fills ?? node.fills).map((paint) => toFigmaPaint(paint)))
    })
  )
  return Object.freeze({
    vertices: Object.freeze(vertices),
    segments: Object.freeze(segments),
    regions: Object.freeze(regions)
  })
}

function readHandleMirroring(
  target: ProxyThis,
  internals: NodeProxyInternals,
  mixed: symbol
): HandleMirroring | symbol {
  const node = raw(target, internals)
  const values = new Set(
    (node.vectorNetwork?.vertices ?? []).map((vertex) => vertex.handleMirroring ?? 'NONE')
  )
  if (values.size === 0) return node.handleMirroring
  if (values.size > 1) return mixed
  return values.values().next().value ?? node.handleMirroring
}

export function installVectorNodeProxyAccessors(
  target: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  Object.defineProperties(target, {
    vectorPaths: {
      get(this: ProxyThis): readonly FigmaVectorPath[] {
        return readVectorPaths(this, internals)
      },
      set(this: ProxyThis, value: readonly FigmaVectorPath[]) {
        if (!Array.isArray(value)) throw new TypeError('vectorPaths must be an array')
        const network = networkFromVectorPaths(value)
        prepareVectorDataEdit(this, internals, 'vectorPaths')
        setGeometry(this, internals, network)
      },
      enumerable: true,
      configurable: true
    },
    vectorNetwork: {
      get(this: ProxyThis): FigmaVectorNetwork {
        return readVectorNetwork(this, internals)
      },
      set(this: ProxyThis, value: FigmaVectorNetwork) {
        assignVectorNetwork(this, internals, value, 'vectorNetwork')
      },
      enumerable: true,
      configurable: true
    },
    setVectorNetworkAsync: {
      value(this: ProxyThis, value: FigmaVectorNetwork): Promise<void> {
        try {
          assignVectorNetwork(this, internals, value, null)
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error)))
        }
      },
      enumerable: true,
      configurable: true
    },
    handleMirroring: {
      get(this: ProxyThis): HandleMirroring | symbol {
        return readHandleMirroring(this, internals, mixed)
      },
      set(this: ProxyThis, value: HandleMirroring) {
        if (!HANDLE_MIRRORING_VALUES.has(value)) {
          throw new TypeError(`Invalid handleMirroring: ${String(value)}`)
        }
        const node = raw(this, internals)
        prepareFollowedFieldEdit(
          graph(this, internals),
          node,
          'handleMirroring',
          'handle-mirroring'
        )
        updateNode(this, internals, {
          handleMirroring: value,
          vectorNetwork: node.vectorNetwork
            ? {
                ...node.vectorNetwork,
                vertices: node.vectorNetwork.vertices.map((vertex) => ({
                  ...vertex,
                  handleMirroring: value
                }))
              }
            : null
        })
      },
      enumerable: true,
      configurable: true
    }
  })
}
