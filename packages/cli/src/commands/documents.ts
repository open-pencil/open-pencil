import { defineCommand } from 'citty'

import type { AutomationDocumentSummary } from '@open-pencil/core/rpc'

import { rpc } from '#cli/app-client'
import { bold, entity, fmtList, kv, printError } from '#cli/format'

export default defineCommand({
  meta: { description: 'List open documents in the running app' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const data = await rpc<{ documents: AutomationDocumentSummary[] }>('list_documents')
      const documents = data.documents

      if (args.json) {
        console.log(JSON.stringify(documents, null, 2))
        return
      }

      console.log('')
      console.log(bold(`  ${documents.length} open document${documents.length !== 1 ? 's' : ''}`))
      console.log('')
      console.log(
        fmtList(
          documents.map((doc) => ({
            header: `${entity('document', doc.name, doc.id)}${doc.active ? ' [active]' : ''}`,
            details: {
              ...(doc.path ? { path: doc.path } : {}),
              current: `${doc.current_page_name} (${doc.current_page_id})`,
              pages: doc.pages.map((page) => `${page.name} (${page.id})`).join(', ')
            }
          })),
          { compact: true }
        )
      )
      console.log('')
      console.log(kv('target flags', '--document-id <id> --page-id <id>'))
      console.log('')
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})
