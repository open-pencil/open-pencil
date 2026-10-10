import type { Page } from '@playwright/test'

/** Chromium's fake microphone, standing in for a real one. */
export const FAKE_MICROPHONE_ARGS = [
  '--enable-unsafe-swiftshader',
  '--use-fake-device-for-media-stream'
]

export function voicePopover(page: Page) {
  return page.getByTestId('voice-call-popover')
}

/** The mute button beside the avatars, outside the call's popover. */
export function muteButton(page: Page, name: 'Mute' | 'Unmute' = 'Mute') {
  return page.getByTestId('voice-call').getByRole('button', { name, exact: true })
}
