/** @jsxImportSource @open-pencil/design-jsx */
import { describe, expect, test } from 'bun:test'

import { REKA_ELEMENTS } from '#design-jsx/behaviours'
import * as designJSX from '#design-jsx/index'
import { Component, Switch, Text } from '#design-jsx/index'
import { node } from '#design-jsx/tree'

describe('Reka elements in TSX', () => {
  test('build the same nodes the JSX string renderer reads', () => {
    const tree = (
      <Switch.Root name="Switch" modelValue="State">
        <Component name="State=Off">
          <Switch.Thumb w={20} />
        </Component>
      </Switch.Root>
    )
    expect(tree).toEqual(
      node('Switch.Root', {
        name: 'Switch',
        modelValue: 'State',
        children: [Component({ name: 'State=Off', children: [node('Switch.Thumb', { w: 20 })] })]
      })
    )
    expect(<Switch.Thumb />).toEqual(node('Switch.Thumb', {}))
    expect(Switch.Root({ name: 'Switch' }, Text({ children: 'On' })).children).toHaveLength(1)
  })

  test('every Reka namespace and part is exported', () => {
    const api: Record<string, unknown> = designJSX
    for (const [namespace, parts] of Object.entries(REKA_ELEMENTS))
      expect(Object.keys(api[namespace] ?? {})).toEqual(Object.keys(parts))
  })
})
