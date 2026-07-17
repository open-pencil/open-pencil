import { describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core/text'

describe('font lifecycle', () => {
  test('advances generation only for provider epochs and unique registrations', () => {
    const manager = new FontManager()
    const registrations: string[] = []
    const provider = {
      registerFont(_data: ArrayBuffer, family: string) {
        registrations.push(family)
      }
    } as TypefaceFontProvider
    const data = new ArrayBuffer(12)

    expect(manager.generation()).toBe(0)
    manager.attachProvider({} as CanvasKit, provider)
    const providerGeneration = manager.generation()
    manager.markLoaded('Generation Test', 'Regular', data)
    const registrationGeneration = manager.generation()
    manager.markLoaded('Generation Test', 'Regular', data)

    expect(providerGeneration).toBeGreaterThan(0)
    expect(registrationGeneration).toBeGreaterThan(providerGeneration)
    expect(manager.generation()).toBe(registrationGeneration)
    expect(registrations).toEqual(['Generation Test'])
  })

  test('keeps cumulative subset registrations under the source family', () => {
    const manager = new FontManager()
    const registrations: string[] = []
    const provider = {
      registerFont(_data: ArrayBuffer, family: string) {
        registrations.push(family)
      }
    } as TypefaceFontProvider

    manager.attachProvider({} as CanvasKit, provider)
    manager.markLoaded('Subset Font', 'Regular', new ArrayBuffer(8))
    const firstGeneration = manager.generation()
    manager.markLoaded('Subset Font', 'Regular', new ArrayBuffer(12))

    expect(manager.renderFamily('Subset Font', 'Regular')).toBe('Subset Font')
    expect(manager.generation()).toBeGreaterThan(firstGeneration)
    expect(registrations).toEqual(['Subset Font', 'Subset Font'])
  })

  test('tracks nodes gated by pre-render font resolution', () => {
    const manager = new FontManager()
    manager.blockNodesUntilFontsResolve(['first', 'second'])
    expect(manager.isNodeBlocked('first')).toBe(true)
    expect(manager.isNodeBlocked('second')).toBe(true)
    manager.unblockNodes(['first'])
    expect(manager.isNodeBlocked('first')).toBe(false)
    expect(manager.isNodeBlocked('second')).toBe(true)
  })
})
