import { describe, expect, test } from 'bun:test'

import { createLinter, type LintMessage } from '@open-pencil/core/lint'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const BLUE = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
const LIGHT_GRAY = { r: 0.8, g: 0.8, b: 0.8, a: 1 }
const DARK_GREEN = { r: 25 / 255, g: 62 / 255, b: 51 / 255, a: 1 }

function solid(color: SceneNode['fills'][number]['color']): SceneNode['fills'] {
  return [{ type: 'SOLID', visible: true, opacity: 1, color }]
}

function lint(graph: SceneGraph, rule: string): LintMessage[] {
  const pageId = graph.getPages()[0].id
  return createLinter({ rules: [rule], config: { rules: { [rule]: 'warning' } } }).lintGraph(
    graph,
    [pageId]
  ).messages
}

function addColorVariable(graph: SceneGraph, id: string, name: string, color: typeof BLUE) {
  graph.addCollection({
    id: 'colors',
    name: 'Colors',
    modes: [{ modeId: 'light', name: 'Light' }],
    defaultModeId: 'light',
    variableIds: []
  })
  graph.addVariable({
    id,
    name,
    type: 'COLOR',
    collectionId: 'colors',
    valuesByMode: { light: color },
    description: '',
    hiddenFromPublishing: false
  })
}

describe('no-hardcoded-colors', () => {
  test('reports an unbound color only when a variable has the same value', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    addColorVariable(graph, 'blue', 'Colors/Blue/500', BLUE)
    const matching = graph.createNode('RECTANGLE', pageId, { name: 'Card', fills: solid(BLUE) })
    graph.createNode('RECTANGLE', pageId, { name: 'Tint', fills: solid(LIGHT_GRAY) })

    const messages = lint(graph, 'no-hardcoded-colors')

    expect(messages).toHaveLength(1)
    expect(messages[0]?.nodeId).toBe(matching.id)
    expect(messages[0]?.data).toEqual({
      paint: 'fill',
      index: 0,
      color: '#3B82F5',
      variableId: 'blue',
      variableName: 'Colors/Blue/500'
    })
  })

  test('stays quiet in a document without color variables', () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, { name: 'Card', fills: solid(BLUE) })
    expect(lint(graph, 'no-hardcoded-colors')).toEqual([])
  })
})

describe('color-contrast', () => {
  test('uses the resolved color of a bound text fill', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    addColorVariable(graph, 'muted', 'Text/Muted', LIGHT_GRAY)
    const card = graph.createNode('FRAME', pageId, { name: 'Card', fills: solid(WHITE) })
    const label = graph.createNode('TEXT', card.id, {
      name: 'Label',
      text: 'Hello',
      fills: solid({ r: 0, g: 0, b: 0, a: 1 })
    })
    graph.bindVariable(label.id, 'fills/0/color', 'muted')

    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([label.id])
    expect(messages[0]?.data).toMatchObject({
      minRatio: 4.5,
      foreground: '#CCCCCC',
      background: '#FFFFFF'
    })
  })

  test('large text needs 3:1, as WCAG AA asks of it', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card', fills: solid(WHITE) })
    // 3.2:1 against white.
    const grey = { r: 0.55, g: 0.55, b: 0.55, a: 1 }
    const text = (name: string, fontSize: number, fontWeight: number) =>
      graph.createNode('TEXT', card.id, {
        name,
        text: name,
        fontSize,
        fontWeight,
        fills: solid(grey)
      })
    const body = text('Body', 16, 400)
    const boldBody = text('Bold body', 18, 700)
    text('Display', 24, 400)
    text('Bold subhead', 19, 700)

    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([body.id, boldBody.id])
    expect(messages.map((message) => message.data?.minRatio)).toEqual([4.5, 4.5])
  })

  test('holds text to the strictest threshold any of its style runs needs', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card', fills: solid(WHITE) })
    // 3.2:1 against white: enough for large text, not for the rest.
    const grey = solid({ r: 0.55, g: 0.55, b: 0.55, a: 1 })
    const mixed = graph.createNode('TEXT', card.id, {
      name: 'Large with a small run',
      text: 'Heading note',
      fontSize: 24,
      fontWeight: 400,
      fills: grey,
      styleRuns: [{ start: 8, length: 4, style: { fontSize: 14 } }]
    })
    graph.createNode('TEXT', card.id, {
      name: 'Small made large throughout',
      text: 'Heading',
      fontSize: 14,
      fontWeight: 400,
      fills: grey,
      styleRuns: [{ start: 0, length: 7, style: { fontSize: 32 } }]
    })

    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([mixed.id])
    expect(messages[0]?.data?.minRatio).toBe(4.5)
  })

  test('does not use an ancestor fill when a filled sibling overlaps the text', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card', fills: solid(WHITE) })
    graph.createNode('VECTOR', card.id, {
      name: 'Background',
      width: 240,
      height: 120,
      fills: solid(DARK_GREEN)
    })
    graph.createNode('TEXT', card.id, {
      name: 'Label',
      text: 'Hello',
      x: 24,
      y: 46,
      width: 120,
      height: 30,
      fills: solid(WHITE)
    })

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('uses the ancestor fill when rotated sibling bounds overlap but the shapes do not', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      width: 320,
      height: 320,
      fills: solid(WHITE)
    })
    graph.createNode('VECTOR', card.id, {
      name: 'Disjoint rotated background',
      x: 170,
      y: 170,
      width: 100,
      height: 100,
      rotation: -45,
      fills: solid(DARK_GREEN)
    })
    const label = graph.createNode('TEXT', card.id, {
      name: 'Label',
      text: 'Hello',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 45,
      fills: solid(WHITE)
    })

    expect(lint(graph, 'color-contrast').map((message) => message.nodeId)).toEqual([label.id])
  })

  test('uses the ancestor fill when sibling fills do not affect the text background', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      width: 240,
      height: 120,
      fills: solid(WHITE)
    })
    graph.createNode('VECTOR', card.id, {
      name: 'Non-overlapping background',
      width: 10,
      height: 10,
      fills: solid(DARK_GREEN)
    })
    const label = graph.createNode('TEXT', card.id, {
      name: 'Label',
      text: 'Hello',
      x: 24,
      y: 46,
      width: 120,
      height: 30,
      fills: solid(WHITE)
    })

    graph.createNode('VECTOR', card.id, {
      name: 'Overlay',
      width: 240,
      height: 120,
      fills: solid(DARK_GREEN)
    })

    expect(lint(graph, 'color-contrast').map((message) => message.nodeId)).toEqual([label.id])
  })
})

describe('color-contrast over layers under the text', () => {
  const BLACK = { r: 0, g: 0, b: 0, a: 1 }

  /** A white card holding a dark background and, in a frame of its own, a label. */
  function card(background: Partial<SceneNode>, label: SceneNode['fills']) {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      width: 240,
      height: 120,
      fills: solid(WHITE)
    })
    graph.createNode('RECTANGLE', card.id, {
      name: 'Background',
      width: 240,
      height: 120,
      fills: solid(DARK_GREEN),
      ...background
    })
    const content = graph.createNode('FRAME', card.id, {
      name: 'Content',
      x: 24,
      y: 24,
      width: 192,
      height: 72
    })
    const text = graph.createNode('TEXT', content.id, {
      name: 'Label',
      text: 'Hello',
      width: 120,
      height: 30,
      fills: label
    })
    return { graph, text }
  }

  test('measures text against a layer under the frame that holds it', () => {
    expect(lint(card({}, solid(WHITE)).graph, 'color-contrast')).toEqual([])

    const { graph, text } = card({}, solid(BLACK))
    const messages = lint(graph, 'color-contrast')
    expect(messages.map((message) => message.nodeId)).toEqual([text.id])
    expect(messages[0]?.data?.background).toBe('#193E33')
  })

  test('skips text a layer under it covers only in part', () => {
    const { graph } = card({ width: 60 }, solid(WHITE))

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('composites a translucent layer under the text over the card', () => {
    const { graph, text } = card({ opacity: 0.1 }, solid(WHITE))
    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([text.id])
    expect(messages[0]?.data?.background).toBe('#E8ECEB')
  })

  test('applies a layer\'s opacity after compositing its fills', () => {
    // Black over white at half opacity is mid gray, not each fill at half strength.
    const fills = [...solid(WHITE), ...solid(BLACK)]
    const { graph, text } = card({ fills, opacity: 0.5 }, solid(WHITE))
    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([text.id])
    expect(messages[0]?.data?.background).toBe('#808080')
  })

  test('ignores a layer under the text that paints nothing', () => {
    const { graph, text } = card({ width: 60, fills: [] }, solid(WHITE))

    expect(lint(graph, 'color-contrast').map((message) => message.nodeId)).toEqual([text.id])
  })
})

describe('color-contrast over translucent fills', () => {
  const DARK = { r: 0.1, g: 0.1, b: 0.1, a: 1 }
  const tint = (opacity: number): SceneNode['fills'] => [
    { type: 'SOLID', visible: true, opacity, color: WHITE }
  ]

  function textOn(layers: SceneNode['fills'][], text: SceneNode['fills']) {
    const graph = new SceneGraph()
    let parentId = graph.getPages()[0].id
    for (const fills of layers) parentId = graph.createNode('FRAME', parentId, { fills }).id
    const label = graph.createNode('TEXT', parentId, { name: 'Label', text: 'Hi', fills: text })
    return { graph, label }
  }

  test('composites a translucent card over the opaque fill below it', () => {
    // A 10% white tint over a dark page stays dark: white text on it reads well.
    const { graph } = textOn([solid(DARK), tint(0.1)], solid(WHITE))

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('reports against the composited background', () => {
    // A 90% white tint over a dark page is nearly white: white text on it does not read.
    const { graph, label } = textOn([solid(DARK), tint(0.9)], solid(WHITE))
    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([label.id])
    expect(messages[0]?.data?.background).not.toBe('#FFFFFF')
  })

  test('composites translucent text over its background', () => {
    const faint: SceneNode['fills'] = [
      { type: 'SOLID', visible: true, opacity: 0.2, color: { r: 0, g: 0, b: 0, a: 1 } }
    ]
    const { graph, label } = textOn([solid(WHITE)], faint)

    expect(lint(graph, 'color-contrast').map((message) => message.nodeId)).toEqual([label.id])
  })

  test('skips text whose only backdrop is translucent', () => {
    const { graph } = textOn([tint(0.1)], solid(WHITE))

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('composites a translucent fill over an opaque fill on the same frame', () => {
    // The frame paints white, then a 10% dark tint over it: dark gray text on it does not read.
    const frame: SceneNode['fills'] = [
      ...solid(WHITE),
      { type: 'SOLID', visible: true, opacity: 0.1, color: DARK }
    ]
    const gray = solid({ r: 0.75, g: 0.75, b: 0.75, a: 1 })
    const { graph, label } = textOn([solid(DARK), frame], gray)
    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([label.id])
    expect(messages[0]?.data?.background).toBe('#E8E8E8')
  })

  test('composites every text fill in paint order', () => {
    // Half-white over black paints mid gray; the other way round, black would cover the white.
    const text: SceneNode['fills'] = [
      ...solid({ r: 0, g: 0, b: 0, a: 1 }),
      { type: 'SOLID', visible: true, opacity: 0.5, color: WHITE }
    ]
    const { graph, label } = textOn([solid(DARK)], text)
    const messages = lint(graph, 'color-contrast')

    expect(messages.map((message) => message.nodeId)).toEqual([label.id])
    expect(messages[0]?.data?.foreground).toBe('#808080')
  })

  test('skips text with a gradient in its fills', () => {
    const text: SceneNode['fills'] = [
      { type: 'GRADIENT_LINEAR', visible: true, opacity: 1, color: WHITE },
      { type: 'SOLID', visible: true, opacity: 0.5, color: WHITE }
    ]
    const { graph } = textOn([solid(WHITE)], text)

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('measures text whose gradient is covered by an opaque fill', () => {
    const text: SceneNode['fills'] = [
      { type: 'GRADIENT_LINEAR', visible: true, opacity: 1, color: WHITE },
      ...solid(WHITE)
    ]
    const { graph, label } = textOn([solid(WHITE)], text)

    expect(lint(graph, 'color-contrast').map((message) => message.nodeId)).toEqual([label.id])
  })

  test('skips text under a gradient that covers the opaque fill', () => {
    // A light gradient covers the dark fill: dark text on it is not dark on dark.
    const frame: SceneNode['fills'] = [
      ...solid(DARK),
      { type: 'GRADIENT_LINEAR', visible: true, opacity: 1, color: WHITE }
    ]
    const { graph } = textOn([frame], solid({ r: 0.15, g: 0.15, b: 0.15, a: 1 }))

    expect(lint(graph, 'color-contrast')).toEqual([])
  })

  test('skips fully transparent text', () => {
    const hidden: SceneNode['fills'] = [{ type: 'SOLID', visible: true, opacity: 0, color: WHITE }]
    const { graph } = textOn([solid(WHITE)], hidden)

    expect(lint(graph, 'color-contrast')).toEqual([])
  })
})

describe('no-deeply-nested', () => {
  test('reports only the layer that crosses the depth limit', () => {
    const graph = new SceneGraph()
    let parentId = graph.getPages()[0].id
    const chain: string[] = []
    for (let depth = 1; depth <= 9; depth++) {
      parentId = graph.createNode('FRAME', parentId, { name: `Level ${depth}` }).id
      chain.push(parentId)
    }

    const messages = lint(graph, 'no-deeply-nested')

    expect(messages.map((message) => message.nodeId)).toEqual([chain[6]])
    expect(messages[0]?.data).toEqual({ depth: 7, maxDepth: 6 })
  })
})

describe('touch-target-size', () => {
  test('treats a small control inside a larger control as part of that control', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const button = graph.createNode('FRAME', pageId, { name: 'Button', width: 120, height: 48 })
    graph.createNode('FRAME', button.id, { name: 'Close button', width: 16, height: 16 })
    const chip = graph.createNode('FRAME', pageId, { name: 'Chip', width: 60, height: 24 })

    const messages = lint(graph, 'touch-target-size')

    expect(messages.map((message) => message.nodeId)).toEqual([chip.id])
    expect(messages[0]?.data).toEqual({ width: 60, height: 24, minSize: 44 })
  })

  test('checks the controls in a row named in the plural, not the row', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const group = graph.createNode('FRAME', pageId, {
      name: 'Footer links',
      width: 280,
      height: 20
    })
    const first = graph.createNode('FRAME', group.id, { name: 'Link', width: 80, height: 20 })
    graph.createNode('RECTANGLE', group.id, { name: 'Divider', width: 1, height: 16 })
    const second = graph.createNode('FRAME', group.id, { name: 'Link', width: 80, height: 20 })

    const messages = lint(graph, 'touch-target-size')

    expect(messages.map((message) => message.nodeId)).toEqual([first.id, second.id])
  })

  test('keeps singularly named controls as targets even when they contain children', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const button = graph.createNode('FRAME', pageId, { name: 'Button', width: 40, height: 20 })
    graph.createNode('FRAME', button.id, { name: 'Icon', width: 16, height: 16 })

    expect(lint(graph, 'touch-target-size').map((message) => message.nodeId)).toEqual([button.id])
  })

  test('keeps a plural-named layer as a target when it has fewer than two children', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const group = graph.createNode('FRAME', pageId, { name: 'Links', width: 40, height: 20 })
    graph.createNode('FRAME', group.id, { name: 'Link', width: 80, height: 20 })

    expect(lint(graph, 'touch-target-size').map((message) => message.nodeId)).toEqual([group.id])
  })

  test('matches control names as whole words', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    graph.createNode('RECTANGLE', pageId, { name: 'Rectangle', width: 1, height: 80 })
    graph.createNode('FRAME', pageId, { name: 'Tablet preview', width: 20, height: 20 })
    const iconButton = graph.createNode('FRAME', pageId, {
      name: 'IconButton2',
      width: 32,
      height: 32
    })

    expect(lint(graph, 'touch-target-size').map((message) => message.nodeId)).toEqual([
      iconButton.id
    ])
  })

  test('checks the WCAG AA minimum in Recommended and the AAA size in Strict', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const input = graph.createNode('FRAME', pageId, { name: 'Input', width: 320, height: 40 })
    const chip = graph.createNode('FRAME', pageId, { name: 'Chip', width: 60, height: 20 })
    const flagged = (preset: string) =>
      createLinter({ preset, rules: ['touch-target-size'] })
        .lintGraph(graph, [pageId])
        .messages.map((message) => message.nodeId)

    expect(flagged('recommended')).toEqual([chip.id])
    expect(flagged('strict')).toEqual([input.id, chip.id])
  })

  test('does not treat icons as touch targets on their own', () => {
    const graph = new SceneGraph()
    graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Icon', width: 16, height: 16 })
    expect(lint(graph, 'touch-target-size')).toEqual([])
  })
})

describe('instances', () => {
  test('are checked themselves but not through their sublayers', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { name: 'Badge' })
    graph.createNode('TEXT', component.id, { name: 'Label', text: 'New', fontSize: 9 })
    const instance = graph.createInstance(component.id, pageId)
    if (!instance) throw new Error('Instance was not created')

    const messages = lint(graph, 'min-text-size')

    expect(messages).toHaveLength(1)
    expect(graph.getNode(messages[0]?.nodeId ?? '')?.parentId).toBe(component.id)
  })
})
