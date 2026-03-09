import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { isAppMode, requireFile, rpc } from '../../app-client'
import { bold, kv, fmtHistogram, fmtSummary } from '../../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { AnalyzeSpacingResult } from '@open-pencil/core'

async function getData(file?: string): Promise<AnalyzeSpacingResult> {
  if (isAppMode(file)) return rpc<AnalyzeSpacingResult>('analyze_spacing')
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'analyze_spacing', undefined) as AnalyzeSpacingResult
}

export default defineCommand({
  meta: { description: 'Analyze spacing values (gap, padding)' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    grid: { type: 'string', description: 'Base grid size to check against', default: '8' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file)
    const gridSize = Number(args.grid)

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    console.log('')

    if (data.gaps.length > 0) {
      console.log(bold('  Gap values'))
      console.log('')
      console.log(
        fmtHistogram(
          data.gaps.slice(0, 15).map((g) => ({
            label: `${String(g.value).padStart(4)}px`,
            value: g.count,
            suffix: g.value % gridSize !== 0 ? '⚠' : undefined
          }))
        )
      )
      console.log('')
    }

    if (data.paddings.length > 0) {
      console.log(bold('  Padding values'))
      console.log('')
      console.log(
        fmtHistogram(
          data.paddings.slice(0, 15).map((p) => ({
            label: `${String(p.value).padStart(4)}px`,
            value: p.count,
            suffix: p.value % gridSize !== 0 ? '⚠' : undefined
          }))
        )
      )
      console.log('')
    }

    if (data.gaps.length === 0 && data.paddings.length === 0) {
      console.log('No auto-layout nodes with spacing found.')
      console.log('')
      return
    }

    console.log(fmtSummary({ 'gap values': data.gaps.length, 'padding values': data.paddings.length }))

    const offGridGaps = data.gaps.filter((g) => g.value % gridSize !== 0)
    const offGridPaddings = data.paddings.filter((p) => p.value % gridSize !== 0)

    if (offGridGaps.length > 0 || offGridPaddings.length > 0) {
      console.log('')
      console.log(bold(`  ⚠ Off-grid values (not ÷${gridSize}px)`))
      if (offGridGaps.length > 0) {
        console.log(kv('Gaps', offGridGaps.map((g) => `${g.value}px`).join(', ')))
      }
      if (offGridPaddings.length > 0) {
        console.log(kv('Paddings', offGridPaddings.map((p) => `${p.value}px`).join(', ')))
      }
    }

    console.log('')
  }
})
