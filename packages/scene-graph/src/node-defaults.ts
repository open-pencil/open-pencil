import { isEmptyObject } from 'es-toolkit/predicate'

import {
  BLACK,
  DEFAULT_FONT_FAMILY,
  DEFAULT_STROKE_MITER_LIMIT,
  DEFAULT_STROKE_WEIGHT
} from './constants'
import { createInstanceOverrideState } from './instance-overrides'
import type { NodeType, SceneNode, SourceMetadata } from './types'

/** Freezes a default value and everything in it, so layers can share one copy. */
function frozen<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry)
    Object.freeze(value)
  }
  return value
}

/**
 * Default values every new layer shares rather than allocating its own. They are frozen: a
 * change replaces a field's value, never writes into one, so a write into a default throws.
 */
const EMPTY = frozen([]) as never[]
const EMPTY_RECORD = frozen({}) as Record<string, never>
const TEXT_FILLS = frozen([
  { type: 'SOLID' as const, color: { ...BLACK }, opacity: 1, visible: true }
])

/**
 * The shared empty value for an empty array or plain object, so the layers that hold one do not
 * each keep their own; anything else is returned as it is.
 */
export function shareEmpty<T>(value: T): T {
  if (Array.isArray(value)) return value.length === 0 ? (EMPTY as T) : value
  return isEmptyObject(value) ? (EMPTY_RECORD as T) : value
}

/**
 * Source metadata with nothing recorded. The objects holding it are each layer's own, so a field
 * can be assigned; the empty lists and records in it are shared and frozen.
 */
export function createDefaultSourceMetadata(): SourceMetadata {
  return {
    format: null,
    id: null,
    orderKey: null,
    editedFields: EMPTY,
    fig: {
      rawSize: null,
      rawTransform: null,
      rawNodeFields: EMPTY_RECORD,
      layout: null,
      symbolOverrides: EMPTY,
      componentPropAssignments: EMPTY,
      derivedSymbolData: EMPTY,
      derivedSymbolDataLayoutVersion: null,
      uniformScaleFactor: null
    }
  }
}

/**
 * Every SceneNode field. Nodes start with all of them, so setting any field later keeps the
 * shape every node shares; a key added after creation turns a JavaScriptCore object into a
 * slower, larger dictionary.
 */
type CompleteNodeFields = SceneNode & Record<keyof SceneNode, unknown>

/** Where Figma aligns a new node's strokes: centered on lines and vectors, outside text, else inside. */
export function defaultStrokeAlign(type: NodeType): SceneNode['strokeAlign'] {
  if (type === 'LINE' || type === 'VECTOR') return 'CENTER'
  return type === 'TEXT' ? 'OUTSIDE' : 'INSIDE'
}

/**
 * Weight and alignment a stroke added to `node` takes: its first stroke's, or what the node keeps
 * with none. Adding a stroke from the panel and from the plugin API both go through here.
 */
export function newStrokeGeometry(
  node: Pick<SceneNode, 'strokes' | 'strokeWeight' | 'strokeAlign'>
): Pick<SceneNode['strokes'][number], 'weight' | 'align'> {
  const first = node.strokes.at(0)
  return { weight: first?.weight ?? node.strokeWeight, align: first?.align ?? node.strokeAlign }
}

export function createDefaultNode(
  generateId: () => string,
  type: NodeType,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return {
    id: generateId(),
    type,
    name: type.charAt(0) + type.slice(1).toLowerCase(),
    parentId: null,
    childIds: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    source: createDefaultSourceMetadata(),
    derivedLayout: null,
    fills: type === 'TEXT' ? TEXT_FILLS : EMPTY,
    strokes: EMPTY,
    effects: EMPTY,
    layoutGrids: EMPTY,
    guides: EMPTY,
    fillStyleId: null,
    strokeStyleId: null,
    textStyleId: null,
    effectStyleId: null,
    gridStyleId: null,
    sharedStyleType: null,
    opacity: 1,
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    independentCorners: false,
    cornerSmoothing: 0,
    visible: true,
    locked: false,
    clipsContent: false,
    text: '',
    fontSize: 14,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 400,
    italic: false,
    textAlignHorizontal: 'LEFT',
    textDirection: 'AUTO',
    textLanguage: null,
    leadingTrim: 'NONE',
    lineHeight: null,
    letterSpacing: 0,
    layoutMode: 'NONE',
    layoutDirection: 'AUTO',
    layoutWrap: 'NO_WRAP',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 0,
    counterAxisSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    blendMode: 'PASS_THROUGH',
    layoutPositioning: 'AUTO',
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    vectorNetwork: null,
    handleMirroring: 'NONE',
    fillGeometry: EMPTY,
    strokeGeometry: EMPTY,
    arcData: null,
    textAlignVertical: 'TOP',
    textAutoResize: 'NONE',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textDecorationStyle: 'SOLID',
    textDecorationThickness: null,
    textDecorationFills: EMPTY,
    textDecorationSkipInk: true,
    textUnderlineOffset: null,
    maxLines: null,
    styleRuns: EMPTY,
    fontVariations: EMPTY,
    fontFeatures: EMPTY,
    horizontalConstraint: 'MIN',
    verticalConstraint: 'MIN',
    strokeCap: 'NONE',
    strokeJoin: 'MITER',
    dashPattern: EMPTY,
    borderTopWeight: 0,
    borderRightWeight: 0,
    borderBottomWeight: 0,
    borderLeftWeight: 0,
    independentStrokeWeights: false,
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    strokeAlign: defaultStrokeAlign(type),
    strokeMiterLimit: DEFAULT_STROKE_MITER_LIMIT,
    minWidth: null,
    maxWidth: null,
    minHeight: null,
    maxHeight: null,
    isMask: false,
    maskType: 'ALPHA',
    maskIsOutline: false,
    gridTemplateColumns: EMPTY,
    gridTemplateRows: EMPTY,
    gridColumnGap: 0,
    gridRowGap: 0,
    gridPosition: null,
    counterAxisAlignContent: 'AUTO',
    itemReverseZIndex: false,
    strokesIncludedInLayout: false,
    expanded: true,
    textTruncation: 'DISABLED',
    autoRename: true,
    pointCount: 5,
    starInnerRadius: 0.38,
    componentId: null,
    instanceOverrides: createInstanceOverrideState(),
    componentPropertyDefinitions: EMPTY,
    componentPropertyReferences: EMPTY,
    componentPropertyAssignments: EMPTY_RECORD,
    componentPropertyValues: EMPTY_RECORD,
    componentKey: null,
    sourceLibraryKey: null,
    publishId: null,
    overrideKey: null,
    sharedSymbolVersion: null,
    publishedVersion: null,
    librarySource: null,
    isPublishable: false,
    isSymbolPublishable: false,
    isExposedInstance: false,
    symbolDescription: '',
    symbolLinks: EMPTY,
    variantPropSpecs: EMPTY,
    boundVariables: EMPTY_RECORD,
    variableBindingScales: EMPTY_RECORD,
    variableAssignmentScales: EMPTY_RECORD,
    componentScale: 1,
    variableModes: EMPTY_RECORD,
    exportSettings: EMPTY,
    pluginData: EMPTY,
    pluginRelaunchData: EMPTY,
    internalOnly: false,
    flipX: false,
    flipY: false,
    textPicture: null,
    derivedTextGlyphs: null,
    textPathData: null,
    textPathBox: null,
    booleanOperation: undefined,
    ...shareEmptyValues(overrides)
  } satisfies CompleteNodeFields
}

/**
 * Values to store on a layer, with empty lists and records swapped for the shared ones. A layer's
 * children are its own, as they are written in place.
 */
export function shareEmptyValues(values: Partial<SceneNode>): Partial<SceneNode> {
  const shared: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(values))
    shared[field] = field === 'childIds' ? value : shareEmpty(value)
  return shared
}

/** Containers whose bounds follow their children and that set no coordinate space, as in Figma. */
export const FITTED_CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'GROUP',
  'BOOLEAN_OPERATION'
])

export const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'GROUP',
  'BOOLEAN_OPERATION',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])
