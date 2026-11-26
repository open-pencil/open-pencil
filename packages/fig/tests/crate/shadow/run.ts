// Runs the fig tests in shadow mode (`preload.ts`) and reports how the crate's reads compare with
// the TypeScript reader's: the same, different, different only where the reader repairs a component
// loop, or skipped because the reader refuses the records or they do not encode as a file. Exits
// nonzero when a read differs anywhere else.
// usage: bun tests/crate/shadow/run.ts [test paths...]
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { groupBy } from 'es-toolkit'
import * as v from 'valibot'

import { repoPath } from '@open-pencil/test-support/paths'

import type { ShadowResult } from './preload'

const resultSchema = v.array(
  v.object({
    kind: v.picklist(['page', 'component', 'instance']),
    id: v.string(),
    at: v.string(),
    outcome: v.picklist(['same', 'different', 'loops', 'skipped']),
    detail: v.optional(v.string()),
    values: v.optional(v.number())
  })
)

const packageDir = repoPath('packages/fig')
const report = join(await mkdtemp(join(tmpdir(), 'fig-shadow-')), 'report.json')
const paths = process.argv.slice(2)
const tests = Bun.spawn(
  [
    'bun',
    'test',
    '--preload',
    './tests/crate/shadow/preload.ts',
    ...(paths.length ? paths : ['tests'])
  ],
  {
    cwd: packageDir,
    env: { ...process.env, FIG_SHADOW_REPORT: report },
    stdout: 'ignore',
    stderr: 'inherit'
  }
)
const suite = await tests.exited

const parsed = v.safeParse(
  v.pipe(v.string(), v.parseJson(), resultSchema),
  await readFile(report, 'utf8')
)
if (!parsed.success) throw new Error('The shadow run wrote no report')
const results: ShadowResult[] = parsed.output
const {
  same = [],
  different = [],
  loops = [],
  skipped = []
} = groupBy(results, (result) => result.outcome)
const values = same.reduce((sum, result) => sum + (result.values ?? 0), 0)

process.stdout.write(
  `Shadowed ${results.length} reads: ${same.length} the same (${values} field values), ` +
    `${different.length} different, ${loops.length} different where the reader repairs a ` +
    `component loop, which the crate does not port yet, ${skipped.length} skipped.\n`
)
for (const [reason, reads] of Object.entries(
  groupBy(skipped, (result) => (result.detail ?? '').split(':')[0])
))
  process.stdout.write(`  skipped, ${reason}: ${reads.length}\n`)
for (const result of different)
  process.stdout.write(`\n${result.kind} ${result.id} read at ${result.at}\n  ${result.detail}\n`)
// Shadowing must not change what the tests find.
if (suite !== 0) process.stdout.write('\nThe fig tests failed in shadow mode.\n')
process.exitCode = different.length || suite !== 0 ? 1 : 0
