import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import type { RasterExportFormat } from '#core/io/formats/raster'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

const exportInputs = {
  ids: v.optional(
    v.pipe(
      v.array(v.string()),
      v.minLength(1),
      v.description('Node IDs to export. Omit to export all top-level nodes on the current page.')
    )
  ),
  path: v.optional(
    v.pipe(
      v.string(),
      v.description(
        'Write exported data to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
      )
    )
  )
}

export const exportSVG = defineTool({
  name: 'export_svg',
  description: 'Export nodes as SVG markup. Returns the SVG string.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({ ...exportInputs }),
  execute: async (figma, args) => {
    const { renderNodesToSVG } = await import('#core/io/formats/svg')
    const pageId = figma.currentPageId
    const ids =
      args.ids && args.ids.length > 0 ? args.ids : figma.currentPage.children.map((node) => node.id)
    const svg = renderNodesToSVG(figma.graph, pageId, ids)
    if (!svg) return { error: 'No visible nodes to export' }
    return { svg }
  }
})

export const exportPDF = defineTool({
  name: 'export_pdf',
  description:
    'Export nodes as a vector PDF document. Text remains selectable, paths stay sharp at any zoom. Returns base64-encoded PDF data.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({ ...exportInputs }),
  execute: async (figma, args) => {
    const { renderNodesToPDF } = await import('#core/io/formats/pdf')
    const pageId = figma.currentPageId
    const ids =
      args.ids && args.ids.length > 0 ? args.ids : figma.currentPage.children.map((node) => node.id)
    const data = await renderNodesToPDF(figma.graph, pageId, ids)
    if (!data || data.length === 0) return { error: 'No visible nodes to export' }
    const base64 = fromUint8Array(data)
    return { mimeType: 'application/pdf', base64, byteLength: data.length }
  }
})

export const exportImage = defineTool({
  name: 'export_image',
  description:
    'Export nodes as a raster image (PNG, JPG, or WEBP). Returns base64-encoded image data. Use to visually verify designs.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({
    ...exportInputs,
    format: v.optional(
      v.pipe(v.picklist(['PNG', 'JPG', 'WEBP']), v.description('Image format')),
      'PNG'
    ),
    scale: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(0.1),
          v.maxValue(4),
          v.description(
            'Export scale multiplier before the maximum-edge limit is applied (default: 1)'
          )
        )
      ),
      1
    ),
    maxEdge: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(64),
          v.maxValue(4096),
          v.description(
            'Maximum output width or height in pixels. Preserves aspect ratio and never upscales. Defaults to 1280 for bounded model input.'
          )
        )
      ),
      1280
    )
  }),
  execute: async (figma, args) => {
    if (!figma.exportImage) {
      return { error: 'Image export is not available in this environment' }
    }
    const ids =
      args.ids && args.ids.length > 0 ? args.ids : figma.currentPage.children.map((node) => node.id)
    const format = args.format.toUpperCase() as RasterExportFormat
    const requestedScale = args.scale
    const maxEdge = args.maxEdge
    const nodes = ids.map((id) => figma.getNodeById(id)).filter((node) => node !== null)
    if (nodes.length === 0) return { error: 'No visible nodes to export' }
    const bounds = nodes.reduce(
      (result, node) => {
        const box = node.absoluteBoundingBox
        const minX = Math.min(result.minX, box.x)
        const minY = Math.min(result.minY, box.y)
        const maxX = Math.max(result.maxX, box.x + box.width)
        const maxY = Math.max(result.maxY, box.y + box.height)
        return { minX, minY, maxX, maxY }
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    const longestEdge = Math.max(width, height)
    const boundedScale = longestEdge > 0 ? Math.min(requestedScale, maxEdge / longestEdge) : 0
    if (boundedScale <= 0) return { error: 'No visible nodes to export' }
    const data = await figma.exportImage(ids, {
      scale: boundedScale,
      format
    })
    if (!data || data.length === 0) return { error: 'No visible nodes to export' }
    const base64 = fromUint8Array(data)
    const mimeMap = { PNG: 'image/png', JPG: 'image/jpeg', WEBP: 'image/webp' } as const
    return {
      mimeType: mimeMap[format],
      base64,
      byteLength: data.length,
      width: Math.ceil(width * boundedScale),
      height: Math.ceil(height * boundedScale),
      scale: boundedScale
    }
  }
})
