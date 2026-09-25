import { describe, expect, mock, test } from 'bun:test'

import { ErrorCodes, defineComponent, h, nextTick, onMounted } from 'vue'

import { isFatalBootErrorInfo, observeBootErrors } from '@/app/shell/support/boot'

import { createTestRenderer, hostNode } from '#tests/helpers/vue/renderer'

function mountApp(root: ReturnType<typeof defineComponent>) {
  const app = createTestRenderer().createApp(root)
  const observer = observeBootErrors(app)
  const logged = mock(() => undefined)
  const restoreConsole = console.error
  console.error = logged
  try {
    app.mount(hostNode())
  } finally {
    console.error = restoreConsole
  }
  return { app, observer, logged }
}

describe('fatal boot error info', () => {
  test.each([
    ['setup function', ErrorCodes.SETUP_FUNCTION, true],
    ['render function', ErrorCodes.RENDER_FUNCTION, true],
    ['async component loader', ErrorCodes.ASYNC_COMPONENT_LOADER, true],
    ['scheduler flush', ErrorCodes.SCHEDULER, true],
    ['component update', ErrorCodes.COMPONENT_UPDATE, true],
    ['mounted hook', 'm', false],
    ['native event handler', ErrorCodes.NATIVE_EVENT_HANDLER, false],
    ['watcher callback', 3, false]
  ])('classifies %s in development and production form alike', (dev, code, fatal) => {
    expect(isFatalBootErrorInfo(dev)).toBe(fatal)
    // Production builds replace the string with the error reference URL.
    expect(isFatalBootErrorInfo(`https://vuejs.org/error-reference/#runtime-${code}`)).toBe(fatal)
  })
})

describe('boot error observer', () => {
  test('captures a setup failure that leaves the first render blank', async () => {
    const error = new TypeError('Promise.withResolvers is not a function')
    const Broken = defineComponent({
      setup() {
        throw error
      },
      render: () => h('div')
    })
    const { app, observer, logged } = mountApp(Broken)
    await nextTick()
    expect(observer.stop()).toEqual({ error })
    expect(logged).toHaveBeenCalledWith(error)
    expect(app.config.errorHandler).toBeUndefined()
  })

  test('leaves lifecycle hook errors to the regular error handling', async () => {
    const Flaky = defineComponent({
      setup() {
        onMounted(() => {
          throw new Error('non-fatal')
        })
        return () => h('div', 'rendered')
      }
    })
    const { observer, logged } = mountApp(Flaky)
    await nextTick()
    expect(observer.stop()).toBeUndefined()
    expect(logged).toHaveBeenCalledTimes(1)
  })

  test('forwards to and restores a previously installed handler', () => {
    const app = createTestRenderer().createApp(defineComponent({ render: () => h('div') }))
    const previous = mock(() => undefined)
    app.config.errorHandler = previous
    const observer = observeBootErrors(app)
    const error = new Error('boom')
    app.config.errorHandler?.(error, null, 'setup function')
    expect(previous).toHaveBeenCalledWith(error, null, 'setup function')
    expect(observer.stop()).toEqual({ error })
    expect(app.config.errorHandler).toBe(previous)
  })
})
