import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, EDITOR_TOOLS, TOOL_SHORTCUTS, type Editor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

let editor: Editor

afterEach(() => editor.dispose())

function current(id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('missing layer')
  return node
}

test('Scale is K and sits in the Move flyout', () => {
  editor = createEditor()
  expect(TOOL_SHORTCUTS.K).toBe('SCALE')
  expect(EDITOR_TOOLS.find((tool) => tool.key === 'SELECT')?.flyout).toContain('SCALE')
})

test('picking the Scale tool puts its anchor at the center, as Figma does', () => {
  editor = createEditor()
  editor.setScaleAnchor({ x: 0, y: 1 })
  editor.setTool('SCALE')
  expect(editor.state.scaleAnchor).toEqual({ x: 0.5, y: 0.5 })
})

describe('scaleSelected', () => {
  test('scales text size and stroke weight as one undo step', () => {
    editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      x: 100,
      y: 50,
      width: 200,
      height: 80,
      text: 'Hello',
      fontSize: 20,
      strokeWeight: 2
    })
    editor.select([text.id])

    editor.scaleSelected(2, { x: 100, y: 50 })

    expect(current(text.id)).toMatchObject({ x: 100, y: 50, width: 400, fontSize: 40, strokeWeight: 4 })
    editor.undo.undo()
    expect(current(text.id)).toMatchObject({ width: 200, fontSize: 20, strokeWeight: 2 })
  })

  test('scales how far the lines of a fixed-size text reach past it, and undo puts it back', () => {
    editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      width: 100,
      height: 20,
      fontSize: 20,
      textAutoResize: 'NONE',
      derivedTextHeight: 60
    })
    editor.select([text.id])

    editor.scaleSelected(2, { x: 0, y: 0 })

    expect(current(text.id)).toMatchObject({ height: 40, fontSize: 40, derivedTextHeight: 120 })
    editor.undo.undo()
    expect(current(text.id)).toMatchObject({ height: 20, fontSize: 20, derivedTextHeight: 60 })
  })

  test('undo with no fonts rescales the reach someone else set since the scale', () => {
    editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      width: 100,
      height: 20,
      fontSize: 20,
      textAutoResize: 'NONE',
      derivedTextHeight: 36
    })
    editor.select([text.id])
    editor.scaleSelected(1.37, { x: 0, y: 0 })
    editor.undo.undo()
    expect(current(text.id).derivedTextHeight).toBe(36)
    editor.undo.redo()

    editor.graph.updateNode(text.id, { text: 'longer', derivedTextHeight: 137 })
    editor.undo.undo()
    expect(current(text.id).derivedTextHeight).toBeCloseTo(100)
    editor.graph.updateNode(text.id, { derivedTextHeight: 50 })
    editor.undo.redo()
    expect(current(text.id).derivedTextHeight).toBeCloseTo(68.5)
  })

  describe('with fonts to measure the lines in', () => {
    afterEach(() => setTextMeasurer(null))

    function measureLinesRoundedToPixels() {
      setTextMeasurer((node) => ({
        width: node.width,
        height: node.text.split('\n').length * Math.round(node.fontSize * 1.24)
      }))
    }

    function fixedText(text: string, derivedTextHeight: number) {
      const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
        width: 100,
        height: 20,
        fontSize: 10,
        text,
        textAutoResize: 'NONE',
        derivedTextHeight
      })
      editor.select([node.id])
      return node
    }

    test('measures the reach again, as lines rounded to whole pixels do not scale evenly', () => {
      editor = createEditor()
      measureLinesRoundedToPixels()
      const text = fixedText('a\nb\nc', 36)

      editor.scaleSelected(1.37, { x: 0, y: 0 })

      expect(current(text.id).derivedTextHeight).toBe(51)
    })

    test('undo measures the text as it is now, edited by someone else since the scale', () => {
      editor = createEditor()
      measureLinesRoundedToPixels()
      const text = fixedText('a\nb\nc', 36)
      editor.scaleSelected(2, { x: 0, y: 0 })

      editor.graph.updateNode(text.id, { text: 'a\nb\nc\nd\ne', derivedTextHeight: 125 })
      editor.undo.undo()
      expect(current(text.id)).toMatchObject({ fontSize: 10, derivedTextHeight: 60 })
      editor.undo.redo()
      expect(current(text.id)).toMatchObject({ fontSize: 20, derivedTextHeight: 125 })
    })

    test('keeps the scaled reach while the fonts cannot be measured', () => {
      editor = createEditor()
      setTextMeasurer(() => null)
      const text = fixedText('a\nb\nc', 36)

      editor.scaleSelected(1.5, { x: 0, y: 0 })

      expect(current(text.id).derivedTextHeight).toBe(54)
    })

    test('undo with no fonts puts back the reach the scale measured, not one the measure left', () => {
      editor = createEditor()
      measureLinesRoundedToPixels()
      const unmeasured = fixedText('a\nb\nc', 0)
      editor.graph.updateNode(unmeasured.id, { derivedTextHeight: null })
      const measured = fixedText('a\nb\nc', 36)
      editor.select([unmeasured.id, measured.id])
      editor.scaleSelected(0.6, { x: 0, y: 0 })
      expect(current(unmeasured.id).derivedTextHeight).toBe(21)

      setTextMeasurer(null)
      editor.undo.undo()
      expect(current(unmeasured.id)).toMatchObject({ fontSize: 10, derivedTextHeight: null })
      expect(current(measured.id)).toMatchObject({ fontSize: 10, derivedTextHeight: 36 })
      editor.undo.redo()
      expect(current(unmeasured.id).derivedTextHeight).toBe(21)
      expect(current(measured.id).derivedTextHeight).toBe(21)
    })

    test('undo with no fonts keeps a reach the scale measured back to where it was', () => {
      editor = createEditor()
      setTextMeasurer((node) => ({ width: node.width, height: 36 }))
      const text = fixedText('a\nb\nc', 36)
      editor.scaleSelected(2, { x: 0, y: 0 })
      expect(current(text.id).derivedTextHeight).toBe(36)

      setTextMeasurer(null)
      editor.undo.undo()
      expect(current(text.id)).toMatchObject({ fontSize: 10, derivedTextHeight: 36 })
    })

    test('measures the reach at the width auto layout stretches the text to', () => {
      editor = createEditor()
      setTextMeasurer((node) => ({
        width: node.width,
        height: Math.ceil((node.text.length * node.fontSize) / node.width) * node.fontSize
      }))
      const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 100,
        height: 200,
        layoutMode: 'VERTICAL'
      })
      const text = editor.graph.createNode('TEXT', frame.id, {
        width: 100,
        height: 10,
        fontSize: 10,
        text: 'abcdefghijklmnopqrst',
        textAutoResize: 'NONE',
        layoutAlignSelf: 'STRETCH',
        derivedTextHeight: 20
      })
      editor.select([text.id])

      editor.scaleSelected(2, { x: 0, y: 0 })

      expect(current(text.id)).toMatchObject({ width: 100, fontSize: 20, derivedTextHeight: 80 })
    })

    test('leaves a text that sizes itself without a reach', () => {
      editor = createEditor()
      measureLinesRoundedToPixels()
      const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
        width: 100,
        height: 36,
        fontSize: 10,
        text: 'a\nb\nc',
        textAutoResize: 'HEIGHT'
      })
      editor.select([text.id])

      editor.scaleSelected(2, { x: 0, y: 0 })

      expect(current(text.id).derivedTextHeight).toBeNull()
    })
  })

  test('undoing a scale keeps the selection, a later edit to the layer, and a layer added since', () => {
    editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 100,
      height: 100,
      name: 'Card'
    })
    editor.select([frame.id])
    editor.scaleSelected(2, { x: 0, y: 0 })

    // As a collaborator's edits arrive: outside the history, one to a field Scale leaves as is.
    editor.graph.updateNode(frame.id, { name: 'Renamed', strokeMiterLimit: 10 })
    const added = editor.graph.createNode('RECTANGLE', frame.id, { width: 10, height: 10 })

    editor.undo.undo()
    expect(current(frame.id)).toMatchObject({ width: 100, name: 'Renamed', strokeMiterLimit: 10 })
    expect([...editor.state.selectedIds]).toEqual([frame.id])
    expect(editor.graph.getNode(added.id)?.parentId).toBe(frame.id)
  })

  test('scales an auto layout frame padding, gap, and text', () => {
    editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 100,
      height: 100,
      layoutMode: 'VERTICAL',
      paddingTop: 10,
      paddingLeft: 10,
      itemSpacing: 10
    })
    const text = editor.graph.createNode('TEXT', frame.id, { text: 'Hi', fontSize: 10 })
    editor.select([frame.id])

    editor.scaleSelected(2, { x: 0, y: 0 })

    expect(current(frame.id)).toMatchObject({ paddingTop: 20, itemSpacing: 20 })
    expect(current(text.id).fontSize).toBe(20)
  })

  test('scales layers in one parent as one box about the anchor', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const left = editor.graph.createNode('RECTANGLE', page, { width: 50, height: 50 })
    const right = editor.graph.createNode('RECTANGLE', page, { x: 100, width: 50, height: 50 })
    editor.select([left.id, right.id])

    // The center of their 150×50 box stays put.
    editor.scaleSelected(2, { x: 75, y: 25 })

    expect(current(left.id)).toMatchObject({ x: -75, y: -25, width: 100 })
    expect(current(right.id)).toMatchObject({ x: 125, y: -25, width: 100 })
  })

  // Measured in Figma: a 200×100 frame scaled 1.5× from its top-left, then from its center.
  test('leaves locked layers, and what they hold, at their size and place in the parent', () => {
    editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 200,
      height: 100
    })
    const locked = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 100,
      y: 50,
      width: 40,
      height: 20,
      strokeWeight: 2,
      locked: true
    })
    const lockedFrame = editor.graph.createNode('FRAME', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      locked: true
    })
    const inside = editor.graph.createNode('RECTANGLE', lockedFrame.id, {
      x: 5,
      y: 5,
      width: 10,
      height: 10
    })
    const plain = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 150,
      y: 10,
      width: 20,
      height: 20
    })
    editor.select([frame.id])

    editor.scaleSelected(1.5, { x: 100, y: 50 })

    expect(current(frame.id)).toMatchObject({ x: -50, y: -25, width: 300, height: 150 })
    expect(current(locked.id)).toMatchObject({ x: 100, y: 50, width: 40, strokeWeight: 2 })
    expect(current(lockedFrame.id)).toMatchObject({ x: 20, y: 20, width: 40 })
    expect(current(inside.id)).toMatchObject({ x: 5, y: 5, width: 10 })
    expect(current(plain.id)).toMatchObject({ x: 225, y: 15, width: 30 })
  })

  test('scales a turned layer in its own frame, keeping its angle and the anchor', () => {
    editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      rotation: 30
    })
    editor.select([rect.id])
    const corner = (id: string) => {
      const [x, y] = Matrix.mapPoints(getWorldMatrix(current(id), editor.graph), [0, 0])
      return { x, y }
    }
    const anchor = corner(rect.id)

    editor.scaleSelected(1.2, anchor)

    expect(current(rect.id).rotation).toBeCloseTo(30)
    expect(current(rect.id).width).toBeCloseTo(240)
    expect(current(rect.id).height).toBeCloseTo(120)
    expect(corner(rect.id).x).toBeCloseTo(anchor.x)
    expect(corner(rect.id).y).toBeCloseTo(anchor.y)
  })

  test('scales an instance by its occurrence scale and leaves its main component', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, { width: 200, height: 100 })
    editor.graph.createNode('TEXT', component.id, { text: 'Hi', fontSize: 20 })
    const instance = editor.graph.createInstance(component.id, page, { x: 300 })
    if (!instance) throw new Error('no instance')
    editor.select([instance.id])

    editor.scaleSelected(1.5, { x: 300, y: 0 })

    const [text] = editor.graph.getChildren(instance.id)
    expect(current(instance.id)).toMatchObject({ width: 300, componentScale: 1.5 })
    expect(text.fontSize).toBe(30)
    expect(current(component.id).width).toBe(200)
  })
})
