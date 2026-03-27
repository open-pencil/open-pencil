import { basename, extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'

import { requireFile } from '../app-client'
import { ok, printError } from '../format'
import { loadDocument } from '../headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const WRITABLE_FORMATS = ['FIG'] as const

type WritableFormat = (typeof WRITABLE_FORMATS)[number]

function defaultOutput(file: string, format: WritableFormat): string {
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
    }
  },
  async run({ args }) {
    const format = args.format.toUpperCase() as WritableFormat
    if (!WRITABLE_FORMATS.includes(format)) {
      printError(`Invalid format "${args.format}". Use fig.`)
      process.exit(1)
    }

    const file = requireFile(args.file)
    const graph = await loadDocument(file)
    const result = await io.writeDocument(format.toLowerCase(), graph)
    const output = args.output ? resolve(args.output) : defaultOutput(file, format)
    await Bun.write(output, result.data as Uint8Array)
    console.log(ok(`Converted ${file} → ${output}`))
  }
})
