import { defineCommand } from 'citty'

import { runToolData } from '#cli/tool-data'

import { nodePairArgs } from './args'
import { printDiffResult, type DiffResult } from './output'

export default defineCommand({
  meta: { description: 'Structural diff between two nodes as design JSX' },
  args: {
    ...nodePairArgs
  },
  async run({ args }) {
    const { result } = await runToolData(
      args.file,
      'diff_jsx',
      { from: args.from, to: args.to },
      args
    )
    printDiffResult(result as DiffResult, !!args.json)
  }
})
