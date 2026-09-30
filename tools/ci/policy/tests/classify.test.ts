import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(
    ['git', '-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid', ...args],
    { cwd }
  )
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

test('classifier reads real Git deletions and renames without losing the original path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'open-pencil-ci-'))
  roots.push(root)
  git(root, 'init')
  await writeFile(join(root, 'runtime.ts'), 'export const version = 1\n')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'base')
  const base = git(root, 'rev-parse', 'HEAD')
  await rename(join(root, 'runtime.ts'), join(root, 'README.md'))
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'move')
  const output = join(root, 'output')
  const command = fileURLToPath(import.meta.resolve('#ci/classify'))
  const result = Bun.spawnSync([process.execPath, command], {
    cwd: root,
    env: { ...process.env, CI_BASE_SHA: base, GITHUB_OUTPUT: output }
  })
  expect(result.exitCode).toBe(0)
  expect(await readFile(output, 'utf8')).toBe('scope=code\n')

  const failed = Bun.spawnSync([process.execPath, command], {
    cwd: root,
    env: { ...process.env, CI_BASE_SHA: 'invalid', GITHUB_OUTPUT: output }
  })
  expect(failed.exitCode).not.toBe(0)
  expect(await readFile(output, 'utf8')).toBe('scope=code\n')
})
