import { writeFile } from 'node:fs/promises'

import { defineCommand } from 'citty'
import { isUndefined, omitBy } from 'es-toolkit'
import { toUint8Array } from 'js-base64'

import type { Rect } from '@open-pencil/scene-graph/primitives'

import { dim, fmtSummary, kv, ok, printError } from '#cli/format'
import { runToolData } from '#cli/tool-data'

import { nodePairArgs } from './args'

interface VisualDiffResult {
  error?: string
  base64?: string
  width?: number
  height?: number
  scale?: number
  changedPixels?: number
  totalPixels?: number
  changedRatio?: number
  changedBounds?: Rect | null
  sizeChanged?: boolean
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value)
}

export default defineCommand({
  meta: { description: 'Pixel diff between two rendered nodes, written as a PNG' },
  args: {
    ...nodePairArgs,
    output: { type: 'string', alias: 'o', description: 'Diff PNG path', required: true },
    scale: { type: 'string', description: 'Render scale before the max-edge limit (default: 1)' },
    'max-edge': { type: 'string', description: 'Maximum image width or height (default: 1280)' },
    threshold: {
      type: 'string',
      description: 'Color tolerance 0–1; smaller is stricter (default: 0.1)'
    }
  },
  async run({ args }) {
    const toolArgs = omitBy(
      {
        from: args.from,
        to: args.to,
        scale: optionalNumber(args.scale),
        maxEdge: optionalNumber(args['max-edge']),
        threshold: optionalNumber(args.threshold)
      },
      isUndefined
    )
    const data = await runToolData(args.file, 'diff_visual', toolArgs, args)
    const result = data.result as VisualDiffResult
    if (result.error || !result.base64) {
      printError(result.error ?? 'Visual diff produced no image')
      process.exit(1)
    }
    await writeFile(args.output, toUint8Array(result.base64))

    // The image went to the file; keep the base64 payload out of the report.
    const summary = { ...result, base64: undefined }
    if (args.json) {
      console.log(JSON.stringify({ ...summary, output: args.output }, null, 2))
      return
    }
    console.log(ok(`Wrote ${args.output}`))
    console.log(
      fmtSummary({
        'changed pixels': summary.changedPixels ?? 0,
        'total pixels': summary.totalPixels ?? 0
      })
    )
    console.log(kv('changed', `${((summary.changedRatio ?? 0) * 100).toFixed(2)}%`))
    if (summary.changedBounds) {
      const { x, y, width, height } = summary.changedBounds
      console.log(kv('region', `${width}×${height} at ${x}, ${y}`))
    }
    if (summary.sizeChanged)
      console.log(dim('  Rendered sizes differ; the smaller side is padded.'))
  }
})
