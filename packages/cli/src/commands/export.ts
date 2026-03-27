import { basename, extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'

import { isAppMode, requireFile, rpc } from '../app-client'
import { ok, printError } from '../format'
import { loadDocument } from '../headless'

import type { RasterExportFormat } from '@open-pencil/core'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const RASTER_FORMATS = ['PNG', 'JPG', 'WEBP']
const ALL_FORMATS = [...RASTER_FORMATS, 'SVG', 'JSX', 'FIG']
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
    const result = await rpc<{ svg: string }>('tool', {
      name: 'export_svg',
      args: { ids: args.node ? [args.node] : undefined }
    })
    if (!result.svg) {
      printError('Nothing to export.')
      process.exit(1)
    }
    await writeAndLog(resolve(args.output ?? 'export.svg'), result.svg)
    return
  }

  if (format === 'JSX' || format === 'FIG') {
    printError(`${format} export is only available in file mode right now.`)
    process.exit(1)
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

function exportFileName(defaultName: string, extension: string, scale?: number): string {
  return scale ? `${defaultName}@${scale}x.${extension}` : `${defaultName}.${extension}`
}

function targetLabel(pageName?: string, nodeId?: string): string {
  if (nodeId) return `node ${nodeId}`
  return pageName ? `page "${pageName}"` : 'first page'
}

async function exportFromFile(format: string, args: ExportArgs) {
  const file = requireFile(args.file)
  const graph = await loadDocument(file)

  const pages = graph.getPages()
  const page = args.page ? pages.find((p) => p.name === args.page) : pages[0]
  if (!page) {
    const available = pages.map((p) => `"${p.name}"`).join(', ')
    printError(
      args.page
        ? `Page "${args.page}" not found. Available pages: ${available || 'none'}.`
        : 'Document has no pages.'
    )
    process.exit(1)
  }

  const defaultName = basename(file, extname(file))

  if (args.page && args.node) {
    printError('--page and --node cannot be used together.')
    process.exit(1)
  }

  const target = args.node
    ? { scope: 'node' as const, nodeId: args.node }
    : { scope: 'page' as const, pageId: page.id }

  if (args.thumbnail) {
    printError('Thumbnail export is not supported by the shared file export path yet.')
    process.exit(1)
  }

  const formatId = format.toLowerCase()
  let options: { format?: string; scale?: number; quality?: number } | undefined
  if (format === 'JSX') {
    options = { format: args.style }
  } else if (format === 'PNG' || format === 'JPG' || format === 'WEBP') {
    options = {
      format,
      scale: Number(args.scale),
      quality: args.quality ? Number(args.quality) : undefined
    }
  }

  const result = await io.exportContent(formatId, { graph, target }, options)
  const output = resolve(
    args.output ??
      exportFileName(
        defaultName,
        result.extension,
        format === 'PNG' || format === 'JPG' || format === 'WEBP' ? Number(args.scale) : undefined
      )
  )
  await writeAndLog(output, result.data as string | Uint8Array)
  console.log(ok(`Target: ${targetLabel(args.page, args.node)}`))
}

export default defineCommand({
  meta: { description: 'Export a document to PNG, JPG, WEBP, SVG, JSX, or .fig' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output file path (default: <name>.<format>)',
      required: false
    },
    format: {
      type: 'string',
      alias: 'f',
      description: 'Export format: png, jpg, webp, svg, jsx, fig (default: png)',
      default: 'png'
    },
    scale: { type: 'string', alias: 's', description: 'Export scale (default: 1)', default: '1' },
    quality: {
      type: 'string',
      alias: 'q',
      description: 'Quality 0-100 for JPG/WEBP (default: 90)',
      required: false
    },
    page: {
      type: 'string',
      description: 'Export a specific page by name (default: first page)',
      required: false
    },
    node: {
      type: 'string',
      description: 'Export a specific node by ID (cannot be combined with --page)',
      required: false
    },
    style: {
      type: 'string',
      description: 'JSX style: openpencil, tailwind (default: openpencil)',
      default: 'openpencil'
    },
    thumbnail: { type: 'boolean', description: 'Export page thumbnail instead of full render' },
    width: { type: 'string', description: 'Thumbnail width (default: 1920)', default: '1920' },
    height: { type: 'string', description: 'Thumbnail height (default: 1080)', default: '1080' }
  },
  async run({ args }) {
    const format = args.format.toUpperCase() as RasterExportFormat | 'SVG' | 'JSX' | 'FIG'
    if (!ALL_FORMATS.includes(format)) {
      printError(`Invalid format "${args.format}". Use png, jpg, webp, svg, jsx, or fig.`)
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
