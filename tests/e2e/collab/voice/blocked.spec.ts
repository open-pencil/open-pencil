import { expect, test } from '@playwright/test'

import { createPeer, share, startRelay, type Peer } from '#tests/helpers/collab/room'
import { FAKE_MICROPHONE_ARGS, muteButton, voicePopover } from '#tests/helpers/collab/voice'

// No fake prompt here: it would answer even a microphone the test blocked.
test.use({ launchOptions: { args: FAKE_MICROPHONE_ARGS } })

test('a blocked microphone keeps you out of the call and says how to allow it', async ({
  browser
}) => {
  const relay = await startRelay()
  let host: Peer | null = null
  try {
    host = await createPeer(browser, 'Host', relay.url)
    const cdp = await host.context.newCDPSession(host.page)
    await cdp.send('Browser.setPermission', {
      permission: { name: 'microphone' },
      setting: 'denied',
      origin: new URL(host.page.url()).origin
    })
    await share(host)
    await host.page.getByRole('button', { name: 'Start voice call', exact: true }).click()
    await voicePopover(host.page)
      .getByRole('button', { name: 'Start voice call', exact: true })
      .click()
    await expect(voicePopover(host.page).getByRole('alert')).toBeVisible()
    await expect(muteButton(host.page)).toHaveCount(0)
  } finally {
    await host?.context.close()
    await relay.close()
  }
})
