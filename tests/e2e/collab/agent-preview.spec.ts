import { expect, test } from '@playwright/test'

import { routeModelCatalog } from '#tests/helpers/chat/catalog'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { documentState, previewKey } from '#tests/helpers/chat/render-preview'
import { installRenderStream } from '#tests/helpers/chat/render-stream'
import { routeVisionModel } from '#tests/helpers/chat/vision'
import {
  collaborationErrors,
  connect,
  createPeer,
  share,
  startRelay,
  type Peer
} from '#tests/helpers/collab/room'

const scenario = {
  jsx: '<Frame name="Shared card" w={280} h={180} bg="#20242f" p={20}><Text size={24} color="#ffffff">Streaming preview</Text></Frame>',
  placement: { x: 80, y: 80 },
  pauseAfter: ['>Streaming']
}

test("collaborators see the AI chat's streamed JSX on their own canvas before it commits", async ({
  browser
}) => {
  test.setTimeout(90_000)
  const relay = await startRelay()
  let host: Peer | null = null
  let guest: Peer | null = null
  try {
    host = await createPeer(browser, 'Host', relay.url)
    guest = await createPeer(browser, 'Guest', relay.url)
    await share(host)
    await connect(guest)
    await expect
      .poll(() => host?.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
      .toBe(1)

    await routeModelCatalog(host.page)
    await routeVisionModel(host.page)
    const chat = new ChatHarness(host.page)
    await chat.configureOpenRouter('sk-or-test-key-12345')
    const stream = await installRenderStream(host.page, scenario)
    const guestPage = guest.page
    try {
      await chat.submit('Render a card')
      await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
      await stream.evaluate((s) => s.advance())

      // Mid-stream, the guest draws the card from the streamed JSX, though nothing is committed.
      await expect.poll(() => previewKey(host?.page ?? guestPage)).not.toBe('')
      await expect.poll(() => previewKey(guestPage)).not.toBe('')
      expect((await documentState(guestPage)).children).toEqual([])

      // Once the tool runs, the preview gives way to the committed card on both screens.
      await stream.evaluate((s) => s.complete())
      await expect(chat.assistantMessage()).toContainText('Rendered.')
      await expect.poll(() => previewKey(guestPage)).toBe('')
      await expect.poll(async () => (await documentState(guestPage)).children.length).toBe(1)
      expect(collaborationErrors(host)).toEqual([])
      expect(collaborationErrors(guest)).toEqual([])
    } finally {
      await stream.evaluate((s) => s.dispose())
      await stream.dispose()
    }
  } finally {
    await host?.context.close()
    await guest?.context.close()
    await relay.close()
  }
})
