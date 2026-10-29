import { writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { layoutAuthoredNodes } from '@open-pencil/core/layout'

import { requireFile } from '#cli/app/client'
import { FONT_POLICIES, reportFontStatus } from '#cli/commands/export/font-policy'
import { ok, printError } from '#cli/format'
import {
  loadDocument,
  measureDocumentText,
  populateWholeDocument,
  writeFigDocument
} from '#cli/headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)

function writableFormatIds(): string[] {
  return io.listWritableFormats().map((format) => format.id)
}

function defaultOutput(file: string, format: string): string {
  const base = basename(file, extname(file))
  return resolve(`${base}.${format.toLowerCase()}`)
}

export default defineCommand({
  meta: { description: 'Convert a document to another writable format' },
  args: {
    file: {
      type: 'positional',
      description: 'Input document file path',
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
      description: 'Output format: fig (default: fig)',
      default: 'fig'
    },
    'font-policy': {
      type: 'string',
      description:
        'When a font of the document is missing: warn, strict (fail without writing), or allow (default: warn)',
      default: 'warn'
    }
  },
  async run({ args }) {
    const format = args.format.toLowerCase()
    const writableFormats = writableFormatIds()
    if (!writableFormats.includes(format)) {
      printError(`Invalid format "${args.format}". Use ${writableFormats.join(', ')}.`)
      process.exit(1)
    }

    if (!FONT_POLICIES.has(args['font-policy'])) {
      printError(`Invalid font policy "${args['font-policy']}". Use warn, strict, or allow.`)
      process.exit(1)
    }

    const file = requireFile(args.file)
    const graph = await loadDocument(file)
    populateWholeDocument(graph)
    // A format that stores layout intent, such as .pen, was laid out as it was read, with its
    // text estimated. The output keeps those sizes, so lay it out again with its text measured
    // in its own fonts, as the app and raster export draw it.
    if (io.findReader(file)?.laysOutOnRead) {
      reportFontStatus(await measureDocumentText(graph), args['font-policy'])
      layoutAuthoredNodes(
        graph,
        graph.getPages(true).map((page) => page.id)
      )
    }
    const output = args.output ? resolve(args.output) : defaultOutput(file, format)
    if (format === 'fig') await writeFigDocument(graph, output)
    else await writeFile(output, (await io.writeDocument(format, graph)).data as Uint8Array)
    console.log(ok(`Converted ${file} → ${output}`))
  }
})
