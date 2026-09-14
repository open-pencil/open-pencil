import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'
import { setupCanvas, previewKey, documentState } from '#tests/helpers/chat/render-preview'
import { installRenderStream } from '#tests/helpers/chat/render-stream'

const opening =
  '<Frame name="Streaming card" w={280} h={180} bg="#20242f" flex="col" p={20} gap={12} rounded={16}><Text size={24} color="#ffffff">Streaming'
const closing = ' preview</Text><Rect w={240} h={36} bg="#9747ff" rounded={8}/></Frame>'
const scenario = {
  jsx: opening + closing,
  placement: { x: 80, y: 80 },
  pauseAfter: ['>Streaming', '</Frame>']
}

test('renders streamed JSX without document mutations, then commits once with undo', async ({
  configuredChat: chat
}) => {
  await setupCanvas(chat.page)
  const stream = await installRenderStream(chat.page, scenario)
  try {
    await chat.submit('Render a card')
    await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
    await stream.evaluate((s) => s.advance())
    await expect.poll(() => previewKey(chat.page)).not.toBe('')
    expect(await documentState(chat.page)).toEqual({ children: [], undo: false })
    const canvas = new CanvasHelper(chat.page)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(640, 400)).toMatchSnapshot(
      'jsx-streaming-open-text.png'
    )
    const first = await previewKey(chat.page)
    await stream.evaluate((s) => s.advance())
    await expect.poll(() => previewKey(chat.page)).not.toBe(first)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(640, 400)).toMatchSnapshot(
      'jsx-streaming-complete-preview.png'
    )
    expect(await documentState(chat.page)).toEqual({ children: [], undo: false })
    await chat.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      store.state.panX = 30
      store.state.panY = 20
      store.state.zoom = 0.75
      store.requestRepaint()
    })
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(640, 400)).toMatchSnapshot(
      'jsx-streaming-zoomed-preview.png'
    )
    await stream.evaluate((s) => s.complete())
    await expect(chat.assistantMessage()).toContainText('Rendered.')
    expect(await stream.evaluate((s) => s.requestCount())).toBe(2)
    await expect.poll(() => previewKey(chat.page)).toBe('')
    const committed = await documentState(chat.page)
    expect(committed.children).toHaveLength(1)
    expect(committed.undo).toBe(true)
    await chat.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
    expect(await documentState(chat.page)).toEqual({ children: [], undo: false })
  } finally {
    await stream.evaluate((s) => s.dispose())
    await stream.dispose()
  }
})

test('preserves a replacement target until completion and restores it on undo', async ({
  configuredChat: chat
}) => {
  await setupCanvas(chat.page)
  const originalId = await chat.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const node = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Placeholder',
      x: 80,
      y: 80,
      width: 280,
      height: 180
    })
    store.requestRender()
    return node.id
  })
  const stream = await installRenderStream(chat.page, {
    ...scenario,
    placement: { replace_id: originalId, x: 80, y: 80 }
  })
  try {
    await chat.submit('Replace the placeholder')
    await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
    await stream.evaluate((s) => s.advance())
    await expect.poll(() => previewKey(chat.page)).not.toBe('')
    expect(await documentState(chat.page)).toEqual({ children: [originalId], undo: false })
    await stream.evaluate((s) => s.complete())
    await expect(chat.assistantMessage()).toContainText('Rendered.')
    expect((await documentState(chat.page)).children).not.toContain(originalId)
    await chat.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
    expect(await documentState(chat.page)).toEqual({ children: [originalId], undo: false })
  } finally {
    await stream.evaluate((s) => s.dispose())
    await stream.dispose()
  }
})

test('clears previews on page switches even while the provider is paused', async ({
  configuredChat: chat
}) => {
  await setupCanvas(chat.page)
  const stream = await installRenderStream(chat.page, scenario)
  try {
    await chat.submit('Render a card')
    await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
    await stream.evaluate((s) => s.advance())
    await expect.poll(() => previewKey(chat.page)).not.toBe('')
    await chat.page.evaluate(async () => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const original = store.state.currentPageId
      const other = store.graph.addPage('Other')
      await store.switchPage(other.id)
      await store.switchPage(original)
    })
    expect(await previewKey(chat.page)).toBe('')
    expect(await documentState(chat.page)).toEqual({ children: [], undo: false })
    await chat.page.getByTestId('chat-stop-button').click()
  } finally {
    await stream.evaluate((s) => s.dispose())
    await stream.dispose()
  }
})

for (const outcome of ['cancel', 'error', 'disconnect'] as const) {
  test(`removes speculative JSX on ${outcome} without committing it`, async ({
    configuredChat: chat
  }) => {
    await setupCanvas(chat.page)
    const stream = await installRenderStream(chat.page, {
      ...scenario,
      outcome: outcome === 'error' ? 'provider-error' : 'render'
    })
    try {
      await chat.submit('Render a card')
      await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
      await stream.evaluate((s) => s.advance())
      await expect.poll(() => previewKey(chat.page)).not.toBe('')
      if (outcome === 'cancel') await chat.page.getByTestId('chat-stop-button').click()
      else if (outcome === 'error') await stream.evaluate((s) => s.complete())
      else await stream.evaluate((s) => s.fail())
      await expect.poll(() => previewKey(chat.page)).toBe('')
      expect(await documentState(chat.page)).toEqual({ children: [], undo: false })
    } finally {
      await stream.evaluate((s) => s.dispose())
      await stream.dispose()
    }
  })
}
