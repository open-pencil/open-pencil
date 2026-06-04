import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const publicPackages = [
  'packages/core',
  'packages/cli',
  'packages/mcp',
  'packages/vue',
  'packages/api'
]

interface PackageJson {
  name: string
  main?: string
  types?: string
  files?: string[]
  bin?: Record<string, string> | string
  exports?: unknown
  publishConfig?: Record<string, unknown>
}

const errors: string[] = []

function readPackageJson(packageDir: string): PackageJson {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
}

function checkRuntimePath(packageName: string, field: string, value: string): void {
  if (value.endsWith('.ts') && !value.endsWith('.d.ts')) {
    errors.push(`${packageName}: ${field} must not point to runtime TypeScript (${value})`)
  }
  if (value.startsWith('./src/')) {
    errors.push(`${packageName}: ${field} must not point to source files (${value})`)
  }
}

function checkIncludedRuntimePath(
  packageName: string,
  field: string,
  value: string,
  files: string[]
): void {
  checkRuntimePath(packageName, field, value)
  const normalized = value.replace(/^\.\//, '')
  const topLevelDir = normalized.split('/')[0]
  if (topLevelDir && !files.includes(topLevelDir)) {
    errors.push(
      `${packageName}: ${field} points to ${value}, but files does not include ${topLevelDir}`
    )
  }
}

function walkExports(packageName: string, value: unknown, path: string[] = []): void {
  if (typeof value === 'string') {
    const key = path.at(-1)
    if (key !== 'types' && key !== 'bun')
      checkRuntimePath(packageName, `exports.${path.join('.')}`, value)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    walkExports(packageName, child, [...path, key])
  }
}

for (const packageDir of publicPackages) {
  const pkg = readPackageJson(packageDir)

  if (!pkg.files?.includes('dist')) {
    errors.push(`${pkg.name}: files must include dist`)
  }

  if (pkg.main) checkRuntimePath(pkg.name, 'main', pkg.main)

  if (typeof pkg.bin === 'string') {
    checkIncludedRuntimePath(pkg.name, 'bin', pkg.bin, pkg.files ?? [])
  } else if (pkg.bin) {
    for (const [name, target] of Object.entries(pkg.bin)) {
      checkIncludedRuntimePath(pkg.name, `bin.${name}`, target, pkg.files ?? [])
    }
  }

  walkExports(pkg.name, pkg.exports)

  if (
    pkg.publishConfig &&
    ('exports' in pkg.publishConfig || 'main' in pkg.publishConfig || 'types' in pkg.publishConfig)
  ) {
    errors.push(`${pkg.name}: publishConfig must not rewrite runtime entrypoints`)
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Package metadata is publish-safe.')
