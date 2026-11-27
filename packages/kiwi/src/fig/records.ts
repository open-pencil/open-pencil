import type { Color, EasingDataValue, GUID, Matrix, PaintFilter, Vector } from './types'

export interface ParentIndex {
  guid: GUID
  position: string
}

export interface ImageSource {
  hash: string | Uint8Array
  name?: string
  dataBlob?: number
}

export interface VideoSource {
  hash: string | Uint8Array
}

export interface Paint {
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE'
    | 'VIDEO'
    | 'PATTERN'
    | 'NOISE'
    | 'CUSTOM'
  color?: Color
  opacity?: number
  visible?: boolean
  blendMode?: string
  stops?: { color: Color; position: number }[]
  transform?: Matrix
  image?: ImageSource
  imageThumbnail?: ImageSource
  animatedImage?: ImageSource
  video?: VideoSource
  imageScaleMode?: string
  /** Degrees an image turns in Fill, Fit, and Tile; a crop's transform holds its own turn. */
  rotation?: number
  /** An image's adjustments; the schema has no `saturation`, and `vibrance` holds Figma's. */
  paintFilter?: PaintFilter
  sourceNodeId?: GUID
  scale?: number
  spacing?: number
  patternSpacing?: Vector
  patternTileType?: string
  verticalAlignment?: string
  horizontalAlignment?: string
  id?: GUID
  altText?: string
  noiseType?: string
  density?: number
  noiseSize?: Vector
  customEffectId?: CodeComponentId
  componentPropAssignments?: unknown[]
  colorVar?: VariableDataEntry
}

export interface Effect {
  /**
   * Every type the schema's `EffectType` has. `LAYER_BLUR` is the plugin API's name for
   * `FOREGROUND_BLUR`, and `GRAIN` its `TEXTURE`.
   */
  type:
    | 'DROP_SHADOW'
    | 'INNER_SHADOW'
    | 'LAYER_BLUR'
    | 'BACKGROUND_BLUR'
    | 'FOREGROUND_BLUR'
    | 'GLASS'
    | 'NOISE'
    | 'GRAIN'
    | 'REPEAT'
    | 'SYMMETRY'
    | 'CUSTOM'
  color?: Color
  offset?: Vector
  radius?: number
  visible?: boolean
  spread?: number
  blendMode?: string
  showShadowBehindNode?: boolean
  /** A glass effect's depth, which Figma's plugin API calls `depth`. */
  refractionRadius?: number
  /** A glass effect's `refraction`. */
  refractionIntensity?: number
  /** A glass effect's `lightAngle`, in degrees. */
  specularAngle?: number
  /** A glass effect's `lightIntensity`. */
  specularIntensity?: number
  /** A glass effect's `dispersion`. */
  chromaticAberration?: number
  /** Figma writes 1 on every glass effect and has no control for it. */
  bevelSize?: number
  /** `PROGRESSIVE` on a progressive blur; a normal blur leaves it out. */
  blurOpType?: 'NORMAL' | 'PROGRESSIVE'
  /** Where a progressive blur starts and ends, as fractions of the layer's size. */
  startOffset?: Vector
  endOffset?: Vector
  /** A progressive blur's radius at its start; `radius` is the radius at its end. */
  startRadius?: number
  /** A noise effect's `MONOTONE`, `DUOTONE`, or `MULTITONE`. */
  noiseType?: 'MONOTONE' | 'DUOTONE' | 'MULTITONE'
  /** A noise or grain effect's grain size, the same on both axes as Figma writes it. */
  noiseSize?: Vector
  /** A noise effect's coverage, 0 to 1. */
  density?: number
  /** A duotone noise effect's second colour. */
  secondaryColor?: Color
  /** A multitone noise effect's opacity. */
  opacity?: number
  /** Whether a grain effect keeps the roughened layer inside its outline. */
  clipToShape?: boolean
  /** Picks a noise or grain effect's pattern; Figma leaves it out for the default pattern. */
  seed?: number
  /** A shader effect's definition, as a shader paint names its own. */
  customEffectId?: CodeComponentId
  colorVar?: VariableDataEntry
  radiusVar?: VariableDataEntry
  spreadVar?: VariableDataEntry
  xVar?: VariableDataEntry
  yVar?: VariableDataEntry
}

/** A reference to a variable: by GUID in the file, or by key in a library. */
export interface VariableAliasValue {
  guid?: GUID
  assetRef?: { key: string; version?: string }
}

export interface VariableAnyValue {
  boolValue?: boolean
  textValue?: string
  floatValue?: number
  colorValue?: Color
  alias?: VariableAliasValue
  symbolIdValue?: { guid?: GUID }
  // fig.kiwi PropRefValue: the component property a parameter entry points at.
  propRefValue?: { defId?: GUID }
  mapValue?: { values?: { key?: string; guidKey?: GUID; value?: VariableDataEntry }[] }
  colorArrayValue?: { colors?: VariableDataEntry[] }
  fontStyleValue?: {
    asString?: VariableDataEntry
    asFloat?: VariableDataEntry
    asVariations?: VariableDataEntry
  }
  expressionValue?: {
    expressionFunction?: string
    expressionArguments?: VariableDataEntry[]
  }
  easingValue?: EasingDataValue
}

export interface VariableDataEntry {
  value?: VariableAnyValue
  dataType?: string
  resolvedDataType?: string
}

export interface VariableConsumptionEntry {
  nodeField?: number
  variableData?: VariableDataEntry
  variableField?: string
}

export interface VariableDataValuesEntry {
  modeID: GUID
  variableData: VariableDataEntry
}

export interface PluginData {
  pluginID: string
  value: string
  key: string
}

export interface PluginRelaunchData {
  pluginID: string
  message: string
  command: string
  isDeleted: boolean
}

export interface AssetRef {
  key: string
  version?: string
}

export type StyleReference = { guid: GUID; assetRef?: never } | { guid?: never; assetRef: AssetRef }

export type CodeComponentId = StyleReference

/** One paragraph of a text: whether it is a list item, and how deeply it nests. */
export interface TextLineData {
  lineType?: 'PLAIN' | 'ORDERED_LIST' | 'UNORDERED_LIST' | 'BLOCKQUOTE' | 'HEADER'
  styleId?: number
  indentationLevel?: number
  sourceDirectionality?: string
  listStartOffset?: number
  isFirstLineOfList?: boolean
}

export interface NodeChange {
  [key: string]: unknown
  guid?: GUID
  phase?: 'CREATED' | 'REMOVED'
  parentIndex?: ParentIndex
  type?: string
  name?: string
  visible?: boolean
  locked?: boolean
  opacity?: number
  blendMode?: string
  size?: Vector
  transform?: Matrix
  cornerRadius?: number
  fillPaints?: Paint[]
  strokePaints?: Paint[]
  backgroundPaints?: Paint[]
  strokeWeight?: number
  strokeAlign?: string
  strokeCap?: string
  strokeJoin?: string
  dashPattern?: number[]
  effects?: Effect[]
  mask?: boolean
  maskType?: string
  maskIsOutline?: boolean
  exportSettings?: unknown[]
  layoutGrids?: unknown[]
  // Layout
  stackMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  stackSpacing?: number
  stackPadding?: number
  stackPaddingRight?: number
  stackPaddingBottom?: number
  stackCounterAlign?: string
  stackJustify?: string
  stackCounterAlignItems?: string
  stackPrimaryAlignItems?: string
  stackPrimarySizing?: 'FIXED' | 'RESIZE_TO_FIT' | 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE'
  stackCounterSizing?: 'FIXED' | 'RESIZE_TO_FIT' | 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE'
  stackVerticalPadding?: number
  stackHorizontalPadding?: number
  stackWrap?: string
  stackPositioning?: string
  stackChildPrimaryGrow?: number
  stackChildAlignSelf?: string
  stackCounterSpacing?: number
  minSize?: { value?: Vector }
  maxSize?: { value?: Vector }
  targetAspectRatio?: { value?: Vector }
  // Frame
  clipsContent?: boolean
  frameMaskDisabled?: boolean
  resizeToFit?: boolean
  // Vector
  booleanOperation?: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'XOR'
  vectorData?: unknown
  fillGeometry?: Array<{ windingRule?: string; commandsBlob?: number; styleID?: number }>
  strokeGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  // Text
  fontSize?: number
  fontWeight?: number
  fontName?: { family: string; style: string; postscript?: string }
  textAlignHorizontal?: string
  textAlignVertical?: string
  textAutoResize?: string
  textData?: {
    characters: string
    lines?: TextLineData[]
    characterStyleIDs?: number[]
    styleOverrideTable?: NodeChange[]
  }
  derivedTextData?: {
    layoutSize?: Vector
    baselines?: Array<{
      firstCharacter: number
      endCharacter: number
      position: Vector
      width: number
      lineY?: number
      lineHeight: number
      lineAscent: number
    }>
    glyphs?: Array<{
      commandsBlob?: number
      position: Vector
      fontSize: number
      /** The character the glyph draws; Figma leaves it out for list markers. */
      firstCharacter?: number
      advance: number
      /** Radians along the text path; kiwi omits the field for axis-aligned text. */
      rotation?: number
      /** An emoji's code points; Figma draws its image in place of the glyph's placeholder. */
      emojiCodePoints?: number[]
      /** The image set the emoji is drawn from; left out for the default, APPLE. */
      emojiImageSet?: 'APPLE' | 'NOTO'
    }>
    /** Underlines and strikethroughs, which Figma draws saved text's decorations from. */
    decorations?: Array<{
      rects: Array<{ x: number; y: number; w: number; h: number }>
      /** The override table entry of the characters decorated, or 0 for the text's own style. */
      styleID: number
    }>
    fontMetaData?: Array<{
      key: { family: string; style: string; postscript?: string }
      fontLineHeight: number
      fontDigest?: Uint8Array | Record<string, number>
      fontStyle?: string
      fontWeight?: number
    }>
    logicalIndexToCharacterOffsetMap?: number[]
    derivedLines?: Array<{ directionality: 'LTR' | 'RTL' }>
    truncationStartIndex?: number
    truncatedHeight?: number
  }
  styleType?: string
  styleIdForText?: StyleReference
  styleIdForFill?: StyleReference
  styleIdForStrokeFill?: StyleReference
  styleIdForEffect?: StyleReference
  styleIdForGrid?: StyleReference
  textUserLayoutVersion?: number
  textExplicitLayoutVersion?: number
  textBidiVersion?: number
  textDecoration?: string
  textDecorationSkipInk?: boolean
  textDecorationFillPaints?: Paint[]
  textUnderlineOffset?: { value?: number; units?: string }
  textDecorationThickness?: { value?: number; units?: string }
  textDecorationStyle?: string
  toggledOnOTFeatures?: string[]
  toggledOffOTFeatures?: string[]
  fontVariations?: Array<{ axisTag?: number; axisName?: string; value?: number }>
  fontVariantCommonLigatures?: boolean
  fontVariantContextualLigatures?: boolean
  fontVariantDiscretionaryLigatures?: boolean
  fontVariantHistoricalLigatures?: boolean
  fontVariantOrdinal?: boolean
  fontVariantSlashedZero?: boolean
  fontVariantNumericFigure?: string
  fontVariantNumericSpacing?: string
  fontVariantNumericFraction?: string
  fontVariantCaps?: string
  fontVersion?: string
  emojiImageSet?: string
  lineHeight?: { value: number; units: string }
  letterSpacing?: { value: number; units: string }
  paragraphSpacing?: number
  paragraphIndent?: number
  listSpacing?: number
  hangingList?: boolean
  // Symbol/Instance
  symbolData?: { symbolID: GUID }
  // ComponentSet
  isStateGroup?: boolean
  stateGroupPropertyValueOrders?: Array<{ property: string; values: string[] }>
  // Internal
  internalOnly?: boolean
  // Corners
  rectangleTopLeftCornerRadius?: number
  rectangleTopRightCornerRadius?: number
  rectangleBottomLeftCornerRadius?: number
  rectangleBottomRightCornerRadius?: number
  rectangleCornerRadiiIndependent?: boolean
  cornerSmoothing?: number
  /** A polygon's sides or a star's points. */
  count?: number
  /** A star's inner radius as a share of its outer one. */
  starInnerScale?: number
  // Constraints
  horizontalConstraint?: string
  verticalConstraint?: string
  // Prototype
  prototypeStartNodeID?: GUID
  prototypeInteractions?: unknown[]
  transitionInfo?: unknown
  // Variables
  variableData?: VariableDataEntry
  variableConsumptionMap?: { entries?: VariableConsumptionEntry[] }
  // fig.kiwi declares this as the same VariableDataMap as variableConsumptionMap.
  parameterConsumptionMap?: { entries?: VariableConsumptionEntry[] }
  variableSetModes?: Array<{ id: GUID; name: string; sortPosition?: string }>
  variableSetID?: { guid?: GUID; assetRef?: { key: string; version?: string } }
  variableResolvedType?: string
  variableDataValues?: { entries?: VariableDataValuesEntry[] }
  variableScopes?: string[]
  codeSyntax?: { entries?: Array<{ platform: string; value: string }> }
  description?: string
  symbolDescription?: string
  isPublishable?: boolean
  documentColorProfile?: 'SRGB' | 'DISPLAY_P3'
  pluginData?: PluginData[]
  pluginRelaunchData?: PluginRelaunchData[]
}

export interface FigmaMessage {
  type: string
  sessionID?: number
  ackID?: number
  reconnectSequenceNumber?: number
  nodeChanges?: NodeChange[]
  blobs?: Array<{ bytes: Uint8Array }>
}
