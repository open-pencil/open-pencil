import type { Page } from '@playwright/test'

import { readProbe } from './probe'

export async function measureHitTesting(page: Page, run: () => Promise<void>) {
  const probe = await page.evaluateHandle(() => {
    const graph = window.openPencil?.getStore?.().graph
    if (!graph) throw new Error('OpenPencil graph not initialized')
    const original = graph.hitTestSelectable
    let calls = 0
    let totalMs = 0
    graph.hitTestSelectable = (...args) => {
      const start = performance.now()
      const result = original.apply(graph, args)
      totalMs += performance.now() - start
      calls++
      return result
    }
    return {
      read: () => ({ calls, totalMs }),
      dispose: () => {
        graph.hitTestSelectable = original
      }
    }
  })
  return readProbe(probe, run)
}
