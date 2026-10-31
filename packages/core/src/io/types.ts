import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import type { RenderColorSpace } from '@open-pencil/scene-graph/color'

import type { SkiaRenderer } from '#core/canvas'
import type { IconProvider } from '#core/icons'

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
  /**
   * Reads a file a document names relative to itself, such as a `.pen` document's images; null
   * when it cannot. Hosts that know where the document lives pass it.
   */
  readAsset?(path: string): Promise<Uint8Array | null>
  /**
   * Reads a document a document imports, such as a `.pen` library, or a file an imported document
   * names, by its path relative to the document being read, which may lead out of its folder;
   * null when it cannot. Without it, imports are left unresolved.
   */
  readImport?(path: string): Promise<Uint8Array | null>
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
  /** Where documents' icons come from; Iconify unless a host passes its own. */
  icons?: IconProvider
}

export interface FigWriteOptions {
  thumbnailPageId?: string
  renderThumbnail?: boolean
  /** The name the file's `meta.json` records; the export's `fileName` without `.fig` otherwise. */
  documentName?: string
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
  /**
   * The format stores layout intent rather than the sizes it implies, so reading lays the layers
   * out, measuring text with whatever measurer is installed.
   */
  laysOutOnRead?: boolean

  matchesFile?(fileName: string, mimeType?: string): boolean

  readDocument?(input: ReadDocumentInput, context?: IOContext): Promise<ReadDocumentResult>
  writeDocument?(graph: SceneGraph, options?: unknown, context?: IOContext): Promise<ExportResult>
  exportContent?(
    request: ExportRequest,
    options?: unknown,
    context?: IOContext
  ): Promise<ExportResult>
}
