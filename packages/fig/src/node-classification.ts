const UNSUPPORTED_FRAGMENT_TYPES: ReadonlySet<string> = new Set([
  'STYLE',
  'STYLE_SET',
  'INTERNAL_ONLY_NODE',
  'WIDGET',
  'STAMP',
  'STICKY',
  'SHAPE_WITH_TEXT',
  'CONNECTOR',
  'CODE_BLOCK',
  'TABLE_NODE',
  'TABLE_CELL',
  'SECTION_OVERLAY',
  'SLIDE',
  'VARIABLE_COLLECTION'
])

const CONTAINER_AND_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'DOCUMENT',
  'CANVAS',
  'VARIABLE_SET',
  'VARIABLE'
])

export function isUnsupportedFigFragmentType(type: string | undefined): boolean {
  return UNSUPPORTED_FRAGMENT_TYPES.has(type ?? '')
}

/** Clipboard bounds exclude containers, resources, and unsupported scene records. */
export function isFigClipboardVisualType(type: string | undefined): boolean {
  return !!type && !CONTAINER_AND_RESOURCE_TYPES.has(type) && !isUnsupportedFigFragmentType(type)
}
