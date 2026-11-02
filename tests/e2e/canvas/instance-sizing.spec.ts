import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import type * as SizingFixture from '#tests/helpers/canvas/instance-sizing'

test.use({ viewport: { width: 900, height: 700 } })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('Fill instances wrap inside narrower parents after component synchronization', async () => {
  await editor.page.evaluate(async () => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createInstanceSizingScene }: typeof SizingFixture = await import(fixtureURL)
    const { boardId, componentId } = await createInstanceSizingScene(
      store.graph,
      store.state.currentPageId
    )
    await store.loadFontsForNodes([boardId, componentId])
    store.clearSelection()
    store.zoomToFit()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('instance-fill-sizing.png')
})
