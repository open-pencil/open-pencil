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

/** A path with a directory part, read from wherever the process happens to run, such as `tests/x.ts`. */
function isCwdRelativePath(value: string): boolean {
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^[a-z][a-z+.-]*:/i.test(value)) {
    return false
  }
  return /[\\/]/.test(value)
}

const SCRIPT_EXTENSION = /\.[cm]?[jt]sx?$/

const SPAWN_FUNCTIONS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork'])

/** File system calls whose first argument is a path. */
const PATH_FUNCTIONS = new Set([
  'existsSync',
  'lstatSync',
  'readFile',
  'readFileSync',
  'readdir',
  'readdirSync',
  'statSync',
  'writeFile',
  'writeFileSync'
])
/** Objects whose path methods are file system calls, as in `fs.readFileSync` or `Bun.file`. */
const PATH_OBJECTS = new Set(['fs', 'fsp', 'Bun'])
const BUN_PATH_FUNCTIONS = new Set(['file', 'write'])

/** `spawn` for `spawn(...)` and `Bun.spawn(...)`. */
function calleeName(callee: ESTree.Node): string | null {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name
  }
  return null
}

/** Whether `node` reads or writes the file its first argument names: `readFileSync(path)`, `Bun.file(path)`. */
function isPathCall(node: ESTree.CallExpression): boolean {
  const { callee } = node
  if (callee.type === 'Identifier') return PATH_FUNCTIONS.has(callee.name)
  if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return false
  if (callee.object.type !== 'Identifier' || !PATH_OBJECTS.has(callee.object.name)) return false
  return callee.object.name === 'Bun'
    ? BUN_PATH_FUNCTIONS.has(callee.property.name)
    : PATH_FUNCTIONS.has(callee.property.name)
}

const INTERPRETERS = new Set(['bun', 'node', 'tsx', 'deno'])

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

/** Whether a spawn call sets its own working directory, which makes relative paths resolve. */
function setsWorkingDirectory(node: ESTree.CallExpression): boolean {
  return node.arguments.some(
    (argument) =>
      argument.type === 'ObjectExpression' &&
      argument.properties.some(
        (property) =>
          property.type === 'Property' &&
          property.key.type === 'Identifier' &&
          property.key.name === 'cwd'
      )
  )
}

/**
 * The argument that names the script a command line runs: the command itself, or the first script
 * after an interpreter, past its flags, their values, and words such as `run`. A computed argument
 * there is taken as the resolved script.
 */
function scriptArgument(command: readonly ESTree.Node[]): ESTree.Node | undefined {
  const [program, ...rest] = command
  if (!program) return undefined
  if (!isInterpreter(program)) return program
  for (const argument of rest) {
    const value = staticString(argument)
    if (value === null) return undefined
    if (SCRIPT_EXTENSION.test(value)) return argument
  }
  return undefined
}

const noCwdRelativePaths = defineRule({
  meta: {
    docs: {
      description:
        'Disallow reading, writing, or spawning a file by a path relative to the working directory — resolve it first'
    }
  },
  create(context) {
    const message =
      'Resolve the path with repoPath() or import.meta first; a path relative to the working directory breaks when the run starts elsewhere or the file moves.'
    return {
      CallExpression(node) {
        if (isPathCall(node)) {
          const [path] = node.arguments
          const value = path ? staticString(path) : null
          if (path && value !== null && isCwdRelativePath(value))
            context.report({ node: path, message })
          return
        }
        if (setsWorkingDirectory(node)) return
        const script = scriptArgument(spawnedCommand(node))
        const value = script ? staticString(script) : null
        if (script && value !== null && SCRIPT_EXTENSION.test(value) && isCwdRelativePath(value)) {
          context.report({ node: script, message })
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
  noCwdRelativePaths,
  noDeepParentRelativeImports,
  noDeepParentRelativePaths,
  noFunctionAliasImports
}
