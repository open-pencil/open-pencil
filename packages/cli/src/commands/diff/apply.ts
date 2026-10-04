import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { appTargetOptions } from '#cli/app-target'
import { dim, entity, fail, fmtList, ok, printError, warn } from '#cli/format'
import { documentWriteOptions, writeFigDocument } from '#cli/headless'
import { runToolData } from '#cli/tool-data'

interface PatchResult {
  path: string
  id: string | null
  status: string
  changes?: string[]
  error?: string
}

interface ApplyResult {
  error?: string
  dryRun?: boolean
  applied?: number
  failed?: number
  results?: PatchResult[]
}

async function readPatch(source: string): Promise<string> {
  if (source !== '-') return readFile(source, 'utf-8')
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

function patchDetails(row: PatchResult) {
  if (row.error) return [fail(row.error)]
  if (row.changes) return { changes: row.changes.join(', ') }
  return undefined
}

function printApplyResult(result: ApplyResult, dryRun: boolean): void {
  if (result.error) printError(result.error)
  const rows = result.results ?? []
  if (rows.length > 0) {
    console.log(
      fmtList(
        rows.map((row) => ({
          header: entity(row.status, row.path, row.id ?? undefined),
          details: patchDetails(row)
        }))
      )
    )
  }
  if (result.error) return
  const failed = result.failed ?? 0
  const line = `${result.applied ?? 0} ${dryRun ? 'would apply' : 'applied'}, ${failed} failed`
  console.log(failed > 0 ? fail(line) : ok(line))
}

export default defineCommand({
  meta: { description: 'Apply a patch from diff create or diff show' },
  args: {
    patch: { type: 'positional', description: 'Patch file path, or - for stdin', required: true },
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    'dry-run': { type: 'boolean', description: 'Validate and list changes without applying' },
    force: { type: 'boolean', description: 'Apply even when current values differ from the patch' },
    ...documentWriteOptions,
    ...appTargetOptions,
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const dryRun = !!args['dry-run']
    const { result, graph } = await runToolData(
      args.file,
      'diff_apply',
      { patch: await readPatch(args.patch), dryRun, force: !!args.force },
      args
    )
    const report = result as ApplyResult
    if (args.json) console.log(JSON.stringify(report, null, 2))
    else printApplyResult(report, dryRun)

    const failed = Boolean(report.error) || (report.failed ?? 0) > 0
    if (graph && !dryRun && !failed) {
      const outPath = args.output || (args.write ? args.file : undefined)
      if (outPath) {
        await writeFigDocument(graph, outPath)
        if (!args.json) console.error(dim(`Written to ${outPath}`))
      } else if (!args.json) {
        console.error(warn('Not saved; pass --write or --output to save the document'))
      }
    }
    if (failed) process.exit(1)
  }
})
