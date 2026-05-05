import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..', '..')

export function repoPath(...segments: string[]): string {
  return join(repoRoot, ...segments)
}

export function coreSourcePath(...segments: string[]): string {
  return repoPath('packages/core/src', ...segments)
}

export function cliSourcePath(...segments: string[]): string {
  return repoPath('packages/cli/src', ...segments)
}

export function testPath(...segments: string[]): string {
  return repoPath('tests', ...segments)
}

export function publicPath(...segments: string[]): string {
  return repoPath('public', ...segments)
}
