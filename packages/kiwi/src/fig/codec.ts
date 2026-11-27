/**
 * Message Encoding/Decoding for Figma Multiplayer
 *
 * Uses:
 * - kiwi-schema: Binary serialization (by Evan Wallace, Figma co-founder)
 * - fzstd: Browser-compatible Zstd decompression
 */

import { compileSchema, encodeBinarySchema } from '../schema-runtime'
import { decompressFigKiwiData, loadFigDataDecompressor } from './container'
import { isZstdCompressed, getKiwiMessageType } from './protocol'
import type { FigmaMessage, NodeChange } from './records'
import figmaSchema from './schema'
import type { Color } from './types'

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
  await loadFigDataDecompressor()
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
  return decompressFigKiwiData(data)
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

export type {
  AssetRef,
  CodeComponentId,
  Effect,
  FigmaMessage,
  ImageSource,
  NodeChange,
  Paint,
  ParentIndex,
  PluginData,
  PluginRelaunchData,
  StyleReference,
  TextLineData,
  VariableAliasValue,
  VariableAnyValue,
  VariableConsumptionEntry,
  VariableDataEntry,
  VariableDataValuesEntry,
  VideoSource
} from './records'

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
