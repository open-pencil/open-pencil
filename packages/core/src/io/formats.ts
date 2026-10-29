import { groupBy } from 'es-toolkit'
import { filename } from 'pathe/utils'

import { sceneNodeToJSX, selectionToJSX } from '@open-pencil/design-jsx'
import { isDrawIOExportFileName } from '@open-pencil/drawio'
import {
  buildPenGraph,
  isDataURL,
  parsePenDocument,
  penAssets,
  type PenIconRequest,
  type PenIconSource
} from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { defaultIcons, drawIcon, type IconData, type IconProvider } from '#core/icons'
import { layoutAuthoredNodes } from '#core/layout'

import type { DrawIOExportTarget } from './formats/drawio/export'
import { exportFigFile, parseFigFile } from './formats/fig'
import type { PPTXExportOptions } from './formats/pptx'
import { headlessRenderNodes, renderNodesToImage, type RasterExportFormat } from './formats/raster'
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
  ReadDocumentInput,
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
    return writeFig(graph, options, context, options?.thumbnailPageId)
  },
  async exportContent(request, options?: FigWriteOptions, context?: IOContext) {
    // A whole document is written as it is, so one opened from an archive keeps that archive.
    if (request.target.scope === 'document')
      return writeFig(request.graph, options, context, options?.thumbnailPageId, request.fileName)
    const extracted = extractExportGraph(request.graph, request.target)
    return writeFig(
      extracted.graph,
      options,
      context,
      options?.thumbnailPageId ?? extracted.pageId ?? undefined,
      request.fileName
    )
  }
}

/** A `.fig` named as asked, or else after the file it is written to, or else Untitled. */
async function writeFig(
  graph: SceneGraph,
  options: FigWriteOptions | undefined,
  context: IOContext | undefined,
  pageId: string | undefined,
  fileName?: string
): Promise<ExportResult> {
  const data = await exportFigFile(graph, {
    ck: context?.canvasKit,
    renderer: context?.renderer,
    pageId,
    renderHeadlessThumbnail: options?.renderThumbnail ?? false,
    documentName: options?.documentName ?? (fileName && filename(fileName))
  })
  return { format: 'fig', mimeType: 'application/octet-stream', extension: 'fig', data }
}

/** The size icons are fetched at; each is scaled to the box it is drawn in. */
const PEN_ICON_SIZE = 24

/**
 * An image's bytes: a data URL decoded by the platform's own URL handling, a file through the
 * host; null when either fails.
 */
async function loadPenImage(url: string, input: ReadDocumentInput): Promise<Uint8Array | null> {
  try {
    if (!isDataURL(url)) return (await input.readAsset?.(url)) ?? null
    // Through `URL`, which lowercases the scheme for runtimes that only fetch `data:`.
    return new Uint8Array(await (await fetch(new URL(url))).arrayBuffer())
  } catch {
    return null
  }
}

async function loadPenImages(
  urls: readonly string[],
  input: ReadDocumentInput
): Promise<Map<string, Uint8Array>> {
  const images = new Map<string, Uint8Array>()
  await Promise.all(
    urls.map(async (url) => {
      const bytes = await loadPenImage(url, input)
      if (bytes) images.set(url, bytes)
    })
  )
  return images
}

/** Icons from `provider`; a document whose icons cannot be fetched opens with empty icons. */
/** A request's options as a key, so requests drawn the same way share a fetch. */
const optionsKey = (options: Record<string, number> | undefined) => JSON.stringify(options ?? null)

/**
 * Icons from `provider`, fetched once for each way they are drawn; a document whose icons cannot
 * be fetched opens with empty icons.
 */
async function loadPenIcons(
  requests: readonly PenIconRequest[],
  provider: IconProvider
): Promise<PenIconSource> {
  const glyphs = new Map<string, IconData>()
  const byOptions = groupBy(requests, (request) => optionsKey(request.options))
  await Promise.all(
    Object.values(byOptions).map(async (group) => {
      const names = group.map((request) => request.name)
      const found = await provider
        .icons(names, PEN_ICON_SIZE, group[0]?.options)
        .catch(() => new Map<string, IconData>())
      for (const [name, icon] of found)
        glyphs.set(`${name}\0${optionsKey(group[0]?.options)}`, icon)
    })
  )
  return {
    draw(graph, frameId, name, size, color, options) {
      const icon = glyphs.get(`${name}\0${optionsKey(options)}`)
      if (!icon) return false
      drawIcon(graph, frameId, icon, size, color)
      return true
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
  laysOutOnRead: true,
  matchesFile(fileName, mimeType) {
    return lowerExt(fileName) === 'pen' || mimeType === 'application/json'
  },
  async readDocument(input, context) {
    const doc = parsePenDocument(new TextDecoder().decode(input.data))
    const assets = penAssets(doc)
    const [images, icons] = await Promise.all([
      loadPenImages(assets.images, input),
      loadPenIcons(assets.icons, context?.icons ?? defaultIcons)
    ])
    // A .pen file stores its layout intent, not the sizes and positions it implies.
    const graph = buildPenGraph(doc, {
      images,
      icons,
      layout: (target) =>
        layoutAuthoredNodes(
          target,
          target.getPages().map((page) => page.id)
        )
    })
    return { graph, sourceFormat: 'pen' }
  }
}

export const drawioFormat: IOFormatAdapter<'drawio'> = {
  id: 'drawio',
  label: 'draw.io Diagram',
  role: 'interchange-document',
  category: 'document',
  extensions: ['drawio', 'dio'],
  mimeTypes: ['application/vnd.jgraph.mxfile'],
  support: {
    readDocument: true,
    writeDocument: true,
    exportDocument: true,
    exportPage: true,
    exportSelection: true,
    exportNode: true
  },
  exportOptions: FIXED_SIZE_EXPORT,
  laysOutOnRead: true,
  // A draw.io PNG or SVG export opens as its diagram when its name says it is one.
  matchesFile(fileName, mimeType) {
    const ext = lowerExt(fileName)
    return (
      ext === 'drawio' ||
      ext === 'dio' ||
      isDrawIOExportFileName(fileName) ||
      mimeType === 'application/vnd.jgraph.mxfile'
    )
  },
  async readDocument(input) {
    const { readDrawIOBytes } = await import('@open-pencil/drawio')
    const { drawioToSceneGraph } = await import('./formats/drawio')
    const file = readDrawIOBytes(input.data)
    if (!file) throw new Error('This file holds no draw.io diagram')
    if (file.unreadable.length > 0) {
      throw new Error(`Could not read the draw.io pages ${file.unreadable.join(', ')}`)
    }
    const graph = drawioToSceneGraph(file)
    // draw.io stores label text, not the sizes it lays out to.
    layoutAuthoredNodes(
      graph,
      graph.getPages().map((page) => page.id)
    )
    return { graph, sourceFormat: 'drawio' }
  },
  async writeDocument(graph) {
    const pageIds = graph.getPages().map((page) => page.id)
    return writeDrawIO(graph, { pageIds })
  },
  // A page or a selection goes as a one-page diagram; the document, every page.
  async exportContent(request) {
    if (request.target.scope === 'document') {
      const pageIds = request.graph.getPages().map((page) => page.id)
      return writeDrawIO(request.graph, { pageIds })
    }
    const target = resolveExportNodes(request)
    if (!target) throw new Error('Nothing to export')
    return writeDrawIO(request.graph, target)
  }
}

export const mermaidFormat: IOFormatAdapter<'mermaid'> = {
  id: 'mermaid',
  label: 'Mermaid Diagram',
  role: 'interchange-document',
  category: 'document',
  extensions: ['mmd', 'mermaid'],
  mimeTypes: ['text/vnd.mermaid'],
  support: {
    readDocument: true
  },
  laysOutOnRead: true,
  matchesFile(fileName, mimeType) {
    const ext = lowerExt(fileName)
    return ext === 'mmd' || ext === 'mermaid' || mimeType === 'text/vnd.mermaid'
  },
  async readDocument(input) {
    const { detectMermaidDiagram } = await import('@open-pencil/mermaid')
    const text = new TextDecoder().decode(input.data)
    if (!detectMermaidDiagram(text)) throw new Error('This file holds no Mermaid flowchart')
    // Mermaid stores a diagram's structure, which reading lays out with its text measured.
    const { mermaidToSceneGraph } = await import('./formats/mermaid')
    return { graph: await mermaidToSceneGraph(text), sourceFormat: 'mermaid' }
  }
}

/** Pages or layers as a draw.io file, loading the writer only when one is saved. */
async function writeDrawIO(graph: SceneGraph, target: DrawIOExportTarget): Promise<ExportResult> {
  const { writeDrawIOFile } = await import('@open-pencil/drawio')
  const { sceneGraphToDrawIO } = await import('./formats/drawio')
  return {
    format: 'drawio',
    mimeType: 'application/vnd.jgraph.mxfile',
    extension: 'drawio',
    data: writeDrawIOFile(sceneGraphToDrawIO(graph, target)),
    encoding: 'utf8'
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
    const { renderNodesToLaidOutSVG } = await import('./formats/svg/text/layout')
    const data = await renderNodesToLaidOutSVG(
      request.graph,
      target.pageId,
      target.nodeIds,
      options
    )
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
    // Embedded, as Figma embeds every face its PDFs draw.
    const { exportPDFDocument } = await import('./formats/pdf/document')
    const data = (await exportPDFDocument(request.graph, [target], { embedFonts: true }))?.data
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
    const { vectorElement } = await import('#core/io/formats/html/vectors')
    const data = sceneNodesToTailwindJSX(request.graph, target.nodeIds, { vectorElement })
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
  drawioFormat,
  mermaidFormat,
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
