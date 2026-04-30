import { defineCommand } from 'citty'

import { loadRpcData } from '#cli/rpc-data'
import { bold, entity, fmtList, fmtSummary } from '#cli/format'

import type { VariablesResult } from '@open-pencil/core/rpc'

export default defineCommand({
  meta: { description: 'List design variables and collections' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    collection: { type: 'string', description: 'Filter by collection name' },
    type: { type: 'string', description: 'Filter by type: COLOR, FLOAT, STRING, BOOLEAN' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await loadRpcData<VariablesResult>(args.file, 'variables', {
      collection: args.collection,
      type: args.type
    })

    if (data.totalVariables === 0) {
      console.log('No variables found.')
      return
    }

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    console.log('')

    for (const coll of data.collections) {
      console.log(bold(entity(coll.name, coll.modes.join(', '))))
      console.log('')
      console.log(
        fmtList(
          coll.variables.map((v) => ({
            header: v.name,
            details: { value: v.value, type: v.type.toLowerCase() }
          })),
          { compact: true }
        )
      )
      console.log('')
    }

    console.log(
      fmtSummary({
        variables: data.totalVariables,
        collections: data.totalCollections
      })
    )
    console.log('')
  }
})
