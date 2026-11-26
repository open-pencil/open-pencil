import { strict as assert } from 'node:assert'

/** How long the injected picture may take to fail to load before the test fails. */
const ERROR_DEADLINE_MS = 5_000

describe('editor content security policy', () => {
  it('starts the editor with its scripts, WebAssembly, and eval allowed', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil store did not initialize' }
    )
    const evaluated = await browser.execute(() => {
      try {
        // The eval tool and design JSX compile code this way.
        return new Function('return 2 + 2')() as number
      } catch (error) {
        return String(error)
      }
    })
    assert.equal(evaluated, 4)
  })

  it('refuses inline scripts and event handlers in markup that reaches the window', async () => {
    const ran = await browser.executeAsync((deadline: number, done: (ran: string[]) => void) => {
      const ran: string[] = []
      Object.assign(window, { __cspRecord: (name: string) => ran.push(name) })
      const host = document.createElement('div')
      host.hidden = true
      host.innerHTML = '<img src="x:" onerror="__cspRecord(\'handler\')">'
      const script = document.createElement('script')
      script.textContent = "__cspRecord('inline script')"
      host.append(script)
      document.body.append(host)
      const image = host.querySelector('img')
      const timer = setTimeout(() => done(['the picture never failed to load']), deadline)
      // Added after the markup, so its attribute handler, if allowed, has run first.
      image?.addEventListener('error', () => {
        clearTimeout(timer)
        host.remove()
        done(ran)
      })
    }, ERROR_DEADLINE_MS)
    assert.deepEqual(ran, [])
  })
})
