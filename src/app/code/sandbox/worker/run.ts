import type { SandboxRunRequest, SandboxRunResult } from '@/app/code/sandbox/schema'
import type { DesignJSXHelperDescriptor } from '@/app/code/sandbox/types'
import { validateStructuredData } from '@/app/code/sandbox/validate'

type Element = {
  type: unknown
  props: Record<string, unknown>
  children: unknown[]
  source?: number
}
type CollectionRecord = {
  collection: unknown
  values: Record<string, unknown>
  options: unknown
  modes: Array<{ mode: unknown; values: unknown }>
}

const FRAGMENT = ''

function normalizeChildren(children: unknown[]): unknown[] {
  return children.flat(Infinity).filter((child) => child != null && child !== false)
}

function createElement(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const { __source, __self: _self, ...normalizedProps } = props ?? {}
  const normalizedChildren = normalizeChildren(children)
  if (typeof type === 'function') return type({ ...normalizedProps, children: normalizedChildren })
  if (type === FRAGMENT) return normalizedChildren
  const element: Element = { type, props: normalizedProps, children: normalizedChildren }
  const line = (__source as { lineNumber?: unknown } | undefined)?.lineNumber
  if (typeof line === 'number') element.source = line
  return element
}

function helper(name: string) {
  return (...args: unknown[]): DesignJSXHelperDescriptor => ({
    __openPencilHelper: name,
    args
  })
}

/**
 * The helpers one run calls. They only describe their calls, which the host replays
 * (`convert.ts`). Each `ref()` is numbered, so the layer it marks and the ends that refer to it
 * share one handle. Each `defineVars()` collection is written once, with the modes `defineMode()`
 * adds to it, and its variables and modes name it by number, so a mode can alias the
 * collection's own variables.
 */
function helperRuntime() {
  let refs = 0
  const collections: CollectionRecord[] = []
  const defineVars = (collection: unknown, values: Record<string, unknown>, options?: unknown) => {
    const index = collections.push({ collection, values, options: options ?? {}, modes: [] }) - 1
    return Object.fromEntries(
      Object.keys(values).map((key): [string, DesignJSXHelperDescriptor] => [
        key,
        helper('variable')(index, key)
      ])
    )
  }
  const defineMode = (
    vars: Record<string, DesignJSXHelperDescriptor>,
    mode: unknown,
    values: unknown
  ) => {
    const index = Object.values(vars)[0]?.args[0]
    const record = typeof index === 'number' ? collections[index] : undefined
    if (!record) throw new Error('defineMode() takes the variables defineVars() returned')
    record.modes.push({ mode, values })
    return helper('mode')(index, mode)
  }
  const byName = (name: string) => {
    if (name === 'ref') return () => helper('ref')(++refs)
    if (name === 'defineVars') return defineVars
    if (name === 'defineMode') return defineMode
    return helper(name)
  }
  return { byName, collections }
}

/** Element types by tag; a dotted element such as Button.Root is a member of its namespace. */
function elementTags(elements: Record<string, string>) {
  const tags: Record<string, string | Record<string, string>> = {}
  for (const [name, type] of Object.entries(elements)) {
    const dot = name.indexOf('.')
    if (dot === -1) {
      tags[name] = type
      continue
    }
    const space = name.slice(0, dot)
    const namespace = tags[space]
    if (typeof namespace === 'object') namespace[name.slice(dot + 1)] = type
    else tags[space] = { [name.slice(dot + 1)]: type }
  }
  return tags
}

/** Evaluate Design JSX into plain data the host can check and convert. */
export function runDesignJSX({
  id,
  code,
  elements,
  helpers,
  limits
}: SandboxRunRequest): SandboxRunResult {
  try {
    const tags = elementTags(elements)
    const names = Object.keys(tags)
    const runtime = helperRuntime()
    // eslint-disable-next-line typescript-eslint/no-implied-eval -- the sandbox exists to evaluate this code
    const run = new Function('__h', '__fragment', ...names, ...helpers, code)
    const value: unknown = run(
      createElement,
      FRAGMENT,
      ...names.map((name) => tags[name]),
      ...helpers.map(runtime.byName)
    )
    if (value === undefined) throw new Error('Design JSX must return an OpenPencil element.')
    validateStructuredData(runtime.collections, limits, validateStructuredData(value, limits))
    return { id, ok: true, value, collections: runtime.collections }
  } catch (error) {
    return { id, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
