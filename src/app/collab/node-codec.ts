import type { GeometryPath, SceneNode, SourceMetadata } from '@open-pencil/core/scene-graph'
import { normalizeSourceMetadata } from '@open-pencil/core/scene-graph'

const ENCODED_UINT8_ARRAY_TYPE = 'Uint8Array'

type EncodedUint8Array = {
  __type: typeof ENCODED_UINT8_ARRAY_TYPE
  data: number[]
}

type YjsNodeLike = {
  entries(): IterableIterator<[string, unknown]>
}

export const COLLAB_NODE_FIELDS = [
  'id',
  'type',
  'name',
  'parentId',
  'childIds',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'source',
  'figmaDerivedLayout',
  'fills',
  'strokes',
  'effects',
  'opacity',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'cornerSmoothing',
  'visible',
  'locked',
  'clipsContent',
  'blendMode',
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
  'textDirection',
  'textAlignVertical',
  'textAutoResize',
  'textCase',
  'textDecoration',
  'lineHeight',
  'letterSpacing',
  'maxLines',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'horizontalConstraint',
  'verticalConstraint',
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'vectorNetwork',
  'booleanOperation',
  'fillGeometry',
  'strokeGeometry',
  'arcData',
  'strokeCap',
  'strokeJoin',
  'dashPattern',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'independentStrokeWeights',
  'strokeMiterLimit',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'isMask',
  'maskType',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap',
  'gridPosition',
  'counterAxisAlignContent',
  'itemReverseZIndex',
  'strokesIncludedInLayout',
  'expanded',
  'textTruncation',
  'autoRename',
  'pointCount',
  'starInnerRadius',
  'componentId',
  'overrides',
  'componentPropertyDefinitions',
  'componentPropertyValues',
  'componentKey',
  'sourceLibraryKey',
  'publishId',
  'overrideKey',
  'sharedSymbolVersion',
  'publishedVersion',
  'isPublishable',
  'isSymbolPublishable',
  'symbolDescription',
  'symbolLinks',
  'variantPropSpecs',
  'boundVariables',
  'pluginData',
  'pluginRelaunchData',
  'internalOnly',
  'flipX',
  'flipY',
  'figmaDerivedTextGlyphs'
] as const satisfies readonly (keyof SceneNode)[]

const COLLAB_NODE_FIELD_SET = new Set<keyof SceneNode>(COLLAB_NODE_FIELDS)

const LEGACY_JSON_FIELDS = new Set<keyof SceneNode>([
  'childIds',
  'source',
  'figmaDerivedLayout',
  'fills',
  'strokes',
  'effects',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'vectorNetwork',
  'fillGeometry',
  'strokeGeometry',
  'arcData',
  'dashPattern',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridPosition',
  'overrides',
  'componentPropertyDefinitions',
  'componentPropertyValues',
  'symbolLinks',
  'variantPropSpecs',
  'boundVariables',
  'pluginData',
  'pluginRelaunchData',
  'figmaDerivedTextGlyphs'
])

export function encodeNodeForYjs(node: SceneNode): Record<string, unknown> {
  const encoded: Record<string, unknown> = {}
  for (const key of COLLAB_NODE_FIELDS) {
    encoded[key] = encodeYjsValue(node[key])
  }
  encoded.textPicture = null
  return encoded
}

export function syncEncodedNodeToYMap(
  node: SceneNode,
  ynode: { set(key: string, value: unknown): void }
) {
  const encoded = encodeNodeForYjs(node)
  for (const [key, value] of Object.entries(encoded)) {
    ynode.set(key, value)
  }
}

export function decodeNodeFromYjs(ynode: YjsNodeLike): Partial<SceneNode> {
  const props: Record<string, unknown> = {}

  for (const [key, value] of ynode.entries()) {
    if (key !== 'textPicture' && !COLLAB_NODE_FIELD_SET.has(key as keyof SceneNode)) continue
    props[key] = decodeNodeField(key, value)
  }

  props.source = normalizeSourceMetadata(props.source)
  if ('fillGeometry' in props) props.fillGeometry = decodeGeometryPaths(props.fillGeometry)
  if ('strokeGeometry' in props) props.strokeGeometry = decodeGeometryPaths(props.strokeGeometry)
  if ('textPicture' in props) props.textPicture = null

  return props as Partial<SceneNode>
}

function decodeNodeField(key: string, value: unknown): unknown {
  const fieldValue = LEGACY_JSON_FIELDS.has(key as keyof SceneNode) ? parseLegacyJson(value) : value
  return decodeYjsValue(fieldValue)
}

function encodeYjsValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return encodeUint8Array(value)
  if (Array.isArray(value)) return value.map(encodeYjsValue)
  if (isRecord(value)) {
    const encoded: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      encoded[key] = encodeYjsValue(child)
    }
    return encoded
  }
  return value
}

function decodeYjsValue(value: unknown): unknown {
  if (isEncodedUint8Array(value)) return Uint8Array.from(value.data)
  if (Array.isArray(value)) return value.map(decodeYjsValue)
  if (isRecord(value)) {
    const decoded: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      decoded[key] = decodeYjsValue(child)
    }
    return decoded
  }
  return value
}

function encodeUint8Array(value: Uint8Array): EncodedUint8Array {
  return { __type: ENCODED_UINT8_ARRAY_TYPE, data: [...value] }
}

function isEncodedUint8Array(value: unknown): value is EncodedUint8Array {
  if (!isRecord(value)) return false
  return value.__type === ENCODED_UINT8_ARRAY_TYPE && isNumberArray(value.data)
}

function decodeGeometryPaths(value: unknown): GeometryPath[] {
  if (!Array.isArray(value)) return []
  const paths: GeometryPath[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const commandsBlob = decodeCommandsBlob(item.commandsBlob)
    if (!commandsBlob) continue
    paths.push({
      windingRule: item.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO',
      commandsBlob
    })
  }
  return paths
}

function decodeCommandsBlob(value: unknown): Uint8Array | null {
  const decoded = decodeYjsValue(value)
  if (decoded instanceof Uint8Array) return decoded
  if (isLegacyUint8ArrayRecord(decoded)) {
    return Uint8Array.from(
      Object.entries(decoded)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, item]) => item)
    )
  }
  return null
}

function parseLegacyJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function isLegacyUint8ArrayRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length === 0) return false
  return entries.every(
    ([key, item]) =>
      /^\d+$/.test(key) &&
      typeof item === 'number' &&
      Number.isInteger(item) &&
      item >= 0 &&
      item <= 255
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !ArrayBuffer.isView(value)
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
  )
}

export type { EncodedUint8Array }
export type { SourceMetadata }
