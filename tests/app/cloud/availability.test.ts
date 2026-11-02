import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import {
  cloudOfficialListed,
  checkCloudAvailability,
  isVersionAtLeast
} from '@/app/cloud/availability'
import { OFFICIAL_CLOUD_URL } from '@/constants'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
import { fetchStub } from '#tests/helpers/fetch'

const EDITOR = 'https://app.example.com/'

function officialServer(answer: () => Response) {
  spyOn(globalThis, 'fetch').mockImplementation(fetchStub(async () => answer()))
}

afterEach(async () => {
  officialServer(() => Response.error())
  await checkCloudAvailability(`${EDITOR}?cloud=off`)
})

describe('Cloud availability', () => {
  test('compares editor versions by number, not by text', () => {
    expect(isVersionAtLeast('0.14.0', '0.14.0')).toBe(true)
    expect(isVersionAtLeast('0.14.2', '0.14.0')).toBe(true)
    expect(isVersionAtLeast('0.10.0', '0.9.5')).toBe(true)
    expect(isVersionAtLeast('0.9.5', '0.10.0')).toBe(false)
    expect(isVersionAtLeast('1.0.0-beta.1', '1.0.0')).toBe(true)
    expect(isVersionAtLeast('next', '1.0.0')).toBe(false)
  })

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
