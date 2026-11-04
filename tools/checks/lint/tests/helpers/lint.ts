import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import * as v from 'valibot'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const diagnosticSchema = v.object({
  code: v.optional(v.string()),
  filename: v.optional(v.string()),
  message: v.string(),
  severity: v.picklist(['error', 'warning', 'advice'])
})
const resultSchema = v.object({ diagnostics: v.array(diagnosticSchema) })
export type Diagnostic = v.InferOutput<typeof diagnosticSchema>

export async function lint(
  source: string,
  rules: Record<string, string | readonly unknown[]>,
  relativePath = 'fixture.ts'
): Promise<Diagnostic[]> {
  return lintFiles({ [relativePath]: source }, rules)
}

/**
 * Lint several fixtures in one Oxlint run, by their path relative to a temporary directory;
 * each diagnostic's `filename` ends with that path. One process instead of one per fixture
 * keeps a table of cases quick under a busy test runner.
 */
export async function lintFiles(
  sources: Record<string, string>,
  rules: Record<string, string | readonly unknown[]>
): Promise<Diagnostic[]> {
  const root = await resolveWorkspaceRoot(import.meta.dir)
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-lint-'))
  try {
    const sourcePaths = await Promise.all(
      Object.entries(sources).map(async ([relativePath, source]) => {
        const sourcePath = join(directory, relativePath)
        await mkdir(dirname(sourcePath), { recursive: true })
        await writeFile(sourcePath, source)
        return sourcePath
      })
    )
    const configPath = join(directory, 'oxlint.json')
    await writeFile(
      configPath,
      JSON.stringify({
        plugins: ['typescript', 'vue'],
        jsPlugins: [join(root, 'lint/plugin.js')],
        rules
      })
    )
    const child = Bun.spawn(
      [
        join(root, 'node_modules/.bin/oxlint'),
        '-c',
        configPath,
        '--format',
        'json',
        ...sourcePaths
      ],
      // From the repository root, where rules find the files they read, such as src/app.css.
      { cwd: root, stdout: 'pipe', stderr: 'pipe' }
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited
    ])
    if (code !== 0 && code !== 1) throw new Error(`Oxlint exited ${code}: ${stderr}`)
    const { diagnostics } = v.parse(resultSchema, JSON.parse(stdout))
    const parserFailure = diagnostics.find(
      (item) => item.severity === 'error' && item.code === undefined
    )
    if (parserFailure)
      throw new Error(`Oxlint could not parse the fixture: ${parserFailure.message}`)
    return diagnostics
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function ruleDiagnostics(diagnostics: Diagnostic[], rule: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === `open-pencil(${rule})`)
}
