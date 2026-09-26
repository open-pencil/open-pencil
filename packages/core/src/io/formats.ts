import { parsePenFile } from '@open-pencil/pen'

import { sceneNodeToJSX, selectionToJSX } from '#core/design-jsx'

import { exportFigFile, parseFigFile } from './formats/fig'
import type { PPTXExportOptions } from './formats/pptx'
import { headlessRenderNodes, renderNodesToImage, type RasterExportFormat } from './formats/raster'
import { renderNodesToSVG } from './formats/svg'
import { extractExportGraph, findPageId } from './subgraph'
import type {
  ExportRequest,
  ExportResult,
  FigWriteOptions,
  HTMLExportOptions,
  IOContext,
  IOFormatAdapter,
  IOFormatExportOptions,
  IOFormatSupport,
  RasterExportOptions,
  SVGExportOptions
} from './types'

/** Formats that export a document, page, selection, or single node alike. */
const EXPORT_EVERY_TARGET: IOFormatSupport = {
  exportDocument: true,
  exportPage: true,
  exportSelection: true,
  exportNode: true
}

/** Formats with a size of their own, so no export scale or quality. */
const FIXED_SIZE_EXPORT: IOFormatExportOptions = { scale: false, quality: false }

function lowerExt(name: string): string {
  const match = /\.([^.]+)$/.exec(name.toLowerCase())
  return match?.[1] ?? ''
}

function ensureSingleNode(target: ExportRequest['target']): string | null {
  if (target.scope === 'node') return target.nodeId
  if (target.scope === 'selection' && target.nodeIds.length === 1) return target.nodeIds[0]
  return null
}

function resolveExportNodes(request: ExportRequest): { pageId: string; nodeIds: string[] } | null {
  switch (request.target.scope) {
    case 'document': {
      const page = request.graph.getPages()[0]
      return { pageId: page.id, nodeIds: page.childIds }
    }
    case 'page': {
      const page = request.graph.getNode(request.target.pageId)
      if (!page) return null
      return { pageId: page.id, nodeIds: page.childIds }
    }
    case 'selection': {
      const first = request.target.nodeIds[0]
      if (!first) return null
      const pageId = findPageId(request.graph, first)
      if (!pageId) return null
      if (!request.target.nodeIds.every((nodeId) => findPageId(request.graph, nodeId) === pageId)) {
        throw new Error('Export selection must stay on a single page')
      }
      return { pageId, nodeIds: request.target.nodeIds }
    }
    case 'node':
      return resolveExportNodes({
        ...request,
        target: { scope: 'selection', nodeIds: [request.target.nodeId] }
      })
    default:
      return null
  }
}

async function renderRaster(
  request: ExportRequest,
  options: RasterExportOptions,
  context?: IOContext
): Promise<Uint8Array | null> {
  const target = resolveExportNodes(request)
  if (!target) return null
  const scale = options.scale ?? 1

  if (context?.canvasKit && context.renderer) {
    return renderNodesToImage(
      context.canvasKit,
      context.renderer,
      request.graph,
      target.pageId,
      target.nodeIds,
      {
        scale,
        format: options.format,
        quality: options.quality,
        trimTransparent: request.target.scope === 'page' || request.target.scope === 'document'
      }
    )
  }

  return headlessRenderNodes(request.graph, target.pageId, target.nodeIds, {
    scale,
    format: options.format,
    quality: options.quality,
    trimTransparent: request.target.scope === 'page' || request.target.scope === 'document'
  })
}

function rasterFormat<F extends RasterExportFormat>(format: F): IOFormatAdapter<Lowercase<F>> {
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

export const figFormat: IOFormatAdapter<'fig'> = {
  id: 'fig',
  label: 'OpenPencil Document',
  role: 'native-document',
  category: 'document',
  extensions: ['fig'],
  mimeTypes: ['application/octet-stream'],
  support: {
    readDocument: true,
    writeDocument: true,
    exportDocument: true,
    exportPage: true,
    exportSelection: true,
    exportNode: true
  },
  exportOptions: FIXED_SIZE_EXPORT,
  matchesFile(fileName) {
    return lowerExt(fileName) === 'fig'
  },
  async readDocument(input) {
    const data = input.data.slice().buffer
    const graph = await parseFigFile(data, { populate: 'first-page' })
    return { graph, sourceFormat: 'fig' }
  },
  async writeDocument(graph, options?: FigWriteOptions, context?: IOContext) {
    const data = await exportFigFile(
      graph,
      context?.canvasKit,
      context?.renderer,
      options?.thumbnailPageId,
      options?.renderThumbnail ?? false
    )
    return {
      format: 'fig',
      mimeType: 'application/octet-stream',
      extension: 'fig',
      data
    }
  },
  async exportContent(request, options?: FigWriteOptions, context?: IOContext) {
    const extracted = extractExportGraph(request.graph, request.target)
    const data = await exportFigFile(
      extracted.graph,
      context?.canvasKit,
      context?.renderer,
      options?.thumbnailPageId ?? extracted.pageId ?? undefined,
      options?.renderThumbnail ?? false
    )
    return {
      format: 'fig',
      mimeType: 'application/octet-stream',
      extension: 'fig',
      data
    }
  }
}

export const penFormat: IOFormatAdapter<'pen'> = {
  id: 'pen',
  label: 'Pencil Document',
  role: 'interchange-document',
  category: 'document',
  extensions: ['pen'],
  mimeTypes: ['application/json', 'text/plain'],
  support: {
    readDocument: true
  },
  matchesFile(fileName, mimeType) {
    return lowerExt(fileName) === 'pen' || mimeType === 'application/json'
  },
  async readDocument(input) {
    const text = new TextDecoder().decode(input.data)
    const graph = parsePenFile(text)
    return { graph, sourceFormat: 'pen' }
  }
}

export const pngFormat = rasterFormat('PNG')
export const jpgFormat = rasterFormat('JPG')
export const webpFormat = rasterFormat('WEBP')

export const svgFormat: IOFormatAdapter<'svg'> = {
  id: 'svg',
  label: 'SVG',
  role: 'derived-export',
  category: 'vector',
  extensions: ['svg'],
  mimeTypes: ['image/svg+xml'],
  support: EXPORT_EVERY_TARGET,
  exportOptions: { ...FIXED_SIZE_EXPORT, colorSpace: true },
  async exportContent(request, options?: SVGExportOptions) {
    const target = resolveExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    const data = renderNodesToSVG(request.graph, target.pageId, target.nodeIds, options)
    if (!data) throw new Error('Nothing to export')
    return {
      format: 'svg',
      mimeType: 'image/svg+xml',
      extension: 'svg',
      data,
      encoding: 'utf8'
    }
  }
}

export const pdfFormat: IOFormatAdapter<'pdf'> = {
  id: 'pdf',
  label: 'PDF',
  role: 'derived-export',
  category: 'vector',
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  support: EXPORT_EVERY_TARGET,
  exportOptions: FIXED_SIZE_EXPORT,
  async exportContent(request) {
    const target = resolveExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    const { renderNodesToPDF } = await import('./formats/pdf')
    const data = await renderNodesToPDF(request.graph, target.pageId, target.nodeIds)
    if (!data) throw new Error('Nothing to export')
    return {
      format: 'pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      data
    }
  }
}

/**
 * Every top-level frame becomes a slide, so a PPTX document export spans all
 * pages — the shared resolver only reaches the first one.
 */
function resolvePPTXExportNodes(
  request: ExportRequest
): { pageId: string; nodeIds: string[] } | null {
  if (request.target.scope !== 'document') return resolveExportNodes(request)
  const pages = request.graph.getPages()
  if (!pages.length) return null
  return { pageId: pages[0].id, nodeIds: pages.flatMap((page) => page.childIds) }
}

export const pptxFormat: IOFormatAdapter<'pptx'> = {
  id: 'pptx',
  label: 'PowerPoint',
  role: 'derived-export',
  category: 'print',
  extensions: ['pptx'],
  mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  support: EXPORT_EVERY_TARGET,
  exportOptions: FIXED_SIZE_EXPORT,
  async exportContent(request, options?: PPTXExportOptions, context?: IOContext) {
    const target = resolvePPTXExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    const { renderNodesToPPTX } = await import('./formats/pptx')
    const data = await renderNodesToPPTX(request.graph, target.pageId, target.nodeIds, {
      ...options,
      context: options?.context ?? context
    })
    if (!data) throw new Error('Nothing to export')
    return {
      format: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: 'pptx',
      data
    }
  }
}

export const jsxFormat: IOFormatAdapter<'jsx'> = {
  id: 'jsx',
  label: 'JSX',
  role: 'derived-export',
  category: 'code',
  extensions: ['jsx'],
  mimeTypes: ['text/plain', 'text/jsx'],
  support: {
    exportSelection: true,
    exportNode: true
  },
  exportOptions: FIXED_SIZE_EXPORT,
  async exportContent(request): Promise<ExportResult> {
    const nodeId = ensureSingleNode(request.target)
    let data = ''
    if (nodeId) {
      data = sceneNodeToJSX(nodeId, request.graph)
    } else if (request.target.scope === 'selection') {
      data = selectionToJSX(request.target.nodeIds, request.graph)
    }
    if (!data) throw new Error('Nothing to export')
    return {
      format: 'jsx',
      mimeType: 'text/plain',
      extension: 'jsx',
      data,
      encoding: 'utf8'
    }
  }
}

export const htmlFormat: IOFormatAdapter<'html'> = {
  id: 'html',
  label: 'HTML',
  role: 'derived-export',
  category: 'code',
  extensions: ['html'],
  mimeTypes: ['text/html'],
  support: EXPORT_EVERY_TARGET,
  exportOptions: FIXED_SIZE_EXPORT,
  async exportContent(request, options?: HTMLExportOptions) {
    const target = resolveExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    const { renderNodesToHTML } = await import('./formats/html')
    const { html, assets } = await renderNodesToHTML(
      request.graph,
      target.nodeIds,
      options,
      request.fileName
    )
    return {
      format: 'html',
      mimeType: 'text/html',
      extension: 'html',
      data: html,
      encoding: 'utf8',
      assets
    }
  }
}

export const tailwindJSXFormat: IOFormatAdapter<'tailwind-jsx'> = {
  id: 'tailwind-jsx',
  label: 'Tailwind JSX',
  role: 'derived-export',
  category: 'code',
  extensions: ['jsx'],
  mimeTypes: ['text/plain', 'text/jsx'],
  support: EXPORT_EVERY_TARGET,
  exportOptions: FIXED_SIZE_EXPORT,
  async exportContent(request) {
    const target = resolveExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    const { sceneNodesToTailwindJSX } = await import('@open-pencil/dom-css/export')
    const data = sceneNodesToTailwindJSX(request.graph, target.nodeIds)
    if (!data) throw new Error('Nothing to export')
    return {
      format: 'tailwind-jsx',
      mimeType: 'text/plain',
      extension: 'jsx',
      data,
      encoding: 'utf8'
    }
  }
}

export const BUILTIN_IO_FORMATS = [
  figFormat,
  penFormat,
  pngFormat,
  jpgFormat,
  webpFormat,
  svgFormat,
  pdfFormat,
  pptxFormat,
  jsxFormat,
  tailwindJSXFormat,
  htmlFormat
] as const satisfies readonly IOFormatAdapter[]

export type BuiltinIOFormatId = (typeof BUILTIN_IO_FORMATS)[number]['id']
