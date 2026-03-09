import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { isAppMode, requireFile, rpc } from '../../app-client'
import { bold, fmtHistogram, fmtSummary } from '../../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { AnalyzeTypographyResult } from '@open-pencil/core'

function weightName(w: number): string {
  if (w <= 100) return 'Thin'
  if (w <= 200) return 'ExtraLight'
  if (w <= 300) return 'Light'
  if (w <= 400) return 'Regular'
  if (w <= 500) return 'Medium'
  if (w <= 600) return 'SemiBold'
  if (w <= 700) return 'Bold'
  if (w <= 800) return 'ExtraBold'
  return 'Black'
}

async function getData(file?: string): Promise<AnalyzeTypographyResult> {
  if (isAppMode(file)) return rpc<AnalyzeTypographyResult>('analyze_typography')
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'analyze_typography', {}) as AnalyzeTypographyResult
}

export default defineCommand({
  meta: { description: 'Analyze typography usage' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    'group-by': { type: 'string', description: 'Group by: family, size, weight (default: show all styles)' },
    limit: { type: 'string', description: 'Max styles to show', default: '30' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file)
    const limit = Number(args.limit)
    const groupBy = args['group-by']

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (data.styles.length === 0) {
      console.log('No text nodes found.')
      return
    }

    console.log('')

    if (groupBy === 'family') {
      const byFamily = new Map<string, number>()
      for (const s of data.styles) byFamily.set(s.family, (byFamily.get(s.family) ?? 0) + s.count)
      console.log(bold('  Font families'))
      console.log('')
      console.log(
        fmtHistogram(
          [...byFamily.entries()].sort((a, b) => b[1] - a[1]).map(([family, count]) => ({ label: family, value: count }))
        )
      )
    } else if (groupBy === 'size') {
      const bySize = new Map<number, number>()
      for (const s of data.styles) bySize.set(s.size, (bySize.get(s.size) ?? 0) + s.count)
      console.log(bold('  Font sizes'))
      console.log('')
      console.log(
        fmtHistogram(
          [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ label: `${size}px`, value: count }))
        )
      )
    } else if (groupBy === 'weight') {
      const byWeight = new Map<number, number>()
      for (const s of data.styles) byWeight.set(s.weight, (byWeight.get(s.weight) ?? 0) + s.count)
      console.log(bold('  Font weights'))
      console.log('')
      console.log(
        fmtHistogram(
          [...byWeight.entries()].sort((a, b) => b[1] - a[1]).map(([weight, count]) => ({ label: `${weight} ${weightName(weight)}`, value: count }))
        )
      )
    } else {
      console.log(bold('  Typography styles'))
      console.log('')
      const items = data.styles.slice(0, limit).map((s) => {
        const lh = s.lineHeight !== 'auto' ? ` / ${s.lineHeight}` : ''
        return { label: `${s.family} ${s.size}px ${weightName(s.weight)}${lh}`, value: s.count }
      })
      console.log(fmtHistogram(items))
    }

    console.log('')
    console.log(fmtSummary({ 'unique styles': data.styles.length, 'text nodes': data.totalTextNodes }))
    console.log('')
  }
})
