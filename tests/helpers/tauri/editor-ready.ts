export async function openNativeEditorDocument(): Promise<void> {
  const homeAction = await $('[data-test-id="home-new-document"]')
  if (await homeAction.isExisting()) await homeAction.click()
  await browser.waitUntil(
    async () => browser.execute(() => Boolean(document.querySelector('[data-test-id="canvas-area"]'))),
    { timeout: 30_000, timeoutMsg: 'Native editor canvas did not open' }
  )
}
