import {
  BLACK,
  DEFAULT_FONT_FAMILY,
  DEFAULT_STROKE_MITER_LIMIT,
  DEFAULT_STROKE_WEIGHT
} from './constants'
import { createInstanceOverrideState } from './instance-overrides'
import type { NodeType, SceneNode, SourceMetadata } from './types'

export function createDefaultSourceMetadata(): SourceMetadata {
  return {
    format: null,
    id: null,
    orderKey: null,
    editedFields: [],
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
    fills:
      type === 'TEXT' ? [{ type: 'SOLID' as const, color: BLACK, opacity: 1, visible: true }] : [],
    strokes: [],
    effects: [],
    layoutGrids: [],
    guides: [],
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
    fillGeometry: [],
    strokeGeometry: [],
    arcData: null,
    textAlignVertical: 'TOP',
    textAutoResize: 'NONE',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textDecorationStyle: 'SOLID',
    textDecorationThickness: null,
    textDecorationFills: [],
    textDecorationSkipInk: true,
    textUnderlineOffset: null,
    maxLines: null,
    styleRuns: [],
    fontVariations: [],
    fontFeatures: [],
    horizontalConstraint: 'MIN',
    verticalConstraint: 'MIN',
    strokeCap: 'NONE',
    strokeJoin: 'MITER',
    dashPattern: [],
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
    gridTemplateColumns: [],
    gridTemplateRows: [],
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
    componentPropertyDefinitions: [],
    componentPropertyReferences: [],
    componentPropertyAssignments: {},
    componentPropertyValues: {},
    componentKey: null,
    sourceLibraryKey: null,
    publishId: null,
    overrideKey: null,
    sharedSymbolVersion: null,
    publishedVersion: null,
    librarySource: null,
    isPublishable: false,
    isSymbolPublishable: false,
    symbolDescription: '',
    symbolLinks: [],
    variantPropSpecs: [],
    boundVariables: {},
    variableBindingScales: {},
    variableAssignmentScales: {},
    componentScale: 1,
    variableModes: {},
    exportSettings: [],
    pluginData: [],
    pluginRelaunchData: [],
    internalOnly: false,
    flipX: false,
    flipY: false,
    textPicture: null,
    derivedTextGlyphs: null,
    textPathData: null,
    textPathBox: null,
    booleanOperation: undefined,
    ...overrides
  } satisfies CompleteNodeFields
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
