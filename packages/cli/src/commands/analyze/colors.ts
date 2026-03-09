import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { isAppMode, requireFile, rpc } from '../../app-client'
import { bold, fmtHistogram, fmtList, fmtSummary } from '../../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { AnalyzeColorsResult } from '@open-pencil/core'

async function getData(file: string | undefined, args: { threshold?: string; similar?: boolean }): Promise<AnalyzeColorsResult> {
  const rpcArgs = { threshold: Number(args.threshold ?? 15), similar: args.similar }
  if (isAppMode(file)) return rpc<AnalyzeColorsResult>('analyze_colors', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'analyze_colors', rpcArgs) as AnalyzeColorsResult
}

export default defineCommand({
  meta: { description: 'Analyze color palette usage' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    limit: { type: 'string', description: 'Max colors to show', default: '30' },
    threshold: { type: 'string', description: 'Distance threshold for clustering similar colors (0–50)', default: '15' },
    similar: { type: 'boolean', description: 'Show similar color clusters' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file, args)
    const limit = Number(args.limit)

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (data.colors.length === 0) {
      console.log('No colors found.')
      return
    }

    const sorted = data.colors.slice(0, limit)

    console.log('')
    console.log(bold('  Colors by usage'))
    console.log('')
    console.log(
      fmtHistogram(
        sorted.map((c) => ({
          label: c.hex,
          value: c.count,
          tag: c.variableName ? `$${c.variableName}` : undefined
        }))
      )
    )

    const hardcoded = data.colors.filter((c) => !c.variableName)
    const fromVars = data.colors.filter((c) => c.variableName)

    console.log('')
    console.log(
      fmtSummary({ 'unique colors': data.colors.length, 'from variables': fromVars.length, hardcoded: hardcoded.length })
    )

    if (args.similar && data.clusters.length > 0) {
      console.log('')
      console.log(bold('  Similar colors (consider merging)'))
      console.log('')
      console.log(
        fmtList(
          data.clusters.slice(0, 10).map((cluster) => ({
            header: cluster.colors.map((c) => c.hex).join(', '),
            details: { suggest: cluster.suggestedHex, total: `${cluster.totalCount}×` }
          }))
        )
      )
    }

    console.log('')
  }
})
