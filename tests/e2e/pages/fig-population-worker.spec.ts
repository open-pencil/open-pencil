import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test('populates a real lazy FIG page in the retained parse worker', async () => {
  test.setTimeout(90_000)
  await editor.page.evaluate(() => {
    const events: unknown[] = []
    Object.assign(window, { figPopulationWorkerEvents: events })
    window.addEventListener('openpencil:fig-population-worker', (event) => {
      if (event instanceof CustomEvent) events.push(event.detail)
    })
  })
  const openFile = editor.page.evaluate(() =>
    window.openPencil?.openFile?.('/tests/fixtures/material3.fig')
  )
  await openFile
  await editor.canvas.waitForRender()

  const targetPageId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getPages(true).at(-1)?.id
  })
  if (!targetPageId) throw new Error('Target page not found')

  const populateEventCount = await editor.page.evaluate(
    () =>
      (Reflect.get(window, 'figPopulationWorkerEvents') as Array<{ event: string }>).filter(
        ({ event }) => event === 'populate'
      ).length
  )
  await editor.page.evaluate((pageId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.switchPage(pageId)
  }, targetPageId)
  await expect
    .poll(
      () =>
        editor.page.evaluate(
          (previousCount) =>
            (Reflect.get(window, 'figPopulationWorkerEvents') as Array<{ event: string }>).filter(
              ({ event }) => event === 'populate'
            ).length > previousCount,
          populateEventCount
        ),
      { timeout: 45_000 }
    )
    .toBe(true)

  const currentPage = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      currentPageId: store.state.currentPageId,
      childCount: store.graph.getChildren(store.state.currentPageId).length
    }
  })
  expect(currentPage.currentPageId).toBe(targetPageId)
  expect(currentPage.childCount).toBeGreaterThan(0)

  const events = await editor.page.evaluate(
    () => Reflect.get(window, 'figPopulationWorkerEvents') as Array<{ event: string }>
  )
  expect(events.map(({ event }) => event)).toEqual(
    expect.arrayContaining(['registered', 'populate'])
  )

  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.dispose())
  await expect
    .poll(() =>
      editor.page.evaluate(
        () =>
          (Reflect.get(window, 'figPopulationWorkerEvents') as Array<{ event: string }>).at(-1)
            ?.event
      )
    )
    .toBe('terminated')
  editor.canvas.assertNoErrors()
})
