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

describe('grid tracks in DOM/CSS export', () => {
  it('keeps tracks that hug their cells from stretching into a larger grid', () => {
    const grid = (tracks: Partial<SceneNode>) =>
      styleOf(exportParent({ layoutMode: 'GRID', ...tracks }, []), 'Parent')
    const hug = { sizing: 'AUTO', value: 0 } as const
    const flex = { sizing: 'FR', value: 1 } as const
    expect(grid({ gridTemplateRows: [hug, hug], gridTemplateColumns: [flex] })).toMatchObject({
      'align-content': 'start'
    })
    expect(grid({ gridTemplateColumns: [hug, flex] })).toMatchObject({ 'justify-content': 'start' })
    const flexible = grid({ gridTemplateRows: [flex], gridTemplateColumns: [flex] })
    expect(flexible).not.toHaveProperty('align-content')
    expect(flexible).not.toHaveProperty('justify-content')
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
    const hugs = { layoutMode: 'VERTICAL', primaryAxisSizing: 'HUG' } as const
    expect(shrink({ ...hugs, layoutGrow: 1 })).toBe('0')
    expect(shrink({ ...hugs, layoutAlignSelf: 'STRETCH' })).toBe('0')
    expect(shrink({ ...hugs, verticalConstraint: 'STRETCH' })).toBe('0')
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
    const packed = { ...between, primaryAxisAlign: 'MIN' } as const
    expect(style(packed)).toMatchObject({ gap: '16px' })
    // A spacing of none between wrapped lines is one, where an unset spacing follows the items'.
    const joined = style({ ...packed, layoutWrap: 'WRAP', counterAxisSpacing: 0 })
    expect(joined).toMatchObject({ 'column-gap': '16px' })
    expect(joined).not.toHaveProperty('gap')
    expect(joined).not.toHaveProperty('row-gap')
    expect(style({ ...packed, layoutWrap: 'WRAP', counterAxisSpacing: null })).toMatchObject({
      gap: '16px'
    })
  })
})

describe('auto layout as the canvas lays it out, in DOM/CSS export', () => {
  const box = { width: 40, height: 40 }
  const frameStyle = (layout: Partial<SceneNode>, children: Partial<SceneNode>[] = []) =>
    styleOf(exportParent(layout, children), 'Parent')

  it('keeps the size of a hugging frame with nothing to hug', () => {
    const hugs = {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    } as const
    expect(frameStyle(hugs)).toMatchObject({ width: '300px', height: '200px' })
    expect(frameStyle(hugs, [{ name: 'A', ...box }])).not.toHaveProperty('width')
  })

  it('packs wrapped lines where the frame aligns its children, or spreads them apart', () => {
    const wraps = { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP' } as const
    expect(frameStyle(wraps)).toMatchObject({ 'align-content': 'flex-start' })
    expect(frameStyle({ ...wraps, counterAxisAlign: 'CENTER' })).toMatchObject({
      'align-content': 'center'
    })
    expect(frameStyle({ ...wraps, counterAxisAlignContent: 'SPACE_BETWEEN' })).toMatchObject({
      'align-content': 'space-between'
    })
    expect(frameStyle({ layoutMode: 'HORIZONTAL' })).not.toHaveProperty('align-content')
  })

  it('overlaps children by a negative gap, which the frame takes back at its end', () => {
    const layout = { layoutMode: 'HORIZONTAL', itemSpacing: -10, paddingRight: 4 } as const
    const doc = exportParent(layout, [
      { name: 'A', ...box },
      { name: 'B', ...box }
    ])
    expect(styleOf(doc, 'A')).toMatchObject({ 'margin-right': '-10px' })
    expect(styleOf(doc, 'B')).toMatchObject({ 'margin-right': '-10px' })
    expect(styleOf(doc, 'Parent')).toMatchObject({ 'padding-right': '14px' })
    const column = exportParent({ ...layout, layoutMode: 'VERTICAL' }, [
      { name: 'A', ...box },
      { name: 'B', ...box }
    ])
    expect(styleOf(column, 'A')).toMatchObject({ 'margin-bottom': '-10px' })
    // A row that inherits right to left ends on its left.
    const graph = new SceneGraph()
    const outer = graph.createNode('FRAME', graph.getPages()[0].id, {
      name: 'Outer',
      layoutMode: 'VERTICAL',
      layoutDirection: 'RTL'
    })
    const inner = graph.createNode('FRAME', outer.id, { name: 'Inner', ...layout })
    for (const name of ['A', 'B']) graph.createNode('FRAME', inner.id, { name, ...box })
    const inherited = sceneNodeToDesignDocument(graph, outer.id).children
    expect(styleOf(inherited, 'A')).toMatchObject({ 'margin-left': '-10px' })
    expect(styleOf(inherited, 'Inner')).toMatchObject({ 'padding-left': '10px' })
    // A row set left to right in a right-to-left one says so, and ends on its right.
    graph.updateNode(inner.id, { layoutDirection: 'LTR' })
    const explicit = sceneNodeToDesignDocument(graph, outer.id).children
    expect(styleOf(explicit, 'Inner')).toMatchObject({ direction: 'ltr', 'padding-right': '14px' })
    expect(styleOf(explicit, 'A')).toMatchObject({ 'margin-right': '-10px' })
    expect(styleOf(exportParent(layout, []), 'Parent')).not.toHaveProperty('direction')
    const alone = exportParent(layout, [{ name: 'A', ...box }])
    expect(styleOf(alone, 'A')).not.toHaveProperty('margin-right')
  })
})

describe('text lines in DOM/CSS export', () => {
  function textStyle(over: Partial<SceneNode>) {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      name: 'Text',
      text: 'Hi',
      ...over
    })
    return styleOf(sceneNodeToDesignDocument(graph, text.id).children, 'Text')
  }

  it('keeps a text within its min and max widths', () => {
    expect(textStyle({ minWidth: 100, maxWidth: 200 })).toMatchObject({
      'min-width': '100px',
      'max-width': '200px'
    })
  })

  it('shows a truncating text up to its line limit, ending with an ellipsis', () => {
    // On the page, text hugs its line, so it clamps as an inline box.
    expect(textStyle({ textTruncation: 'ENDING', maxLines: 2 })).toMatchObject({
      display: '-webkit-inline-box',
      '-webkit-line-clamp': '2',
      overflow: 'hidden',
      'white-space': 'pre-wrap'
    })
    expect(textStyle({ maxLines: 2 })).not.toHaveProperty('-webkit-line-clamp')
    expect(textStyle({ maxLines: 1 })).toMatchObject({ 'white-space': 'nowrap' })
  })

  it('clamps a truncating text in a frame as a block box', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Frame' })
    graph.createNode('TEXT', frame.id, {
      name: 'Text',
      text: 'Hi',
      textTruncation: 'ENDING',
      maxLines: 1
    })
    const style = styleOf(sceneNodeToDesignDocument(graph, frame.id).children, 'Text')
    expect(style).toMatchObject({ display: '-webkit-box', '-webkit-line-clamp': '1' })
  })

  it('trims a text to its cap height', () => {
    expect(textStyle({ leadingTrim: 'CAP_HEIGHT' })).toMatchObject({
      'text-box': 'trim-both cap alphabetic'
    })
    expect(textStyle({})).not.toHaveProperty('text-box')
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

  it('draws a stroke as shadows that take room only where the layout gives an inside stroke room', () => {
    const style = padding({})
    expect(style).toMatchObject({ 'padding-block': '1px', 'padding-inline': '24px' })
    expect(style).not.toHaveProperty('border')
    expect(style?.['box-shadow']).toBe('inset 0 0 0 2px #000000')
    expect(padding({ strokesIncludedInLayout: true })).toMatchObject({
      'padding-block': '3px',
      'padding-inline': '26px'
    })
    const outside = padding({
      strokes: [{ ...stroke, align: 'OUTSIDE' }],
      strokesIncludedInLayout: true
    })
    expect(outside).toMatchObject({
      'padding-block': '1px',
      'box-shadow': '0 0 0 2px #000000'
    })
    const centred = padding({ strokes: [{ ...stroke, align: 'CENTER' }] })
    expect(centred?.['box-shadow']).toBe('inset 0 0 0 1px #000000, 0 0 0 1px #000000')
  })

  it('takes back a negative gap past a border wider than the padding', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      name: 'Frame',
      layoutMode: 'HORIZONTAL',
      itemSpacing: -5,
      strokes: [{ ...stroke, weight: 10, dashPattern: [4, 2] }]
    })
    for (const name of ['A', 'B'])
      graph.createNode('FRAME', frame.id, { name, width: 20, height: 20 })
    const canvasMetrics = { autoLineHeight: () => undefined }
    const doc = sceneNodeToDesignDocument(graph, frame.id, { canvasMetrics }).children
    expect(styleOf(doc, 'Frame')).toMatchObject({ 'padding-right': '5px' })
  })

  it('keeps the stroke of an image a border, which the image would cover as a shadow', () => {
    const style = padding({
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'a',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    expect(style).toHaveProperty('border')
  })

  it('draws each side of a stroke with weights of its own as a band along that side', () => {
    const sides = padding({
      strokes: [{ ...stroke, align: 'CENTER' }],
      independentStrokeWeights: true,
      borderTopWeight: 4,
      borderRightWeight: 0,
      borderBottomWeight: 0,
      borderLeftWeight: 2
    })
    expect(sides?.['box-shadow']).toBe(
      'inset 0px 2px 0 0 #000000, 0px -2px 0 0 #000000, inset 1px 0px 0 0 #000000, -1px 0px 0 0 #000000'
    )
  })

  it('places the children of a frame whose stroke is a shadow where the canvas does', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      name: 'Frame',
      width: 200,
      height: 100,
      strokes: [{ ...stroke, weight: 4 }]
    })
    graph.createNode('FRAME', frame.id, { name: 'Child', x: 10, y: 12, width: 20, height: 20 })
    const child = (canvasMetrics?: { autoLineHeight: () => undefined }) =>
      styleOf(sceneNodeToDesignDocument(graph, frame.id, { canvasMetrics }).children, 'Child')
    expect(child({ autoLineHeight: () => undefined })).toMatchObject({ left: '10px', top: '12px' })
    // A border takes its weight from the box it places the child in.
    expect(child()).toMatchObject({ left: '6px', top: '8px' })
  })

  it('keeps a dashed stroke a border whose room the padding gives back, down to none', () => {
    const dashed = padding({ strokes: [{ ...stroke, dashPattern: [4, 2] }] })
    expect(dashed).toMatchObject({ 'padding-inline': '22px', 'border-style': 'dashed' })
    expect(dashed).not.toHaveProperty('padding-block')
  })

  it('keeps the border and its room in exported code', () => {
    expect(padding({}, false)).toMatchObject({
      border: '2px solid #000000',
      'padding-block': '1px',
      'padding-inline': '24px'
    })
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
