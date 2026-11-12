import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { inlineImportSource, normalizedFilename } from '#lint/support/context.ts'
import { createImportSourceRule } from '#lint/support/factories.ts'
import type { RuleContext, RuleDefinition } from '#lint/support/types.ts'
import * as v from 'valibot'

function isPackageOrSubpath(source: string, packageName: string): boolean {
  return source === packageName || source.startsWith(`${packageName}/`)
}

const noVueSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/vue self-imports inside the Vue SDK — use #vue/* aliases',
  applies: (file) => file.includes('/packages/vue/src/'),
  check: (source) =>
    isPackageOrSubpath(source, '@open-pencil/vue') &&
    `Use #vue/* for internal Vue SDK imports instead of self-package import '${source}'.`
})

const manifestSchema = v.object({
  name: v.optional(v.string()),
  workspaces: v.optional(v.array(v.string())),
  exports: v.optional(v.unknown())
})

function readManifest(path: string) {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), manifestSchema),
    readFileSync(path, 'utf8')
  )
  return parsed.success ? parsed.output : null
}

/** The repository the rule runs in, found by its lockfile from this file. */
function repositoryRoot(): string | null {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) return null
  }
}

/** The subpaths an `exports` field declares: `.` for a bare target or conditions alone. */
function declaredSubpaths(exports: unknown): string[] {
  if (exports === undefined) return []
  if (typeof exports !== 'object' || exports === null) return ['.']
  const keys = Object.keys(exports)
  return keys.some((key) => key.startsWith('.')) ? keys : ['.']
}

let workspaceExports: ReadonlyMap<string, readonly string[]> | undefined

/** Each workspace package that declares `exports`, by name, with its subpaths; read once. */
function exportsByPackage(): ReadonlyMap<string, readonly string[]> {
  if (workspaceExports) return workspaceExports
  const packages = new Map<string, readonly string[]>()
  const root = repositoryRoot()
  for (const workspace of (root && readManifest(join(root, 'package.json'))?.workspaces) || []) {
    const manifest = root ? readManifest(join(root, workspace, 'package.json')) : null
    if (manifest?.name && manifest.exports !== undefined) {
      packages.set(manifest.name, declaredSubpaths(manifest.exports))
    }
  }
  workspaceExports = packages
  return packages
}

/** Whether `subpath` is one an `exports` key declares, `*` patterns included. */
function isDeclared(subpath: string, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const star = key.indexOf('*')
    if (star === -1) return key === subpath
    const [prefix, suffix] = [key.slice(0, star), key.slice(star + 1)]
    return (
      subpath.length > prefix.length + suffix.length &&
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix)
    )
  })
}

/**
 * The message for a workspace package specifier whose subpath its package does not export. The
 * repository's TypeScript paths map every subpath to source, so such an import type-checks and
 * runs here and fails only for a consumer that resolves through `exports`.
 */
function undeclaredSubpath(source: string): string | false {
  const match = /^(@[^/]+\/[^/]+|[^@/][^/]*)(\/.+)?$/.exec(source)
  if (!match) return false
  const [, name, rest] = match
  const keys = exportsByPackage().get(name)
  if (!keys) return false
  const subpath = rest ? `.${rest}` : '.'
  return (
    !isDeclared(subpath, keys) &&
    `'${source}' is not in ${name}'s package.json exports, so it resolves only inside this repository. Import a subpath the package exports, or add one.`
  )
}

const noCrossPackageSourceImports = createImportSourceRule({
  description:
    "Disallow imports that reach into another workspace package's source tree or a subpath its exports do not declare — use package exports or package-local aliases",
  includeExports: true,
  check: (source) =>
    ((source.includes('/packages/') ||
      /^(?:\.\.\/){2,}packages\//.test(source) ||
      /^(?:\.\.\/)+(?:core|vue|cli|mcp)\/src\//.test(source)) &&
      `Use workspace package exports or package-local aliases instead of cross-package source import '${source}'.`) ||
    undeclaredSubpath(source)
})

const noCoreSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/core self-imports inside packages/core/src',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    isPackageOrSubpath(source, '@open-pencil/core') &&
    'Core internals must import local modules directly instead of importing the @open-pencil/core public package entrypoints.'
})

const noAppImportsInPackages = createImportSourceRule({
  description: 'Disallow app-shell imports from workspace packages',
  applies: (file) => file.includes('/packages/'),
  check: (source) =>
    source.startsWith('@/') && `Workspace packages must not import app-shell alias '${source}'.`
})

const frameworkImportPrefixes = ['@vue/', '@tauri-apps/', '@/']

const noCoreFrameworkImports = createImportSourceRule({
  description: 'Keep @open-pencil/core framework-agnostic by disallowing Vue/Tauri/app imports',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    (source === 'vue' ||
      isPackageOrSubpath(source, '@open-pencil/vue') ||
      frameworkImportPrefixes.some((prefix) => source.startsWith(prefix))) &&
    `@open-pencil/core must stay framework-agnostic; do not import '${source}'.`
})

/**
 * Tauri's modules reach the native side only when one of their functions is called, so shipped
 * code imports them statically like any other module. Only the startup support gate loads them
 * inline: it must parse on engines that cannot run the app, which `src/main.ts` keeps free of the
 * app bundle. Tests and tooling, which load Tauri's mocks and CLI in a set order, are not shipped.
 */
const noInlineTauriImports: RuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Import Tauri modules statically, outside the startup support gate' },
    schema: []
  },
  create(context: RuleContext) {
    const file = normalizedFilename(context)
    if (!file.includes('/src/') || /\/(tools|tests)\//.test(file)) return {}
    if (/\/src\/app\/shell\/support\/(gate|render)\.ts$/.test(file)) return {}
    return {
      ImportExpression(node) {
        const source = inlineImportSource(node)
        if (!source?.startsWith('@tauri-apps/')) return
        context.report({
          node,
          message: `Import '${source}' statically; Tauri's modules reach the native side only when called.`
        })
      }
    }
  }
}

export {
  noVueSelfPackageImports,
  noCrossPackageSourceImports,
  noCoreSelfPackageImports,
  noAppImportsInPackages,
  noCoreFrameworkImports,
  noInlineTauriImports
}
