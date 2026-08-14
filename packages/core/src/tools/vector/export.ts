import { encodeBase64 } from '#core/bytes'
import type { RasterExportFormat } from '#core/io/formats/raster'
import { defineTool } from '#core/tools/schema'

export const exportSVG = defineTool({
  name: 'export_svg',
  description: 'Export nodes as SVG markup. Returns the SVG string.',
  params: {
    ids: {
      type: 'string[]',
      description: 'Node IDs to export. Omit to export all top-level nodes on the current page.'
    },
    path: {
      type: 'string',
      description: 'Write SVG to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
    }
  },
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
  params: {
    ids: {
      type: 'string[]',
      description: 'Node IDs to export. Omit to export all top-level nodes on the current page.'
    },
    path: {
      type: 'string',
      description:
        'Write PDF to this path instead of returning base64 (requires OPENPENCIL_MCP_ROOT)'
    }
  },
  execute: async (figma, args) => {
    const { renderNodesToPDF } = await import('#core/io/formats/pdf')
    const pageId = figma.currentPageId
    const ids =
      args.ids && args.ids.length > 0 ? args.ids : figma.currentPage.children.map((node) => node.id)
    const data = await renderNodesToPDF(figma.graph, pageId, ids)
    if (!data || data.length === 0) return { error: 'No visible nodes to export' }
    const base64 = encodeBase64(data)
    return { mimeType: 'application/pdf', base64, byteLength: data.length }
  }
})

export const exportImage = defineTool({
  name: 'export_image',
  description:
    'Export nodes as a raster image (PNG, JPG, or WEBP). Returns base64-encoded image data. Use to visually verify designs.',
  params: {
    ids: {
      type: 'string[]',
      description: 'Node IDs to export. Omit to export all top-level nodes on the current page.'
    },
    format: {
      type: 'string',
      description: 'Image format',
      enum: ['PNG', 'JPG', 'WEBP'],
      default: 'PNG'
    },
    scale: {
      type: 'number',
      description: 'Export scale multiplier before the maximum-edge limit is applied (default: 1)',
      default: 1,
      min: 0.1,
      max: 4
    },
    maxEdge: {
      type: 'number',
      description:
        'Maximum output width or height in pixels. Preserves aspect ratio and never upscales. Defaults to 1280 for bounded model input.',
      default: 1280,
      min: 64,
      max: 4096
    },
    path: {
      type: 'string',
      description:
        'Write image to this path instead of returning base64 (requires OPENPENCIL_MCP_ROOT)'
    }
  },
  execute: async (figma, args) => {
    if (!figma.exportImage) {
      return { error: 'Image export is not available in this environment' }
    }
    const ids =
      args.ids && args.ids.length > 0 ? args.ids : figma.currentPage.children.map((node) => node.id)
    const format = (args.format ?? 'PNG').toUpperCase() as RasterExportFormat
    const requestedScale = args.scale ?? 1
    const maxEdge = args.maxEdge ?? 1280
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
    const base64 = encodeBase64(data)
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
