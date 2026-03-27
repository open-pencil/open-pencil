import type { JSXFormat } from '../render'
import type { RasterExportFormat } from '../render-image'
import type { SkiaRenderer } from '../renderer'
import type { SceneGraph } from '../scene-graph'
import type { CanvasKit } from 'canvaskit-wasm'

export type IOFormatRole = 'native-document' | 'interchange-document' | 'derived-export'

export type IOFormatCategory = 'document' | 'raster' | 'vector' | 'code' | 'print'

export type IOTextEncoding = 'utf8'

export type IOBinaryData = Uint8Array
export type IOTextData = string
export type IOData = IOBinaryData | IOTextData

export interface ReadDocumentInput {
  name?: string
  mimeType?: string
  data: Uint8Array
}

export interface ReadDocumentResult {
  graph: SceneGraph
  sourceFormat: string
}

export interface ExportTargetDocument {
  scope: 'document'
}

export interface ExportTargetPage {
  scope: 'page'
  pageId: string
}

export interface ExportTargetSelection {
  scope: 'selection'
  nodeIds: string[]
}

export interface ExportTargetNode {
  scope: 'node'
  nodeId: string
}

export type ExportTarget =
  | ExportTargetDocument
  | ExportTargetPage
  | ExportTargetSelection
  | ExportTargetNode

export interface ExportRequest {
  graph: SceneGraph
  target: ExportTarget
  fileName?: string
}

export interface IOContext {
  canvasKit?: CanvasKit
  renderer?: SkiaRenderer
}

export interface FigWriteOptions {
  thumbnailPageId?: string
}

export interface RasterExportOptions {
  scale?: number
  quality?: number
  format: RasterExportFormat
}

export interface SVGExportOptions {
  xmlDeclaration?: boolean
}

export interface JSXExportOptions {
  format?: JSXFormat
}

export interface ExportResult {
  format: string
  mimeType: string
  extension: string
  data: IOData
  encoding?: IOTextEncoding
}

export interface IOFormatSupport {
  readDocument?: boolean
  writeDocument?: boolean
  exportDocument?: boolean
  exportPage?: boolean
  exportSelection?: boolean
  exportNode?: boolean
}

export interface IOFormatExportOptions {
  scale?: boolean
  quality?: boolean
}

export interface IOFormatAdapter {
  id: string
  label: string
  role: IOFormatRole
  category: IOFormatCategory
  extensions: string[]
  mimeTypes: string[]
  support: IOFormatSupport
  exportOptions?: IOFormatExportOptions

  matchesFile?(fileName: string, mimeType?: string): boolean

  readDocument?(input: ReadDocumentInput, context?: IOContext): Promise<ReadDocumentResult>
  writeDocument?(graph: SceneGraph, options?: unknown, context?: IOContext): Promise<ExportResult>
  exportContent?(
    request: ExportRequest,
    options?: unknown,
    context?: IOContext
  ): Promise<ExportResult>
}
