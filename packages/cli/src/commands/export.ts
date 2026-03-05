import { defineCommand } from 'citty'
import { basename, extname, resolve } from 'node:path'

import { renderNodesToSVG, sceneNodeToJSX, selectionToJSX } from '@open-pencil/core'

import { loadDocument, loadFonts, exportNodes, exportThumbnail } from '../headless'
import { ok, printError } from '../format'
import type { ExportFormat, JSXFormat } from '@open-pencil/core'

const RASTER_FORMATS = ['PNG', 'JPG', 'WEBP']
const ALL_FORMATS = [...RASTER_FORMATS, 'SVG', 'JSX']
const JSX_STYLES = ['openpencil', 'tailwind']

export default defineCommand({
  meta: { description: 'Export a .fig file to PNG, JPG, WEBP, SVG, or JSX' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    output: { type: 'string', alias: 'o', description: 'Output file path (default: <name>.<format>)' },
    format: { type: 'string', alias: 'f', description: 'Export format: png, jpg, webp, svg, jsx (default: png)', default: 'png' },
    scale: { type: 'string', alias: 's', description: 'Export scale (default: 1)', default: '1' },
    quality: { type: 'string', alias: 'q', description: 'Quality 0-100 for JPG/WEBP (default: 90)' },
    page: { type: 'string', description: 'Page name (default: first page)' },
    node: { type: 'string', description: 'Node ID to export (default: all top-level nodes)' },
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

    const graph = await loadDocument(args.file)
    await loadFonts(graph)

    const pages = graph.getPages()
    const page = args.page
      ? pages.find((p) => p.name === args.page)
      : pages[0]

    if (!page) {
      printError(`Page "${args.page}" not found.`)
      process.exit(1)
    }

    const defaultName = basename(args.file, extname(args.file))

    if (format === 'JSX') {
      const jsxFormat = args.style as JSXFormat
      const nodeIds = args.node ? [args.node] : page.childIds
      const jsxStr = nodeIds.length === 1
        ? sceneNodeToJSX(nodeIds[0], graph, jsxFormat)
        : selectionToJSX(nodeIds, graph, jsxFormat)

      if (!jsxStr) {
        printError('Nothing to export (empty page or no visible nodes).')
        process.exit(1)
      }

      const output = resolve(args.output ?? `${defaultName}.jsx`)
      await Bun.write(output, jsxStr)
      console.log(ok(`Exported ${output} (${(jsxStr.length / 1024).toFixed(1)} KB)`))
      return
    }

    const ext = format.toLowerCase() === 'jpg' ? 'jpg' : format.toLowerCase()
    const output = resolve(args.output ?? `${defaultName}.${ext}`)

    if (format === 'SVG') {
      const nodeIds = args.node ? [args.node] : page.childIds
      const svgStr = renderNodesToSVG(graph, page.id, nodeIds)
      if (!svgStr) {
        printError('Nothing to export (empty page or no visible nodes).')
        process.exit(1)
      }
      await Bun.write(output, svgStr)
      console.log(ok(`Exported ${output} (${(svgStr.length / 1024).toFixed(1)} KB)`))
      return
    }

    let data: Uint8Array | null

    if (args.thumbnail) {
      data = await exportThumbnail(graph, page.id, Number(args.width), Number(args.height))
    } else {
      const nodeIds = args.node ? [args.node] : page.childIds
      data = await exportNodes(graph, page.id, nodeIds, {
        scale: Number(args.scale),
        format,
        quality: args.quality ? Number(args.quality) : undefined
      })
    }

    if (!data) {
      printError('Nothing to export (empty page or no visible nodes).')
      process.exit(1)
    }

    await Bun.write(output, data)
    console.log(ok(`Exported ${output} (${(data.length / 1024).toFixed(1)} KB)`))
  }
})
