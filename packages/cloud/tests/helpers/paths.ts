import { repoPath } from '@open-pencil/test-support/paths'

export function cloudPackagePath(...segments: string[]): string {
  return repoPath('packages/cloud', ...segments)
}

export function cloudDeployPath(...segments: string[]): string {
  return cloudPackagePath('deploy', ...segments)
}
