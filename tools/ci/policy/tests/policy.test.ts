import { expect, test } from 'bun:test'

import {
  classifyPaths,
  ALWAYS_JOBS,
  CLOUD_JOBS,
  CODE_JOBS,
  DOCS_JOB,
  gateErrors,
  type ChangeScope,
  type JobStatus
} from '#ci/policy'

const CLOUD_INPUTS = ['packages/cloud/', 'packages/scene-graph/', 'bun.lock']
const NO_CLOUD_INPUTS: string[] = []

const documentation = [
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'changes/README.md',
  'changes/1095/added.md',
  'packages/vue/README.md',
  'packages/core/README.md',
  'packages/core/AGENTS.md',
  'src/AGENTS.md',
  'tests/AGENTS.md',
  'tools/AGENTS.md',
  'packages/docs/programmable/sdk/api/components/bindable-value.md',
  'packages/docs/public/logo.svg',
  'skills/open-pencil/SKILL.md',
  'skills/open-pencil/references/design-authoring.md',
  'openspec/proposal.md'
]
const code = [
  'src/app/ai/chat/system-prompt.md',
  'packages/design-jsx/src/reference/authoring.md',
  'packages/core/src/README.md',
  'packages/core/README.md.ts',
  'packages/core/instructions.md',
  'src/app/agents.md',
  'packages/core/src/AGENTS.md.ts',
  'packages/docs/.vitepress/config.ts',
  'packages/docs/demo.vue',
  'skills/open-pencil/scripts/create.ts',
  'changes/1095/notes.txt',
  'package.json',
  'bun.lock',
  '.github/workflows/ci.yml',
  'new-domain/instructions.md',
  'src/editor.ts'
]

test.each(documentation)('docs-only path: %s', (path) => {
  expect(classifyPaths([path], CLOUD_INPUTS)).toBe('docs')
})
test.each(code)('code or unknown path: %s', (path) => {
  expect(classifyPaths([path], NO_CLOUD_INPUTS)).toBe('code')
  expect(classifyPaths([...documentation, path], NO_CLOUD_INPUTS)).toBe('code')
})
test('changes that reach Cloud add the Cloud suites', () => {
  expect(classifyPaths(['packages/cloud/src/server/app.ts'], CLOUD_INPUTS)).toBe('cloud')
  expect(classifyPaths(['packages/scene-graph/src/random.ts'], CLOUD_INPUTS)).toBe('cloud')
  expect(classifyPaths(['src/editor.ts', 'bun.lock'], CLOUD_INPUTS)).toBe('cloud')
  expect(classifyPaths(['packages/cloud/README.md'], CLOUD_INPUTS)).toBe('docs')
})
test('changes outside Cloud skip the Cloud suites', () => {
  expect(classifyPaths(['src/editor.ts', 'packages/core/src/index.ts'], CLOUD_INPUTS)).toBe('code')
  // A directory input covers only paths below it, not a sibling sharing its prefix.
  expect(classifyPaths(['packages/cloud-extra/index.ts'], CLOUD_INPUTS)).toBe('code')
  expect(classifyPaths(['bun.lockb'], CLOUD_INPUTS)).toBe('code')
})
test('package READMEs and public guides share the docs-only route', () => {
  expect(
    classifyPaths(
      ['packages/vue/README.md', 'packages/docs/programmable/sdk/getting-started.md'],
      CLOUD_INPUTS
    )
  ).toBe('docs')
})
test('empty diffs and unreadable Cloud inputs fail safe to every check', () => {
  expect(classifyPaths([], CLOUD_INPUTS)).toBe('cloud')
  expect(classifyPaths(['src/editor.ts'], 'all')).toBe('cloud')
  expect(classifyPaths(['README.md'], 'all')).toBe('docs')
})
test('both sides of a rename affect classification', () => {
  expect(classifyPaths(['src/prompt.md', 'packages/docs/prompt.md'], CLOUD_INPUTS)).toBe('code')
  expect(classifyPaths(['packages/docs/old.md', 'packages/docs/new.md'], CLOUD_INPUTS)).toBe('docs')
})

function selectedJobs(scope: 'docs' | 'code' | 'cloud'): string[] {
  if (scope === 'docs') return [DOCS_JOB]
  return scope === 'cloud' ? [...CODE_JOBS, ...CLOUD_JOBS] : [...CODE_JOBS]
}

function results(scope: ChangeScope): Record<string, JobStatus> {
  return {
    changes: { result: 'success', outputs: { scope } },
    ...Object.fromEntries(ALWAYS_JOBS.map((job) => [job, { result: 'success' }])),
    [DOCS_JOB]: { result: scope === 'docs' ? 'success' : 'skipped' },
    ...Object.fromEntries(
      CODE_JOBS.map((job) => [
        job,
        { result: scope === 'code' || scope === 'cloud' ? 'success' : 'skipped' }
      ])
    ),
    ...Object.fromEntries(
      CLOUD_JOBS.map((job) => [job, { result: scope === 'cloud' ? 'success' : 'skipped' }])
    )
  }
}

test.each(['docs', 'code', 'cloud', 'verified'] as const)(
  'accepts only appropriate successful checks for %s',
  (scope) => {
    expect(gateErrors(results(scope))).toEqual([])
  }
)

test.each(['failure', 'cancelled', 'skipped'] as const)(
  'rejects %s detection and required checks',
  (result) => {
    for (const scope of ['docs', 'code', 'cloud'] as const) {
      expect(gateErrors({ ...results(scope), changes: { result } })).not.toEqual([])
      for (const job of [...ALWAYS_JOBS, ...selectedJobs(scope)]) {
        expect(gateErrors({ ...results(scope), [job]: { result } })).not.toEqual([])
      }
    }
  }
)

test('missing jobs or outputs cannot pass', () => {
  expect(gateErrors({})).not.toEqual([])
  expect(gateErrors({ ...results('docs'), changes: { result: 'success' } })).not.toEqual([])
  expect(
    gateErrors({
      ...results('docs'),
      changes: { result: 'success', outputs: { scope: 'unknown' } }
    })
  ).not.toEqual([])
  for (const scope of ['docs', 'code', 'cloud'] as const) {
    for (const job of [...ALWAYS_JOBS, ...selectedJobs(scope)]) {
      const incomplete = Object.fromEntries(
        Object.entries(results(scope)).filter(([name]) => name !== job)
      )
      expect(gateErrors(incomplete)).not.toEqual([])
    }
  }
})

test('docs routing rejects unexpected execution of test suites', () => {
  for (const job of [...CODE_JOBS, ...CLOUD_JOBS]) {
    expect(gateErrors({ ...results('docs'), [job]: { result: 'success' } })).not.toEqual([])
  }
})

test('code that does not reach Cloud rejects running the Cloud suites', () => {
  for (const job of CLOUD_JOBS) {
    expect(gateErrors({ ...results('code'), [job]: { result: 'success' } })).not.toEqual([])
  }
})

test('a verified tree runs only the checks every change runs', () => {
  for (const job of [...CODE_JOBS, ...CLOUD_JOBS, DOCS_JOB]) {
    expect(gateErrors({ ...results('verified'), [job]: { result: 'success' } })).not.toEqual([])
  }
  for (const job of ALWAYS_JOBS) {
    expect(gateErrors({ ...results('verified'), [job]: { result: 'skipped' } })).not.toEqual([])
  }
})
