import { importSource } from '#oxlint-plugin/support/context'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

type ParentRelativeImportOptions = {
  /** How many `../` segments an import may climb before it needs an alias; 2 by default. */
  minDepth?: number
  /** The alias to name in the message, such as `#core/*`. */
  alias?: string
}

/** How many `../` segments a module path starts with. */
function parentDepth(source: string): number {
  return (source.match(/^(?:\.\.\/)+/)?.[0].length ?? 0) / '../'.length
}

const noDeepParentRelativeImports = defineRule({
  meta: {
    docs: {
      description: 'Disallow deep parent-relative imports — use package or test aliases instead'
    },
    schema: [
      {
        type: 'object',
        properties: { minDepth: { type: 'integer', minimum: 1 }, alias: { type: 'string' } },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options: ParentRelativeImportOptions =
      (context.options[0] as ParentRelativeImportOptions | undefined) ?? {}
    const minDepth = options.minDepth ?? 2
    const message = options.alias
      ? `Use the ${options.alias} alias instead of parent-relative imports.`
      : 'Use an import alias instead of path drilling with ../.. imports.'

    function check(
      node:
        | ESTree.ImportDeclaration
        | ESTree.ExportAllDeclaration
        | ESTree.ExportNamedDeclaration
        | ESTree.ImportExpression
    ) {
      const source = importSource(node)
      if (!source?.startsWith('../')) return
      if (parentDepth(source) < minDepth) return
      if (/^(?:\.\.\/)+package\.json$/.test(source)) return
      context.report({ node, message })
    }

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check
    }
  }
})

/**
 * A path that climbs two or more directories, written as `../..`, `..\\..`, or `'..', '..'`.
 * An unknown part, such as a template expression, ends the run of parent segments.
 */
function climbsTwoLevels(values: (string | null)[]): boolean {
  const joined = values
    .map((value) => value ?? '\u0000')
    .join('/')
    .replaceAll('\\', '/')
  return /(^|\/)\.\.\/+\.\.(\/|$)/.test(joined)
}

function staticString(node: ESTree.Node): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral') {
    const head = node.quasis[0]?.value.cooked ?? null
    return head !== null && node.expressions.length ? `${head}\u0000` : head
  }
  return null
}

/** `import.meta.url`, `.dir`, or `.dirname`, directly or wrapped, as in `dirname(fileURLToPath(import.meta.url))`. */
function isImportMetaLocation(node: ESTree.Node): boolean {
  if (node.type === 'MemberExpression') {
    if (node.object.type === 'MetaProperty') {
      return (
        node.property.type === 'Identifier' &&
        ['url', 'dir', 'dirname'].includes(node.property.name)
      )
    }
    return isImportMetaLocation(node.object)
  }
  if (node.type === 'CallExpression') return node.arguments.some(isImportMetaLocation)
  return false
}

const noDeepParentRelativePaths = defineRule({
  meta: {
    docs: {
      description:
        'Disallow climbing two or more directories from import.meta — use a path helper or alias'
    }
  },
  create(context) {
    const message =
      'Resolve the file through a path helper or an import alias instead of climbing with ../..'
    function check(node: ESTree.Node, relative: readonly ESTree.Node[]) {
      if (relative.length && climbsTwoLevels(relative.map(staticString))) {
        context.report({ node, message })
      }
    }
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URL') return
        const [path, base] = node.arguments
        if (!path || !base || !isImportMetaLocation(base)) return
        check(node, [path])
      },
      CallExpression(node) {
        const start = node.arguments.findIndex(isImportMetaLocation)
        if (start !== -1) check(node, node.arguments.slice(start + 1))
      }
    }
  }
})

const noFunctionAliasImports = defineRule({
  meta: {
    docs: {
      description: 'Disallow import aliases ending in Fn for facade delegation'
    }
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        if (node.imported.type !== 'Identifier') return
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
})

export { noDeepParentRelativeImports, noDeepParentRelativePaths, noFunctionAliasImports }
