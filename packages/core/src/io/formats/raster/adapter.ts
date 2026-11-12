import { resolveExportNodes } from '#core/io/targets'
import type { ExportRequest, IOContext, IOFormatAdapter, RasterExportOptions } from '#core/io/types'

import { headlessRenderNodes } from './headless'
import { renderNodesToImage, type RasterExportFormat } from './render'

/**
 * The export request's layers as a raster image: drawn by the host's renderer when it passes
 * one, otherwise by a headless one. A page or document is trimmed to what it draws.
 */
async function renderRaster(
  request: ExportRequest,
  options: RasterExportOptions,
  context?: IOContext
): Promise<Uint8Array | null> {
  const target = resolveExportNodes(request)
  if (!target) return null
  const renderOptions = {
    scale: options.scale ?? 1,
    format: options.format,
    quality: options.quality,
    trimTransparent: request.target.scope === 'page' || request.target.scope === 'document'
  }

  if (context?.canvasKit && context.renderer) {
    return renderNodesToImage(
      context.canvasKit,
      context.renderer,
      request.graph,
      target.pageId,
      target.nodeIds,
      renderOptions
    )
  }

  return headlessRenderNodes(request.graph, target.pageId, target.nodeIds, renderOptions)
}

/** The export adapter for a raster `format`, by its lowercase extension. */
export function rasterFormat<F extends RasterExportFormat>(
  format: F
): IOFormatAdapter<Lowercase<F>> {
  const extension = format.toLowerCase() as Lowercase<F>
  let mimeType = 'image/png'
  if (format === 'JPG') mimeType = 'image/jpeg'
  else if (format === 'WEBP') mimeType = 'image/webp'

  return {
    id: extension,
    label: format,
    role: 'derived-export',
    category: 'raster',
    extensions: [extension],
    mimeTypes: [mimeType],
    support: {
      exportDocument: true,
      exportPage: true,
      exportSelection: true,
      exportNode: true
    },
    exportOptions: {
      scale: true,
      quality: format !== 'PNG',
      colorSpace: false
    },
    async exportContent(request, options?: RasterExportOptions, context?: IOContext) {
      const data = await renderRaster(
        request,
        {
          format,
          scale: options?.scale,
          quality: options?.quality
        },
        context
      )
      if (!data) throw new Error('Nothing to export')
      return {
        format: extension,
        mimeType,
        extension,
        data
      }
    }
  }
}
