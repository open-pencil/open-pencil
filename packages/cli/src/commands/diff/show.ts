import { defineCommand } from 'citty'

import { appTargetOptions } from '#cli/app/target'
import { runToolData } from '#cli/tool-data'

import { printDiffResult, type DiffResult } from './output'

export default defineCommand({
  meta: { description: 'Preview the patch that setting JSX attributes on a node would produce' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    attributes: {
      type: 'string',
      description: 'JSX attributes to set, e.g. \'w={200} bg="#FF0000"\'',
      required: true
    },
    ...appTargetOptions,
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const { result } = await runToolData(
      args.file,
      'diff_show',
      { id: args.id, attributes: args.attributes },
      args
    )
    printDiffResult(result as DiffResult, !!args.json)
  }
})
