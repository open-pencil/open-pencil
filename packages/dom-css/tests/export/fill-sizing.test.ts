import { describe, expect, it } from 'bun:test'

import { sceneNodeToDesignDocument, type DesignNode } from '@open-pencil/dom-css/export'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function styleOf(nodes: DesignNode[], name: string): Record<string, string> | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.sourceSceneNode?.name === name) return node.inlineStyle
    const found = styleOf(node.children, name)
    if (found) return found
  }
  return undefined
}

function exportParent(layout: Partial<SceneNode>, children: Partial<SceneNode>[]) {
  const graph = new SceneGraph()
  const parent = graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Parent',
    width: 300,
    height: 200,
    ...layout
  })
  for (const child of children) graph.createNode('FRAME', parent.id, child)
  return sceneNodeToDesignDocument(graph, parent.id).children
}

describe('fill sizing in DOM/CSS export', () => {
  it('leaves out the size a flex child stretches across, so align-self can stretch it', () => {
    const doc = exportParent({ layoutMode: 'HORIZONTAL' }, [
      { name: 'Tall', width: 40, height: 50, layoutAlignSelf: 'STRETCH' },
      { name: 'Wide', width: 40, height: 50, layoutGrow: 1 }
    ])

    expect(styleOf(doc, 'Tall')).toMatchObject({ width: '40px', 'align-self': 'stretch' })
    expect(styleOf(doc, 'Tall')?.height).toBeUndefined()
    // Along the row, fill is flex-grow and the size stays as its basis.
    expect(styleOf(doc, 'Wide')).toMatchObject({ width: '40px', height: '50px', 'flex-grow': '1' })
  })

  it('leaves out the size of each axis a grid child fills', () => {
    const doc = exportParent(
      {
        layoutMode: 'GRID',
        gridTemplateColumns: [
          { sizing: 'FR', value: 1 },
          { sizing: 'FR', value: 1 }
        ]
      },
      [
        { name: 'Wide', width: 40, height: 50, layoutGrow: 1 },
        { name: 'Tall', width: 40, height: 50, layoutAlignSelf: 'STRETCH' }
      ]
    )

    expect(styleOf(doc, 'Wide')?.width).toBeUndefined()
    expect(styleOf(doc, 'Wide')?.height).toBe('50px')
    expect(styleOf(doc, 'Tall')?.width).toBe('40px')
    expect(styleOf(doc, 'Tall')?.height).toBeUndefined()
  })
})

describe('auto layout sizes in DOM/CSS export', () => {
  const child = { name: 'Child', width: 40, height: 50 }
  const shrink = (layout: Partial<SceneNode>, over: Partial<SceneNode> = {}) =>
    styleOf(exportParent(layout, [{ ...child, ...over }]), 'Child')?.['flex-shrink']

  it('keeps a layer that does not fill from shrinking, so it overflows as auto layout lets it', () => {
    expect(shrink({ layoutMode: 'HORIZONTAL' })).toBe('0')
    expect(shrink({ layoutMode: 'VERTICAL', primaryAxisSizing: 'FIXED' })).toBe('0')
    expect(shrink({ layoutMode: 'VERTICAL', primaryAxisSizing: 'HUG', maxHeight: 40 })).toBe('0')
  })

  it('says nothing of a layer that fills, is placed, or has a column that hugs it', () => {
    expect(shrink({ layoutMode: 'HORIZONTAL' }, { layoutGrow: 1 })).toBeUndefined()
    expect(shrink({ layoutMode: 'HORIZONTAL' }, { layoutPositioning: 'ABSOLUTE' })).toBeUndefined()
    expect(shrink({ layoutMode: 'VERTICAL', primaryAxisSizing: 'HUG' })).toBeUndefined()
    expect(shrink({ layoutMode: 'NONE' })).toBeUndefined()
  })

  it('drops the gap space between takes the place of, keeping the space between wrapped lines', () => {
    const between = {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlign: 'SPACE_BETWEEN',
      itemSpacing: 16
    } as const
    const style = (layout: Partial<SceneNode>) => styleOf(exportParent(layout, [child]), 'Parent')
    expect(style(between)).not.toHaveProperty('gap')
    expect(style(between)).not.toHaveProperty('row-gap')
    const wrapped = style({ ...between, layoutWrap: 'WRAP', counterAxisSpacing: 8 })
    expect(wrapped).toMatchObject({ 'row-gap': '8px' })
    expect(wrapped).not.toHaveProperty('column-gap')
    expect(style({ ...between, layoutWrap: 'WRAP', counterAxisSpacing: null })).toMatchObject({
      'row-gap': '16px'
    })
    expect(style({ ...between, primaryAxisAlign: 'MIN' })).toMatchObject({ gap: '16px' })
  })
})

describe('canvas metrics, as preview projects', () => {
  const stroke = {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    weight: 2,
    align: 'INSIDE'
  } as const
  function padding(over: Partial<SceneNode>, exact = true) {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      name: 'Frame',
      layoutMode: 'VERTICAL',
      strokes: [stroke],
      paddingTop: 1,
      paddingRight: 24,
      paddingBottom: 1,
      paddingLeft: 24,
      ...over
    })
    const canvasMetrics = exact ? { autoLineHeight: () => undefined } : undefined
    return styleOf(sceneNodeToDesignDocument(graph, frame.id, { canvasMetrics }).children, 'Frame')
  }

  it('takes the room of a stroke the layout leaves out from the padding, down to none', () => {
    const style = padding({})
    expect(style).toMatchObject({ 'padding-inline': '22px' })
    expect(style).not.toHaveProperty('padding-block')
    expect(padding({ strokesIncludedInLayout: true })).toMatchObject({
      'padding-block': '1px',
      'padding-inline': '24px'
    })
    expect(padding({}, false)).toMatchObject({ 'padding-block': '1px', 'padding-inline': '24px' })
  })

  it('writes the measured line height of text with an automatic one, and only then', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, { name: 'Text', text: 'Hi' })
    const lineHeight = (canvasMetrics?: { autoLineHeight: () => number }) =>
      styleOf(sceneNodeToDesignDocument(graph, text.id, { canvasMetrics }).children, 'Text')?.[
        'line-height'
      ]
    expect(lineHeight()).toBeUndefined()
    expect(lineHeight({ autoLineHeight: () => 18 })).toBe('18px')
    graph.updateNode(text.id, { lineHeight: { value: 30, unit: 'PIXELS' } })
    expect(lineHeight({ autoLineHeight: () => 18 })).toBe('30px')
  })
})
