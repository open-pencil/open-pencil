import type { DesignJSXValidationLimits } from '@/app/code/sandbox/types'

const workerSource = String.raw`
self.onmessage = ({ data }) => {
  const { id, code, elements, helpers: helperNames, limits } = data
  const blocked = () => { throw new Error('Network access is unavailable in Design JSX.') }
  self.fetch = blocked
  self.XMLHttpRequest = undefined
  self.WebSocket = undefined
  self.EventSource = undefined
  self.importScripts = blocked

  const normalizeChildren = (children) => children.flat(Infinity).filter((child) => child != null && child !== false)
  const __fragment = ''
  const __h = (type, props, ...children) => {
    const normalizedProps = props == null ? {} : props
    const normalizedChildren = normalizeChildren(children)
    if (typeof type === 'function') return type({ ...normalizedProps, children: normalizedChildren })
    if (type === __fragment) return normalizedChildren
    return { type, props: normalizedProps, children: normalizedChildren }
  }
  const helper = (name) => (...args) => ({ __openPencilHelper: name, args })
  const helperRuntime = (name) => {
    if (name === 'defineVars') return (vars) => Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, { __openPencilHelper: 'designVar', args: [value] }]))
    return helper(name)
  }
  const names = Object.keys(elements)
  const tags = elements
  const helpers = Object.fromEntries(helperNames.map((name) => [name, helperRuntime(name)]))
  const validate = (value, depth = 0, state = { elements: 0, bytes: 0 }) => {
    if (depth > limits.depth) throw new Error('Design JSX output is too deeply nested.')
    if (value === null) {
      state.bytes += 4
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'boolean') {
      state.bytes += value ? 4 : 5
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Design JSX output contains an invalid number.')
      state.bytes += 8
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'string') {
      if (value.length > limits.stringLength) throw new Error('Design JSX output contains a string that is too long.')
      state.bytes += new TextEncoder().encode(value).byteLength
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (Array.isArray(value)) {
      state.bytes += 2 + Math.max(0, value.length - 1)
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      if (value.length > limits.arrayLength) throw new Error('Design JSX output contains an array that is too long.')
      for (const item of value) validate(item, depth + 1, state)
      return state
    }
    if (typeof value !== 'object') throw new Error('Design JSX output contains an unsupported value.')
    const keys = Object.keys(value)
    state.bytes += 2 + Math.max(0, keys.length - 1)
    if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
    if (keys.length > limits.objectKeys) throw new Error('Design JSX output contains too many object properties.')
    if ('type' in value && 'props' in value && 'children' in value && ++state.elements > limits.elements) throw new Error('Design JSX output has too many elements.')
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('Design JSX output contains a blocked property.')
      state.bytes += key.length
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      validate(value[key], depth + 1, state)
    }
    return state
  }
  try {
    const argumentNames = ['__h', '__fragment', ...names, ...helperNames]
    const argumentValues = [__h, __fragment, ...names.map((name) => tags[name]), ...helperNames.map((name) => helpers[name])]
    const run = new Function(...argumentNames, code)
    const value = run(...argumentValues)
    validate(value)
    self.postMessage({ id, ok: true, value })
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
`

export type SandboxDocumentOptions = {
  elements: Record<string, string>
  helpers: string[]
  limits: DesignJSXValidationLimits
}

export function sandboxDocument({ elements, helpers, limits }: SandboxDocumentOptions): string {
  const escapedWorkerSource = JSON.stringify(workerSource)
  const escapedElements = JSON.stringify(elements)
  const escapedHelpers = JSON.stringify(helpers)
  const escapedLimits = JSON.stringify(limits)
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; worker-src blob:; base-uri 'none'; form-action 'none'"></head><body><script>
  const workerURL = URL.createObjectURL(new Blob([${escapedWorkerSource}], { type: 'text/javascript' }))
  const workers = new Map()
  addEventListener('message', (event) => {
    const message = event.data
    if (!message || message.type !== 'open-pencil-design-jsx-run') return
    const worker = new Worker(workerURL)
    workers.set(message.id, worker)
    worker.onmessage = ({ data }) => {
      parent.postMessage({ type: 'open-pencil-design-jsx-result', ...data }, '*')
      worker.terminate()
      workers.delete(message.id)
    }
    worker.onerror = () => {
      parent.postMessage({ type: 'open-pencil-design-jsx-result', id: message.id, ok: false, error: 'Design JSX execution failed.' }, '*')
      worker.terminate()
      workers.delete(message.id)
    }
    worker.postMessage({ id: message.id, code: message.code, elements: ${escapedElements}, helpers: ${escapedHelpers}, limits: ${escapedLimits} })
  })
  parent.postMessage({ type: 'open-pencil-design-jsx-ready' }, '*')
  </script></body></html>`
}
