import type { RasterExportFormat } from '#core/io/formats/raster'

export type FigmaTransform = [[number, number, number], [number, number, number]]

/** Raster export request; `pageId` names the page holding the nodes (default: the current page). */
export interface ExportImageOptions {
  scale?: number
  format?: RasterExportFormat
  quality?: number
  pageId?: string
}
