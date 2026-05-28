import type { SceneNode, SourceMetadata } from './types'

export function createDefaultSourceMetadata(): SourceMetadata {
  return {
    format: null,
    id: null,
    orderKey: null,
    fig: {
      rawSize: null,
      rawTransform: null,
      rawNodeFields: {},
      layout: null,
      symbolOverrides: [],
      componentPropAssignments: [],
      derivedSymbolData: [],
      derivedSymbolDataLayoutVersion: null,
      uniformScaleFactor: null
    }
  }
}

const RAW_SIZE_KEYS = new Set(['width', 'height'])

const RAW_TRANSFORM_KEYS = new Set(['x', 'y', 'rotation', 'flipX', 'flipY'])

const RAW_NODE_FIELD_KEYS = new Set([
  'visible',
  'opacity',
  'blendMode',
  'fills',
  'strokes',
  'effects',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'cornerSmoothing',
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
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
  'textTruncation',
  'layoutMode',
  'itemSpacing',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'primaryAxisSizing',
  'counterAxisSizing',
  'primaryAxisAlign',
  'counterAxisAlign',
  'layoutWrap',
  'counterAxisSpacing',
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'counterAxisAlignContent',
  'itemReverseZIndex',
  'strokesIncludedInLayout',
  'layoutDirection',
  'horizontalConstraint',
  'verticalConstraint',
  'strokeCap',
  'strokeJoin',
  'strokeMiterLimit',
  'dashPattern',
  'arcData',
  'vectorNetwork',
  'fillGeometry',
  'strokeGeometry',
  'isMask',
  'maskType',
  'clipsContent'
])

export function clearEditedSourceMetadata(node: SceneNode, changeKeys: string[]): void {
  node.source = normalizeSourceMetadata(node.source)
  if (changeKeys.some((key) => RAW_SIZE_KEYS.has(key))) node.source.fig.rawSize = null
  if (changeKeys.some((key) => RAW_TRANSFORM_KEYS.has(key))) node.source.fig.rawTransform = null
  if (changeKeys.some((key) => RAW_NODE_FIELD_KEYS.has(key))) node.source.fig.rawNodeFields = {}
}

export function normalizeSourceMetadata(source: unknown): SourceMetadata {
  const defaults = createDefaultSourceMetadata()
  if (!source || typeof source !== 'object') return defaults
  const value = source as Partial<SourceMetadata>
  const fig: Partial<SourceMetadata['fig']> =
    value.fig && typeof value.fig === 'object' ? value.fig : {}
  return {
    format: value.format === 'fig' ? 'fig' : null,
    id: typeof value.id === 'string' ? value.id : null,
    orderKey: typeof value.orderKey === 'string' ? value.orderKey : null,
    fig: {
      rawSize: fig.rawSize ?? null,
      rawTransform: fig.rawTransform ?? null,
      rawNodeFields:
        fig.rawNodeFields && typeof fig.rawNodeFields === 'object' ? fig.rawNodeFields : {},
      layout: fig.layout ?? null,
      symbolOverrides: Array.isArray(fig.symbolOverrides) ? fig.symbolOverrides : [],
      componentPropAssignments: Array.isArray(fig.componentPropAssignments)
        ? fig.componentPropAssignments
        : [],
      derivedSymbolData: Array.isArray(fig.derivedSymbolData) ? fig.derivedSymbolData : [],
      derivedSymbolDataLayoutVersion:
        typeof fig.derivedSymbolDataLayoutVersion === 'number'
          ? fig.derivedSymbolDataLayoutVersion
          : null,
      uniformScaleFactor: typeof fig.uniformScaleFactor === 'number' ? fig.uniformScaleFactor : null
    }
  }
}
