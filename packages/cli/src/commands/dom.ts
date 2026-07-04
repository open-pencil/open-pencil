import { basename, extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import {
  createHeadlessCSSRuntime,
  htmlToDesignDocument,
  htmlToSceneGraph,
  serializeHTML,
  tailwindHTMLToDesignDocument,
  tailwindHTMLToSceneGraph,
  type DesignDocument,
  type SerializeHTMLOptions
} from '@open-pencil/dom-css'

import { requireFile } from '#cli/app-client'
import { fmtList, ok, printError } from '#cli/format'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const OUTPUT_FORMATS = new Set(['fig', 'html', 'json'])
const HTML_STYLES = new Set(['inline', 'tailwind'])

interface DomArgs {
  file?: string
  output?: string
  format: string
  css?: string
  cssText?: string
  tailwind?: string
  tailwindFile?: string
  pageName: string
  htmlStyle: SerializeHTMLOptions['style']
  json?: boolean
}

function defaultOutput(input: string, format: string): string {
  const base = basename(input, extname(input))
  return resolve(`${base}.${format}`)
}

async function readTextFile(path: string): Promise<string> {
  return Bun.file(requireFile(path)).text()
}

async function cssTextForArgs(args: DomArgs): Promise<string | undefined> {
  const cssParts = []
  if (args.css) cssParts.push(await readTextFile(args.css))
  if (args.cssText) cssParts.push(args.cssText)
  return cssParts.length > 0 ? cssParts.join('\n') : undefined
}

async function tailwindCandidatesForArgs(args: DomArgs): Promise<string[] | undefined> {
  const parts = []
  if (args.tailwind) parts.push(args.tailwind)
  if (args.tailwindFile) parts.push(await readTextFile(args.tailwindFile))
  const classes = parts
    .flatMap((part) => part.split(/\s+/))
    .filter((className) => className.length > 0)
  return classes.length > 0 ? classes : undefined
}

function childCount(document: DesignDocument): number {
  return document.children.length
}

async function convertDom(args: DomArgs) {
  const file = requireFile(args.file)
  const html = await readTextFile(file)
  const runtime = createHeadlessCSSRuntime()
  const tailwind = await tailwindCandidatesForArgs(args)
  const cssText = await cssTextForArgs(args)

  if (tailwind) {
    const options = { ...args, css: cssText, runtime }
    return {
      document: await tailwindHTMLToDesignDocument(html, tailwind, options),
      graph: await tailwindHTMLToSceneGraph(html, tailwind, options)
    }
  }

  const options = { cssText, runtime, pageName: args.pageName }
  return {
    document: await htmlToDesignDocument(html, options),
    graph: await htmlToSceneGraph(html, options)
  }
}

async function writeOutput(
  args: DomArgs,
  document: DesignDocument,
  graph: Awaited<ReturnType<typeof htmlToSceneGraph>>
) {
  const format = args.format.toLowerCase()
  const output = args.output ? resolve(args.output) : defaultOutput(requireFile(args.file), format)

  if (format === 'json') {
    await Bun.write(output, `${JSON.stringify(document, null, 2)}\n`)
    return output
  }

  if (format === 'html') {
    await Bun.write(output, serializeHTML(document, { style: args.htmlStyle }))
    return output
  }

  const result = await io.writeDocument('fig', graph)
  await Bun.write(output, result.data as Uint8Array)
  return output
}

export default defineCommand({
  meta: { description: 'Convert HTML/CSS/Tailwind into an OpenPencil document' },
  args: {
    file: {
      type: 'positional',
      description: 'Input HTML file path',
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
      description: 'Output format: fig, html, json (default: fig)',
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
    htmlStyle: {
      type: 'string',
      description: 'HTML style output: inline or tailwind (default: inline)',
      default: 'inline'
    },
    json: {
      type: 'boolean',
      description: 'Print a machine-readable summary to stdout'
    }
  },
  async run({ args }) {
    const format = args.format.toLowerCase()
    if (!OUTPUT_FORMATS.has(format)) {
      printError(`Invalid format "${args.format}". Use fig, html, or json.`)
      process.exit(1)
    }
    const htmlStyleArg = args.htmlStyle.toLowerCase()
    if (!HTML_STYLES.has(htmlStyleArg)) {
      printError(`Invalid htmlStyle "${args.htmlStyle}". Use inline or tailwind.`)
      process.exit(1)
    }
    const htmlStyle = htmlStyleArg as SerializeHTMLOptions['style']

    const normalizedArgs = { ...args, htmlStyle }
    const { document, graph } = await convertDom(normalizedArgs)
    const output = await writeOutput(normalizedArgs, document, graph)
    const pages = graph.getPages()
    const summary = {
      input: requireFile(args.file),
      output,
      format,
      pages: pages.length,
      rootElements: childCount(document)
    }

    if (args.json) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    console.log(ok(`Converted ${summary.input} → ${summary.output}`))
    console.log(
      fmtList([
        {
          header: 'DOM/CSS conversion',
          details: summary
        }
      ])
    )
  }
})
