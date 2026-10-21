import { afterEach, describe, expect, test } from 'bun:test'

import { createMemoryHistory, createRouter } from 'vue-router'

import { homeLocation, setHomeLeaveGuard, type HomeLocation } from '@/app/home/location'
import {
  activeStorageProviderID,
  storageProviderRegistry,
  writeStoragePreference
} from '@/app/integrations/storage'
import { browseFiles } from '@/app/shell/menu/navigation'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { render: () => null } }]
})

/** Read through a function, as browsing changes it after the test set it. */
function shownLocation(): HomeLocation {
  return homeLocation.value
}

afterEach(() => {
  const providerID = activeStorageProviderID.value
  for (const field of storageProviderRegistry.get(providerID).preferenceFields) {
    writeStoragePreference(providerID, field.id, '')
  }
  homeLocation.value = { kind: 'recent' }
  setHomeLeaveGuard(null)
})

describe('browsing files from the File menu', () => {
  test('opens Home where it was left when no storage is set up', () => {
    homeLocation.value = { kind: 'shared' }

    browseFiles(router)

    expect(shownLocation()).toEqual({ kind: 'shared' })
  })

  test('never lands on Settings when browsing files', () => {
    homeLocation.value = { kind: 'settings' }

    browseFiles(router)

    expect(shownLocation()).toEqual({ kind: 'recent' })
  })

  test('opens Home on the storage bucket once it is set up', () => {
    const providerID = activeStorageProviderID.value
    for (const field of storageProviderRegistry.get(providerID).preferenceFields) {
      if (field.required) writeStoragePreference(providerID, field.id, 'configured')
    }
    homeLocation.value = { kind: 'recent' }

    browseFiles(router)

    expect(shownLocation()).toEqual({ kind: 'storage' })
  })

  test('waits for the shown page to agree before leaving it', () => {
    homeLocation.value = { kind: 'settings' }
    const held: (() => void)[] = []
    setHomeLeaveGuard((next) => held.push(next))

    browseFiles(router)
    expect(shownLocation()).toEqual({ kind: 'settings' })

    held[0]?.()
    expect(shownLocation()).toEqual({ kind: 'recent' })
  })
})
