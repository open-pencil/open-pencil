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

type FileRuleCheck = (sourceRel: string) => string | null

const FILE_PREFIX_GROUP_ALLOWLIST = new Set([
  'packages/core/src/lint/rules::no',
  'tests/engine::visual'
])

type ImportRef = {
  specifier: string
  line: number
  column: number
}

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs', '.mts'])
const ROOT_MARKDOWN_ALLOWLIST = new Set([
  'AGENTS.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'README.md',
  'SECURITY.md'
])
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

function collectFolders(entry: TreeEntry, folders: TreeEntry[] = []) {
  if (entry.type !== 'folder') return folders
  folders.push(entry)
  for (const child of entry.children ?? []) collectFolders(child, folders)
  return folders
}

function importsIn(content: string): ImportRef[] {
  const imports: ImportRef[] = []
  const patterns = [
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/gm,
    /^\s*import\(\s*['"]([^'"]+)['"]\s*\)/gm
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

function createFileRule(name: string, checkFile: FileRuleCheck): Rule {
  return {
    name,
    check(root) {
      const diagnostics: Diagnostic[] = []
      for (const file of collectFiles(root)) {
        const sourceRel = relativePath(root.path, file)
        const message = checkFile(sourceRel)
        if (!message) continue
        diagnostics.push({ message, location: { path: file } })
      }
      return { diagnostics }
    }
  }
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

function filePrefix(filePath: string): string | null {
  const name = path.basename(filePath).replace(/\.(test|spec|bench)?\.?[cm]?[tj]sx?$|\.vue$/, '')
  const match = /^([a-z][a-z0-9]+)-[a-z0-9-]+$/.exec(name)
  return match?.[1] ?? null
}

const preferDomainFoldersOverFilenamePrefixes: Rule = {
  name: 'open-pencil/prefer-domain-folders-over-filename-prefixes',
  check(root) {
    const diagnostics: Diagnostic[] = []
    for (const folder of collectFolders(root)) {
      const folderRel = relativePath(root.path, folder.path)
      const groups = new Map<string, string[]>()
      for (const child of folder.children ?? []) {
        if (child.type !== 'file' || !TEXT_EXTENSIONS.has(path.extname(child.path))) continue
        const prefix = filePrefix(child.path)
        if (!prefix) continue
        const files = groups.get(prefix) ?? []
        files.push(child.path)
        groups.set(prefix, files)
      }
      for (const [prefix, files] of groups) {
        if (files.length < 3) continue
        if (FILE_PREFIX_GROUP_ALLOWLIST.has(`${folderRel}::${prefix}`)) continue
        diagnostics.push({
          message: `Use a ${prefix}/ domain folder instead of ${files.length} sibling files with the ${prefix}- filename prefix.`,
          location: { path: folder.path }
        })
      }
    }
    return { diagnostics }
  }
}

const strictTestFilePlacement = createFileRule('open-pencil/strict-test-file-placement', (sourceRel) => {
  if (!sourceRel.startsWith('tests/')) return null
  if (!TEXT_EXTENSIONS.has(path.extname(sourceRel))) return null
  const name = path.basename(sourceRel)
  if (name.includes('.tmp.') || name.includes('.profile.')) {
    return 'Temporary/profile test files must not be committed. Move exploratory specs to scratch/ or delete them.'
  }
  if (sourceRel.startsWith('tests/e2e/')) {
    if (sourceRel.endsWith('.spec.ts') || sourceRel.endsWith('/fixtures.ts')) return null
    return 'E2E tests must live under tests/e2e/** and use *.spec.ts.'
  }
  if (sourceRel.startsWith('tests/figma/')) {
    return sourceRel.endsWith('.spec.ts') ? null : 'Figma Playwright tests must live under tests/figma/** and use *.spec.ts.'
  }
  if (sourceRel.startsWith('tests/engine/')) {
    if (sourceRel.endsWith('.test.ts')) return null
    if (sourceRel.endsWith('/helpers.ts') || sourceRel.endsWith('.bench.ts')) return null
    if (/\/visual\/[^/]+\.ts$/.test(sourceRel)) return null
    return 'Engine/unit tests must live under tests/engine/** and use *.test.ts; helpers.ts, *.bench.ts, and domain visual support scripts are allowed.'
  }
  if (sourceRel.startsWith('tests/helpers/')) return null
  return 'Tests must live under tests/e2e/** (*.spec.ts), tests/engine/** (*.test.ts), or tests/helpers/**.'
})

const ENGINE_TEST_DOMAIN_REDIRECTS: Array<{
  from: string
  to: string
  source: string
}> = [
  {
    from: 'tests/engine/fig/',
    to: 'tests/engine/io/fig/',
    source: 'packages/core/src/io/formats/fig/'
  },
  {
    from: 'tests/engine/svg/',
    to: 'tests/engine/io/svg/',
    source: 'packages/core/src/io/formats/svg/'
  },
  {
    from: 'tests/engine/fonts/',
    to: 'tests/engine/text/fonts/',
    source: 'packages/core/src/text/fonts.ts'
  },
  {
    from: 'tests/engine/figma-api/',
    to: 'tests/engine/figma/api/',
    source: 'packages/core/src/figma-api/'
  }
]

const noMisplacedEngineTestDomainPaths = createFileRule(
  'open-pencil/no-misplaced-engine-test-domain-paths',
  (sourceRel) => {
    const redirect = ENGINE_TEST_DOMAIN_REDIRECTS.find(({ from }) => sourceRel.startsWith(from))
    if (redirect) {
      return `Move tests from ${redirect.from} under ${redirect.to} to mirror ${redirect.source}.`
    }
    if (/^tests\/engine\/[^/]+\.test\.ts$/.test(sourceRel)) {
      return 'Move root-level engine tests under a domain folder that mirrors the source module under test.'
    }
    return null
  }
)

const noKitchenSinkEngineBasicTests: Rule = {
  name: 'open-pencil/no-kitchen-sink-engine-basic-tests',
  check(root) {
    const diagnostics: Diagnostic[] = []
    for (const file of collectFiles(root)) {
      const sourceRel = relativePath(root.path, file)
      if (!sourceRel.startsWith('tests/engine/') || !sourceRel.endsWith('/basic.test.ts')) continue

      const content = readFileSync(file, 'utf8')
      const lineCount = content.split('\n').length
      const describeCount = content.match(/\bdescribe\s*\(/g)?.length ?? 0
      if (lineCount <= 250 || describeCount < 4) continue

      diagnostics.push({
        message:
          'Split broad engine basic.test.ts files into focused domain/module tests, or add a deliberate narrow redirect/allowlist.',
        location: { path: file }
      })
    }
    return { diagnostics }
  }
}

const noEngineOnlyAssertionsInE2E = createImportRule(
  'open-pencil/no-engine-only-assertions-in-e2e',
  (sourceRel, specifier, resolved) => {
    if (!sourceRel.startsWith('tests/e2e/')) return null
    if (specifier === 'bun:test' || resolved?.startsWith('tests/engine/')) {
      return 'E2E tests must drive the UI and visible behavior. Put engine/internal-state assertions in tests/engine/**.'
    }
    return null
  }
)

const noE2EImportsInEngineTests = createImportRule(
  'open-pencil/no-e2e-imports-in-engine-tests',
  (sourceRel, _specifier, resolved) => {
    if (!sourceRel.startsWith('tests/engine/')) return null
    if (resolved?.startsWith('tests/e2e/')) {
      return 'Engine/unit tests must not import E2E tests or fixtures.'
    }
    return null
  }
)

const noRootMarkdownClutter = createFileRule('open-pencil/no-root-markdown-clutter', (sourceRel) => {
  if (sourceRel.includes('/')) return null
  if (!sourceRel.endsWith('.md')) return null
  if (ROOT_MARKDOWN_ALLOWLIST.has(sourceRel)) return null
  return 'Do not add ad hoc root Markdown files. Put durable docs under packages/docs/** or update the root allowlist deliberately.'
})

const noPrototypeOrGeneratedImports = createImportRule(
  'open-pencil/no-prototype-or-generated-imports',
  (sourceRel, _specifier, resolved) => {
    if (!resolved) return null
    if (resolved.startsWith('scratch/')) {
      return 'Committed code must not import scratch prototypes.'
    }
    if (resolved.startsWith('desktop/generated/')) {
      return 'Do not import generated desktop artifacts from TypeScript/app code.'
    }
    if (
      resolved.startsWith('packages/core/src/kiwi/kiwi-schema/') &&
      !sourceRel.startsWith('packages/core/src/kiwi/kiwi-schema/')
    ) {
      return 'Do not import vendored Kiwi schema internals directly; use the supported Kiwi APIs.'
    }
    return null
  }
)

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
    if (sourceRel.startsWith('scripts/') || sourceRel.startsWith('tests/')) return null
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

const noNonUiImportsInSharedUi = createImportRule(
  'open-pencil/no-non-ui-imports-in-shared-ui',
  (sourceRel, _specifier, resolved) => {
    if (!sourceRel.startsWith('src/components/ui/')) return null
    if (resolved?.startsWith('src/components/') && !resolved.startsWith('src/components/ui/')) {
      return 'Shared UI components must only import other shared UI modules from src/components/ui/**.'
    }
    return null
  }
)

const noViewsImportedOutsideEntry = createImportRule(
  'open-pencil/no-views-imported-outside-entry',
  (sourceRel, _specifier, resolved) => {
    if (!resolved?.startsWith('src/views/')) return null
    if (sourceRel === 'src/App.vue' || sourceRel === 'src/main.ts' || sourceRel === 'src/router.ts') return null
    return 'Views are top-level composition entrypoints and must not be imported by app services or reusable components.'
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
    preferDomainFoldersOverFilenamePrefixes,
    strictTestFilePlacement,
    noMisplacedEngineTestDomainPaths,
    noKitchenSinkEngineBasicTests,
    noEngineOnlyAssertionsInE2E,
    noE2EImportsInEngineTests,
    noRootMarkdownClutter,
    noPrototypeOrGeneratedImports,
    noPropertyPanelImportsInCanvas,
    noAppImportsInWorkspacePackages,
    noPackageInternalsInApp,
    noForeignPackageLocalAliases,
    noAppImportsComponentsOrViews,
    noComponentsImportViews,
    noViewsImportedOutsideEntry,
    noNonUiImportsInSharedUi,
    noAppImportsInSharedUi,
    noPropertyPanelInternalsOutsidePanel,
    noUiImportsInCore
  ]
}
