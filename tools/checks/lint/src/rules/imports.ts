import { importSource, normalizedFilename } from '#lint/support/context.ts'
import { createImportSourceRule } from '#lint/support/factories.ts'
import type { RuleContext, RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

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

const noCrossPackageSourceImports = createImportSourceRule({
  description:
    'Disallow imports that reach into another workspace package source tree — use package exports or package-local aliases',
  check: (source) =>
    (source.includes('/packages/') ||
      /^(?:\.\.\/){2,}packages\//.test(source) ||
      /^(?:\.\.\/)+(?:core|vue|cli|mcp)\/src\//.test(source)) &&
    `Use workspace package exports or package-local aliases instead of cross-package source import '${source}'.`
})

interface ImportBoundaryRuleOptions {
  description: string
  applies(file: string): boolean
  message: string
  minDepth?: number
}

function createParentRelativeImportRule({
  description,
  applies,
  message,
  minDepth = 1
}: ImportBoundaryRuleOptions): RuleDefinition {
  return {
    meta: {
      docs: { description }
    },
    create(context: RuleContext) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}

      function reportSource(node: TSESTree.Node, source: string | null) {
        if (!source?.startsWith('../')) return
        const parentPrefix = source.match(/^(?:\.\.\/)+/)?.[0]
        const depth = parentPrefix ? parentPrefix.split('../').length - 1 : 0
        if ((depth ?? 0) < minDepth) return
        if (/^(?:\.\.\/)+package\.json$/.test(source)) return
        context.report({ node, message })
      }

      function reportParentRelative(
        node:
          | TSESTree.ImportDeclaration
          | TSESTree.ExportAllDeclaration
          | TSESTree.ExportNamedDeclaration
      ) {
        reportSource(node, importSource(node))
      }

      return {
        ExportAllDeclaration: reportParentRelative,
        ExportNamedDeclaration: reportParentRelative,
        ImportDeclaration: reportParentRelative,
        ImportExpression(node) {
          reportSource(
            node,
            node.source?.type === 'Literal' && typeof node.source.value === 'string'
              ? node.source.value
              : null
          )
        }
      }
    }
  }
}

const noDeepParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow deep parent-relative imports — use package/test aliases instead',
  applies: () => true,
  message: 'Use an import alias instead of path drilling with ../.. imports.',
  minDepth: 2
})

const noCoreParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in core internals — use #core/* aliases',
  applies: (file) =>
    file.includes('/packages/core/src/') && !file.includes('/packages/core/src/kiwi/kiwi-schema/'),
  message: 'Use the #core/* package-local alias instead of parent-relative core imports.'
})

const noMcpParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in MCP internals — use #mcp/* aliases',
  applies: (file) => file.includes('/packages/mcp/src/'),
  message: 'Use the #mcp/* package-local alias instead of parent-relative MCP imports.'
})

const noVueParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in Vue SDK internals — use #vue/* aliases',
  applies: (file) => file.includes('/packages/vue/src/'),
  message: 'Use the #vue/* package-local alias instead of parent-relative Vue SDK imports.'
})

const noCliParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in CLI internals — use #cli/* aliases',
  applies: (file) => file.includes('/packages/cli/src/'),
  message: 'Use the #cli/* package-local alias instead of parent-relative CLI imports.'
})

interface ExactCoreBarrelRuleOptions {
  description: string
  applies(file: string): boolean
  message: string
}

function createExactCoreBarrelImportRule({
  description,
  applies,
  message
}: ExactCoreBarrelRuleOptions): RuleDefinition {
  return createImportSourceRule({
    description,
    applies,
    check: (source) => source === '@open-pencil/core' && message
  })
}

const noMcpCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow MCP imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/packages/mcp/src/'),
  message:
    'Use a targeted @open-pencil/core subpath in MCP code instead of the compatibility barrel.'
})

const noCliCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow CLI imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/packages/cli/src/'),
  message:
    'Use a targeted @open-pencil/core subpath in CLI code instead of the compatibility barrel.'
})

const noScriptCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow script imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/scripts/'),
  message:
    'Use a targeted @open-pencil/core subpath or #core/* alias in scripts instead of the compatibility barrel.'
})

const noCoreSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/core self-imports inside packages/core/src',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    isPackageOrSubpath(source, '@open-pencil/core') &&
    'Core internals must import local modules directly instead of importing the @open-pencil/core public package entrypoints.'
})

const noInlinePromptConstants = {
  meta: {
    docs: {
      description: 'Disallow inline prompt/context template literals — use markdown prompt files'
    }
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return
        if (!/(?:PROMPT|CONTEXT)/.test(node.id.name)) return
        if (node.init?.type !== 'TemplateLiteral') return
        context.report({
          node,
          message:
            'Move prompt/context text to a dedicated markdown file and import it instead of using an inline template literal.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noAppVueCoreBarrelImports = createExactCoreBarrelImportRule({
  description:
    'Disallow app and Vue SDK imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) =>
    (file.includes('/src/') && !file.includes('/packages/')) || file.includes('/packages/vue/src/'),
  message:
    'Use a targeted @open-pencil/core subpath (editor, scene-graph, constants, io, etc.) instead of the compatibility barrel.'
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

export {
  noVueSelfPackageImports,
  noCrossPackageSourceImports,
  noDeepParentRelativeImports,
  noCoreParentRelativeImports,
  noMcpParentRelativeImports,
  noVueParentRelativeImports,
  noCliParentRelativeImports,
  noMcpCoreBarrelImports,
  noCliCoreBarrelImports,
  noScriptCoreBarrelImports,
  noCoreSelfPackageImports,
  noInlinePromptConstants,
  noAppVueCoreBarrelImports,
  noAppImportsInPackages,
  noCoreFrameworkImports
}
