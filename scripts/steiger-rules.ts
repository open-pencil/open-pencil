import { readFileSync } from 'node:fs'
import path from 'node:path'

type TreeEntry = {
  type: 'file' | 'folder'
  path: string
  children?: TreeEntry[]
}

type Diagnostic = {
  message: string
  location: { path: string; line?: number; column?: number }
}

type RuleResult = { diagnostics: Diagnostic[] }
type Rule = { name: string; check: (root: TreeEntry) => RuleResult }

type ImportRef = {
  specifier: string
  line: number
  column: number
}

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs', '.mts'])
const PACKAGE_ALIASES: Record<string, string> = {
  '#core/': 'packages/core/src/',
  '#vue/': 'packages/vue/src/',
  '#cli/': 'packages/cli/src/',
  '#mcp/': 'packages/mcp/src/'
}

const PACKAGE_ALIAS_OWNERS: Record<string, string> = {
  '#core/': 'packages/core/src/',
  '#vue/': 'packages/vue/src/',
  '#cli/': 'packages/cli/src/',
  '#mcp/': 'packages/mcp/src/'
}

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join('/')
}

function relativePath(rootPath: string, filePath: string) {
  return normalizePath(path.relative(rootPath, filePath))
}

function collectFiles(entry: TreeEntry, files: string[] = []) {
  if (entry.type === 'file') {
    if (TEXT_EXTENSIONS.has(path.extname(entry.path))) files.push(entry.path)
    return files
  }
  for (const child of entry.children ?? []) collectFiles(child, files)
  return files
}

function importsIn(content: string): ImportRef[] {
  const imports: ImportRef[] = []
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const before = content.slice(0, match.index)
      const lines = before.split('\n')
      imports.push({
        specifier: match[1],
        line: lines.length,
        column: lines.at(-1)?.length ?? 0
      })
    }
  }
  return imports
}

function resolveImport(sourceRel: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`

  for (const [alias, target] of Object.entries(PACKAGE_ALIASES)) {
    if (specifier.startsWith(alias)) return `${target}${specifier.slice(alias.length)}`
  }

  if (specifier.startsWith('.')) {
    return normalizePath(path.join(path.dirname(sourceRel), specifier))
  }

  return null
}

function createImportRule(
  name: string,
  checkImport: (sourceRel: string, specifier: string, resolved: string | null) => string | null
): Rule {
  return {
    name,
    check(root) {
      const diagnostics: Diagnostic[] = []
      for (const file of collectFiles(root)) {
        const sourceRel = relativePath(root.path, file)
        const content = readFileSync(file, 'utf8')
        for (const imported of importsIn(content)) {
          const resolved = resolveImport(sourceRel, imported.specifier)
          const message = checkImport(sourceRel, imported.specifier, resolved)
          if (!message) continue
          diagnostics.push({
            message,
            location: { path: file, line: imported.line, column: imported.column }
          })
        }
      }
      return { diagnostics }
    }
  }
}

const noPropertyPanelImportsInCanvas = createImportRule(
  'open-pencil/no-property-panel-imports-in-canvas',
  (sourceRel, _specifier, resolved) => {
    const isCanvasSurface =
      sourceRel === 'src/components/EditorCanvas.vue' ||
      sourceRel.startsWith('src/app/editor/canvas/') ||
      sourceRel.startsWith('src/components/canvas/') ||
      sourceRel.startsWith('packages/vue/src/canvas/')

    if (isCanvasSurface && resolved?.startsWith('src/components/properties/')) {
      return 'Canvas/editor overlay code must not import property-panel internals. Extract app-neutral UI or keep concerns local.'
    }
    return null
  }
)

const noAppImportsInWorkspacePackages = createImportRule(
  'open-pencil/no-app-imports-in-workspace-packages',
  (sourceRel, specifier, resolved) => {
    const isWorkspacePackage = /^packages\/[^/]+\/src\//.test(sourceRel)
    if (isWorkspacePackage && (specifier.startsWith('@/') || resolved?.startsWith('src/'))) {
      return 'Workspace packages must not import app-layer src/ code.'
    }
    return null
  }
)

const noPackageInternalsInApp = createImportRule(
  'open-pencil/no-package-internals-in-app',
  (sourceRel, specifier, resolved) => {
    if (!sourceRel.startsWith('src/')) return null
    if (specifier in PACKAGE_ALIASES || Object.keys(PACKAGE_ALIASES).some((alias) => specifier.startsWith(alias))) {
      return 'App code must use package public exports such as @open-pencil/core or @open-pencil/vue, not package-local aliases.'
    }
    if (resolved?.startsWith('packages/')) {
      return 'App code must not import workspace package internals. Use package public exports instead.'
    }
    return null
  }
)

const noForeignPackageLocalAliases = createImportRule(
  'open-pencil/no-foreign-package-local-aliases',
  (sourceRel, specifier) => {
    if (sourceRel.startsWith('scripts/')) return null
    for (const [alias, owner] of Object.entries(PACKAGE_ALIAS_OWNERS)) {
      if (specifier.startsWith(alias) && !sourceRel.startsWith(owner)) {
        return `Package-local alias ${alias} can only be used inside ${owner}. Use a public package export across package boundaries.`
      }
    }
    return null
  }
)

const noAppImportsComponentsOrViews = createImportRule(
  'open-pencil/no-app-imports-components-or-views',
  (sourceRel, _specifier, resolved) => {
    if (!sourceRel.startsWith('src/app/')) return null
    const importsAppComponent =
      resolved?.startsWith('src/components/') && !resolved.startsWith('src/components/ui/')
    if (importsAppComponent || resolved?.startsWith('src/views/')) {
      return 'App service/domain code must not import app component or view layers. Pass data/actions through app-owned entrypoints instead.'
    }
    return null
  }
)

const noComponentsImportViews = createImportRule(
  'open-pencil/no-components-import-views',
  (sourceRel, _specifier, resolved) => {
    if (!sourceRel.startsWith('src/components/')) return null
    if (resolved?.startsWith('src/views/')) {
      return 'Components must not import views. Views assemble components, not the other way around.'
    }
    return null
  }
)

const noAppImportsInSharedUi = createImportRule(
  'open-pencil/no-app-imports-in-shared-ui',
  (sourceRel, _specifier, resolved) => {
    if (!sourceRel.startsWith('src/components/ui/')) return null
    if (resolved?.startsWith('src/app/')) {
      return 'Shared UI components must not import app services or stores. Pass data/actions in or move app-specific wrappers outside src/components/ui.'
    }
    return null
  }
)

const noPropertyPanelInternalsOutsidePanel = createImportRule(
  'open-pencil/no-property-panel-internals-outside-panel',
  (sourceRel, _specifier, resolved) => {
    if (!resolved?.startsWith('src/components/properties/')) return null
    if (sourceRel.startsWith('src/components/properties/')) return null
    if (sourceRel === 'src/components/DesignPanel.vue') return null
    return 'Property-panel internals must stay inside the property panel. Extract app-neutral UI before reusing elsewhere.'
  }
)

const noUiImportsInCore = createImportRule(
  'open-pencil/no-ui-imports-in-core',
  (sourceRel, specifier) => {
    if (!sourceRel.startsWith('packages/core/src/')) return null
    if (
      specifier === 'vue' ||
      specifier.startsWith('@vueuse/') ||
      specifier === 'reka-ui' ||
      specifier.startsWith('#vue/') ||
      specifier.startsWith('@open-pencil/vue')
    ) {
      return 'Core must stay framework-agnostic and cannot import Vue/UI modules.'
    }
    return null
  }
)

export const openPencilArchitecturePlugin = {
  meta: { name: 'open-pencil-architecture', version: '0.0.0' },
  ruleDefinitions: [
    noPropertyPanelImportsInCanvas,
    noAppImportsInWorkspacePackages,
    noPackageInternalsInApp,
    noForeignPackageLocalAliases,
    noAppImportsComponentsOrViews,
    noComponentsImportViews,
    noAppImportsInSharedUi,
    noPropertyPanelInternalsOutsidePanel,
    noUiImportsInCore
  ]
}
