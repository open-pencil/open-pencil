import { defineCommand } from 'citty'

import { loadRpcData } from '#cli/rpc-data'
import { bold, fmtHistogram, fmtSummary, kv } from '#cli/format'

import type { InfoResult } from '@open-pencil/core/rpc'

export default defineCommand({
  meta: { description: 'Show document info (pages, node counts, fonts)' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await loadRpcData<InfoResult>(args.file, 'info')

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    console.log('')
    console.log(bold(`  ${data.pages} pages, ${data.totalNodes} nodes`))
    console.log('')

    const pageItems = Object.entries(data.pageCounts).map(([label, value]) => ({ label, value }))
    console.log(fmtHistogram(pageItems, { unit: 'nodes' }))

    console.log('')
    console.log(fmtSummary(data.types))

    if (data.fonts.length > 0) {
      console.log('')
      console.log(kv('Fonts', data.fonts.join(', ')))
    }
    console.log('')
  }
})
