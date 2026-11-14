import { describe, expect, test } from 'bun:test'

import { storagePreset, withPreset } from '@/app/integrations/storage/preferences'

describe('storage preset', () => {
  test('a build with an endpoint and a bucket presets both for S3 storage', () => {
    expect(
      storagePreset({
        VITE_STORAGE_PRESET_ENDPOINT: ' https://files.example.com ',
        VITE_STORAGE_PRESET_BUCKET: 'designs'
      })
    ).toEqual({ 's3-compatible': { endpoint: 'https://files.example.com', bucket: 'designs' } })
  })

  test('a build missing either value presets nothing', () => {
    expect(storagePreset({ VITE_STORAGE_PRESET_ENDPOINT: 'https://files.example.com' })).toEqual({})
    expect(storagePreset({ VITE_STORAGE_PRESET_BUCKET: 'designs' })).toEqual({})
    expect(storagePreset({})).toEqual({})
  })

  test('saved values win and the preset fills only missing or empty fields', () => {
    const preset = { endpoint: 'https://files.example.com', bucket: 'designs' }
    expect(withPreset({ bucket: 'mine', region: '' }, preset)).toEqual({
      endpoint: 'https://files.example.com',
      bucket: 'mine'
    })
    expect(withPreset({ endpoint: '  ' }, preset)).toEqual(preset)
    expect(withPreset(undefined, undefined)).toEqual({})
  })
})
