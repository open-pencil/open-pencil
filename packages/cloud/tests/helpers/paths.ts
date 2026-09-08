import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cloudPackageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const repositoryRoot = dirname(dirname(cloudPackageRoot))

export function cloudPackagePath(...segments: string[]): string {
  return join(cloudPackageRoot, ...segments)
}

export function repositoryPath(...segments: string[]): string {
  return join(repositoryRoot, ...segments)
}

export function cloudDeployPath(...segments: string[]): string {
  return cloudPackagePath('deploy', ...segments)
}
