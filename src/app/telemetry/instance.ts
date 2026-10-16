import { feedback } from '@/app/feedback/client'
import { appPreferences } from '@/app/settings/preferences/store'

import { currentBuild } from './build'
import { createSharingClient } from './client'
import { FEEDBACK_ENABLED } from './config'
import { sharingDisabledByEnvironment, sharingState } from './state'

async function accepted(request: Promise<Pick<Response, 'ok'>>): Promise<boolean> {
  const response = await request.catch(() => null)
  return response?.ok ?? false
}

/** The app's one sharing client, sending to the feedback service when the build allows. */
export const sharingClient = createSharingClient({
  enabled: FEEDBACK_ENABLED,
  preferences: () => appPreferences.value.sharing,
  state: sharingState,
  build: currentBuild,
  disabledByEnvironment: sharingDisabledByEnvironment,
  send: {
    ping: (ping) => accepted(feedback.ping.$post({ json: ping })),
    ingest: (batch, { keepalive }) =>
      accepted(feedback.ingest.$post({ json: batch }, { init: { keepalive } }))
  }
})
