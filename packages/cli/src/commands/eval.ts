import { defineCommand } from 'citty'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'

import { isAppMode, requireFile, rpc } from '#cli/app/client'
import { appTargetOptions, appTargetRPCArgs } from '#cli/app/target'
import { printError } from '#cli/format'
import {
  documentWriteOptions,
  loadDocument,
  populateWholeDocument,
  writeFigDocument
} from '#cli/headless'

function printResult(value: unknown, json: boolean) {
  if (json || !process.stdout.isTTY) {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(value)
  }
}

function serializeResult(value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === 'object' && 'toJSON' in value && typeof value.toJSON === 'function') {
    return value.toJSON()
  }
  if (Array.isArray(value)) return value.map(serializeResult)
  return value
}

export default defineCommand({
  meta: { description: 'Execute JavaScript with Figma plugin API' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    code: { type: 'string', alias: 'c', description: 'JavaScript code to execute' },
    stdin: { type: 'boolean', description: 'Read code from stdin' },
    ...documentWriteOptions,
    ...appTargetOptions,
    json: { type: 'boolean', description: 'Output as JSON' },
    quiet: { type: 'boolean', alias: 'q', description: 'Suppress output' }
  },
  async run({ args }) {
    let code = args.code

    if (args.stdin) {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
      code = Buffer.concat(chunks).toString('utf-8')
    }

    if (!code) {
      printError('Provide code via --code or --stdin')
      process.exit(1)
    }

    if (isAppMode(args.file)) {
      const result = await rpc('eval', { code, ...appTargetRPCArgs(args) })
      if (!args.quiet && result !== undefined && result !== null) {
        printResult(result, !!args.json)
      }
      return
    }

    const file = requireFile(args.file)
    const graph = await loadDocument(file)
    populateWholeDocument(graph)
    const figma = new FigmaAPI(graph)

    let result: unknown
    try {
      result = await compileScript(code)(figma)
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }

    if (!args.quiet && result !== undefined) {
      printResult(serializeResult(result), !!args.json)
    }

    if (args.write || args.output) {
      const outPath = args.output ? args.output : file
      await writeFigDocument(graph, outPath)
      if (!args.quiet) {
        console.error(`Written to ${outPath}`)
      }
    }
  }
})
