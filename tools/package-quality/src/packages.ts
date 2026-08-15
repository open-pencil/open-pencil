import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

const workspaceDirs = (rootPackage.workspaces ?? []).flatMap((workspacePattern) => {
  if (!workspacePattern.includes('*')) return [workspacePattern]
  const packagePattern = `${workspacePattern}/package.json`
  return [...new Bun.Glob(packagePattern).scanSync({ cwd: rootDir, onlyFiles: true })].map(dirname)
})

export const publicPackageDirs = workspaceDirs.filter((workspaceDir) => {
  const workspacePackage = readJSON<WorkspacePackageJSON>(
    join(rootDir, workspaceDir, 'package.json')
  )
  return workspacePackage.private !== true
})
