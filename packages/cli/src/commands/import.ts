import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { defineCommand } from 'citty'

import { createHeadlessIconMatcher } from '@open-pencil/core/icons/match'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readHTMLDocument, type ReadHTMLResult } from '@open-pencil/core/io/formats/html/import'
import { fetchRemoteFile, type RemoteFileKind } from '@open-pencil/core/io/remote'
import { errorMessage } from '@open-pencil/std/errors'

import { requireFile } from '#cli/app/client'
import { fmtList, ok, printError } from '#cli/format'
import { writeFigDocument } from '#cli/headless'

const OUTPUT_FORMATS = new Set(['fig', 'json'])

interface ImportArgs {
  file?: string
  output?: string
  format: string
  css?: string
  cssText?: string
  tailwind?: string
  tailwindFile?: string
  pageName: string
  json?: boolean
  'icon-names': boolean
}

/** The HTML to import, where it came from, the address it resolves against, and its title. */
interface ImportInput {
  html: string
  /** The file path or web address, as the summary reports it. */
  source: string
  baseURL: string
  /** What the imported document is called, which names the output by default. */
  title: string
}

async function readTextFile(path: string): Promise<string> {
  return readFile(requireFile(path), 'utf8')
}

async function cssTextForArgs(args: ImportArgs): Promise<string | undefined> {
  const cssParts = []
  if (args.css) cssParts.push(await readTextFile(args.css))
  if (args.cssText) cssParts.push(args.cssText)
  return cssParts.length > 0 ? cssParts.join('\n') : undefined
}

async function tailwindCandidatesForArgs(args: ImportArgs): Promise<string[] | undefined> {
  const parts = []
  if (args.tailwind) parts.push(args.tailwind)
  if (args.tailwindFile) parts.push(await readTextFile(args.tailwindFile))
  const classes = parts
    .flatMap((part) => part.split(/\s+/))
    .filter((className) => className.length > 0)
  return classes.length > 0 ? classes : undefined
}

/** A web address to import from, when the input is one rather than a file path. */
function webAddress(input: string | undefined): URL | null {
  if (!input || !/^https?:\/\//i.test(input)) return null
  return URL.canParse(input) ? new URL(input) : null
}

const KIND_NAMES: Record<Exclude<RemoteFileKind, 'html'>, string> = {
  svg: 'an SVG image',
  image: 'an image',
  document: 'a design document; open it in OpenPencil instead',
  pdf: 'a PDF, which OpenPencil cannot read yet',
  unsupported: 'not an HTML page'
}

/** The page at a web address, resolved against the address a redirect ends at. */
async function fetchPage(url: URL): Promise<ImportInput> {
  const file = await fetchRemoteFile(url, { io: new IORegistry(BUILTIN_IO_FORMATS) })
  if (file.kind !== 'html') throw new Error(`${url.href} is ${KIND_NAMES[file.kind]}`)
  return {
    html: new TextDecoder().decode(file.bytes),
    source: url.href,
    baseURL: file.url,
    title: file.title
  }
}

async function readInput(args: ImportArgs): Promise<ImportInput> {
  const url = webAddress(args.file)
  if (url) return fetchPage(url)
  const file = requireFile(args.file)
  return {
    html: await readTextFile(file),
    source: file,
    // Relative stylesheets, fonts, and images resolve beside the file, as a browser opening it.
    baseURL: pathToFileURL(resolve(file)).href,
    title: basename(file, extname(file))
  }
}

async function importHTML(
  args: ImportArgs,
  { html, baseURL }: ImportInput
): Promise<ReadHTMLResult> {
  return readHTMLDocument(html, {
    baseURL,
    cssText: await cssTextForArgs(args),
    tailwind: await tailwindCandidatesForArgs(args),
    pageName: args.pageName,
    matchIcon: args['icon-names'] ? createHeadlessIconMatcher() : undefined
  })
}

async function writeOutput(args: ImportArgs, title: string, { styled, graph }: ReadHTMLResult) {
  const format = args.format.toLowerCase()
  const output = resolve(args.output ?? `${title}.${format}`)

  await mkdir(dirname(output), { recursive: true })

  if (format === 'json') {
    await writeFile(output, `${JSON.stringify(styled, null, 2)}\n`)
    return output
  }

  await writeFigDocument(graph, output)
  return output
}

export default defineCommand({
  meta: {
    description:
      'Import HTML/CSS/Tailwind, from a file or a web address, into an OpenPencil document'
  },
  args: {
    file: {
      type: 'positional',
      description: 'Input HTML file path, or the http(s) address of a web page',
      required: true
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
      description: 'Output format: fig or json (default: fig)',
      default: 'fig'
    },
    css: {
      type: 'string',
      description: 'CSS file to apply before conversion',
      required: false
    },
    cssText: {
      type: 'string',
      description: 'Inline CSS text to apply before conversion',
      required: false
    },
    tailwind: {
      type: 'string',
      description: 'Tailwind utility candidates to compile and apply',
      required: false
    },
    tailwindFile: {
      type: 'string',
      description: 'File containing Tailwind utility candidates',
      required: false
    },
    pageName: {
      type: 'string',
      description: 'Scene graph page name (default: DOM/CSS)',
      default: 'DOM/CSS'
    },
    json: {
      type: 'boolean',
      description: 'Print a machine-readable summary to stdout'
    },
    'icon-names': {
      type: 'boolean',
      description:
        'Name inline SVG without data-icon after the Iconify icon it draws, downloading an icon index and the candidate icons; --no-icon-names turns this matching off, and SVG named by data-icon stays an icon (default: true)',
      default: true
    }
  },
  async run({ args }) {
    const format = args.format.toLowerCase()
    if (!OUTPUT_FORMATS.has(format)) {
      printError(`Invalid format "${args.format}". Use fig or json.`)
      process.exit(1)
    }

    let input: ImportInput
    try {
      input = await readInput(args)
    } catch (error) {
      printError(errorMessage(error))
      process.exit(1)
    }
    const imported = await importHTML(args, input)
    const output = await writeOutput(args, input.title, imported)
    const pages = imported.graph.getPages()
    const summary = {
      input: input.source,
      output,
      format,
      pages: pages.length,
      rootElements: imported.styled.children.length
    }

    if (args.json) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    console.log(ok(`Converted ${summary.input} → ${summary.output}`))
    console.log(
      fmtList([
        {
          header: 'HTML/CSS import',
          details: summary
        }
      ])
    )
  }
})
