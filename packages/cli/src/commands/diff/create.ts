import { defineCommand } from 'citty'

import { runToolData } from '#cli/tool-data'

import { nodePairArgs } from './args'
import { printDiffResult, type DiffResult } from './output'

export default defineCommand({
  meta: { description: 'Property diff between two node trees as a unified patch' },
  args: {
    ...nodePairArgs,
    depth: { type: 'string', description: 'Max tree depth (default: 10)' }
  },
  async run({ args }) {
    const { result } = await runToolData(
      args.file,
      'diff_create',
      { from: args.from, to: args.to, ...(args.depth ? { depth: Number(args.depth) } : {}) },
      args
    )
    printDiffResult(result as DiffResult, !!args.json)
  }
})
