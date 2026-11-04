import { describe, expect, test } from 'bun:test'

import * as cloud from '@/app/cloud/integration'
import * as off from '@/app/cloud/integration/off'
import * as offStorage from '@/app/cloud/integration/off/storage'
import * as storage from '@/app/cloud/integration/storage'
import * as cloudComponents from '@/components/cloud/integration'
import * as offComponents from '@/components/cloud/integration/off'

// A build without Cloud swaps these modules in for the real ones, so they must type as them.
const offServices: typeof cloud = off
const offProviders: typeof storage = offStorage

describe('the build without Cloud', () => {
  test('offers every name the app imports from Cloud', () => {
    expect(Object.keys(off).sort()).toEqual(Object.keys(cloud).sort())
    expect(Object.keys(offStorage).sort()).toEqual(Object.keys(storage).sort())
    expect(Object.keys(offComponents).sort()).toEqual(Object.keys(cloudComponents).sort())
  })

  test('has no Cloud to show, start, or save to', async () => {
    expect(offServices.CLOUD_INCLUDED).toBe(false)
    expect(offProviders.CLOUD_STORAGE_PROVIDERS).toEqual([])
    expect(offServices.isCloudBinding(null)).toBe(false)
    expect(await offServices.cloudSaveDestinations()).toEqual([])
    expect(offServices.signInToSaveTo()).toBe(false)
    expect(offServices.useHomeCloud().signedIn.value).toBe(false)
  })
})
