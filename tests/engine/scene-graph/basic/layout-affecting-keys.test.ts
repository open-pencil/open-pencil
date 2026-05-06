import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

describe('LAYOUT_AFFECTING_KEYS membership', () => {
  test('contains all direct transform properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of ['x', 'y', 'width', 'height', 'rotation', 'flipX', 'flipY']) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('contains all auto-layout properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of [
      'layoutMode',
      'layoutDirection',
      'itemSpacing',
      'counterAxisSpacing',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'paddingBottom',
      'primaryAxisAlign',
      'counterAxisAlign',
      'counterAxisAlignContent',
      'layoutWrap',
      'primaryAxisSizing',
      'counterAxisSizing',
      'layoutPositioning',
      'layoutGrow',
      'layoutAlignSelf',
      'strokesIncludedInLayout'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('contains grid and sizing constraint properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of [
      'gridTemplateColumns',
      'gridTemplateRows',
      'gridColumnGap',
      'gridRowGap',
      'gridPosition',
      'minWidth',
      'maxWidth',
      'minHeight',
      'maxHeight'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('does NOT contain visual-only properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of ['fills', 'strokes', 'effects', 'opacity', 'visible', 'name', 'pluginData']) {
      expect(keys.has(k)).toBe(false)
    }
  })

  test('has exactly the expected number of keys', () => {
    // x,y,width,height,rotation,flipX,flipY = 7
    // layoutMode,layoutDirection,itemSpacing,counterAxisSpacing = 4
    // paddingLeft,paddingRight,paddingTop,paddingBottom = 4
    // primaryAxisAlign,counterAxisAlign,counterAxisAlignContent = 3
    // layoutWrap,primaryAxisSizing,counterAxisSizing = 3
    // layoutPositioning,layoutGrow,layoutAlignSelf,strokesIncludedInLayout = 4
    // horizontalConstraint,verticalConstraint = 2
    // gridTemplateColumns,gridTemplateRows,gridColumnGap,gridRowGap,gridPosition = 5
    // minWidth,maxWidth,minHeight,maxHeight = 4
    // Total: 36
    expect(SceneGraph.LAYOUT_AFFECTING_KEYS.size).toBe(36)
  })
})
