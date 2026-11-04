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

/** A script named by a path from wherever the process happens to run, such as `tests/x.ts`. */
function isCwdRelativeScript(value: string): boolean {
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return false
  return /[\\/]/.test(value) && /\.[cm]?[jt]sx?$/.test(value)
}

const SPAWN_FUNCTIONS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork'])

/** `spawn` for `spawn(...)` and `Bun.spawn(...)`. */
function calleeName(callee: ESTree.Node): string | null {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name
  }
  return null
}

const INTERPRETERS = new Set(['bun', 'node', 'tsx', 'deno'])
/** Interpreter words between the interpreter and its script, as in `bun run x.ts`. */
const INTERPRETER_SUBCOMMANDS = new Set(['run', 'test'])

function isInterpreter(node: ESTree.Node): boolean {
  if (node.type === 'MemberExpression') {
    return (
      node.object.type === 'Identifier' &&
      node.object.name === 'process' &&
      node.property.type === 'Identifier' &&
      node.property.name === 'execPath'
    )
  }
  const value = staticString(node)
  return value !== null && INTERPRETERS.has(value)
}

/** The command line a spawn call runs: `Bun.spawn([...])`, `{ cmd: [...] }`, or `spawn(cmd, [...])`. */
function spawnedCommand(node: ESTree.CallExpression): ESTree.Node[] {
  if (!SPAWN_FUNCTIONS.has(calleeName(node.callee) ?? '')) return []
  const [first, second] = node.arguments
  const elements = (list: ESTree.Node | undefined): ESTree.Node[] =>
    list?.type === 'ArrayExpression'
      ? list.elements.filter((element): element is ESTree.Expression => element !== null)
      : []
  if (first?.type === 'ArrayExpression') return elements(first)
  if (first?.type === 'ObjectExpression') {
    const cmd = first.properties.find(
      (property) =>
        property.type === 'Property' &&
        property.key.type === 'Identifier' &&
        property.key.name === 'cmd'
    )
    return cmd?.type === 'Property' ? elements(cmd.value) : []
  }
  return first ? [first, ...elements(second)] : []
}

/** The argument that names the script a command line runs: the command, or an interpreter's script. */
function scriptArgument(command: readonly ESTree.Node[]): ESTree.Node | undefined {
  const [program, ...rest] = command
  if (!program) return undefined
  if (!isInterpreter(program)) return program
  return rest.find((argument) => {
    const value = staticString(argument)
    return value === null || !(value.startsWith('-') || INTERPRETER_SUBCOMMANDS.has(value))
  })
}

const noCwdRelativeScriptPaths = defineRule({
  meta: {
    docs: {
      description:
        'Disallow spawning a script by a path relative to the working directory — resolve it first'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const script = scriptArgument(spawnedCommand(node))
        const value = script ? staticString(script) : null
        if (script && value !== null && isCwdRelativeScript(value)) {
          context.report({
            node: script,
            message:
              'Resolve the script with repoPath() or import.meta before spawning it; a path relative to the working directory breaks when the run starts elsewhere or the file moves.'
          })
        }
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

export {
  noCwdRelativeScriptPaths,
  noDeepParentRelativeImports,
  noDeepParentRelativePaths,
  noFunctionAliasImports
}
