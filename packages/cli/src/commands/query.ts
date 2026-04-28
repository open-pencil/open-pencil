import { defineCommand } from 'citty'

import { loadRpcData } from '#cli/rpc-data'
import { printNodeResults, printError } from '#cli/format'

import type { QueryNodeResult } from '@open-pencil/core/rpc'

export default defineCommand({
  meta: {
    description: 'Query nodes using XPath selectors'
  },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    selector: {
      type: 'positional',
      description: 'XPath selector (e.g., //FRAME[@width < 300], //TEXT[contains(@name, "Label")])',
      required: true
    },
    page: { type: 'string', description: 'Page name (default: all pages)' },
    limit: { type: 'string', description: 'Max results (default: 1000)', default: '1000' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const results = await loadRpcData<QueryNodeResult[] | { error: string }>(args.file, 'query', {
      selector: args.selector,
      page: args.page,
      limit: args.limit ? Number(args.limit) : undefined
    })

    if ('error' in results) {
      printError(results.error)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    printNodeResults(results, (n) => {
      const q = n as { width?: number; height?: number; name: string }
      return `${q.name}  ${q.width}×${q.height}`
    })
  }
})
