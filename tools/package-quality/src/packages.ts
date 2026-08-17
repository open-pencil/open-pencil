import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RootPackageJSON {
  workspaces?: string[]
}

interface WorkspacePackageJSON {
  private?: boolean
}

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

const rootPackage = readJSON<RootPackageJSON>(join(rootDir, 'package.json'))

export const publicPackageDirs = (rootPackage.workspaces ?? []).filter((workspaceDir) => {
  const workspacePackage = readJSON<WorkspacePackageJSON>(
    join(rootDir, workspaceDir, 'package.json')
  )
  return workspacePackage.private !== true
})
