import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { normalizedFilename } from '#lint/support/context.ts'
import { createProgramFilenameRule } from '#lint/support/factories.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type {
  ArrayExpression,
  ArrayExpressionElement,
  Program,
  PropertyKey
} from '@oxc-project/types'
import { compact, once } from 'es-toolkit'
import { Visitor, parseSync } from 'oxc-parser'

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

function isNamed(key: PropertyKey, name: string): boolean {
  return key.type === 'Identifier' && key.name === name
}

/** The `order` list of the `storySort` parameter, wherever the preview sets it. */
function storySortOrder(program: Program): ArrayExpression | null {
  let order: ArrayExpression | null = null
  new Visitor({
    Property(property) {
      if (!isNamed(property.key, 'storySort') || property.value.type !== 'ObjectExpression') return
      for (const entry of property.value.properties) {
        if (entry.type !== 'Property' || !isNamed(entry.key, 'order')) continue
        if (entry.value.type === 'ArrayExpression') order = entry.value
      }
    }
  }).visit(program)
  return order
}

const stringValue = (node: ArrayExpressionElement | null): string | null =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null

/**
 * The Storybook sections whose stories group under named areas, each with its areas, read from
 * the sidebar order in `.storybook/preview.ts`: a section's name, then the list of its areas. Read
 * once per lint run; a run outside the repository root has no preview and leaves titles alone.
 */
const sidebarAreas = once((): Map<string, Set<string>> => {
  const areas = new Map<string, Set<string>>()
  const path = resolve('.storybook/preview.ts')
  if (!existsSync(path)) return areas
  const { program, errors } = parseSync('preview.ts', readFileSync(path, 'utf8'))
  const order = errors.length === 0 ? storySortOrder(program) : null
  order?.elements.forEach((element, index) => {
    const section = stringValue(element)
    const next = order.elements[index + 1]
    if (section === null || next?.type !== 'ArrayExpression') return
    areas.set(section, new Set(compact(next.elements.map(stringValue))))
  })
  return areas
})

/** Short words Title Case leaves lowercase inside a name, as in "Report a Shared File". */
const TITLE_CASE_MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
])

function isTitleCase(segment: string): boolean {
  return segment
    .split(' ')
    .every(
      (word, index) => /^[A-Z0-9]/.test(word) || (index > 0 && TITLE_CASE_MINOR_WORDS.has(word))
    )
}

const storyTitles = {
  meta: {
    docs: {
      description:
        'Require Design System and App story titles to name a listed family or area, then the component, in Title Case'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.stories.ts')) return {}
    const sections = sidebarAreas()

    return {
      Property(node) {
        if (node.key.type !== 'Identifier' || node.key.name !== 'title') return
        if (node.value.type !== 'Literal' || typeof node.value.value !== 'string') return
        const [section = '', area, ...rest] = node.value.value.split('/')
        const areas = sections.get(section)
        if (!areas) return
        let message: string | null = null
        if (area === undefined || rest.length === 0) {
          message = `'${node.value.value}' needs an area and a component: '${section}/<Area>/<Component>'.`
        } else if (!areas.has(area)) {
          message = `'${area}' is not one of the ${section} areas listed in the sidebar: use one of ${[...areas].join(', ')}, or add it to the sidebar order in .storybook/preview.ts.`
        } else if (!node.value.value.split('/').every(isTitleCase)) {
          message = `'${node.value.value}' must be in Title Case.`
        }
        if (message) context.report({ node: node.value, message })
      }
    }
  }
} satisfies RuleDefinition

export {
  vueComponentFilePascalCase,
  componentNamespaceCasing,
  nonComponentSourceDirectoriesKebabCase,
  noComponentRootSiblingFolder,
  noTopLevelPrefixedTestFiles,
  noFlatKiwiModules,
  storyTitles
}
