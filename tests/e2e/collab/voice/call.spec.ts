import { expect, test, type Page } from '@playwright/test'

import {
  collaborationErrors,
  connect,
  createPeer,
  share,
  startRelay,
  type Peer
} from '#tests/helpers/collab/room'
import { FAKE_MICROPHONE_ARGS, muteButton, voicePopover } from '#tests/helpers/collab/voice'

// The fake prompt answers itself, so every context may use the microphone.
test.use({ launchOptions: { args: [...FAKE_MICROPHONE_ARGS, '--use-fake-ui-for-media-stream'] } })

async function startOrJoin(page: Page, name: 'Start voice call' | 'Join voice call') {
  await page.getByRole('button', { name, exact: true }).click()
  await voicePopover(page).getByRole('button', { name, exact: true }).click()
  await expect(muteButton(page)).toBeVisible()
  await page.keyboard.press('Escape')
}

function peerInCall(peer: Peer) {
  return peer.page.getByTestId('collab-peer-avatar').locator('[data-voice]')
}

test('people in a room start, join, mute, and leave its voice call', async ({ browser }) => {
  test.setTimeout(60_000)
  const relay = await startRelay()
  const peers: Peer[] = []
  try {
    const host = await createPeer(browser, 'Host', relay.url)
    peers.push(host)
    const guest = await createPeer(browser, 'Guest', relay.url)
    peers.push(guest)
    await share(host)
    await connect(guest)
    await expect(guest.page.getByTestId('collab-peer-avatar')).toHaveCount(1)

    await startOrJoin(host.page, 'Start voice call')
    await expect(peerInCall(guest)).toHaveCount(1)

    await startOrJoin(guest.page, 'Join voice call')
    await expect(peerInCall(host)).toHaveCount(1)

    await muteButton(host.page).click()
    await expect(guest.page.getByTestId('presence-muted')).toHaveCount(1)
    await muteButton(host.page, 'Unmute').click()
    await expect(guest.page.getByTestId('presence-muted')).toHaveCount(0)

    await host.page.getByRole('button', { name: 'Voice call', exact: true }).click()
    await voicePopover(host.page).getByRole('button', { name: 'Leave call', exact: true }).click()
    await expect(peerInCall(guest)).toHaveCount(0)
    await expect(muteButton(host.page)).toHaveCount(0)

    for (const peer of peers) expect(collaborationErrors(peer)).toEqual([])
  } finally {
    for (const peer of peers) await peer.context.close()
    await relay.close()
  }
})
