import { sceneNodeToJSX, selectionToJSX } from '@open-pencil/core/render'

import { exportFigFile, parseFigFile } from './formats/fig'
import { parsePenFile } from './formats/pen'
import { headlessRenderNodes, renderNodesToImage, type RasterExportFormat } from './formats/raster'
import { renderNodesToSVG } from './formats/svg'
import { extractExportGraph } from './subgraph'

import type {
  ExportRequest,
  ExportResult,
  FigWriteOptions,
  IOContext,
  IOFormatAdapter,
  JSXExportOptions,
  RasterExportOptions,
  SVGExportOptions
} from './types'

function lowerExt(name: string): string {
  const match = /\.([^.]+)$/.exec(name.toLowerCase())
  return match?.[1] ?? ''
}

function ensureSingleNode(target: ExportRequest['target']): string | null {
  if (target.scope === 'node') return target.nodeId
  if (target.scope === 'selection' && target.nodeIds.length === 1) return target.nodeIds[0]
  return null
}

function findPageId(graph: ExportRequest['graph'], nodeId: string): string | null {
  let current = graph.getNode(nodeId)
  while (current?.parentId) {
    const parent = graph.getNode(current.parentId)
    if (!parent) return null
    if (parent.type === 'CANVAS') return parent.id
    current = parent
  }
  return current?.type === 'CANVAS' ? current.id : null
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
        quality: options.quality
      }
    )
  }

  return headlessRenderNodes(request.graph, target.pageId, target.nodeIds, {
    scale,
    format: options.format,
    quality: options.quality
  })
}

function rasterFormat(format: RasterExportFormat): IOFormatAdapter {
  const extension = format === 'JPG' ? 'jpg' : format.toLowerCase()
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

export const figFormat: IOFormatAdapter = {
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
  exportOptions: {
    scale: false,
    quality: false
  },
  matchesFile(fileName) {
    return lowerExt(fileName) === 'fig'
  },
  async readDocument(input) {
    const data = input.data.slice().buffer
    const graph = await parseFigFile(data)
    return { graph, sourceFormat: 'fig' }
  },
  async writeDocument(graph, options?: FigWriteOptions, context?: IOContext) {
    const data = await exportFigFile(
      graph,
      context?.canvasKit,
      context?.renderer,
      options?.thumbnailPageId
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
      options?.thumbnailPageId ?? extracted.pageId ?? undefined
    )
    return {
      format: 'fig',
      mimeType: 'application/octet-stream',
      extension: 'fig',
      data
    }
  }
}

export const penFormat: IOFormatAdapter = {
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

export const svgFormat: IOFormatAdapter = {
  id: 'svg',
  label: 'SVG',
  role: 'derived-export',
  category: 'vector',
  extensions: ['svg'],
  mimeTypes: ['image/svg+xml'],
  support: {
    exportDocument: true,
    exportPage: true,
    exportSelection: true,
    exportNode: true
  },
  exportOptions: {
    scale: false,
    quality: false,
    colorSpace: true
  },
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

export const jsxFormat: IOFormatAdapter = {
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
  exportOptions: {
    scale: false,
    quality: false
  },
  async exportContent(request, options?: JSXExportOptions): Promise<ExportResult> {
    const format = options?.format ?? 'openpencil'
    const nodeId = ensureSingleNode(request.target)
    let data = ''
    if (nodeId) {
      data = sceneNodeToJSX(nodeId, request.graph, format)
    } else if (request.target.scope === 'selection') {
      data = selectionToJSX(request.target.nodeIds, request.graph, format)
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

export const BUILTIN_IO_FORMATS: IOFormatAdapter[] = [
  figFormat,
  penFormat,
  pngFormat,
  jpgFormat,
  webpFormat,
  svgFormat,
  jsxFormat
]
