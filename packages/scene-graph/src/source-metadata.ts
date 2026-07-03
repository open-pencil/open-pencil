import type { SceneNode } from './types'

const RAW_SIZE_KEYS = new Set(['width', 'height'])

const RAW_TRANSFORM_KEYS = new Set(['x', 'y', 'rotation', 'flipX', 'flipY'])

const RAW_NODE_FIELD_KEYS = new Set([
  'visible',
  'opacity',
  'blendMode',
  'fills',
  'strokes',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'independentStrokeWeights',
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
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'lineHeight',
  'leadingTrim',
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
  'maskIsOutline',
  'clipsContent'
])

export function clearEditedSourceMetadata(node: SceneNode, changeKeys: string[]): void {
  if (changeKeys.some((key) => RAW_SIZE_KEYS.has(key))) node.source.fig.rawSize = null
  if (changeKeys.some((key) => RAW_TRANSFORM_KEYS.has(key))) node.source.fig.rawTransform = null
  if (changeKeys.some((key) => RAW_NODE_FIELD_KEYS.has(key))) node.source.fig.rawNodeFields = {}
  // Export settings are persisted via plugin data, not RAW_NODE_FIELD_KEYS. Once the
  // user edits them (including clearing every row) drop the raw native exportSettings
  // so they don't resurrect from the import fallback (extractExportSettings) on reopen.
  if (changeKeys.includes('exportSettings')) {
    delete node.source.fig.rawNodeFields.exportSettings
  }
}
