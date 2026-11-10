import { afterEach, describe, expect, test } from 'bun:test'

import type { Effect } from '@open-pencil/scene-graph'
import { DEFAULT_GLASS } from '@open-pencil/scene-graph/constants'

import { createDefaultEffect, effectOptions, effectOptionsFor } from '#vue/controls/effects/helpers'
import { setLocale } from '#vue/i18n/locale'
import { panelMessages } from '#vue/i18n/messages'

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

  test('follow the language once its translations load', async () => {
    const label = (type: string) => effectOptions().find((option) => option.value === type)?.label
    expect(label('DROP_SHADOW')).toBe('Drop shadow')
    setLocale('de')
    // The panel messages switch when the German translations arrive.
    await new Promise<void>((resolve) => {
      const stop = panelMessages.subscribe((messages) => {
        if (messages.dropShadow === 'Drop shadow') return
        queueMicrotask(() => stop())
        resolve()
      })
    })
    expect(label('DROP_SHADOW')).toBe('Schlagschatten')
    expect(label('LAYER_BLUR')).toBe('Ebenenunschärfe')
  })
})
