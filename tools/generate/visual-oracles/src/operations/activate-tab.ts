import { parseArgs } from 'node:util'

import * as v from 'valibot'

/**
 * Bring a Figma desktop tab to the front by its title. `figma-use` and the oracle captures
 * target the active document, so a reopened export must be the visible tab first. The tab
 * strip lives in the desktop shell page, reachable over the same DevTools port figma-use uses.
 */
const { values } = parseArgs({
  options: { title: { type: 'string' }, port: { type: 'string', default: '9222' } }
})
if (!values.title) throw new Error('Required: --title <tab title> [--port 9222]')

const TargetsJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.array(v.looseObject({ type: v.string(), url: v.string(), webSocketDebuggerUrl: v.string() }))
)
const targets = v.parse(
  TargetsJSON,
  await (await fetch(`http://localhost:${values.port}/json/list`)).text()
)
const shell = targets.find((t) => t.type === 'page' && t.url.endsWith('shell.html'))
if (!shell)
  throw new Error('Figma desktop shell page not found; is Figma running with remote debugging?')

const EvaluateResponseJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    // CDP omits `value` for results it cannot return by value.
    result: v.optional(
      v.object({ result: v.optional(v.object({ value: v.optional(v.unknown()) })) })
    )
  })
)

const socket = new WebSocket(shell.webSocketDebuggerUrl)
await new Promise<void>((resolve, reject) => {
  socket.onopen = () => resolve()
  socket.onerror = () => reject(new Error('Could not connect to the Figma shell'))
})
const expression = `(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')]
  const tab = tabs.find((t) => (t.getAttribute('aria-label') || '') === ${JSON.stringify(values.title)})
  if (!tab) return tabs.map((t) => t.getAttribute('aria-label'))
  tab.click()
  return true
})()`
socket.send(
  JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })
)
// A throw inside onmessage would leave this pending forever, so a bad frame rejects instead.
const result = await new Promise<unknown>((resolve, reject) => {
  socket.onmessage = (message) => {
    const parsed = v.safeParse(EvaluateResponseJSON, String(message.data))
    if (parsed.success) resolve(parsed.output.result?.result?.value)
    else reject(new v.ValiError(parsed.issues))
  }
}).finally(() => socket.close())
if (result !== true)
  throw new Error(`No tab titled ${values.title}; open tabs: ${JSON.stringify(result)}`)
await new Promise<void>((resolve) => {
  setTimeout(resolve, 1500)
})
console.log(`activated ${values.title}`)
