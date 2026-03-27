import { defineCommand } from 'citty'

import { executeRpcCommand } from '@open-pencil/core'

import { isAppMode, requireFile, rpc } from '../app-client'
import { bold, fmtList, entity } from '../format'
import { loadDocument } from '../headless'

import type { PageItem } from '@open-pencil/core'

async function getData(file?: string): Promise<PageItem[]> {
  if (isAppMode(file)) return rpc<PageItem[]>('pages')
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'pages', undefined) as PageItem[]
}

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
    const pages = await getData(args.file)

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
