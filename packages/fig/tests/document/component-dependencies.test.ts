import { expect, test } from 'bun:test'

import { componentDependencies } from '#fig/document/component/dependencies'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('collects component dependencies from instances, inactive defaults and nested assignments', () => {
  const source = {
    symbolData: {
      symbolID: guid(1),
      symbolOverrides: [
        {
          overriddenSymbolID: guid(2),
          componentPropAssignments: [
            { defID: guid(90), varValue: { value: { symbolIdValue: { guid: guid(3) } } } }
          ]
        }
      ]
    },
    componentPropDefs: [
      { type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(4) } },
      { type: 'TEXT', initialValue: { textValue: '1:999' } }
    ],
    componentPropAssignments: [{ defID: guid(91), value: { guidValue: guid(1) } }]
  } as NodeChange
  const before = structuredClone(source)
  expect([...componentDependencies(source)].sort()).toEqual(['1:1', '1:2', '1:3', '1:4'])
  expect(source).toEqual(before)
})
