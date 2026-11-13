import { describe, expect, test } from 'bun:test'

import { homeLocation, homeLocationChosen, type HomeLocation } from '@/app/home/location'

describe('Home location', () => {
  test('keeps Trash as a place Home can show', () => {
    const trash: HomeLocation = { kind: 'trash' }
    homeLocation.value = trash
    expect(homeLocation.value).toEqual(trash)
    expect(homeLocationChosen.value).toBe(true)
  })
})
