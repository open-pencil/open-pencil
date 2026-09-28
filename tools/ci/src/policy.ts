const ROOT_DOCS = new Set(['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'CHANGELOG.md', 'LICENSE'])
const DOC_ASSET = /\.(?:md|png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf)$/i

export type ChangeScope = 'docs' | 'code'

/** Root docs, package READMEs, and every AGENTS.md guide are docs-only; unknown paths, executable docs, and runtime prompt Markdown require the code checks. */
export function classifyPaths(paths: readonly string[]): ChangeScope {
  if (paths.length === 0) return 'code'
  return paths.every((path) => {
    if (ROOT_DOCS.has(path) || /^packages\/[^/]+\/README\.md$/.test(path)) return true
    if (/(?:^|\/)AGENTS\.md$/.test(path)) return true
    if (path.startsWith('packages/docs/')) return DOC_ASSET.test(path)
    if (path.startsWith('openspec/')) return path.endsWith('.md')
    if (path.startsWith('skills/')) return path.endsWith('.md') || path.endsWith('/LICENSE.txt')
    return false
  })
    ? 'docs'
    : 'code'
}

export const CODE_JOBS = [
  'source-quality',
  'package-quality',
  'repository-quality',
  'storybook',
  'native-test-contracts',
  'unit-tests'
] as const
export const DOCS_JOB = 'documentation'
export const ALWAYS_JOBS = ['commit-messages'] as const

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
  if (scope !== 'docs' && scope !== 'code') return ['Invalid or missing change scope']
  const required: readonly string[] = [
    ...ALWAYS_JOBS,
    ...(scope === 'docs' ? [DOCS_JOB] : CODE_JOBS)
  ]
  const excluded: readonly string[] = scope === 'docs' ? CODE_JOBS : [DOCS_JOB]
  const errors = required
    .filter((job) => needs[job]?.result !== 'success')
    .map((job) => `${job} did not succeed`)
  // Unexpected execution is also a policy failure: docs must not run the full suites.
  for (const job of excluded) {
    if (needs[job]?.result !== 'skipped')
      errors.push(`${job} was not skipped for ${scope}-only routing`)
  }
  return errors
}
