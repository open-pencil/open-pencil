export async function openNativeEditorDocument(): Promise<void> {
  const homeAction = await $('[data-test-id="home-new-document"]')
  if (await homeAction.isExisting()) await homeAction.click()
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const store = window.openPencil?.getStore?.()
        return Boolean(document.querySelector('[data-test-id="canvas-area"]') && store?.textEditor)
      }),
    { timeout: 30_000, timeoutMsg: 'Native editor canvas and text renderer did not initialize' }
  )
}
