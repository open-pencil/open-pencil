import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { fetchStub } from '@open-pencil/test-support/fetch'

import { cloudOfficialListed, checkCloudAvailability } from '@/app/cloud/availability'
import { OFFICIAL_CLOUD_URL } from '@/constants'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
const EDITOR = 'https://app.example.com/'

function officialServer(answer: () => Response) {
  spyOn(globalThis, 'fetch').mockImplementation(fetchStub(async () => answer()))
}

afterEach(async () => {
  officialServer(() => Response.error())
  await checkCloudAvailability(`${EDITOR}?cloud=off`)
})

describe('Cloud availability', () => {
  test('stays hidden while the official server is unreachable or unlisted', async () => {
    officialServer(() => Response.error())
    await checkCloudAvailability(EDITOR)
    expect(cloudOfficialListed.value).toBe(false)
  })

  test('a preview link shows Cloud on this device until it is turned off', async () => {
    officialServer(() => Response.error())
    await checkCloudAvailability(`${EDITOR}?cloud=preview`)
    expect(cloudOfficialListed.value).toBe(true)
    await checkCloudAvailability(EDITOR)
    expect(cloudOfficialListed.value).toBe(true)
    await checkCloudAvailability(`${EDITOR}?cloud=off`)
    expect(cloudOfficialListed.value).toBe(false)
  })

  test('shows Cloud once the official server lists itself for this editor version', async () => {
    officialServer(() =>
      Response.json({
        ...cloudDiscoveryFixture(OFFICIAL_CLOUD_URL),
        deployment: 'official',
        // Tests run as editor version 0.0.0.
        listing: { minimumEditorVersion: '0.0.0' }
      })
    )
    await checkCloudAvailability(EDITOR)
    expect(cloudOfficialListed.value).toBe(true)
  })
})
