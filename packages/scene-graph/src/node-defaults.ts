import {
  BLACK,
  DEFAULT_FONT_FAMILY,
  DEFAULT_STROKE_MITER_LIMIT,
  DEFAULT_STROKE_WEIGHT
} from './constants'
import { createInstanceOverrideState } from './instances/overrides'
import { NO_LETTER_SPACING } from './text/lengths'
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
  // A literal ending in a spread is built one field at a time, and V8 keeps an object given this
  // many fields that way in dictionary mode, about 3 KB more per layer; a spread copy of a
  // finished literal keeps fast fields, in JavaScriptCore as well.
  // Imports already supply many collections: don't allocate defaults the final spread replaces.
  const defaults = {
    id: generateId(),
    type,
    name: type.charAt(0) + type.slice(1).toLowerCase(),
    parentId: null,
    childIds: overrides.childIds ?? [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    source: overrides.source ?? createDefaultSourceMetadata(),
    derivedLayout: null,
    fills:
      overrides.fills ??
      (type === 'TEXT'
        ? [{ type: 'SOLID' as const, color: BLACK, opacity: 1, visible: true }]
        : []),
    strokes: overrides.strokes ?? [],
    effects: overrides.effects ?? [],
    layoutGrids: overrides.layoutGrids ?? [],
    guides: overrides.guides ?? [],
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
    fontStyle: null,
    textAlignHorizontal: 'LEFT',
    textDirection: 'AUTO',
    textLanguage: null,
    leadingTrim: 'NONE',
    lineHeight: null,
    letterSpacing: NO_LETTER_SPACING,
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
    fillGeometry: overrides.fillGeometry ?? [],
    strokeGeometry: overrides.strokeGeometry ?? [],
    arcData: null,
    textAlignVertical: 'TOP',
    textAutoResize: 'NONE',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textDecorationStyle: 'SOLID',
    textDecorationThickness: null,
    textDecorationFills: overrides.textDecorationFills ?? [],
    textDecorationSkipInk: true,
    textUnderlineOffset: null,
    maxLines: null,
    textParagraphs: overrides.textParagraphs ?? [],
    listSpacing: 0,
    paragraphSpacing: 0,
    paragraphIndent: 0,
    hangingList: false,
    styleRuns: overrides.styleRuns ?? [],
    fontVariations: overrides.fontVariations ?? [],
    opticalSizeFromFontSize: true,
    fontFeatures: overrides.fontFeatures ?? [],
    horizontalConstraint: 'MIN',
    verticalConstraint: 'MIN',
    strokeCap: 'NONE',
    strokeJoin: 'MITER',
    dashPattern: overrides.dashPattern ?? [],
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
    targetAspectRatio: null,
    connectorStart: null,
    connectorEnd: null,
    connectorLineType: 'ELBOWED',
    connectorStartCap: 'ROUND',
    connectorEndCap: 'ARROW_LINES',
    connectorControlPoints: overrides.connectorControlPoints ?? [],
    connectorCurveHandles: null,
    connectorLabelPosition: null,
    isMask: false,
    maskType: 'ALPHA',
    maskIsOutline: false,
    gridTemplateColumns: overrides.gridTemplateColumns ?? [],
    gridTemplateRows: overrides.gridTemplateRows ?? [],
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
    // Figma's: the golden-ratio star, whose inner points line up with its outer ones.
    starInnerRadius: (3 - Math.sqrt(5)) / 2,
    shapeWithTextType: 'SQUARE',
    shapeUserHeight: 0,
    shapeTruncates: false,
    componentId: null,
    instanceOverrides: overrides.instanceOverrides ?? createInstanceOverrideState(),
    componentPropertyDefinitions: overrides.componentPropertyDefinitions ?? [],
    componentPropertyReferences: overrides.componentPropertyReferences ?? [],
    componentPropertyAssignments: overrides.componentPropertyAssignments ?? {},
    componentPropertyValues: overrides.componentPropertyValues ?? {},
    componentKey: null,
    sourceLibraryKey: null,
    publishId: null,
    overrideKey: null,
    sharedSymbolVersion: null,
    publishedVersion: null,
    librarySource: null,
    libraryLayerId: null,
    isPublishable: false,
    isSymbolPublishable: false,
    isExposedInstance: false,
    symbolDescription: '',
    symbolLinks: overrides.symbolLinks ?? [],
    variantPropSpecs: overrides.variantPropSpecs ?? [],
    boundVariables: overrides.boundVariables ?? {},
    variableBindingScales: overrides.variableBindingScales ?? {},
    variableAssignmentScales: overrides.variableAssignmentScales ?? {},
    componentScale: 1,
    variableModes: overrides.variableModes ?? {},
    exportSettings: overrides.exportSettings ?? [],
    status: null,
    pluginData: overrides.pluginData ?? [],
    pluginRelaunchData: overrides.pluginRelaunchData ?? [],
    internalOnly: false,
    flipX: false,
    flipY: false,
    textPicture: null,
    derivedTextGlyphs: null,
    derivedTextHeight: null,
    textPathData: null,
    textPathBox: null,
    booleanOperation: undefined
  } satisfies CompleteNodeFields
  return { ...defaults, ...overrides }
}

/** Containers whose bounds follow their children and that set no coordinate space, as in Figma. */
export const FITTED_CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'GROUP',
  'BOOLEAN_OPERATION'
])

/** Layers whose stroke can take a weight per side, as Figma's `strokeTopWeight` and its siblings. */
export const SIDE_STROKE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'RECTANGLE',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/** The kinds that hold layers of their own on the canvas: what a shadow or a clip encloses. */
export const LAYER_CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

export function isLayerContainer(node: Pick<SceneNode, 'type'>): boolean {
  return LAYER_CONTAINER_TYPES.has(node.type)
}

/** The kinds that clip their children when their clip content is on. */
export const CLIPPING_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/**
 * Whether a layer clips its children: a frame, component, component set or instance with clip
 * content on. A section or group has no such setting in Figma and never clips, whatever an import
 * left in `clipsContent` (Figma desktop, live).
 */
export function clipsChildren(node: Pick<SceneNode, 'type' | 'clipsContent'>): boolean {
  return node.clipsContent && CLIPPING_TYPES.has(node.type)
}

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
