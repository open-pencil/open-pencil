import { existsSync } from 'node:fs'

import type { TSESTree } from '@typescript-eslint/utils'

import { normalizedFilename } from '../support/context.ts'
import { createProgramFilenameRule } from '../support/factories.ts'
import type { RuleDefinition } from '../support/types.ts'

function isPascalCaseName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

function isKebabOrLowercaseName(name: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)
}

const vueComponentFilePascalCase = {
  meta: {
    docs: {
      description: 'Require Vue component files to use PascalCase names'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      Program(node) {
        const basename =
          file
            .split('/')
            .at(-1)
            ?.replace(/\.vue$/, '') ?? ''
        if (isPascalCaseName(basename)) return
        context.report({
          node,
          message: 'Vue component files must use PascalCase names.'
        })
      }
    }
  }
} satisfies RuleDefinition

const componentNamespaceCasing = {
  meta: {
    docs: {
      description: 'Require component namespace folders to use the project casing convention'
    }
  },
  create(context) {
    const file = normalizedFilename(context)

    return {
      Program(node) {
        const primitiveMatch = file.match(/\/packages\/vue\/src\/primitives\/([^/]+)/)
        if (primitiveMatch && !isPascalCaseName(primitiveMatch[1])) {
          context.report({
            node,
            message: `Vue primitive namespace folder '${primitiveMatch[1]}' must use PascalCase.`
          })
          return
        }

        const componentMatch = file.match(/\/src\/components\/(.+)$/)
        if (!componentMatch) return

        const parts = componentMatch[1].split('/')
        const first = parts[0]
        const second = parts[1]

        if (parts.length > 1 && !isPascalCaseName(first) && !isKebabOrLowercaseName(first)) {
          context.report({
            node,
            message: `Component namespace folder '${first}' must use PascalCase or kebab-case.`
          })
          return
        }

        if (
          parts.length > 2 &&
          (first === 'chat' || first === 'properties') &&
          second !== undefined &&
          !isPascalCaseName(second) &&
          !isKebabOrLowercaseName(second)
        ) {
          context.report({
            node,
            message: `Nested component namespace folder '${first}/${second}' must use PascalCase or kebab-case.`
          })
        }
      }
    }
  }
} satisfies RuleDefinition

const nonComponentSourceDirectoriesKebabCase = {
  meta: {
    docs: {
      description: 'Require non-component source directories to use lowercase or kebab-case names'
    }
  },
  create(context) {
    const file = normalizedFilename(context)

    const roots = [
      '/src/app/',
      '/packages/core/src/',
      '/packages/cli/src/',
      '/packages/mcp/src/',
      '/packages/vue/src/canvas/',
      '/packages/vue/src/controls/',
      '/packages/vue/src/document/',
      '/packages/vue/src/editor/',
      '/packages/vue/src/i18n/',
      '/packages/vue/src/internal/',
      '/packages/vue/src/shared/',
      '/packages/vue/src/variables/'
    ]

    const root = roots.find((candidate) => file.includes(candidate))
    if (!root) return {}

    return {
      Program(node) {
        const relativePath = file.slice(file.indexOf(root) + root.length)
        const directories = relativePath.split('/').slice(0, -1)
        const invalid = directories.find((part) => !isKebabOrLowercaseName(part))
        if (!invalid) return
        context.report({
          node,
          message: `Non-component source directory '${invalid}' must use lowercase or kebab-case.`
        })
      }
    }
  }
} satisfies RuleDefinition

const noComponentRootSiblingFolder = {
  meta: {
    docs: {
      description: 'Disallow multi-file component roots beside their namespace folder'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const match = file.match(/\/src\/components\/(?:chat\/|properties\/)?([A-Z][A-Za-z0-9]*)\.vue$/)
    if (!match) return {}

    return {
      Program(node) {
        const dir = file.replace(/\.vue$/, '')
        if (!existsSync(dir)) return
        context.report({
          node,
          message: `Move '${match[1]}.vue' inside its '${match[1]}/' component namespace folder.`
        })
      }
    }
  }
} satisfies RuleDefinition

const noUselessPassThroughWrappers = {
  meta: {
    docs: {
      description:
        'Disallow functions that only return another function call with the same arguments'
    }
  },
  create(context) {
    function paramNames(params: readonly TSESTree.Parameter[]): string[] | null {
      const names: string[] = []
      for (const param of params ?? []) {
        if (param.type !== 'Identifier') return null
        names.push(param.name)
      }
      return names
    }

    function returnedCall(
      body: TSESTree.BlockStatement | TSESTree.Expression
    ): TSESTree.CallExpression | null {
      if (!body) return null
      if (body.type === 'CallExpression') return body
      if (body.type !== 'BlockStatement') return null
      const statements = body.body?.filter((statement) => statement.type !== 'EmptyStatement') ?? []
      if (statements.length !== 1) return null
      const statement = statements[0]
      if (statement.type !== 'ReturnStatement') return null
      return statement.argument?.type === 'CallExpression' ? statement.argument : null
    }

    function calleeName(callee: TSESTree.CallExpression['callee']): string | null {
      return callee?.type === 'Identifier' ? callee.name : null
    }

    function isSameArgumentForwarding(
      args: readonly TSESTree.CallExpressionArgument[],
      params: readonly string[]
    ): boolean {
      if (args?.length !== params.length) return false
      return args.every((arg, index) => arg.type === 'Identifier' && arg.name === params[index])
    }

    function check(
      node: TSESTree.Node,
      name: string,
      params: readonly TSESTree.Parameter[],
      body: TSESTree.BlockStatement | TSESTree.Expression
    ) {
      const names = paramNames(params)
      if (!names) return
      const call = returnedCall(body)
      if (!call || !isSameArgumentForwarding(call.arguments, names)) return
      const target = calleeName(call.callee)
      if (!target || target === name) return
      context.report({
        node,
        message: `Remove pass-through wrapper '${name}'. Call '${target}' directly or give the wrapper real domain logic.`
      })
    }

    return {
      FunctionDeclaration(node) {
        if (!node.id?.name) return
        check(node, node.id.name, node.params, node.body)
      },
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return
        const init = node.init
        if (
          !init ||
          (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
        )
          return
        check(node, node.id.name, init.params, init.body)
      }
    }
  }
} satisfies RuleDefinition

const noFunctionAliasImports = {
  meta: {
    docs: {
      description: 'Disallow import aliases ending in Fn for facade delegation'
    }
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        if (!node.imported || !node.local) return
        if (node.imported.type !== 'Identifier' || node.local.type !== 'Identifier') return
        if (node.imported.name === node.local.name) return
        if (!node.local.name.endsWith('Fn')) return
        context.report({
          node,
          message:
            'Avoid aliasing imports as *Fn. Use a namespace import or give the exported helper a clearer domain name.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noDirectOpenPencilBrowserStore = {
  meta: {
    docs: {
      description: 'Disallow direct window.openPencil.store access'
    }
  },
  create(context) {
    function propertyName(
      property: TSESTree.Expression | TSESTree.PrivateIdentifier
    ): string | null {
      if (property?.type === 'Identifier') return property.name
      if (property?.type === 'Literal' && typeof property.value === 'string') return property.value
      return null
    }

    function isOpenPencilMember(node: TSESTree.Expression): boolean {
      return (
        node?.type === 'MemberExpression' &&
        propertyName(node.property) === 'openPencil' &&
        ((node.object?.type === 'Identifier' && node.object.name === 'window') ||
          (node.object?.type === 'Identifier' && node.object.name === 'globalThis'))
      )
    }

    return {
      MemberExpression(node) {
        if (propertyName(node.property) !== 'store') return
        if (!isOpenPencilMember(node.object)) return
        context.report({
          node,
          message:
            'Use window.openPencil.getStore() instead of accessing window.openPencil.store directly.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noDirectOpenPencilWindowInternals = {
  meta: {
    docs: {
      description: 'Disallow direct access to private OpenPencil window internals'
    }
  },
  create(context) {
    function propertyName(
      property: TSESTree.Expression | TSESTree.PrivateIdentifier
    ): string | null {
      if (property?.type === 'Identifier') return property.name
      if (property?.type === 'Literal' && typeof property.value === 'string') return property.value
      return null
    }

    return {
      MemberExpression(node) {
        const name = propertyName(node.property)
        if (!name?.startsWith('__OPEN_PENCIL')) return
        context.report({
          node,
          message:
            'Do not access window.__OPEN_PENCIL* directly. Use src/app/browser-bridge.ts or tests/helpers/store.ts instead.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noBunGlobalsInCli = {
  meta: { docs: { description: 'Disallow Bun globals in Node-compatible CLI source' } },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/cli/src/')) return {}
    return {
      MemberExpression(node) {
        if (node.object?.type !== 'Identifier' || node.object.name !== 'Bun') return
        context.report({
          node,
          message: 'Use Node-compatible APIs in CLI source instead of Bun globals.'
        })
      }
    }
  }
} satisfies RuleDefinition
const noTopLevelPrefixedTestFiles = createProgramFilenameRule({
  description: 'Disallow top-level test files that encode domains as filename prefixes',
  check(file) {
    const match = file.match(/\/tests\/(engine|e2e)\/([^/]+-[^/]+\.(?:test|spec)\.ts)$/)
    if (!match) return false
    return `Move '${match[2]}' under a domain folder instead of encoding the domain as a filename prefix.`
  }
})

const noSiblingDomainPrefixedFiles = createProgramFilenameRule({
  description: 'Disallow files that repeat an existing sibling domain folder in the filename',
  check(file) {
    const match = file.match(/^(.*\/)([^/]+)\.(?:test\.)?(?:spec\.)?(?:ts|tsx|vue)$/)
    if (!match) return false

    const [, dir, name] = match
    const parts = name.split('-')
    if (parts.length < 2) return false

    const prefix = parts[0]
    const suffix = parts.at(-1)
    let domain: string | null = null
    if (existsSync(`${dir}${prefix}`)) domain = prefix
    else if (suffix && existsSync(`${dir}${suffix}`)) domain = suffix
    if (!domain) return false

    const filename = file.slice(dir.length)
    return `Move '${filename}' under the existing '${domain}/' folder instead of repeating the domain in the filename.`
  }
})

export {
  vueComponentFilePascalCase,
  componentNamespaceCasing,
  nonComponentSourceDirectoriesKebabCase,
  noComponentRootSiblingFolder,
  noUselessPassThroughWrappers,
  noFunctionAliasImports,
  noDirectOpenPencilBrowserStore,
  noDirectOpenPencilWindowInternals,
  noBunGlobalsInCli,
  noTopLevelPrefixedTestFiles,
  noSiblingDomainPrefixedFiles
}
