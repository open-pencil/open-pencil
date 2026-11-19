import { describe, expect, test } from 'bun:test'

import { defineComponent, h } from 'vue'

import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
import { useAutoRefresh } from '@open-pencil/vue/shared/refresh'

const renderer = createTestRenderer()

function mountRefresh(run: () => Promise<unknown>) {
  const holder: { current: ReturnType<typeof useAutoRefresh> | null } = { current: null }
  const app = renderer.createApp(
    defineComponent({
      setup() {
        holder.current = useAutoRefresh(run)
        return () => h('div')
      }
    })
  )
  app.mount(hostNode())
  const refresh = holder.current
  if (!refresh) throw new Error('useAutoRefresh did not initialize')
  return { refresh, unmount: () => app.unmount() }
}

describe('useAutoRefresh', () => {
  test('runs once more after the refresh under way when asked again meanwhile', async () => {
    let release: (() => void) | null = null
    let runs = 0
    const mounted = mountRefresh(() => {
      runs += 1
      return runs === 1
        ? new Promise<void>((resolve) => {
            release = resolve
          })
        : Promise.resolve()
    })

    const first = mounted.refresh.refresh()
    expect(mounted.refresh.refresh()).toBe(first)
    void mounted.refresh.invalidate()
    void mounted.refresh.invalidate()
    release?.()
    await first
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(runs).toBe(2)
    mounted.unmount()
  })
})
