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

  it('renders SVG element children for every supported primitive', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 100 100" size={100}>
        <path d="M0 0 L10 0" fill="#111" />
        <ellipse cx="50" cy="50" rx="20" ry="10" fill="#F00" />
        <circle cx="50" cy="50" r="10" fill="#0F0" />
        <rect x="1" y="1" width="9" height="9" rx="2" fill="#00F" />
        <line x1="10" y1="20" x2="30" y2="40" stroke="#123" />
        <polyline points="60,10 70,20 80,10" fill="none" stroke="#456" />
        <polygon points="60,60 80,60 70,80" fill="#789" />
      </svg>`
    )

    const vectors = [...g.nodes.values()].filter((node) => node.type === 'VECTOR')
    expect(vectors).toHaveLength(7)
    expect(vectors.filter((node) => node.fills.length > 0)).toHaveLength(6)
    expect(vectors.filter((node) => node.strokes.length > 0)).toHaveLength(2)
    expect(vectors.every((node) => (node.vectorNetwork?.vertices.length ?? 0) > 0)).toBe(true)
  })

  it('preserves root presentation and applies nested transforms', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 100 100" size={100} fill="#FF0000">
        <g transform="translate(30 20) scale(2)"><rect x="1" y="2" width="4" height="5" /></g>
      </svg>`
    )

    const vector = [...g.nodes.values()].find((node) => node.type === 'VECTOR')
    expect(vector?.fills[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(vector?.vectorNetwork?.vertices.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 32, y: 24 },
      { x: 40, y: 24 },
      { x: 40, y: 34 },
      { x: 32, y: 34 }
    ])
  })

  it('renders an SVG containing only a circle', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 24 24" size={24}><circle cx="12" cy="12" r="10" fill="#0F0" /></svg>`
    )

    const vectors = [...g.nodes.values()].filter((node) => node.type === 'VECTOR')
    expect(vectors).toHaveLength(1)
    expect(vectors[0].fills).toHaveLength(1)
  })

  it('renders open and closed SVG paths as separate stroked vectors', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 24 24" size={24}><path d="M2 2 L22 2" stroke="#000" fill="none" /><path d="M2 6 H22 V22 H2 Z" stroke="#000" fill="none" /></svg>`
    )
    const vectors = [...g.nodes.values()].filter((node) => node.type === 'VECTOR')
    expect(vectors).toHaveLength(2)
    for (const vector of vectors) {
      expect(vector.vectorNetwork?.vertices.length).toBeGreaterThan(0)
      expect(vector.strokes.length).toBeGreaterThan(0)
    }
  })

  it('respects none paints on inline SVG paths', async () => {
    const g = makeSceneGraph()
    await renderJSX(
      g,
      `<svg viewBox="0 0 24 24" w={24} h={24}>
        <path d="M2 2L22 22" fill="none" stroke="#021A3B" stroke-width="2" />
        <path d="M2 22L12 2L22 22Z" fill="#FF0000" stroke="none" />
      </svg>`
    )

    const vectors = [...g.nodes.values()].filter((node) => node.type === 'VECTOR')
    expect(vectors).toHaveLength(2)
    expect(vectors[0].fills).toEqual([])
    expect(vectors[0].strokes).toHaveLength(1)
    expect(vectors[1].fills).toHaveLength(1)
    expect(vectors[1].strokes).toEqual([])
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
