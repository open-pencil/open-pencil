import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { collectExportTargets } from './manifest/exports'
import { parsePackageManifest } from './manifest/read'
import type { PackageManifest } from './manifest/types'

const execFileAsync = promisify(execFile)

export interface TarballDiagnostic {
  field: string
  message: string
  packageName: string
  tarballPath: string
}

export interface TarballInspection {
  diagnostics: TarballDiagnostic[]
  entries: Set<string>
  manifest: PackageManifest
  tarballPath: string
}

export function packageBinTargets(manifest: PackageManifest): Record<string, string> {
  if (typeof manifest.bin === 'string') return { [manifest.name]: manifest.bin }
  return manifest.bin ?? {}
}

export function packageExportTargetPaths(manifest: Pick<PackageManifest, 'exports'>): string[] {
  return collectExportTargets(manifest.exports).map(({ target }) => target)
}

export async function tarballEntries(tarballPath: string): Promise<Set<string>> {
  const { stdout } = await execFileAsync('tar', ['-tf', tarballPath], { encoding: 'utf8' })
  return new Set(stdout.trim().split('\n').filter(Boolean))
}

export async function tarballPackageJSON(tarballPath: string): Promise<PackageManifest> {
  const { stdout } = await execFileAsync('tar', ['-xOf', tarballPath, 'package/package.json'], {
    encoding: 'utf8'
  })
  return parsePackageManifest(stdout, `${tarballPath}: package/package.json`)
}

function exportTargetPattern(target: string): RegExp {
  const escaped = target.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
}

function targetExists(entries: Set<string>, target: string): boolean {
  const relativeTarget = target.replace(/^\.\//, '')
  if (relativeTarget.startsWith('/') || relativeTarget.split('/').includes('..')) return false
  if (!relativeTarget.includes('*')) return entries.has(`package/${relativeTarget}`)
  const pattern = exportTargetPattern(relativeTarget)
  return [...entries].some((entry) =>
    entry.startsWith('package/') ? pattern.test(entry.slice('package/'.length)) : false
  )
}

export async function inspectTarball(tarballPath: string): Promise<TarballInspection> {
  const [entries, manifest] = await Promise.all([
    tarballEntries(tarballPath),
    tarballPackageJSON(tarballPath)
  ])
  const diagnostics: TarballDiagnostic[] = []
  const report = (field: string, message: string) =>
    diagnostics.push({ field, message, packageName: manifest.name, tarballPath })

  for (const field of ['main', 'types'] as const) {
    const target = manifest[field]
    if (target && !targetExists(entries, target)) report(field, `target is missing (${target})`)
  }
  for (const [name, target] of Object.entries(packageBinTargets(manifest))) {
    if (!targetExists(entries, target)) report(`bin.${name}`, `target is missing (${target})`)
  }
  for (const { field, target } of collectExportTargets(manifest.exports, ['exports'])) {
    if (!targetExists(entries, target)) report(field, `target is missing (${target})`)
  }
  return { diagnostics, entries, manifest, tarballPath }
}

export async function inspectTarballDirectory(directory: string): Promise<TarballInspection[]> {
  const tarballs = (await readdir(directory))
    .filter((name) => name.endsWith('.tgz'))
    .sort()
    .map((name) => join(directory, name))
  return await Promise.all(tarballs.map(inspectTarball))
}

function formatDiagnostic(diagnostic: TarballDiagnostic): string {
  return `${diagnostic.packageName}: ${diagnostic.field} ${diagnostic.message}`
}

export async function validateTarballBinTargets(tarballPath: string): Promise<void> {
  const inspection = await inspectTarball(tarballPath)
  const diagnostics = inspection.diagnostics.filter(({ field }) => field.startsWith('bin'))
  if (diagnostics.length > 0) throw new Error(diagnostics.map(formatDiagnostic).join('\n'))
}

export async function validateTarballExportTargets(tarballPath: string): Promise<void> {
  const inspection = await inspectTarball(tarballPath)
  const diagnostics = inspection.diagnostics.filter(({ field }) => field.startsWith('exports'))
  if (diagnostics.length > 0) throw new Error(diagnostics.map(formatDiagnostic).join('\n'))
}

export async function validatePackedTarballs(directory: string): Promise<void> {
  const inspections = await inspectTarballDirectory(directory)
  if (inspections.length === 0) throw new Error(`No package tarballs found in ${directory}`)
  const diagnostics = inspections.flatMap(({ diagnostics }) => diagnostics)
  if (diagnostics.length > 0) throw new Error(diagnostics.map(formatDiagnostic).join('\n'))
}
