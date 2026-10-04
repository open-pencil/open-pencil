/**
 * Message Encoding/Decoding for Figma Multiplayer
 *
 * Uses:
 * - kiwi-schema: Binary serialization (by Evan Wallace, Figma co-founder)
 * - fzstd: Browser-compatible Zstd decompression
 */

import { decompress as zstdDecompress } from 'fzstd'

import { compileSchema, encodeBinarySchema } from '../schema-runtime'
import { isZstdCompressed, getKiwiMessageType } from './protocol'
import figmaSchema from './schema'
import type { Color, GUID, Matrix, Vector } from './types'

interface CompiledSchema {
  encodeMessage(message: unknown): Uint8Array
  decodeMessage(data: Uint8Array): unknown
  encodePaint(paint: unknown): Uint8Array
  encodeNodeChange(nodeChange: unknown): Uint8Array
}

let compiledSchema: CompiledSchema | null = null

/**
 * Initialize the codec (compiles Kiwi schema)
 */
export async function initCodec(): Promise<void> {
  if (compiledSchema) return
  compiledSchema = compileSchema(figmaSchema) as CompiledSchema
}

export function getCompiledSchema() {
  if (!compiledSchema) throw new Error('Codec not initialized')
  return compiledSchema
}

export function getSchemaBytes(): Uint8Array {
  return encodeBinarySchema(figmaSchema)
}

/**
 * Check if codec is initialized
 */
export function isCodecReady(): boolean {
  return compiledSchema !== null
}

/**
 * Compress data using Zstd (Bun native)
 */
export function compress(data: Uint8Array): Uint8Array {
  return data
}

/**
 * Decompress Zstd data (Bun native)
 */
export function decompress(data: Uint8Array): Uint8Array {
  if (!isZstdCompressed(data)) return data
  return zstdDecompress(data)
}

/**
 * Encode a message for sending to Figma
 * Handles variable bindings in fillPaints which require custom encoding
 */
export function encodeMessage(message: FigmaMessage): Uint8Array {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }
  return compress(compiledSchema.encodeMessage(message))
}

/**
 * Decode a message received from Figma
 */
export function decodeMessage(data: Uint8Array): FigmaMessage {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }

  const decompressed = decompress(data)
  return compiledSchema.decodeMessage(decompressed) as FigmaMessage
}

/**
 * Quick peek at message type without full decoding
 */
export function peekMessageType(data: Uint8Array): number | null {
  try {
    const decompressed = decompress(data)
    return getKiwiMessageType(decompressed)
  } catch {
    return null
  }
}

// Type definitions

export type { Color, GUID, Matrix, Vector } from './types'

export interface ParentIndex {
  guid: GUID
  position: string
}

export interface ImageSource {
  hash: string | Uint8Array
  name?: string
  dataBlob?: number
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
  imageScaleMode?: string
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
  customEffectId?: { guid?: GUID }
  colorVar?: {
    value?: {
      alias?: {
        guid?: GUID
        assetRef?: { key: string; version?: string }
      }
    }
    dataType?: string
    resolvedDataType?: string
  }
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color?: Color
  offset?: Vector
  radius?: number
  visible?: boolean
  spread?: number
  blendMode?: string
  showShadowBehindNode?: boolean
}

export interface VariableAnyValue {
  boolValue?: boolean
  textValue?: string
  floatValue?: number
  colorValue?: Color
  alias?: { guid?: GUID; assetRef?: { key: string; version?: string } }
  symbolIdValue?: { guid?: GUID }
  // fig.kiwi PropRefValue: the component property a parameter entry points at.
  propRefValue?: { defId?: GUID }
  expressionValue?: {
    expressionFunction?: string
    expressionArguments?: VariableDataEntry[]
  }
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
    lines?: Array<{ lineType?: string; styleId?: number; indentationLevel?: number }>
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
      firstCharacter: number
      advance: number
      /** Radians along the text path; kiwi omits the field for axis-aligned text. */
      rotation?: number
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

/**
 * Create a NODE_CHANGES message
 */
export function createNodeChangesMessage(
  sessionID: number,
  reconnectSequenceNumber: number,
  nodeChanges: NodeChange[],
  ackID = 1
): FigmaMessage {
  return {
    type: 'NODE_CHANGES',
    sessionID,
    ackID,
    reconnectSequenceNumber,
    nodeChanges
  }
}

/**
 * Create a node change for a new shape
 */
export function createNodeChange(opts: {
  sessionID: number
  localID: number
  parentSessionID: number
  parentLocalID: number
  position?: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  fill?: Color
  stroke?: Color
  strokeWeight?: number
  cornerRadius?: number
  opacity?: number
}): NodeChange {
  const change: NodeChange = {
    guid: { sessionID: opts.sessionID, localID: opts.localID },
    phase: 'CREATED',
    parentIndex: {
      guid: { sessionID: opts.parentSessionID, localID: opts.parentLocalID },
      position: opts.position || '!'
    },
    type: opts.type,
    name: opts.name,
    visible: true,
    opacity: opts.opacity ?? 1.0,
    size: { x: opts.width, y: opts.height },
    transform: {
      m00: 1,
      m01: 0,
      m02: opts.x,
      m10: 0,
      m11: 1,
      m12: opts.y
    }
  }

  if (opts.fill) {
    change.fillPaints = [
      {
        type: 'SOLID',
        color: opts.fill,
        opacity: 1.0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  }

  if (opts.stroke) {
    change.strokePaints = [
      {
        type: 'SOLID',
        color: opts.stroke,
        opacity: 1.0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
    change.strokeWeight = opts.strokeWeight ?? 1
  }

  if (opts.cornerRadius !== undefined) {
    change.cornerRadius = opts.cornerRadius
  }

  return change
}

export { parseVariableId } from './variable-bindings'
