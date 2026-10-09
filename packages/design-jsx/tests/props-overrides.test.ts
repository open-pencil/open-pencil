import { describe, expect, test } from 'bun:test'

import { designJSXProp } from '#design-jsx/index'
import { propsToOverrides } from '#design-jsx/props-overrides'

describe('property names', () => {
  test('reads the first name of a property that is set', () => {
    expect(designJSXProp({ width: 10 }, 'w')).toBe(10)
    expect(designJSXProp({ w: 20, width: 10 }, 'w')).toBe(20)
    expect(designJSXProp({ fill: '#000', backgroundColor: '#FFF' }, 'bg')).toBe('#000')
  })

  test('an attribute under any of its names wins over style', () => {
    const overrides = propsToOverrides(
      { width: 100, style: { width: '200px', height: '50px', borderRadius: 8 } },
      false,
      'NONE'
    )

    expect(overrides).toMatchObject({ width: 100, height: 50, cornerRadius: 8 })
  })
})

describe('stack alignment', () => {
  test('CSS justify and align keywords mean what the short names do', () => {
    expect(
      propsToOverrides({ flex: 'row', justifyContent: 'space-between' }, false, 'NONE')
    ).toMatchObject({
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    expect(propsToOverrides({ flex: 'row', justify: 'between' }, false, 'NONE')).toMatchObject({
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    expect(propsToOverrides({ flex: 'row', alignItems: 'flex-end' }, false, 'NONE')).toMatchObject({
      counterAxisAlign: 'MAX'
    })
  })

  test('items can align children by their baseline', () => {
    expect(propsToOverrides({ flex: 'row', items: 'baseline' }, false, 'NONE')).toMatchObject({
      counterAxisAlign: 'BASELINE'
    })
  })
})
