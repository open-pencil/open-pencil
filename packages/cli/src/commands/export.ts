import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

import { defineCommand } from 'citty'
import { toUint8Array } from 'js-base64'

import { BUILTIN_IO_FORMATS, IORegistry, type ExportResult } from '@open-pencil/core/io'

import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { appTargetOptions, appTargetRPCArgs } from '#cli/app-target'
import { applyExportFontPolicy, exportFontRoots, FONT_POLICIES } from '#cli/export-font-policy'
import { ok, printError } from '#cli/format'
import { loadDocument, populateDocumentPage, populateWholeDocument } from '#cli/headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const FORMAT_IDS = io.listExportFormats('node').map((format) => format.id)
const ALL_FORMATS = new Set(FORMAT_IDS.map((id) => id.toUpperCase()))
const FORMAT_LIST = `${FORMAT_IDS.slice(0, -1).join(', ')}, or ${FORMAT_IDS.at(-1)}`

function formatSupportsScale(format: string): boolean {
  return io.getFormat(format.toLowerCase())?.exportOptions?.scale ?? false
}
const JSX_STYLES = new Set(['openpencil', 'tailwind'])
const HTML_STYLES = new Set(['inline', 'tailwind'])
const HTML_MODES = new Set(['fragment', 'standalone'])
const HTML_ASSETS = new Set(['inline', 'external'])
const HTML_FONTS = new Set(['assets', 'none'])

interface ExportArgs {
  file?: string
  output?: string
  format: string
  scale: string
  quality?: string
  page?: string
  node?: string
  style: string
  html: string
  css: string
  assets: string
  fonts: string
  'font-policy': string
  thumbnail?: boolean
  width: string
  height: string
  'document-id'?: string
  'page-id'?: string
}

async function writeAndLog(path: string, content: string | Uint8Array) {
  await writeFile(path, content)
  const size = typeof content === 'string' ? content.length : content.length
  console.log(ok(`Exported ${path} (${(size / 1024).toFixed(1)} KB)`))
}

async function exportViaApp(format: string, args: ExportArgs) {
  const targetArgs = appTargetRPCArgs(args)
  if (format === 'SVG') {
    const result = await rpc<{ svg: string }>('tool', {
      ...targetArgs,
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

  if (format === 'PDF') {
    const result = await rpc<{ base64: string }>('tool', {
      ...targetArgs,
      name: 'export_pdf',
      args: { ids: args.node ? [args.node] : undefined }
    })
    if (!result.base64) {
      printError('Nothing to export.')
      process.exit(1)
    }
    const data = toUint8Array(result.base64)
    await writeAndLog(resolve(args.output ?? 'export.pdf'), data)
    return
  }

  if (format === 'JSX' || format === 'HTML' || format === 'FIG' || format === 'PPTX') {
    printError(`${format} export is only available in file mode right now.`)
    process.exit(1)
  }

  const result = await rpc<{ base64: string }>('export', {
    ...targetArgs,
    nodeIds: args.node ? [args.node] : undefined,
    scale: Number(args.scale),
    format: format.toLowerCase()
  })
  const data = toUint8Array(result.base64)
  const ext = format.toLowerCase() === 'jpg' ? 'jpg' : format.toLowerCase()
  await writeAndLog(resolve(args.output ?? `export.${ext}`), data)
}

function exportFileName(defaultName: string, extension: string, scale?: number): string {
  return scale ? `${defaultName}@${scale}x.${extension}` : `${defaultName}.${extension}`
}

function targetLabel(pageName?: string, nodeId?: string, wholeDocument = false): string {
  if (wholeDocument) return 'whole document'
  if (nodeId) return `node ${nodeId}`
  return pageName ? `page "${pageName}"` : 'first page'
}

type FileExportTarget = { scope: 'node'; nodeId: string } | { scope: 'page'; pageId: string }

/** Writes the export and the files it refers to, which sit next to it. */
async function writeExport(output: string, result: ExportResult) {
  await writeAndLog(output, result.data as string | Uint8Array)
  const assets = result.assets ?? []
  for (const asset of assets) {
    const assetPath = join(dirname(output), asset.path)
    await mkdir(dirname(assetPath), { recursive: true })
    await writeFile(assetPath, asset.content as string | Uint8Array)
  }
  if (assets.length > 0) console.log(ok(`Assets: ${assets.length} files`))
}

function prepareGraphForExport(
  graph: Awaited<ReturnType<typeof loadDocument>>,
  pageId: string,
  format: string,
  args: ExportArgs
): boolean {
  const wholeDocument = (format === 'FIG' || format === 'PPTX') && !args.page && !args.node
  if (wholeDocument || args.node) populateWholeDocument(graph)
  else populateDocumentPage(graph, pageId)
  return wholeDocument
}

async function executeFileExport(
  formatId: string,
  graph: Awaited<ReturnType<typeof loadDocument>>,
  target: FileExportTarget,
  options: unknown,
  wholeDocument: boolean,
  fileName: string
) {
  if (wholeDocument) {
    if (formatId === 'fig') return io.writeDocument(formatId, graph, options)
    return io.exportContent(formatId, { graph, target: { scope: 'document' }, fileName }, options)
  }
  return io.exportContent(formatId, { graph, target, fileName }, options)
}

function exportOptions(format: string, args: ExportArgs): unknown {
  if (format === 'FIG') return { renderThumbnail: true }
  if (format === 'HTML')
    return { html: args.html, style: args.css, assets: args.assets, fonts: args.fonts }
  if (formatSupportsScale(format))
    return {
      format,
      scale: Number(args.scale),
      quality: args.quality ? Number(args.quality) : undefined
    }
  return undefined
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

  const wholeDocument = prepareGraphForExport(graph, page.id, format, args)

  const target = args.node
    ? { scope: 'node' as const, nodeId: args.node }
    : { scope: 'page' as const, pageId: page.id }
  await applyExportFontPolicy(
    graph,
    exportFontRoots(
      args.node,
      page.id,
      pages.map((candidate) => candidate.id),
      wholeDocument
    ),
    format,
    args['font-policy']
  )

  if (args.thumbnail) {
    printError('Thumbnail export is not supported by the shared file export path yet.')
    process.exit(1)
  }

  // `--style tailwind` keeps the JSX spelling of the Tailwind JSX format.
  const formatId =
    format === 'JSX' && args.style === 'tailwind' ? 'tailwind-jsx' : format.toLowerCase()
  const scale = formatSupportsScale(format) ? Number(args.scale) : undefined
  const extension = io.getFormat(formatId)?.extensions[0] ?? formatId
  const output = resolve(args.output ?? exportFileName(defaultName, extension, scale))
  const result = await executeFileExport(
    formatId,
    graph,
    target,
    exportOptions(format, args),
    wholeDocument,
    basename(output)
  )
  await writeExport(output, result)
  console.log(ok(`Target: ${targetLabel(args.page, args.node, wholeDocument)}`))
}

export default defineCommand({
  meta: { description: `Export a document to ${FORMAT_LIST}` },
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
      description: `Export format: ${FORMAT_IDS.join(', ')} (default: png)`,
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
      description: 'Export a specific page by name (FIG defaults to the whole document)',
      required: false
    },
    node: {
      type: 'string',
      description: 'Export a specific node by ID (cannot be combined with --page)',
      required: false
    },
    style: {
      type: 'string',
      description: 'JSX style: openpencil or tailwind (default: openpencil)',
      default: 'openpencil'
    },
    html: {
      type: 'string',
      description: 'HTML output mode: fragment or standalone (default: fragment)',
      default: 'fragment'
    },
    css: {
      type: 'string',
      description: 'HTML CSS output: inline or tailwind (default: inline)',
      default: 'inline'
    },
    assets: {
      type: 'string',
      description: 'HTML asset output: inline or external (default: inline)',
      default: 'inline'
    },
    fonts: {
      type: 'string',
      description: 'HTML font output: assets or none (default: none)',
      default: 'none'
    },
    'font-policy': {
      type: 'string',
      description: 'Raster/PDF font policy: warn, strict, or allow (default: warn)',
      default: 'warn'
    },
    thumbnail: { type: 'boolean', description: 'Export page thumbnail instead of full render' },
    width: { type: 'string', description: 'Thumbnail width (default: 1920)', default: '1920' },
    height: { type: 'string', description: 'Thumbnail height (default: 1080)', default: '1080' },
    ...appTargetOptions
  },
  async run({ args }) {
    const format = args.format.toUpperCase()
    if (!ALL_FORMATS.has(format)) {
      printError(`Invalid format "${args.format}". Use ${FORMAT_LIST}.`)
      process.exit(1)
    }

    if (format === 'JSX' && !JSX_STYLES.has(args.style)) {
      printError(`Invalid JSX style "${args.style}". Use openpencil or tailwind.`)
      process.exit(1)
    }

    if (format === 'HTML' && !HTML_MODES.has(args.html)) {
      printError(`Invalid HTML mode "${args.html}". Use fragment or standalone.`)
      process.exit(1)
    }

    if (format === 'HTML' && !HTML_STYLES.has(args.css)) {
      printError(`Invalid HTML CSS output "${args.css}". Use inline or tailwind.`)
      process.exit(1)
    }

    if (format === 'HTML' && !HTML_ASSETS.has(args.assets)) {
      printError(`Invalid HTML asset output "${args.assets}". Use inline or external.`)
      process.exit(1)
    }

    if (format === 'HTML' && !HTML_FONTS.has(args.fonts)) {
      printError(`Invalid HTML font output "${args.fonts}". Use assets or none.`)
      process.exit(1)
    }

    if (!FONT_POLICIES.has(args['font-policy'])) {
      printError(`Invalid font policy "${args['font-policy']}". Use warn, strict, or allow.`)
      process.exit(1)
    }

    if (isAppMode(args.file)) {
      await exportViaApp(format, args)
    } else {
      await exportFromFile(format, args)
    }
  }
})
