import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { bold, fmtHistogram, fmtSummary, kv } from '../format'

import type { InfoResult } from '@open-pencil/core'
import { executeRpcCommand } from '@open-pencil/core'

async function getData(file?: string): Promise<InfoResult> {
  if (isAppMode(file)) return rpc<InfoResult>('info')
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'info', undefined) as InfoResult
}

export default defineCommand({
  meta: { description: 'Show document info (pages, node counts, fonts)' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file)

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
