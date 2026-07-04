import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { RasterExportFormat } from '@open-pencil/core/io'
import {
  exportHTMLBundle,
  sceneGraphToDesignDocument,
  type ExportHTMLBundleOptions
} from '@open-pencil/dom-css'

import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { appTargetOptions, appTargetRpcArgs } from '#cli/app-target'
import { ok, printError } from '#cli/format'
import { loadDocument } from '#cli/headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const RASTER_FORMATS = ['PNG', 'JPG', 'WEBP']
const ALL_FORMATS = new Set([...RASTER_FORMATS, 'SVG', 'PDF', 'JSX', 'FIG', 'HTML'])
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
  const targetArgs = appTargetRpcArgs(args)
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
    const data = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
    await writeAndLog(resolve(args.output ?? 'export.pdf'), data)
    return
  }

  if (format === 'JSX' || format === 'HTML' || format === 'FIG') {
    printError(`${format} export is only available in file mode right now.`)
    process.exit(1)
  }

  const result = await rpc<{ base64: string }>('export', {
    ...targetArgs,
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

type FileExportTarget = { scope: 'node'; nodeId: string } | { scope: 'page'; pageId: string }

async function writeHTMLFiles(
  output: string,
  bundle: Awaited<ReturnType<typeof exportHTMLBundle>>
) {
  const entrypoint = bundle.files.find((file) => file.path === bundle.entrypoint)
  if (!entrypoint) {
    printError(`HTML export did not include ${bundle.entrypoint}.`)
    process.exit(1)
  }

  await writeAndLog(output, entrypoint.content)
  const outputDir = dirname(output)
  const assetFiles = bundle.files.filter((file) => file.path !== bundle.entrypoint)
  for (const file of assetFiles) {
    const assetPath = join(outputDir, file.path)
    await mkdir(dirname(assetPath), { recursive: true })
    await writeFile(assetPath, file.content)
  }
  if (assetFiles.length > 0) console.log(ok(`Assets: ${assetFiles.length} files`))
}

async function exportHTMLFromFile(
  args: ExportArgs,
  graph: Awaited<ReturnType<typeof loadDocument>>,
  target: FileExportTarget,
  defaultName: string
) {
  const document = sceneGraphToDesignDocument(graph, {
    rootId: target.scope === 'page' ? target.pageId : target.nodeId
  })
  const output = resolve(args.output ?? exportFileName(defaultName, 'html'))
  const assetBasePath = `${basename(output, extname(output))}.assets`
  const bundle = await exportHTMLBundle(document, {
    html: args.html as ExportHTMLBundleOptions['html'],
    style: args.css as ExportHTMLBundleOptions['style'],
    assets: args.assets as ExportHTMLBundleOptions['assets'],
    fonts: args.fonts as ExportHTMLBundleOptions['fonts'],
    assetBasePath
  })
  await writeHTMLFiles(output, bundle)
  console.log(ok(`Target: ${targetLabel(args.page, args.node)}`))
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
  let options:
    | { format?: string; scale?: number; quality?: number; renderThumbnail?: boolean }
    | undefined
  if (format === 'HTML') {
    await exportHTMLFromFile(args, graph, target, defaultName)
    return
  }

  if (format === 'JSX') {
    options = { format: args.style }
  } else if (format === 'FIG') {
    options = { renderThumbnail: true }
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
  meta: { description: 'Export a document to PNG, JPG, WEBP, SVG, PDF, JSX, HTML, or .fig' },
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
      description: 'Export format: png, jpg, webp, svg, pdf, jsx, html, fig (default: png)',
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
    thumbnail: { type: 'boolean', description: 'Export page thumbnail instead of full render' },
    width: { type: 'string', description: 'Thumbnail width (default: 1920)', default: '1920' },
    height: { type: 'string', description: 'Thumbnail height (default: 1080)', default: '1080' },
    ...appTargetOptions
  },
  async run({ args }) {
    const format = args.format.toUpperCase() as RasterExportFormat | 'SVG' | 'JSX' | 'FIG' | 'HTML'
    if (!ALL_FORMATS.has(format)) {
      printError(
        `Invalid format "${args.format}". Use png, jpg, webp, svg, pdf, jsx, html, or fig.`
      )
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

    if (isAppMode(args.file)) {
      await exportViaApp(format, args)
    } else {
      await exportFromFile(format, args)
    }
  }
})
