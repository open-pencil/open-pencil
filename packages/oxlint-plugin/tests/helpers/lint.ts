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

/** The domain plugins' source entries, which Oxlint loads as it would the published build. */
export const DOMAINS = ['data', 'imports', 'runtime', 'security', 'structure', 'types'] as const
const PLUGINS = DOMAINS.map((domain) =>
  fileURLToPath(import.meta.resolve(`#oxlint-plugin/plugins/${domain}`))
)
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
    return await lintWithConfig({ plugins: ['typescript'], rules }, directory, sourcePaths)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/**
 * Run Oxlint over files with a configuration written into `directory`, adding this plugin from
 * source.
 */
export async function lintWithConfig(
  config: Record<string, unknown>,
  directory: string,
  files: string[]
): Promise<Diagnostic[]> {
  const configPath = join(directory, 'oxlint.json')
  await writeFile(configPath, JSON.stringify({ ...config, jsPlugins: PLUGINS }))
  const child = Bun.spawn([OXLINT, '-c', configPath, '--format', 'json', ...files], {
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
}

/** The diagnostics of one rule, by its full ID: Oxlint reports `@open-pencil/data/no-x` as `@open-pencil/data(no-x)`. */
export function ruleDiagnostics(diagnostics: Diagnostic[], rule: string): Diagnostic[] {
  const at = rule.lastIndexOf('/')
  const code = `${rule.slice(0, at)}(${rule.slice(at + 1)})`
  return diagnostics.filter((diagnostic) => diagnostic.code === code)
}
