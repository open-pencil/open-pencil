import { existsSync } from 'node:fs'

import { normalizedFilename } from '#lint/support/context.ts'
import { createProgramFilenameRule } from '#lint/support/factories.ts'
import type { RuleDefinition } from '#lint/support/types.ts'

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

    const root = roots
      .filter((candidate) => file.includes(candidate))
      .sort((left, right) => right.length - left.length)[0]
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

const noTopLevelPrefixedTestFiles = createProgramFilenameRule({
  description: 'Disallow top-level test files that encode domains as filename prefixes',
  check(file) {
    const match = file.match(/\/tests\/(engine|e2e)\/([^/]+-[^/]+\.(?:test|spec)\.ts)$/)
    if (!match) return false
    return `Move '${match[2]}' under a domain folder instead of encoding the domain as a filename prefix.`
  }
})

const noFlatKiwiModules = createProgramFilenameRule({
  description: 'Disallow flat top-level Kiwi modules — group code under Kiwi subdomains',
  check(file) {
    const marker = '/packages/core/src/kiwi/'
    const start = file.indexOf(marker)
    if (start === -1) return false

    const relativePath = file.slice(start + marker.length)
    if (relativePath.includes('/') || relativePath === 'index.ts') return false

    return 'Move Kiwi modules under binary/, fig/, node-change/, instance-overrides/, or kiwi-schema/ instead of adding flat top-level files.'
  }
})

export {
  vueComponentFilePascalCase,
  componentNamespaceCasing,
  nonComponentSourceDirectoriesKebabCase,
  noComponentRootSiblingFolder,
  noTopLevelPrefixedTestFiles,
  noFlatKiwiModules
}
