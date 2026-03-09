import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { bold, entity, fmtList, fmtSummary } from '../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { VariablesResult } from '@open-pencil/core'

async function getData(file: string | undefined, args: { collection?: string; type?: string }): Promise<VariablesResult> {
  const rpcArgs = { collection: args.collection, type: args.type }
  if (isAppMode(file)) return rpc<VariablesResult>('variables', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'variables', rpcArgs) as VariablesResult
}

export default defineCommand({
  meta: { description: 'List design variables and collections' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    collection: { type: 'string', description: 'Filter by collection name' },
    type: { type: 'string', description: 'Filter by type: COLOR, FLOAT, STRING, BOOLEAN' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file, args)

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
