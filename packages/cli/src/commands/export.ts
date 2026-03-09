import { defineCommand } from 'citty'
import { basename, extname, resolve } from 'node:path'

import { renderNodesToSVG, sceneNodeToJSX, selectionToJSX } from '@open-pencil/core'

import { loadDocument, loadFonts, exportNodes, exportThumbnail } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { ok, printError } from '../format'
import type { ExportFormat, JSXFormat } from '@open-pencil/core'

const RASTER_FORMATS = ['PNG', 'JPG', 'WEBP']
const ALL_FORMATS = [...RASTER_FORMATS, 'SVG', 'JSX']
const JSX_STYLES = ['openpencil', 'tailwind']

interface ExportArgs {
  file?: string
  output?: string
  format: string
  scale: string
  quality?: string
  page?: string
  node?: string
  style: string
  thumbnail?: boolean
  width: string
  height: string
}

async function writeAndLog(path: string, content: string | Uint8Array) {
  await Bun.write(path, content)
  const size = typeof content === 'string' ? content.length : content.length
  console.log(ok(`Exported ${path} (${(size / 1024).toFixed(1)} KB)`))
}

async function exportViaApp(format: string, args: ExportArgs) {
  if (format === 'SVG') {
    const result = await rpc<{ svg: string }>('tool', { name: 'export_svg', args: { ids: args.node ? [args.node] : undefined } })
    if (!result.svg) { printError('Nothing to export.'); process.exit(1) }
    await writeAndLog(resolve(args.output ?? 'export.svg'), result.svg)
    return
  }

  if (format === 'JSX') {
    const result = await rpc<{ jsx: string }>('export_jsx', { nodeIds: args.node ? [args.node] : undefined, style: args.style })
    if (!result.jsx) { printError('Nothing to export.'); process.exit(1) }
    await writeAndLog(resolve(args.output ?? 'export.jsx'), result.jsx)
    return
  }

  const result = await rpc<{ base64: string }>('export', {
    nodeIds: args.node ? [args.node] : undefined,
    scale: Number(args.scale),
    format: format.toLowerCase()
  })
  const data = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
  const ext = format.toLowerCase() === 'jpg' ? 'jpg' : format.toLowerCase()
  await writeAndLog(resolve(args.output ?? `export.${ext}`), data)
}

async function exportFromFile(format: string, args: ExportArgs) {
  const file = requireFile(args.file)
  const graph = await loadDocument(file)
  await loadFonts(graph)

  const pages = graph.getPages()
  const page = args.page ? pages.find((p) => p.name === args.page) : pages[0]
  if (!page) { printError(`Page "${args.page}" not found.`); process.exit(1) }

  const defaultName = basename(file, extname(file))

  if (format === 'JSX') {
    const nodeIds = args.node ? [args.node] : page.childIds
    const jsxStr = nodeIds.length === 1
      ? sceneNodeToJSX(nodeIds[0], graph, args.style as JSXFormat)
      : selectionToJSX(nodeIds, graph, args.style as JSXFormat)
    if (!jsxStr) { printError('Nothing to export (empty page or no visible nodes).'); process.exit(1) }
    await writeAndLog(resolve(args.output ?? `${defaultName}.jsx`), jsxStr)
    return
  }

  const ext = format.toLowerCase() === 'jpg' ? 'jpg' : format.toLowerCase()
  const output = resolve(args.output ?? `${defaultName}.${ext}`)

  if (format === 'SVG') {
    const nodeIds = args.node ? [args.node] : page.childIds
    const svgStr = renderNodesToSVG(graph, page.id, nodeIds)
    if (!svgStr) { printError('Nothing to export (empty page or no visible nodes).'); process.exit(1) }
    await writeAndLog(output, svgStr)
    return
  }

  let data: Uint8Array | null
  if (args.thumbnail) {
    data = await exportThumbnail(graph, page.id, Number(args.width), Number(args.height))
  } else {
    const nodeIds = args.node ? [args.node] : page.childIds
    data = await exportNodes(graph, page.id, nodeIds, {
      scale: Number(args.scale),
      format: format as ExportFormat,
      quality: args.quality ? Number(args.quality) : undefined
    })
  }

  if (!data) { printError('Nothing to export (empty page or no visible nodes).'); process.exit(1) }
  await writeAndLog(output, data)
}

export default defineCommand({
  meta: { description: 'Export a .fig file to PNG, JPG, WEBP, SVG, or JSX' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    output: { type: 'string', alias: 'o', description: 'Output file path (default: <name>.<format>)', required: false },
    format: { type: 'string', alias: 'f', description: 'Export format: png, jpg, webp, svg, jsx (default: png)', default: 'png' },
    scale: { type: 'string', alias: 's', description: 'Export scale (default: 1)', default: '1' },
    quality: { type: 'string', alias: 'q', description: 'Quality 0-100 for JPG/WEBP (default: 90)', required: false },
    page: { type: 'string', description: 'Page name (default: first page)', required: false },
    node: { type: 'string', description: 'Node ID to export (default: all top-level nodes)', required: false },
    style: { type: 'string', description: 'JSX style: openpencil, tailwind (default: openpencil)', default: 'openpencil' },
    thumbnail: { type: 'boolean', description: 'Export page thumbnail instead of full render' },
    width: { type: 'string', description: 'Thumbnail width (default: 1920)', default: '1920' },
    height: { type: 'string', description: 'Thumbnail height (default: 1080)', default: '1080' }
  },
  async run({ args }) {
    const format = args.format.toUpperCase() as ExportFormat | 'JSX'
    if (!ALL_FORMATS.includes(format)) {
      printError(`Invalid format "${args.format}". Use png, jpg, webp, svg, or jsx.`)
      process.exit(1)
    }

    if (format === 'JSX' && !JSX_STYLES.includes(args.style)) {
      printError(`Invalid JSX style "${args.style}". Use openpencil or tailwind.`)
      process.exit(1)
    }

    if (isAppMode(args.file)) {
      await exportViaApp(format, args)
    } else {
      await exportFromFile(format, args)
    }
  }
})
