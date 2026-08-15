import { isEqual } from 'es-toolkit/predicate'

import type {
  Fill,
  FillType,
  GeometryPath,
  SceneNode,
  SourceMetadata
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import type { Matrix, Vector } from '@open-pencil/scene-graph/primitives'

const DERIVED_NODE_FIELDS = new Set<keyof SceneNode>(['textPicture'])
const FILL_TYPES = new Set<FillType>([
  'SOLID',
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND',
  'IMAGE',
  'VIDEO',
  'PATTERN',
  'NOISE',
  'CUSTOM'
])

type YjsNodeLike = {
  entries(): IterableIterator<[string, unknown]>
}

export function encodeNodeForYjs(node: SceneNode): Record<string, unknown> {
  const encoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (DERIVED_NODE_FIELDS.has(key as keyof SceneNode)) continue
    encoded[key] = structuredClone(value)
  }
  return encoded
}

export function syncEncodedNodeToYMap(
  node: SceneNode,
  ynode: {
    delete(key: string): void
    get(key: string): unknown
    has(key: string): boolean
    set(key: string, value: unknown): void
  }
): void {
  for (const key of DERIVED_NODE_FIELDS) {
    if (ynode.has(key)) ynode.delete(key)
  }
  for (const [key, value] of Object.entries(encodeNodeForYjs(node))) {
    if (!isEqual(ynode.get(key), value)) ynode.set(key, value)
  }
}

export function decodeNodeFromYjs(ynode: YjsNodeLike): Partial<SceneNode> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of ynode.entries()) {
    if (DERIVED_NODE_FIELDS.has(key as keyof SceneNode)) continue
    props[key] = structuredClone(value)
  }

  props.source = normalizeSourceMetadata(props.source)
  if ('fillGeometry' in props) props.fillGeometry = normalizeGeometryPaths(props.fillGeometry)
  if ('strokeGeometry' in props) props.strokeGeometry = normalizeGeometryPaths(props.strokeGeometry)
  props.textPicture = null
  return props as Partial<SceneNode>
}

export function normalizeSourceMetadata(source: unknown): SourceMetadata {
  const defaults = createDefaultSourceMetadata()
  if (!isRecord(source)) return defaults

  const fig = isRecord(source.fig) ? source.fig : {}
  return {
    format: source.format === 'fig' ? 'fig' : null,
    id: stringOrNull(source.id),
    orderKey: stringOrNull(source.orderKey),
    editedFields: stringArray(source.editedFields),
    fig: {
      rawSize: normalizeVector(fig.rawSize),
      rawTransform: normalizeMatrix(fig.rawTransform),
      rawNodeFields: isRecord(fig.rawNodeFields) ? structuredClone(fig.rawNodeFields) : {},
      layout: isRecord(fig.layout)
        ? (structuredClone(fig.layout) as SourceMetadata['fig']['layout'])
        : null,
      symbolOverrides: arrayOrEmpty(fig.symbolOverrides),
      componentPropAssignments: arrayOrEmpty(fig.componentPropAssignments),
      derivedSymbolData: arrayOrEmpty(fig.derivedSymbolData),
      derivedSymbolDataLayoutVersion: numberOrNull(fig.derivedSymbolDataLayoutVersion),
      uniformScaleFactor: numberOrNull(fig.uniformScaleFactor)
    }
  }
}

function normalizeGeometryPaths(value: unknown): GeometryPath[] {
  if (!Array.isArray(value)) return []
  const paths: GeometryPath[] = []
  for (const item of value) {
    if (!isRecord(item) || !(item.commandsBlob instanceof Uint8Array)) continue
    const path: GeometryPath = {
      windingRule: item.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO',
      commandsBlob: new Uint8Array(item.commandsBlob)
    }
    const fills = normalizeFills(item.fills)
    if (fills.length > 0) path.fills = copyFills(fills)
    if (typeof item.fillStyleId === 'string') path.fillStyleId = item.fillStyleId
    paths.push(path)
  }
  return paths
}

function normalizeVector(value: unknown): Vector | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null
  return { x: value.x, y: value.y }
}

function normalizeMatrix(value: unknown): Matrix | null {
  if (!isRecord(value)) return null
  const entries = [value.m00, value.m01, value.m02, value.m10, value.m11, value.m12]
  if (!entries.every((item) => isFiniteNumber(item))) return null
  return {
    m00: value.m00 as number,
    m01: value.m01 as number,
    m02: value.m02 as number,
    m10: value.m10 as number,
    m11: value.m11 as number,
    m12: value.m12 as number
  }
}

function normalizeFills(value: unknown): Fill[] {
  return Array.isArray(value) ? value.filter(isFill) : []
}

function isFill(value: unknown): value is Fill {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    FILL_TYPES.has(value.type as FillType) &&
    isColor(value.color) &&
    isFiniteNumber(value.opacity) &&
    typeof value.visible === 'boolean' &&
    isOptionalGradientStops(value.gradientStops) &&
    isOptionalMatrix(value.gradientTransform) &&
    isOptionalMatrix(value.imageTransform) &&
    isOptionalVector(value.patternSpacing) &&
    isOptionalVector(value.noiseSize)
  )
}

function isOptionalGradientStops(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((stop) => isRecord(stop) && isFiniteNumber(stop.position) && isColor(stop.color)))
  )
}

function isOptionalMatrix(value: unknown): boolean {
  return value === undefined || normalizeMatrix(value) !== null
}

function isOptionalVector(value: unknown): boolean {
  return value === undefined || normalizeVector(value) !== null
}

function isColor(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.r) &&
    isFiniteNumber(value.g) &&
    isFiniteNumber(value.b) &&
    isFiniteNumber(value.a)
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? structuredClone(value) : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
