import { GENERATED_FRAME_TYPES } from '@open-pencil/scene-graph'

const UNSUPPORTED_FRAGMENT_TYPES: ReadonlySet<string> = new Set([
  'STYLE',
  'STYLE_SET',
  'INTERNAL_ONLY_NODE',
  'WIDGET',
  'STAMP',
  'SHAPE_WITH_TEXT',
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

/**
 * Whether a record is dropped on paste. FigJam's generated frames are kept once their type is
 * defined as one, as a sticky note is.
 */
export function isUnsupportedFigFragmentType(type: string | undefined): boolean {
  const generated: ReadonlySet<string> = GENERATED_FRAME_TYPES
  return UNSUPPORTED_FRAGMENT_TYPES.has(type ?? '') && !generated.has(type ?? '')
}

/** Clipboard bounds exclude containers, resources, and unsupported scene records. */
export function isFigClipboardVisualType(type: string | undefined): boolean {
  return !!type && !CONTAINER_AND_RESOURCE_TYPES.has(type) && !isUnsupportedFigFragmentType(type)
}
