import { describe, expect, test } from 'bun:test'

import { cloudConnectionPresentation } from '@/app/integrations/storage/cloud/presentation'

describe('Cloud connection presentation', () => {
  test.each([
    ['connected', 'open-workspace'],
    ['unauthenticated', 'sign-in'],
    ['authentication-required', 'reauthenticate'],
    ['discovering', 'retry'],
    ['offline', 'retry'],
    ['error', 'retry'],
    ['disconnected', 'reconnect']
  ] as const)('%s maps to an actionable status', (status, primaryAction) => {
    expect(cloudConnectionPresentation(status)).toMatchObject({ status, primaryAction })
  })
})
