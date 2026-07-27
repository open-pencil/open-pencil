import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { makeSceneGraph } from '#tests/helpers/scene'

describe('jsx gaps', () => {
  it('mask prop sets isMask + maskType', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<Frame name="m" w={80} h={80}><Ellipse mask w={40} h={40} /><Rectangle w={80} h={80} bg="#f00" /></Frame>`
    )
    const ellipse = [...g.nodes.values()].find((n) => n.type === 'ELLIPSE')
    expect(ellipse?.isMask).toBe(true)
    expect(ellipse?.maskType).toBe('ALPHA')
  })

  it('svg element renders vector paths', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 24 24" w={24} h={24}><path d="M12 21s-7-4.5-9.5-9C0.5 8 2 4 6 4c2.5 0 4 1.5 6 3 2-1.5 3.5-3 6-3 4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg>`
    )
    const vector = [...g.nodes.values()].find((n) => n.type === 'VECTOR')
    expect(vector).toBeTruthy()
    expect(vector?.vectorNetwork).toBeTruthy()
  })

  it('instance overrides apply child text by name', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<Component name="Badge" w={60} h={24}><Text name="label">+0%</Text></Component>
       <Instance of="Badge" overrides={{ 'label:text': '+14%' }} />`
    )
    const inst = [...g.nodes.values()].find((n) => n.type === 'INSTANCE')
    const label = [...g.nodes.values()].find(
      (n) => n.type === 'TEXT' && inst && n.parentId === inst.id
    )
    expect(label?.text).toBe('+14%')
  })
})
