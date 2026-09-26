import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import type { RenderColorSpace } from '@open-pencil/scene-graph/color'

import type { SkiaRenderer } from '#core/canvas'

import type { RasterExportFormat } from './formats/raster'

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
  renderThumbnail?: boolean
}

export interface RasterExportOptions {
  scale?: number
  quality?: number
  colorSpace?: RenderColorSpace
  format: RasterExportFormat
}

export interface SVGExportOptions {
  xmlDeclaration?: boolean
  colorSpace?: RenderColorSpace
}

/** A file written next to an export's main file, at a path relative to it. */
export interface ExportAsset {
  path: string
  content: IOData
}

export interface ExportResult {
  format: string
  mimeType: string
  extension: string
  data: IOData
  encoding?: IOTextEncoding
  /** Extra files the main file refers to, such as external images and fonts. */
  assets?: ExportAsset[]
}

export interface HTMLExportOptions {
  html?: 'fragment' | 'standalone'
  style?: 'inline' | 'tailwind'
  assets?: 'inline' | 'external'
  /** `assets` ships web fonts with external assets. */
  fonts?: 'assets' | 'none'
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
  colorSpace?: boolean
}

export interface IOFormatAdapter<Id extends string = string> {
  id: Id
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
