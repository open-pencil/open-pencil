import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as v from 'valibot'

const diagnosticSchema = v.object({
  code: v.optional(v.string()),
  filename: v.optional(v.string()),
  message: v.string(),
  severity: v.picklist(['error', 'warning', 'advice'])
})
const resultSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ diagnostics: v.array(diagnosticSchema) })
)
export type Diagnostic = v.InferOutput<typeof diagnosticSchema>

/** The plugin's source entry, which Oxlint loads as it would the published build. */
const PLUGIN = fileURLToPath(import.meta.resolve('#oxlint-plugin/index'))
const OXLINT = join(dirname(Bun.resolveSync('oxlint/package.json', import.meta.dir)), 'bin/oxlint')

export async function lint(
  source: string,
  rules: Record<string, string | readonly unknown[]>,
  relativePath = 'fixture.ts'
): Promise<Diagnostic[]> {
  return lintFiles({ [relativePath]: source }, rules)
}

/**
 * Lint several fixtures in one Oxlint run, by their path relative to a temporary directory;
 * each diagnostic's `filename` ends with that path.
 */
export async function lintFiles(
  sources: Record<string, string>,
  rules: Record<string, string | readonly unknown[]>
): Promise<Diagnostic[]> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-oxlint-plugin-'))
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
      JSON.stringify({ plugins: ['typescript'], jsPlugins: [PLUGIN], rules })
    )
    const child = Bun.spawn([OXLINT, '-c', configPath, '--format', 'json', ...sourcePaths], {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited
    ])
    if (code !== 0 && code !== 1) throw new Error(`Oxlint exited ${code}: ${stderr}`)
    const { diagnostics } = v.parse(resultSchema, stdout)
    const parserFailure = diagnostics.find(
      (item) => item.severity === 'error' && item.code === undefined
    )
    if (parserFailure) {
      throw new Error(`Oxlint could not parse the fixture: ${parserFailure.message}`)
    }
    return diagnostics
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function ruleDiagnostics(diagnostics: Diagnostic[], rule: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === `open-pencil(${rule})`)
}
