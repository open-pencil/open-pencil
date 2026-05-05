import { defineTool } from '#core/tools/schema'

import type { RasterExportFormat } from '#core/io/formats/raster'

const CHUNK_SIZE = 0x8000

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export const exportSvg = defineTool({
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

export const exportPdf = defineTool({
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
    const base64 = uint8ArrayToBase64(data)
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
      description: 'Export scale multiplier (default: 1)',
      default: 1,
      min: 0.1,
      max: 4
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
    const data = await figma.exportImage(ids, {
      scale: args.scale ?? 1,
      format
    })
    if (!data || data.length === 0) return { error: 'No visible nodes to export' }
    const base64 = uint8ArrayToBase64(data)
    const mimeMap = { PNG: 'image/png', JPG: 'image/jpeg', WEBP: 'image/webp' } as const
    return {
      mimeType: mimeMap[format],
      base64,
      byteLength: data.length
    }
  }
})
