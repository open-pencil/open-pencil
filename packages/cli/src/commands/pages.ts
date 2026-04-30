import { defineCommand } from 'citty'

import { loadRpcData } from '#cli/rpc-data'
import { bold, fmtList, entity } from '#cli/format'

import type { PageItem } from '@open-pencil/core/rpc'

export default defineCommand({
  meta: { description: 'List pages in a document' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const pages = await loadRpcData<PageItem[]>(args.file, 'pages')

    if (args.json) {
      console.log(JSON.stringify(pages, null, 2))
      return
    }

    console.log('')
    console.log(bold(`  ${pages.length} page${pages.length !== 1 ? 's' : ''}`))
    console.log('')
    console.log(
      fmtList(
        pages.map((page) => ({
          header: entity('page', page.name, page.id),
          details: { nodes: page.nodes }
        })),
        { compact: true }
      )
    )
    console.log('')
  }
})
