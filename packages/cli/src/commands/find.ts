import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { printNodeResults } from '../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { FindNodeResult } from '@open-pencil/core'

async function getData(file: string | undefined, args: { name?: string; type?: string; page?: string; limit?: string }): Promise<FindNodeResult[]> {
  const rpcArgs = { name: args.name, type: args.type, page: args.page, limit: args.limit ? Number(args.limit) : undefined }
  if (isAppMode(file)) return rpc<FindNodeResult[]>('find', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'find', rpcArgs) as FindNodeResult[]
}

export default defineCommand({
  meta: { description: 'Find nodes by name or type' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    name: { type: 'string', description: 'Node name (partial match, case-insensitive)' },
    type: { type: 'string', description: 'Node type: FRAME, TEXT, RECTANGLE, INSTANCE, etc.' },
    page: { type: 'string', description: 'Page name (default: all pages)' },
    limit: { type: 'string', description: 'Max results (default: 100)', default: '100' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const results = await getData(args.file, args)

    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    printNodeResults(results)
  }
})
