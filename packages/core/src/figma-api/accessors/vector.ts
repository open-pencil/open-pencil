import {
  mergeVectorNetworks,
  normalizeVectorNetwork,
  transformVectorNetwork,
  validateVectorNetwork
} from '@open-pencil/scene-graph'
import type {
  Fill,
  GeometryPath,
  HandleMirroring,
  VectorNetwork as SceneVectorNetwork,
  VectorSegment,
  VectorVertex,
  WindingRule
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { parsePluginVectorPath } from '@open-pencil/scene-graph/parse-path'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from '#core/io/formats/svg/paths'
import { computeAccurateBounds } from '#core/vector/curve-math'
import { regenerateFillGeometry } from '#core/vector/fill-geometry'

export interface FigmaVectorPath {
  readonly windingRule: WindingRule | 'NONE'
  readonly data: string
}

interface FigmaVectorRegion {
  readonly windingRule: WindingRule
  readonly loops: ReadonlyArray<ReadonlyArray<number>>
  readonly fills?: readonly Fill[]
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
    regions: regions.map((region) => ({
      windingRule: region.windingRule,
      loops: region.loops.map((loop) => [...loop])
    }))
  })
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

function geometryForRegions(regions: readonly FigmaVectorRegion[]): GeometryPath[] {
  if (!regions.some((region) => region.fills !== undefined || region.fillStyleId !== undefined)) {
    return []
  }
  return regions.map((region) => ({
    windingRule: region.windingRule,
    commandsBlob: new Uint8Array(),
    fills: region.fills ? copyFills([...region.fills]) : [],
    fillStyleId: region.fillStyleId ?? ''
  }))
}

function setGeometry(
  target: ProxyThis,
  internals: NodeProxyInternals,
  network: SceneVectorNetwork,
  fillGeometry: GeometryPath[]
): void {
  const node = raw(target, internals)
  const bounds = computeAccurateBounds(network)
  const hasGeometry = network.vertices.length > 0
  const normalized = hasGeometry
    ? transformVectorNetwork([1, 0, -bounds.x, 0, 1, -bounds.y, 0, 0, 1], network)
    : structuredClone(EMPTY_NETWORK)
  const normalizedGeometry =
    fillGeometry.length > 0 ? regenerateFillGeometry(normalized, fillGeometry) : []

  updateNode(target, internals, {
    x: hasGeometry ? node.x + bounds.x : node.x,
    y: hasGeometry ? node.y + bounds.y : node.y,
    width: hasGeometry ? bounds.width : 0,
    height: hasGeometry ? bounds.height : 0,
    vectorNetwork: normalized,
    fillGeometry: normalizedGeometry,
    strokeGeometry: []
  })
}

function assignVectorNetwork(
  target: ProxyThis,
  internals: NodeProxyInternals,
  value: FigmaVectorNetwork
): void {
  const errors = validateVectorNetwork(value)
  if (errors.length > 0) throw new TypeError(`Invalid vectorNetwork: ${errors.join('; ')}`)
  validateRegionPaintMetadata(value.regions ?? [])
  const network = normalizeInputNetwork(value)
  setGeometry(target, internals, network, geometryForRegions(value.regions ?? []))
}

function vectorPathsForNetwork(network: SceneVectorNetwork): FigmaVectorPath[] {
  if (network.segments.length === 0) return []
  const regions = (network as Partial<SceneVectorNetwork>).regions ?? []
  if (regions.length === 0) {
    return vectorNetworkToSVGPaths({ ...network, regions }, null).map((data) => ({
      windingRule: 'NONE',
      data
    }))
  }

  const paths: FigmaVectorPath[] = []
  const usedSegments = new Set<number>()
  for (const region of regions) {
    for (const loop of region.loops) for (const segmentIndex of loop) usedSegments.add(segmentIndex)
    const data = vectorNetworkToSVGPaths({ ...network, regions: [region] }, null)[0]
    if (data) paths.push({ windingRule: region.windingRule, data })
  }

  const remainingSegments = network.segments.filter((_, index) => !usedSegments.has(index))
  if (remainingSegments.length > 0) {
    const data = vectorNetworkToSVGPaths(
      {
        vertices: network.vertices,
        segments: remainingSegments,
        regions: []
      },
      null
    )[0]
    if (data) paths.push({ windingRule: 'NONE', data })
  }
  return paths
}

function readVectorPaths(
  target: ProxyThis,
  internals: NodeProxyInternals
): readonly FigmaVectorPath[] {
  const node = raw(target, internals)
  const paths =
    node.vectorNetwork && node.vectorNetwork.segments.length > 0
      ? vectorPathsForNetwork(node.vectorNetwork)
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
  const regions = sourceRegions.map((region, index) => {
    const geometry = node.fillGeometry.at(index)
    return Object.freeze({
      windingRule: region.windingRule,
      loops: Object.freeze(region.loops.map((loop) => Object.freeze([...loop]))),
      fillStyleId: geometry?.fillStyleId ?? '',
      fills: Object.freeze(copyFills(geometry?.fills ?? []))
    })
  })
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
        setGeometry(this, internals, networkFromVectorPaths(value), [])
      },
      enumerable: true,
      configurable: true
    },
    vectorNetwork: {
      get(this: ProxyThis): FigmaVectorNetwork {
        return readVectorNetwork(this, internals)
      },
      set(this: ProxyThis, value: FigmaVectorNetwork) {
        assignVectorNetwork(this, internals, value)
      },
      enumerable: true,
      configurable: true
    },
    setVectorNetworkAsync: {
      value(this: ProxyThis, value: FigmaVectorNetwork): Promise<void> {
        return Promise.resolve().then(() => assignVectorNetwork(this, internals, value))
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
