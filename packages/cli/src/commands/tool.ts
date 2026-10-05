// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toJsonSchema as toJSONSchema } from '@valibot/to-json-schema'
import { defineCommand } from 'citty'
import * as v from 'valibot'

import {
  ALL_TOOLS,
  isToolExposed,
  toolChangesDocument,
  type ToolDef
} from '@open-pencil/core/tools'

import { appTargetOptions } from '#cli/app/target'
import { bold, dim, entity, fmtList, kv, printError, warn } from '#cli/format'
import { documentWriteOptions, writeFigDocument } from '#cli/headless'
import { readTextSource } from '#cli/input'
import { runToolData } from '#cli/tool-data'

const json = { type: 'boolean', description: 'Output as JSON' } as const

const toolArgsSchema = v.record(v.string(), v.unknown())

// The running app accepts the same tools as MCP, so the CLI lists and calls that set.
const TOOLS = ALL_TOOLS.filter((def) => isToolExposed(def, 'mcp'))

function findTool(name: string): ToolDef {
  const def = TOOLS.find((candidate) => candidate.name === name)
  if (!def) throw new Error(`Unknown tool "${name}". Run \`openpencil tool list\` to see tools.`)
  return def
}

function effectOf(def: ToolDef): 'read' | 'write' {
  return toolChangesDocument(def) ? 'write' : 'read'
}

function summaryOf(def: ToolDef): string {
  return def.description.split(/(?<=\.)\s/)[0] ?? def.description
}

const list = defineCommand({
  meta: { description: 'List the tools available to `tool call`' },
  args: { json },
  run({ args }) {
    if (args.json) {
      const rows = TOOLS.map((def) => ({
        name: def.name,
        effect: effectOf(def),
        description: def.description
      }))
      console.log(JSON.stringify(rows, null, 2))
      return
    }
    console.log('')
    console.log(bold(`  ${TOOLS.length} tools`))
    console.log('')
    console.log(
      fmtList(
        TOOLS.map((def) => ({
          header: `${def.name} ${dim(`[${effectOf(def)}]`)}`,
          details: { about: summaryOf(def) }
        })),
        { compact: true }
      )
    )
    console.log('')
  }
})

const describe = defineCommand({
  meta: { description: "Show a tool's description and JSON Schema for its arguments" },
  args: {
    name: { type: 'positional', description: 'Tool name', required: true },
    json
  },
  run({ args }) {
    try {
      const def = findTool(args.name)
      const schema = toJSONSchema(def.input, { errorMode: 'ignore' })
      if (args.json) {
        const info = { name: def.name, effect: effectOf(def), description: def.description, schema }
        console.log(JSON.stringify(info, null, 2))
        return
      }
      const header = entity('tool', def.name)
      console.log('')
      console.log(fmtList([{ header, details: { effect: effectOf(def), about: def.description } }]))
      console.log('')
      console.log(bold('  Arguments (JSON Schema)'))
      console.log(JSON.stringify(schema, null, 2))
      console.log('')
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})

async function readToolArgs(args: {
  args?: string
  'args-file'?: string
}): Promise<Record<string, unknown>> {
  const source = args['args-file'] ? await readTextSource(args['args-file']) : args.args
  if (!source) return {}
  const value: unknown = JSON.parse(source)
  // Valibot records accept arrays as index-keyed objects; tools never take them.
  const parsed = v.safeParse(toolArgsSchema, value)
  if (Array.isArray(value) || !parsed.success)
    throw new Error('Tool arguments must be a JSON object')
  return parsed.output
}

function printResult(result: unknown): void {
  const binary = result as { base64?: unknown; mimeType?: unknown } | null
  if (binary && typeof binary.base64 === 'string' && typeof binary.mimeType === 'string') {
    const bytes = Math.floor((binary.base64.length * 3) / 4)
    console.log(kv(binary.mimeType, `${bytes} bytes; use openpencil export to write files`))
    return
  }
  console.log(JSON.stringify(result, null, 2))
}

const call = defineCommand({
  meta: {
    description: 'Run one tool against the running app, or headlessly against a document file'
  },
  args: {
    name: { type: 'positional', description: 'Tool name from `tool list`', required: true },
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    args: { type: 'string', description: 'Tool arguments as a JSON object' },
    'args-file': {
      type: 'string',
      description: 'Read tool arguments from a JSON file, or - for stdin'
    },
    ...documentWriteOptions,
    ...appTargetOptions,
    json
  },
  async run({ args }) {
    try {
      if (!args.file && (args.write || args.output)) {
        throw new Error(
          '--write and --output need a document file; in the running app, use `openpencil documents save`'
        )
      }
      const def = findTool(args.name)
      const toolArgs = await readToolArgs(args)
      const { result, graph } = await runToolData(args.file, def.name, toolArgs, args)
      if (args.json) console.log(JSON.stringify(result, null, 2))
      else printResult(result)

      const outPath = args.output || (args.write ? args.file : undefined)
      if (!graph || !toolChangesDocument(def)) return
      if (outPath) {
        await writeFigDocument(graph, outPath)
        if (!args.json) console.error(dim(`Written to ${outPath}`))
      } else if (!args.json) {
        console.error(warn('Changes were not saved; pass --write or --output'))
      }
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})

export default defineCommand({
  meta: { description: 'List, describe, and call editor tools (the same set MCP exposes)' },
  subCommands: { list, describe, call }
})
