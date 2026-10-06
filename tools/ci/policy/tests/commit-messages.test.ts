import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { hasAICoauthor } from '#ci/commit-attribution'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const root = await resolveWorkspaceRoot(import.meta.dir)

async function lint(message: string, args: string[] = [], prTitle = false) {
  const child = Bun.spawn([process.execPath, 'run', 'check:commits', '--verbose', ...args], {
    cwd: root,
    env: { ...process.env, COMMITLINT_PR_TITLE: prTitle ? '1' : '0' },
    stdin: new Blob([message]),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  return { code, output: stdout + stderr }
}

test.each([
  'fix: preserve selection',
  'refactor(MCP): preserve DOM/CSS and Kiwi names',
  'feat!: change the tool contract',
  `fix: explain the change\n\n${'Detailed rationale. '.repeat(12)}`,
  'Release v0.14.0',
  'Merge pull request #697 from open-pencil/mcp-v2-webmcp'
])('accepts supported commit: %s', async (message) => {
  const result = await lint(message)
  expect(result.output).toContain('found 0 problems')
  expect(result.code).toBe(0)
})

test.each([
  'fix: document Claude Code and OpenAI integration',
  'fix: preserve credits\n\nCo-authored-by: Claude Martin <claude@example.org>',
  'fix: preserve credits\n\nCo-authored-by: person@example.org',
  'fix: preserve credits\n\nCo-authored-by: Claude <123+claude@users.noreply.github.com>',
  'fix: preserve credits\n\nCo-authored-by: Codex <456+codex@users.noreply.github.com>',
  'fix: preserve credits\n\nCo-authored-by: Human Contributor <person@anthropic.com>',
  'build: update packages\n\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>'
])('preserves ordinary mentions, human credits, and maintenance bots: %s', async (message) => {
  expect((await lint(message)).code).toBe(0)
})

test.each([
  'Claude Sonnet 5 <noreply@anthropic.com>',
  'noreply@anthropic.com',
  'NOREPLY@OPENAI.COM',
  'Codex <codex@openai.com>',
  'Cursor <noreply@cursor.com>',
  'Gemini CLI <gemini-cli@google.com>',
  'Copilot <175728472+Copilot@users.noreply.github.com>',
  'Claude <123+claude[bot]@users.noreply.github.com>'
])('recognizes known assistant identities: %s', (identity) => {
  expect(hasAICoauthor(`fix: update\n\nCo-authored-by: ${identity}`)).toBe(true)
})

test('parses real trailers without treating fenced examples as authorship', () => {
  expect(
    hasAICoauthor(
      'docs: explain policy\n\n```text\nCo-authored-by: Claude <noreply@anthropic.com>\n```'
    )
  ).toBe(false)
  expect(
    hasAICoauthor(
      'fix: update\n\nCo-authored-by: Human <person@example.org>\ncO-aUtHoReD-bY: Claude <NOREPLY@ANTHROPIC.COM>'
    )
  ).toBe(true)
})

test.each([
  'fix: update',
  'Merge pull request #1 from contributor/fix',
  'Revert "fix: update"',
  'Release v0.14.0'
])('attribution cannot bypass lint through an ignored subject: %s', async (subject) => {
  const result = await lint(`${subject}\n\nCo-authored-by: Claude <noreply@anthropic.com>`)
  expect(result.code).not.toBe(0)
  expect(result.output).toContain('no-ai-coauthors')
  expect(result.output).toContain('AI-assisted contributions are welcome')
  expect(result.output).toContain('Preserve human co-author credits')
})

test.each(['fix: update', 'Release v0.14.0'])(
  'rejects bare assistant email trailers: %s',
  async (subject) => {
    const result = await lint(`${subject}\n\nCo-authored-by: noreply@anthropic.com`)
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('no-ai-coauthors')
  }
)

test.each([
  ['Fixed stuff', 'type-empty'],
  ['feature: add tools', 'type-enum'],
  ['fix:', 'subject-empty'],
  ['fix: trailing period.', 'subject-full-stop'],
  ['Release whatever', 'type-empty'],
  ['Bad subject\n\nRelease v0.14.0', 'type-empty']
])('rejects invalid commit: %s', async (message, rule) => {
  const result = await lint(message)
  expect(result.code).not.toBe(0)
  expect(result.output).toContain(rule)
  expect(result.output).toContain('CONTRIBUTING.md#commit-messages')
})

test.each([
  'fix(MCP): preserve connection settings',
  'feat!: change the tool contract',
  'Release v0.14.0'
])('accepts supported PR title: %s', async (title) => {
  expect((await lint(title, [], true)).code).toBe(0)
})

test.each([
  'Merge pull request #700 from open-pencil/build/commitlint',
  "Merge remote-tracking branch 'origin/master' into build/commitlint",
  'Revert "fix: preserve selection"',
  'Fixed stuff'
])('rejects non-conventional PR title: %s', async (title) => {
  const result = await lint(title, [], true)
  expect(result.code).not.toBe(0)
  expect(result.output).toContain('type-empty')
})

test('checks the full PR range while excluding existing base history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-commitlint-'))
  async function git(...args: string[]) {
    const child = Bun.spawn(['git', ...args], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text()
    ])
    if (code !== 0) throw new Error(stderr)
    return stdout.trim()
  }
  try {
    await git('init', '--quiet')
    await git('config', 'user.name', 'Commitlint test')
    await git('config', 'user.email', 'commitlint@example.invalid')
    await git('config', 'commit.gpgsign', 'false')
    await git('config', 'core.hooksPath', join(directory, 'no-hooks'))
    await git(
      'commit',
      '--allow-empty',
      '-m',
      'Legacy base message\n\nCo-authored-by: Claude <noreply@anthropic.com>'
    )
    const base = await git('rev-parse', 'HEAD')
    await git('commit', '--allow-empty', '-m', 'docs: explain setup')
    const args = [
      '--cwd',
      directory,
      '--config',
      join(root, 'commitlint.config.ts'),
      '--from',
      base,
      '--to',
      'HEAD'
    ]
    expect((await lint('', args)).code).toBe(0)
    await git(
      'commit',
      '--allow-empty',
      '-m',
      'fix: update\n\nCo-authored-by: Claude <noreply@anthropic.com>'
    )
    await git('commit', '--allow-empty', '-m', 'Bad intermediate commit')
    await git('commit', '--allow-empty', '-m', 'fix: valid final commit')
    const result = await lint('', args)
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Bad intermediate commit')
    expect(result.output).toContain('no-ai-coauthors')
    expect(result.output).not.toContain('Legacy base message')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
