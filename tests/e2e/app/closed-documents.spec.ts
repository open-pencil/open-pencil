import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const FIXTURE = 'gold-preview.fig'

// A closed tab must release its document. CanvasKit's WebGL context table, an editor's global
// text measurer, store effects created during a component's setup, and app-level event
// subscriptions each kept every closed document alive: store, graph, canvas, and UI tree.
test('documents closed in tabs are released', async ({ page }) => {
  test.setTimeout(90_000)
  await page.route(`**/__fixtures/${FIXTURE}`, (route) =>
    route.fulfill({ path: fileURLToPath(new URL(`../../fixtures/${FIXTURE}`, import.meta.url)) })
  )
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const cdp = await page.context().newCDPSession(page)
  await page.evaluate(() => Reflect.set(window, '__closedGraphs', []))

  for (let cycle = 0; cycle < 3; cycle++) {
    await page.evaluate(async (fixture) => {
      const tabs = await import('/src/app/tabs/index.ts')
      const response = await fetch(`/__fixtures/${fixture}`)
      await tabs.openFileInNewTab(new File([await response.arrayBuffer()], fixture))
    }, FIXTURE)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = window.openPencil?.getStore?.()
          return Boolean(store && store.graph.nodes.size > 100 && !store.state.preparation)
        })
      )
      .toBe(true)
    await page.evaluate(async () => {
      const tabs = await import('/src/app/tabs/index.ts')
      const store = tabs.getActiveStore()
      const graphs = Reflect.get(window, '__closedGraphs') as WeakRef<object>[]
      graphs.push(new WeakRef(store.graph))
      await tabs.closeTab(tabs.getActiveTabId(), 'discard')
    })
  }

  await expect
    .poll(
      async () => {
        await cdp.send('HeapProfiler.collectGarbage')
        return page.evaluate(
          () =>
            (Reflect.get(window, '__closedGraphs') as WeakRef<object>[]).filter((ref) =>
              ref.deref()
            ).length
        )
      },
      { timeout: 15_000 }
    )
    .toBe(0)
})
