import { printNodeResults } from '#cli/format'
import { loadRpcData } from '#cli/rpc-data'
import { defineCommand } from 'citty'

import type { FindNodeResult } from '@open-pencil/core/rpc'

export default defineCommand({
  meta: { description: 'Find nodes by name or type' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    name: { type: 'string', description: 'Node name (partial match, case-insensitive)' },
    type: { type: 'string', description: 'Node type: FRAME, TEXT, RECTANGLE, INSTANCE, etc.' },
    page: { type: 'string', description: 'Page name (default: all pages)' },
    limit: { type: 'string', description: 'Max results (default: 100)', default: '100' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const results = await loadRpcData<FindNodeResult[]>(args.file, 'find', {
      name: args.name,
      type: args.type,
      page: args.page,
      limit: args.limit ? Number(args.limit) : undefined
    })

    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    printNodeResults(results)
  }
})
