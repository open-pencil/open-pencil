import { describe, expect, test } from 'bun:test'

import { createDemoShapes } from '@/app/demo/document'
import { createEditorStore } from '@/app/editor/session'

describe('demo document', () => {
  test('builds the component library and analytics showcase', () => {
    const store = createEditorStore()

    createDemoShapes(store)

    const nodes = [...store.graph.getAllNodes()]
    expect(nodes.some((node) => node.name === 'Component Library')).toBe(true)
    expect(nodes.some((node) => node.name === 'App — Analytics')).toBe(true)
    expect(nodes.some((node) => node.name === 'Chart')).toBe(true)
    expect(nodes.filter((node) => node.type === 'COMPONENT').length).toBeGreaterThanOrEqual(6)
    expect(nodes.filter((node) => node.type === 'INSTANCE').length).toBeGreaterThan(6)
    expect(store.graph.variables.size).toBeGreaterThan(0)
  })
})
