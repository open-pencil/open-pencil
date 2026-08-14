const workerSource = String.raw`
self.onmessage = ({ data }) => {
  const { id, code } = data
  const blocked = () => { throw new Error('Network access is unavailable in Design JSX.') }
  self.fetch = blocked
  self.XMLHttpRequest = undefined
  self.WebSocket = undefined
  self.EventSource = undefined
  self.importScripts = blocked

  const normalizeChildren = (children) => children.flat(Infinity).filter((child) => child != null && child !== false)
  const __fragment = ''
  const __h = (type, props, ...children) => ({
    type,
    props: props == null ? {} : props,
    children: normalizeChildren(children)
  })
  const helper = (name) => (...args) => ({ __openPencilHelper: name, args })
  const names = ['Frame', 'Text', 'Rectangle', 'Ellipse', 'Line', 'Star', 'Polygon', 'Vector', 'Group', 'Section', 'Component', 'ComponentSet', 'Instance', 'View', 'Rect', 'Page', 'Icon']
  const tags = Object.fromEntries(names.map((name) => [name, name]))
  const helperNames = ['solid', 'gradient', 'linearGradient', 'radialGradient', 'angularGradient', 'diamondGradient', 'dropShadow', 'innerShadow', 'layerBlur', 'backgroundBlur', 'foregroundBlur', 'designVar', 'defineVars']
  const helpers = Object.fromEntries(helperNames.map((name) => [name, helper(name)]))
  try {
    const argumentNames = ['__h', '__fragment', ...names, ...helperNames]
    const argumentValues = [__h, __fragment, ...names.map((name) => tags[name]), ...helperNames.map((name) => helpers[name])]
    const run = new Function(...argumentNames, code)
    const value = run(...argumentValues)
    self.postMessage({ id, ok: true, value })
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
`

export function sandboxDocument(): string {
  const escapedWorkerSource = JSON.stringify(workerSource)
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
    worker.postMessage({ id: message.id, code: message.code })
  })
  parent.postMessage({ type: 'open-pencil-design-jsx-ready' }, '*')
  </scr${'ipt'}></body></html>`
}
