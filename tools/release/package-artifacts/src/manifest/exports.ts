import type { PackageTarget } from './schema'
import type { PackageDiagnostic, PackageManifest } from './types'

export interface ExportTarget {
  condition: string | null
  field: string
  target: string
}

function exportField(path: string[]): string {
  return path.reduce((field, segment, index) => {
    if (index === 0) return segment
    if (/^[A-Za-z_$][\w$]*$/.test(segment)) return `${field}.${segment}`
    if (/^\d+$/.test(segment)) return `${field}[${segment}]`
    return `${field}[${JSON.stringify(segment)}]`
  }, '')
}

function exportCondition(path: string[]): string | null {
  return (
    [...path]
      .reverse()
      .find(
        (segment) =>
          segment !== 'exports' &&
          segment !== 'imports' &&
          !segment.startsWith('.') &&
          !/^\d+$/.test(segment)
      ) ?? null
  )
}

export function collectExportTargets(
  value: PackageTarget | undefined,
  path: string[] = []
): ExportTarget[] {
  if (typeof value === 'string') {
    return [{ condition: exportCondition(path), field: exportField(path), target: value }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => collectExportTargets(child, [...path, String(index)]))
  }
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) =>
    collectExportTargets(child, [...path, key])
  )
}

export function concreteImportSpecifiers(manifest: PackageManifest): string[] {
  if (typeof manifest.exports === 'string') return [manifest.name]
  if (
    !manifest.exports ||
    typeof manifest.exports !== 'object' ||
    Array.isArray(manifest.exports)
  ) {
    return []
  }
  const keys = Object.keys(manifest.exports)
  if (!keys.some((key) => key.startsWith('.'))) return [manifest.name]
  return keys.flatMap((key) => {
    if (key === './package.json' || key.includes('*')) return []
    if (key === '.') return [manifest.name]
    return key.startsWith('./') ? [`${manifest.name}/${key.slice(2)}`] : []
  })
}

function isDeclarationPath(value: string): boolean {
  return /\.d\.[cm]?ts$/.test(value)
}

function includedByFiles(target: string, files: string[]): boolean {
  const normalized = target.replace(/^\.\//, '')
  if (normalized === 'package.json') return true
  const topLevel = normalized.split('/')[0]
  return Boolean(topLevel && files.includes(topLevel))
}

export function validateManifest(manifest: PackageManifest): PackageDiagnostic[] {
  const diagnostics: PackageDiagnostic[] = []
  const files = manifest.files ?? []
  const report = (field: string, message: string) =>
    diagnostics.push({ field, message, packageName: manifest.name })

  function validateRuntime(field: string, target: string, condition: string | null = null): void {
    if (isDeclarationPath(target)) report(field, `runtime target is a declaration file (${target})`)
    else if (/\.[cm]?tsx?$/.test(target) && condition !== 'bun') {
      report(field, `runtime target is TypeScript (${target})`)
    }
    if (target.startsWith('./src/') && condition !== 'bun') {
      report(field, `runtime target points to source (${target})`)
    }
    if (!includedByFiles(target, files)) report(field, `target is excluded by files (${target})`)
  }

  function validateTypes(field: string, target: string): void {
    if (!isDeclarationPath(target))
      report(field, `type target is not a declaration file (${target})`)
    if (target.startsWith('./src/')) report(field, `type target points to source (${target})`)
    if (!includedByFiles(target, files)) report(field, `target is excluded by files (${target})`)
  }

  if (!files.includes('dist')) report('files', 'must include dist')
  if (manifest.main) validateRuntime('main', manifest.main)
  if (manifest.types) validateTypes('types', manifest.types)
  if (typeof manifest.bin === 'string') validateRuntime('bin', manifest.bin)
  else {
    for (const [name, target] of Object.entries(manifest.bin ?? {})) {
      validateRuntime(`bin.${name}`, target)
    }
  }
  for (const entry of collectExportTargets(manifest.exports, ['exports'])) {
    if (entry.condition === 'types') validateTypes(entry.field, entry.target)
    else validateRuntime(entry.field, entry.target, entry.condition)
  }
  if (
    manifest.publishConfig &&
    ('exports' in manifest.publishConfig ||
      'main' in manifest.publishConfig ||
      'types' in manifest.publishConfig)
  ) {
    report('publishConfig', 'must not rewrite runtime entrypoints')
  }

  return diagnostics
}
