import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readHTMLDocument, type ReadHTMLResult } from '@open-pencil/core/io/formats/html/import'

import { requireFile } from '#cli/app/client'
import { fmtList, ok, printError } from '#cli/format'

const io = new IORegistry(BUILTIN_IO_FORMATS)
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
}

function defaultOutput(input: string, format: string): string {
  const base = basename(input, extname(input))
  return resolve(`${base}.${format}`)
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

async function importHTML(args: ImportArgs): Promise<ReadHTMLResult> {
  return readHTMLDocument(await readTextFile(requireFile(args.file)), {
    cssText: await cssTextForArgs(args),
    tailwind: await tailwindCandidatesForArgs(args),
    pageName: args.pageName
  })
}

async function writeOutput(args: ImportArgs, { styled, graph }: ReadHTMLResult) {
  const format = args.format.toLowerCase()
  const output = args.output ? resolve(args.output) : defaultOutput(requireFile(args.file), format)

  await mkdir(dirname(output), { recursive: true })

  if (format === 'json') {
    await writeFile(output, `${JSON.stringify(styled, null, 2)}\n`)
    return output
  }

  const result = await io.writeDocument('fig', graph)
  await writeFile(output, result.data as Uint8Array)
  return output
}

export default defineCommand({
  meta: { description: 'Import HTML/CSS/Tailwind into an OpenPencil document' },
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
    }
  },
  async run({ args }) {
    const format = args.format.toLowerCase()
    if (!OUTPUT_FORMATS.has(format)) {
      printError(`Invalid format "${args.format}". Use fig or json.`)
      process.exit(1)
    }

    const imported = await importHTML(args)
    const output = await writeOutput(args, imported)
    const pages = imported.graph.getPages()
    const summary = {
      input: requireFile(args.file),
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
