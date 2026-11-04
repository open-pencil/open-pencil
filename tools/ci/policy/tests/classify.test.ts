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
  // This repository has no manifests to read the Cloud inputs from, so every check runs.
  expect(await readFile(output, 'utf8')).toBe('scope=cloud\n')

  const failed = Bun.spawnSync([process.execPath, command], {
    cwd: root,
    env: { ...process.env, CI_BASE_SHA: 'invalid', GITHUB_OUTPUT: output }
  })
  expect(failed.exitCode).not.toBe(0)
  expect(await readFile(output, 'utf8')).toBe('scope=cloud\n')
})

test('a pull request is measured from the base its merge commit merges into', async () => {
  const root = await mkdtemp(join(tmpdir(), 'open-pencil-ci-'))
  roots.push(root)
  git(root, 'init', '-b', 'main')
  await writeFile(join(root, 'runtime.ts'), 'export const version = 1\n')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'base')
  const staleBase = git(root, 'rev-parse', 'HEAD')
  git(root, 'checkout', '-b', 'docs-change')
  await writeFile(join(root, 'README.md'), '# Docs\n')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'docs')
  // The base branch moves on with code after the event recorded its base.
  git(root, 'checkout', 'main')
  await writeFile(join(root, 'runtime.ts'), 'export const version = 2\n')
  git(root, 'commit', '-am', 'code on main')
  git(root, 'merge', '--no-ff', '-m', 'Merge docs-change into main', 'docs-change')
  const output = join(root, 'output')
  const command = fileURLToPath(import.meta.resolve('#ci/classify'))
  const classify = (event: string) =>
    Bun.spawnSync([process.execPath, command], {
      cwd: root,
      env: { ...process.env, CI_BASE_SHA: staleBase, CI_EVENT: event, GITHUB_OUTPUT: output }
    })

  expect(classify('pull_request').exitCode).toBe(0)
  expect(await readFile(output, 'utf8')).toBe('scope=docs\n')
  // The merge queue's base is exact, so it is used as given.
  expect(classify('merge_group').exitCode).toBe(0)
  expect(await readFile(output, 'utf8')).toBe('scope=docs\nscope=cloud\n')
})
