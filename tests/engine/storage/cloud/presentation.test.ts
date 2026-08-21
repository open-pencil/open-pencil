import { describe, expect, test } from 'bun:test'

import { cloudConnectionPresentation } from '@/app/integrations/storage/cloud/presentation'

describe('Cloud connection presentation', () => {
  test.each([
    ['connected', 'Connected', 'open-workspace'],
    ['unauthenticated', 'Sign in required', 'sign-in'],
    ['authentication-required', 'Reauthentication required', 'reauthenticate'],
    ['discovering', 'Connecting…', 'retry'],
    ['offline', 'Offline', 'retry'],
    ['error', 'Connection error', 'retry'],
    ['disconnected', 'Disconnected', 'reconnect']
  ] as const)('%s maps to an actionable status', (status, label, primaryAction) => {
    expect(cloudConnectionPresentation(status)).toMatchObject({ label, primaryAction })
  })
})
