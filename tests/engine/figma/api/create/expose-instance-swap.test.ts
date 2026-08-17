import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('exposeInstanceSwap', () => {
  test('adds an INSTANCE_SWAP property to the host component and tags the slot', () => {
    const api = createAPI()
    const host = api.createComponent()
    host.name = 'Button'
    host.resize(120, 40)

    const iconA = api.createComponent()
    iconA.name = 'Icon/A'
    iconA.resize(16, 16)
    const iconB = api.createComponent()
    iconB.name = 'Icon/B'
    iconB.resize(16, 16)

    const slot = iconA.createInstance()
    host.appendChild(slot)

    const result = api.exposeInstanceSwap([slot], [iconA, iconB], 'Icon')
    const raw = api.graph.getNode(result.id)

    expect(result.id).toBe(host.id)
    expect(raw?.componentPropertyDefinitions?.length).toBe(1)
    expect(raw?.componentPropertyDefinitions?.[0].type).toBe('INSTANCE_SWAP')
    expect(raw?.componentPropertyDefinitions?.[0].preferredValues?.slice().sort()).toEqual(
      [iconA.id, iconB.id].sort()
    )

    const slotRaw = api.graph.getNode(slot.id)
    expect(slotRaw?.componentPropertyReferences?.length).toBe(1)
    expect(slotRaw?.componentPropertyReferences?.[0].field).toBe('INSTANCE_SWAP')
  })

  test('shares one property across slots in different variants of the same set', () => {
    const api = createAPI()
    const a = api.createComponent()
    a.name = 'Primary'
    a.resize(120, 40)
    const b = api.createComponent()
    b.name = 'Secondary'
    b.resize(120, 40)

    const icon = api.createComponent()
    icon.name = 'Icon/A'
    icon.resize(16, 16)

    const slotA = icon.createInstance()
    a.appendChild(slotA)
    const slotB = icon.createInstance()
    b.appendChild(slotB)

    const set = api.graph.createNode('COMPONENT_SET', api.currentPageId, { name: 'Button' })
    api.graph.reparentNode(a.id, set.id)
    api.graph.reparentNode(b.id, set.id)
    const result = api.exposeInstanceSwap([slotA, slotB], [icon], 'Icon')

    expect(result.id).toBe(set.id)
    const raw = api.graph.getNode(set.id)
    expect(raw?.componentPropertyDefinitions?.some((d) => d.type === 'INSTANCE_SWAP')).toBe(true)
  })

  test('rejects non-instance slots', () => {
    const api = createAPI()
    const host = api.createComponent()
    const icon = api.createComponent()
    const frame = api.createFrame()
    host.appendChild(frame)
    expect(() => api.exposeInstanceSwap([frame], [icon])).toThrow()
  })

  test('rejects non-component candidates', () => {
    const api = createAPI()
    const host = api.createComponent()
    const icon = api.createComponent()
    const slot = icon.createInstance()
    host.appendChild(slot)
    const notAComponent = api.createFrame()
    expect(() => api.exposeInstanceSwap([slot], [notAComponent])).toThrow()
  })

  test('rejects slots from unrelated hosts', () => {
    const api = createAPI()
    const hostA = api.createComponent()
    hostA.resize(100, 40)
    const hostB = api.createComponent()
    hostB.resize(100, 40)
    const icon = api.createComponent()
    icon.resize(16, 16)
    const slotA = icon.createInstance()
    hostA.appendChild(slotA)
    const slotB = icon.createInstance()
    hostB.appendChild(slotB)
    expect(() => api.exposeInstanceSwap([slotA, slotB], [icon])).toThrow()
  })
})
