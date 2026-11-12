import { afterEach, describe, expect, test } from 'bun:test'

import type { Effect } from '@open-pencil/scene-graph'
import { DEFAULT_GLASS } from '@open-pencil/scene-graph/constants'

import { createDefaultEffect, effectOptions, effectOptionsFor } from '#vue/controls/effects/helpers'
import { setLocale } from '#vue/i18n/locale'
import { panelMessageDefaults, panelMessages } from '#vue/i18n/messages/panels'

const glass: Effect = { ...createDefaultEffect(), type: 'GLASS', glass: { ...DEFAULT_GLASS } }
const offersGlass = (effects: Effect[], index: number) =>
  effectOptionsFor(effects, index).some((option) => option.value === 'GLASS')

describe('effect type options', () => {
  test('glass is offered only where no other row holds it', () => {
    const effects = [glass, createDefaultEffect()]
    expect(offersGlass(effects, 0)).toBe(true)
    expect(offersGlass(effects, 1)).toBe(false)
    expect(offersGlass([createDefaultEffect()], 0)).toBe(true)
  })

  test('every glass row keeps glass when a script gave the layer several', () => {
    const effects = [glass, glass]
    expect(offersGlass(effects, 0)).toBe(true)
    expect(offersGlass(effects, 1)).toBe(true)
  })
})

describe('effect type labels', () => {
  afterEach(() => setLocale('en'))

  /** The labels `effectOptions` gives, beside the active catalog's, in the same order. */
  const labelsBesideCatalog = () => {
    const catalog = panelMessages.get()
    return {
      labels: effectOptions().map((option) => option.label),
      catalog: [
        catalog.dropShadow,
        catalog.innerShadow,
        catalog.layerBlur,
        catalog.backgroundBlur,
        catalog.foregroundBlur,
        catalog.glass
      ]
    }
  }

  test('follow the language once its translations load', async () => {
    const before = labelsBesideCatalog()
    expect(before.labels).toEqual(before.catalog)
    const english = panelMessages.get()
    setLocale('de')
    // The catalog is replaced when the German translations arrive.
    await new Promise<void>((resolve) => {
      const stop = panelMessages.subscribe((messages) => {
        if (messages === english) return
        queueMicrotask(() => stop())
        resolve()
      })
    })
    expect(panelMessages.get().dropShadow).not.toBe(panelMessageDefaults.dropShadow)
    const after = labelsBesideCatalog()
    expect(after.labels).toEqual(after.catalog)
  })
})
