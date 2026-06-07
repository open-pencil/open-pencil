import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type PackageJSON = {
  bin?: Record<string, string> | string
  name: string
}

export function packageBinTargets(packageJSON: PackageJSON): Record<string, string> {
  if (typeof packageJSON.bin === 'string') return { [packageJSON.name]: packageJSON.bin }
  return packageJSON.bin ?? {}
}

export async function tarballEntries(tarballPath: string): Promise<Set<string>> {
  const { stdout } = await execFileAsync('tar', ['-tf', tarballPath], { encoding: 'utf8' })
  return new Set(stdout.trim().split('\n').filter(Boolean))
}

export async function tarballPackageJSON(tarballPath: string): Promise<PackageJSON> {
  const { stdout } = await execFileAsync('tar', ['-xOf', tarballPath, 'package/package.json'], {
    encoding: 'utf8'
  })
  return JSON.parse(stdout) as PackageJSON
}

export async function validateTarballBinTargets(tarballPath: string): Promise<void> {
  const entries = await tarballEntries(tarballPath)
  const packageJSON = await tarballPackageJSON(tarballPath)

  for (const [name, target] of Object.entries(packageBinTargets(packageJSON))) {
    const entry = `package/${target.replace(/^\.\//, '')}`
    if (!entries.has(entry)) {
      throw new Error(`${tarballPath}: bin ${name} target missing from tarball: ${entry}`)
    }
  }
}

export async function validatePackedTarballs(directory: string): Promise<void> {
  const tarballs = (await readdir(directory)).filter((name) => name.endsWith('.tgz'))
  for (const tarball of tarballs) {
    await validateTarballBinTargets(join(directory, tarball))
  }
}
