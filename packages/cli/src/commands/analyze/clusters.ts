import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { isAppMode, requireFile, rpc } from '../../app-client'
import { bold, fmtList, fmtSummary } from '../../format'
import { executeRpcCommand, calcClusterConfidence } from '@open-pencil/core'

import type { AnalyzeClustersResult } from '@open-pencil/core'

function formatSignature(sig: string): string {
  const [typeSize, children] = sig.split('|')
  const type = typeSize.split(':')[0]
  if (!type) return sig
  const typeName = type.charAt(0) + type.slice(1).toLowerCase()
  if (!children) return typeName

  const childParts = children.split(',').map((c) => {
    const [t, count] = c.split(':')
    if (!t) return ''
    const name = t.charAt(0) + t.slice(1).toLowerCase()
    return Number(count) > 1 ? `${name}×${count}` : name
  })

  return `${typeName} > [${childParts.join(', ')}]`
}

async function getData(file: string | undefined, args: { limit?: string; 'min-size'?: string; 'min-count'?: string }): Promise<AnalyzeClustersResult> {
  const rpcArgs = { limit: Number(args.limit ?? 20), minSize: Number(args['min-size'] ?? 30), minCount: Number(args['min-count'] ?? 2) }
  if (isAppMode(file)) return rpc<AnalyzeClustersResult>('analyze_clusters', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'analyze_clusters', rpcArgs) as AnalyzeClustersResult
}

export default defineCommand({
  meta: { description: 'Find repeated design patterns (potential components)' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    limit: { type: 'string', description: 'Max clusters to show', default: '20' },
    'min-size': { type: 'string', description: 'Min node size in px', default: '30' },
    'min-count': { type: 'string', description: 'Min instances to form cluster', default: '2' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file, args)

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (data.clusters.length === 0) {
      console.log('No repeated patterns found.')
      return
    }

    console.log('')
    console.log(bold('  Repeated patterns'))
    console.log('')

    const items = data.clusters.map((c) => {
      const first = c.nodes[0]
      const confidence = calcClusterConfidence(c.nodes)

      const widths = c.nodes.map((n) => n.width)
      const heights = c.nodes.map((n) => n.height)
      const wRange = Math.max(...widths) - Math.min(...widths)
      const hRange = Math.max(...heights) - Math.min(...heights)
      const avgW = Math.round(widths.reduce((a, b) => a + b, 0) / widths.length)
      const avgH = Math.round(heights.reduce((a, b) => a + b, 0) / heights.length)

      const sizeStr =
        wRange <= 4 && hRange <= 4
          ? `${avgW}×${avgH}`
          : `${avgW}×${avgH} (±${Math.max(wRange, hRange)}px)`

      return {
        header: `${c.nodes.length}× ${first.type.toLowerCase()} "${first.name}" (${confidence}% match)`,
        details: {
          size: sizeStr,
          structure: formatSignature(c.signature),
          examples: c.nodes.slice(0, 3).map((n) => n.id).join(', ')
        }
      }
    })

    console.log(fmtList(items, { numbered: true }))

    const clusteredNodes = data.clusters.reduce((sum, c) => sum + c.nodes.length, 0)
    console.log('')
    console.log(fmtSummary({
      clusters: data.clusters.length,
      'total nodes': data.totalNodes,
      clustered: clusteredNodes
    }))
    console.log('')
  }
})
