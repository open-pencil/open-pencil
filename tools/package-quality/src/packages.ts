import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RootPackageJson {
  workspaces?: string[]
}

interface WorkspacePackageJson {
  private?: boolean
}

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

const rootPackage = readJson<RootPackageJson>(join(rootDir, 'package.json'))

export const publicPackageDirs = (rootPackage.workspaces ?? []).filter((workspaceDir) => {
  const workspacePackage = readJson<WorkspacePackageJson>(
    join(rootDir, workspaceDir, 'package.json')
  )
  return workspacePackage.private !== true
})
