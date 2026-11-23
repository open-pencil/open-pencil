import { describe, expect, test } from 'bun:test'

import { isMovingSite, movedURL } from '@/app/cloud/moving'
import { OFFICIAL_CLOUD_URL } from '@/constants'

describe('moving to the Cloud site', () => {
  test('opens the same page there: a room, a share link, or the tour', () => {
    const cloud = new URL(OFFICIAL_CLOUD_URL).origin
    expect(movedURL({ pathname: '/rooms/abc', search: '', hash: '' })).toBe(`${cloud}/rooms/abc`)
    expect(movedURL({ pathname: '/share/s1', search: '?view=1', hash: '#c' })).toBe(
      `${cloud}/share/s1?view=1#c`
    )
    expect(movedURL({ pathname: '/demo', search: '', hash: '' })).toBe(`${cloud}/demo`)
  })

  test('stays on the Cloud site whatever the path', () => {
    const cloud = new URL(OFFICIAL_CLOUD_URL).origin
    const moved = new URL(
      movedURL({ pathname: '//elsewhere.example/rooms/abc', search: '', hash: '' })
    )
    expect(moved.origin).toBe(cloud)
    expect(moved.pathname).toBe('//elsewhere.example/rooms/abc')
  })

  test('says so only at the old address', () => {
    expect(isMovingSite('https://cloud.openpencil.dev')).toBe(false)
    expect(isMovingSite('http://localhost:1420')).toBe(false)
  })
})
