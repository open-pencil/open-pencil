import { describe, test, expect } from 'bun:test'

import { importNodeChanges, type NodeChange } from '@open-pencil/core'

const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
const SIZE = { x: 100, y: 100 }

function nc(
  sessionID: number,
  localID: number,
  type: string,
  parentSessionID: number,
  parentLocalID: number,
  name: string,
  extra: Record<string, unknown> = {}
): NodeChange {
  return {
    guid: { sessionID, localID },
    parentIndex: {
      guid: { sessionID: parentSessionID, localID: parentLocalID },
      position: String.fromCharCode(33 + localID)
    },
    type,
    name,
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    size: SIZE,
    transform: ID,
    ...extra
  } as NodeChange
}

function guid(s: number, l: number) {
  return { sessionID: s, localID: l }
}

/**
 * Build a minimal fig structure for testing instance swap overrides:
 *
 *   Document (0:0)
 *   ├── InternalPage (0:1) [internalOnly]
 *   │   ├── IconA COMPONENT (0:10) — children: VectorA (0:11)
 *   │   ├── IconB COMPONENT (0:20) — children: VectorB (0:21)
 *   │   └── Button COMPONENT (0:30) — children: Icon INSTANCE→IconA (0:31)
 *   └── Page1 (0:2)
 *       └── ButtonInstance INSTANCE→Button (0:40)
 *           symbolOverride: swap Icon to IconB
 */
function swapOverrideFixture(opts?: { customName?: string }): NodeChange[] {
  return [
    nc(0, 0, 'DOCUMENT', 0, 0, 'Document'),
    nc(0, 1, 'CANVAS', 0, 0, 'InternalPage', { internalOnly: true }),
    nc(0, 2, 'CANVAS', 0, 0, 'Page1'),

    // IconA component with a vector child
    nc(0, 10, 'COMPONENT', 0, 1, 'IconA'),
    nc(0, 11, 'VECTOR', 0, 10, 'VectorA'),

    // IconB component with a vector child
    nc(0, 20, 'COMPONENT', 0, 1, 'IconB'),
    nc(0, 21, 'VECTOR', 0, 20, 'VectorB'),

    // Button component containing an Icon instance pointing to IconA
    nc(0, 30, 'COMPONENT', 0, 1, 'Button'),
    nc(0, 31, 'INSTANCE', 0, 30, opts?.customName ?? 'IconA', {
      symbolData: { symbolID: guid(0, 10) }
    }),

    // Visible-page instance of Button with a swap override: Icon→IconB
    nc(0, 40, 'INSTANCE', 0, 2, 'ButtonInstance', {
      symbolData: {
        symbolID: guid(0, 30),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(0, 31)] },
            overriddenSymbolID: guid(0, 20)
          }
        ]
      }
    })
  ]
}

describe('instance swap overrides', () => {
  test('swap override renames icon and reclones children', () => {
    const graph = importNodeChanges(swapOverrideFixture())
    const page = graph.getPages().find((p) => p.name === 'Page1')!
    const button = graph.getChildren(page.id)[0]
    expect(button.name).toBe('ButtonInstance')

    const icon = graph.getChildren(button.id)[0]
    expect(icon.name).toBe('IconB')
    expect(icon.type).toBe('INSTANCE')

    const iconChildren = graph.getChildren(icon.id)
    expect(iconChildren.length).toBe(1)
    expect(iconChildren[0].name).toBe('VectorB')
  })

  test('swap override preserves user-given name', () => {
    const graph = importNodeChanges(swapOverrideFixture({ customName: 'MyCustomIcon' }))
    const page = graph.getPages().find((p) => p.name === 'Page1')!
    const button = graph.getChildren(page.id)[0]
    const icon = graph.getChildren(button.id)[0]

    // Name was "MyCustomIcon" which doesn't match root component "IconA",
    // so it should NOT be renamed to "IconB"
    expect(icon.name).toBe('MyCustomIcon')

    // Children should still be swapped to IconB's children
    const iconChildren = graph.getChildren(icon.id)
    expect(iconChildren.length).toBe(1)
    expect(iconChildren[0].name).toBe('VectorB')
  })

  test('swap propagates transitively through 2-level clone chain', () => {
    // Add a second instance that clones the first button instance
    const nodes = [
      ...swapOverrideFixture(),
      // Wrapper COMPONENT on internal page that contains a Button instance
      nc(0, 50, 'COMPONENT', 0, 1, 'Wrapper'),
      nc(0, 51, 'INSTANCE', 0, 50, 'ButtonInstance', {
        symbolData: { symbolID: guid(0, 30) }
      }),
      // WrapperInstance on visible page with swap override on the button's icon
      nc(0, 60, 'INSTANCE', 0, 2, 'WrapperInstance', {
        symbolData: {
          symbolID: guid(0, 50),
          symbolOverrides: [
            {
              guidPath: { guids: [guid(0, 51), guid(0, 31)] },
              overriddenSymbolID: guid(0, 20)
            }
          ]
        }
      })
    ]

    const graph = importNodeChanges(nodes)
    const page = graph.getPages().find((p) => p.name === 'Page1')!
    const children = graph.getChildren(page.id)

    const wrapper = children.find((c) => c.name === 'WrapperInstance')!
    expect(wrapper).toBeDefined()

    // WrapperInstance > ButtonInstance > icon
    const wrapperButton = graph.getChildren(wrapper.id)[0]
    expect(wrapperButton.name).toBe('ButtonInstance')

    const icon = graph.getChildren(wrapperButton.id)[0]
    expect(icon.name).toBe('IconB')

    const iconChildren = graph.getChildren(icon.id)
    expect(iconChildren.length).toBe(1)
    expect(iconChildren[0].name).toBe('VectorB')
  })

  test('swap propagates to sibling clone at same level', () => {
    // Two Button instances on the visible page, both cloning the same component.
    // Only one has a swap override — the other should keep the default icon.
    const nodes: NodeChange[] = [
      ...swapOverrideFixture(),
      // Second ButtonInstance with NO swap override
      nc(0, 41, 'INSTANCE', 0, 2, 'ButtonDefault', {
        symbolData: { symbolID: guid(0, 30) }
      })
    ]

    const graph = importNodeChanges(nodes)
    const page = graph.getPages().find((p) => p.name === 'Page1')!
    const children = graph.getChildren(page.id)

    const swapped = children.find((c) => c.name === 'ButtonInstance')!
    const swappedIcon = graph.getChildren(swapped.id)[0]
    expect(swappedIcon.name).toBe('IconB')

    const defaultBtn = children.find((c) => c.name === 'ButtonDefault')!
    const defaultIcon = graph.getChildren(defaultBtn.id)[0]
    expect(defaultIcon.name).toBe('IconA')
  })

  test('transitive propagation: clone of swapped clone gets swap', () => {
    // ButtonInstance (swap Icon→IconB) on internal page,
    // then ButtonClone on visible page clones ButtonInstance.
    // ButtonClone's icon should also be IconB.
    const nodes: NodeChange[] = [
      nc(0, 0, 'DOCUMENT', 0, 0, 'Document'),
      nc(0, 1, 'CANVAS', 0, 0, 'InternalPage', { internalOnly: true }),
      nc(0, 2, 'CANVAS', 0, 0, 'Page1'),

      nc(0, 10, 'COMPONENT', 0, 1, 'IconA'),
      nc(0, 11, 'VECTOR', 0, 10, 'VectorA'),
      nc(0, 20, 'COMPONENT', 0, 1, 'IconB'),
      nc(0, 21, 'VECTOR', 0, 20, 'VectorB'),

      // Button component: children = Icon INSTANCE→IconA
      nc(0, 30, 'COMPONENT', 0, 1, 'Button'),
      nc(0, 31, 'INSTANCE', 0, 30, 'IconA', {
        symbolData: { symbolID: guid(0, 10) }
      }),

      // ButtonSwapped: instance of Button on internal page with swap
      nc(0, 40, 'INSTANCE', 0, 1, 'ButtonSwapped', {
        symbolData: {
          symbolID: guid(0, 30),
          symbolOverrides: [
            {
              guidPath: { guids: [guid(0, 31)] },
              overriddenSymbolID: guid(0, 20)
            }
          ]
        }
      }),

      // Container component on internal page wrapping ButtonSwapped
      nc(0, 50, 'COMPONENT', 0, 1, 'Container'),
      nc(0, 51, 'INSTANCE', 0, 50, 'ButtonSwapped', {
        symbolData: { symbolID: guid(0, 40) }
      }),

      // Visible-page instance of Container
      nc(0, 60, 'INSTANCE', 0, 2, 'ContainerInstance', {
        symbolData: { symbolID: guid(0, 50) }
      })
    ]

    const graph = importNodeChanges(nodes)
    const page = graph.getPages().find((p) => p.name === 'Page1')!
    const container = graph.getChildren(page.id)[0]

    // ContainerInstance > ButtonSwapped > icon
    const button = graph.getChildren(container.id)[0]
    const icon = graph.getChildren(button.id)[0]
    expect(icon.name).toBe('IconB')

    const iconChildren = graph.getChildren(icon.id)
    expect(iconChildren.length).toBe(1)
    expect(iconChildren[0].name).toBe('VectorB')
  })
})
