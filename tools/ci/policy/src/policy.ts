const ROOT_DOCS = new Set(['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'CHANGELOG.md', 'LICENSE'])
const DOC_ASSET = /\.(?:md|png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf)$/i

/**
 * `code` runs the full suites, and `cloud` adds the Cloud suites when a change reaches what the
 * Cloud package is built from. `verified`: a merge queue commit whose exact tree already passed its
 * pull request's CI.
 */
export type ChangeScope = 'docs' | 'code' | 'cloud' | 'verified'

/**
 * Routes a change by its paths. `cloudInputs` lists what the Cloud suites depend on (`cloudInputs`
 * in `cloud-inputs.ts`), or is `'all'` when that list couldn't be read; a change that touches none
 * of them skips those suites.
 */
export function classifyPaths(
  paths: readonly string[],
  cloudInputs: readonly string[] | 'all'
): Exclude<ChangeScope, 'verified'> {
  // An empty or unknown diff runs everything.
  if (paths.length === 0) return 'cloud'
  if (isDocumentation(paths)) return 'docs'
  if (cloudInputs === 'all') return 'cloud'
  return paths.some((path) => touchesInput(path, cloudInputs)) ? 'cloud' : 'code'
}

/** An input ending in `/` is a directory and covers everything below it; any other is one file. */
function touchesInput(path: string, inputs: readonly string[]): boolean {
  return inputs.some((input) => (input.endsWith('/') ? path.startsWith(input) : path === input))
}

/** Root docs, changelog fragments, package READMEs, and every AGENTS.md guide are docs-only; unknown paths, executable docs, and runtime prompt Markdown require the code checks. */
function isDocumentation(paths: readonly string[]): boolean {
  return paths.every((path) => {
    if (ROOT_DOCS.has(path) || /^packages\/[^/]+\/README\.md$/.test(path)) return true
    if (/(?:^|\/)AGENTS\.md$/.test(path)) return true
    if (path.startsWith('packages/docs/')) return DOC_ASSET.test(path)
    if (path.startsWith('openspec/')) return path.endsWith('.md')
    if (path.startsWith('changes/')) return path.endsWith('.md')
    if (path.startsWith('skills/')) return path.endsWith('.md') || path.endsWith('/LICENSE.txt')
    return false
  })
}

export const CODE_JOBS = [
  'source-quality',
  'package-quality',
  'repository-quality',
  'storybook',
  'native-test-contracts',
  'unit-tests',
  'feedback-tests'
] as const
export const CLOUD_JOBS = ['cloud-tests', 'cloud-storage'] as const
export const DOCS_JOB = 'documentation'
export const ALWAYS_JOBS = ['commit-messages'] as const
/** The jobs each scope runs besides `ALWAYS_JOBS`; a verified tree runs none of them. */
const SELECTED_JOBS = new Map<string, readonly string[]>([
  ['docs', [DOCS_JOB]],
  ['code', CODE_JOBS],
  ['cloud', [...CODE_JOBS, ...CLOUD_JOBS]],
  ['verified', []]
] satisfies [ChangeScope, readonly string[]][])

type JobResult = 'success' | 'failure' | 'cancelled' | 'skipped'
export interface JobStatus {
  result: JobResult
  outputs?: Record<string, string>
}

/** The sole required gate accepts only the successful checks selected by successful detection. */
export function gateErrors(needs: Partial<Record<string, JobStatus>>): string[] {
  const detection = needs.changes
  if (detection?.result !== 'success') return ['Change detection did not succeed']
  const scope = detection.outputs?.scope
  const selected = scope ? SELECTED_JOBS.get(scope) : undefined
  if (!selected) return ['Invalid or missing change scope']
  const required: readonly string[] = [...ALWAYS_JOBS, ...selected]
  const excluded = [...CODE_JOBS, ...CLOUD_JOBS, DOCS_JOB].filter((job) => !required.includes(job))
  const errors = required
    .filter((job) => needs[job]?.result !== 'success')
    .map((job) => `${job} did not succeed`)
  // Unexpected execution is also a policy failure: docs must not run the full suites, code that
  // doesn't reach Cloud skips its suites, and a verified tree runs nothing it already passed.
  for (const job of excluded) {
    if (needs[job]?.result !== 'skipped') errors.push(`${job} was not skipped for ${scope} routing`)
  }
  return errors
}
