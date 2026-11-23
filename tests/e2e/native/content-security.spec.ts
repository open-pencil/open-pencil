import { strict as assert } from 'node:assert'

describe('editor content security policy', () => {
  it('starts the editor with its scripts, WebAssembly, and eval allowed', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil store did not initialize' }
    )
    const evaluated = await browser.execute(() => {
      try {
        // The eval tool and design JSX compile code this way.
        return Function('return 2 + 2')() as number
      } catch (error) {
        return String(error)
      }
    })
    assert.equal(evaluated, 4)
  })

  it('refuses inline scripts and event handlers in markup that reaches the window', async () => {
    const ran = await browser.executeAsync((done: (ran: string[]) => void) => {
      const ran: string[] = []
      const record = (name: string) => ran.push(name)
      Object.assign(window, { __cspRecord: record })
      const host = document.createElement('div')
      host.hidden = true
      host.innerHTML = '<img src="x:" onerror="__cspRecord(\'handler\')">'
      const script = document.createElement('script')
      script.textContent = "__cspRecord('inline script')"
      host.append(script)
      document.body.append(host)
      setTimeout(() => {
        host.remove()
        done(ran)
      }, 500)
    })
    assert.deepEqual(ran, [])
  })
})
